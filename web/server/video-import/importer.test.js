import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createVideoImporter } from './importer.js'
import { VideoImportError } from './errors.js'

let root
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'acecam-import-test-')) })
afterEach(async () => {
  if (dirname(resolve(root)) !== resolve(tmpdir())) throw new Error('Invalid test cleanup target.')
  await rm(root, { recursive: true, force: true })
})

function setup(options = {}) {
  const receipts = new Map()
  const authorize = vi.fn(async () => ({ orgId: 'org1', actorId: 'user1' }))
  const store = {
    find: vi.fn(async ({ orgId, matchId }) => receipts.get(`${orgId}/${matchId}`)),
    putIfAbsent: vi.fn(async record => {
      // A local fixture, not an implementation of atomic cloud persistence.
      expect(await readFile(record.localPath, 'utf8')).toBe('video-bytes')
      const receipt = { orgId: record.orgId, actorId: record.actorId, matchId: record.matchId, sourceHash: record.sourceHash, videoPath: `orgs/${record.orgId}/matches/${record.matchId}/video.mp4` }
      receipts.set(`${record.orgId}/${record.matchId}`, receipt)
      return receipt
    }),
  }
  const download = vi.fn(async ({ destination }) => {
    await writeFile(destination, 'video-bytes', { flag: 'wx' })
    return { bytes: 11, sha256: createHash('sha256').update('video-bytes').digest('hex') }
  })
  const probe = vi.fn(async () => ({ durationSeconds: 20, width: 1920, height: 1080 }))
  const make = extra => createVideoImporter({ authorize, store, download, probe, maxBytes: 100, tempRoot: root, ...options, ...extra })
  return { importVideo: make(), make, authorize, store, download, probe, receipts, input: { url: 'https://media.example.com/match.mp4?token=private', matchId: 'm1', requestContext: { authorization: 'server-request' } } }
}

describe('Núcleo de importación (Auth y Storage simulados)', () => {
  it('usa la identidad verificada, comprueba el archivo y devuelve ruta solo tras guardar', async () => {
    const { importVideo, authorize, store, download, probe, input } = setup()
    expect(await importVideo({ ...input, orgId: 'attacker-org', actorId: 'attacker-user', maxBytes: 999999 })).toBe('orgs/org1/matches/m1/video.mp4')
    expect(authorize).toHaveBeenCalledWith(input.requestContext)
    expect(download.mock.calls[0][0].maxBytes).toBe(100)
    expect(probe).toHaveBeenCalledTimes(1)
    const record = store.putIfAbsent.mock.calls[0][0]
    expect(record).toMatchObject({ orgId: 'org1', actorId: 'user1', bytes: 11, metadata: { width: 1920 } })
    expect(JSON.stringify(record)).not.toContain('private')
    expect(await readdir(root)).toEqual([])
  })

  it('reutiliza un recibo persistido tras reiniciar el servicio y rechaza otro enlace o usuario', async () => {
    const { importVideo, make, download, store, authorize, input } = setup()
    await importVideo(input)
    expect(await make()(input)).toBe('orgs/org1/matches/m1/video.mp4')
    expect(download).toHaveBeenCalledTimes(1)
    expect(store.putIfAbsent).toHaveBeenCalledTimes(1)
    await expect(make()({ ...input, url: 'https://media.example.com/other.mp4' })).rejects.toMatchObject({ code: 'import/conflict' })
    authorize.mockResolvedValue({ orgId: 'org1', actorId: 'other-user' })
    await expect(make()(input)).rejects.toMatchObject({ code: 'import/conflict' })
  })

  it('no realiza descarga, consulta de Storage ni temporales si falla la autorización', async () => {
    const { importVideo, authorize, download, store, input } = setup()
    authorize.mockRejectedValue(new Error('sensitive-auth-error'))
    await expect(importVideo(input)).rejects.toMatchObject({ code: 'import/permission', message: expect.not.stringContaining('sensitive') })
    expect(store.find).not.toHaveBeenCalled()
    expect(download).not.toHaveBeenCalled()
    expect(await readdir(root)).toEqual([])
  })

  it('limpia temporales y no guarda si falla el formato o la descarga', async () => {
    const { importVideo, probe, store, download, input } = setup()
    probe.mockRejectedValueOnce(new VideoImportError('format', 'Video inválido'))
    await expect(importVideo(input)).rejects.toMatchObject({ code: 'import/format' })
    expect(store.putIfAbsent).not.toHaveBeenCalled()
    expect(await readdir(root)).toEqual([])
    download.mockImplementationOnce(async ({ destination }) => { await writeFile(destination, 'partial'); throw new Error('signed URL secret') })
    await expect(importVideo(input)).rejects.toMatchObject({ code: 'import/failed', message: expect.not.stringContaining('secret') })
    expect(await readdir(root)).toEqual([])
  })

  it('permite reintentar tras fallo de Storage sin reutilizar un archivo incompleto', async () => {
    const { importVideo, store, input } = setup()
    store.putIfAbsent.mockRejectedValueOnce(new Error('upload failed'))
    await expect(importVideo(input)).rejects.toMatchObject({ code: 'import/failed' })
    expect(await readdir(root)).toEqual([])
    expect(await importVideo(input)).toBe('orgs/org1/matches/m1/video.mp4')
  })

  it('impide persistir cuando el tamaño real no coincide o supera el límite', async () => {
    const { importVideo, download, probe, store, input } = setup()
    download.mockImplementationOnce(async ({ destination }) => { await writeFile(destination, Buffer.alloc(101)); return { bytes: 101, sha256: 'a'.repeat(64) } })
    await expect(importVideo(input)).rejects.toMatchObject({ code: 'import/size' })
    expect(probe).not.toHaveBeenCalled()
    expect(store.putIfAbsent).not.toHaveBeenCalled()
    expect(await readdir(root)).toEqual([])
  })

  it('propaga cancelación, no guarda y libera la capacidad para otro intento', async () => {
    const { importVideo, download, store, input } = setup()
    const controller = new AbortController()
    download.mockImplementationOnce(async ({ destination }) => {
      await writeFile(destination, 'partial')
      controller.abort()
      throw controller.signal.reason
    })
    await expect(importVideo({ ...input, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(store.putIfAbsent).not.toHaveBeenCalled()
    expect(await readdir(root)).toEqual([])
    expect(await importVideo(input)).toBe('orgs/org1/matches/m1/video.mp4')
  })

  it('limita concurrencia y rechaza envíos simultáneos del mismo partido', async () => {
    const { make, download, input } = setup({ maxConcurrent: 1 })
    let release
    const ready = new Promise(resolve => { release = resolve })
    const original = download.getMockImplementation()
    download.mockImplementationOnce(async (...args) => { await ready; return original(...args) })
    const importVideo = make()
    const first = importVideo(input)
    await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    await expect(importVideo(input)).rejects.toMatchObject({ code: 'import/busy' })
    await expect(importVideo({ ...input, matchId: 'm2' })).rejects.toMatchObject({ code: 'import/busy' })
    release()
    await first
    expect(await importVideo({ ...input, matchId: 'm2' })).toBe('orgs/org1/matches/m2/video.mp4')
  })

  it('no devuelve rutas públicas, recibos de otra organización ni IDs con directorios', async () => {
    const { importVideo, store, input } = setup()
    await expect(importVideo({ ...input, matchId: '../m1' })).rejects.toMatchObject({ code: 'import/input' })
    store.putIfAbsent.mockImplementationOnce(async record => ({ ...record, orgId: 'other-org', videoPath: 'https://public.example/video.mp4' }))
    await expect(importVideo(input)).rejects.toMatchObject({ code: 'import/conflict' })
    expect(await readdir(root)).toEqual([])
  })
})
