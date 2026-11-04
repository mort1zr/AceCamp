import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { createFirestoreAnalysisService } from './firestoreAnalysisService.js'
import { createHttpVideoImporter } from './httpVideoImportService.js'
import { createVideoImportHttpHandler } from '../../../server/video-import/http.js'

vi.mock('firebase/firestore', () => ({ collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), onSnapshot: vi.fn(), query: vi.fn(), runTransaction: vi.fn(), serverTimestamp: vi.fn(), where: vi.fn() }))
const absent = { exists: () => false }
const db = { app: { options: { projectId: 'test' } } }
const input = { sourceType: 'file', file: { name: 'video.mp4', type: 'video/mp4', size: 50, lastModified: 1 }, playerId: 'p1', playerPosition: 'arriba', opponent: 'Rival', matchDate: '2026-01-01', orgId: 'forged', status: 'listo' }
let tx
let upload
const matchPath = (matchId, orgId = 'org-a') => `orgs/${orgId}/matches/${matchId}/video.mp4`

beforeEach(() => {
  vi.resetAllMocks()
  collection.mockReturnValue({ kind: 'collection' })
  doc.mockImplementation((first, second, third) => first === db ? { kind: second, id: third } : { kind: 'match', id: second ?? 'generated-id' })
  getDoc.mockImplementation(ref => Promise.resolve(ref.kind === 'players' ? { exists: () => true, data: () => ({ orgId: 'org-a' }) } : absent))
  tx = { get: vi.fn().mockResolvedValue(absent), set: vi.fn() }
  runTransaction.mockImplementation((_, work) => work(tx))
  serverTimestamp.mockReturnValue('server-time')
  upload = vi.fn(async ({ matchId, orgId }) => matchPath(matchId, orgId))
})

const make = options => createFirestoreAnalysisService({ db, orgId: 'org-a', actorId: 'coach-a', uploadVideo: upload, maxBytes: 100, ...options })

describe('Cola Firestore (SDK y transferencias simulados)', () => {
  it('exige capacidad explícita del adaptador antes de aceptar YouTube y no guarda su URL', async () => {
    const importer = vi.fn(async () => matchPath('youtube-match'))
    const link = { ...input, sourceType: 'link', url: 'https://youtu.be/abcdefghijk?si=example' }
    expect(make({ importVideo: importer }).supportsYouTube).toBe(false)
    await expect(make({ importVideo: importer }).enqueue(link, { requestId: 'youtube-match' })).rejects.toMatchObject({ code: 'analysis/validation' })
    expect(importer).not.toHaveBeenCalled()
    importer.supportsYouTube = true
    const service = make({ importVideo: importer })
    expect(service.supportsYouTube).toBe(true)
    await service.enqueue(link, { requestId: 'youtube-match' })
    expect(tx.set.mock.calls[0][1]).toMatchObject({ videoPath: matchPath('youtube-match'), status: 'en cola' })
    expect(JSON.stringify(tx.set.mock.calls[0][1])).not.toContain('youtu.be')
  })

  it('espera la respuesta del contrato HTTP antes de encolar un enlace y omite sus tokens', async () => {
    const origin = 'https://acecam.example'
    let finish
    const backend = vi.fn(() => new Promise(resolve => { finish = resolve }))
    const handler = createVideoImportHttpHandler({ origin, importVideo: backend })
    const importVideo = createHttpVideoImporter({
      enabled: true, origin, endpoint: '/api/video-import',
      getSession: async () => ({ orgId: 'org-a', actorId: 'coach-a', token: 'test-verified-token' }),
      fetcher: (url, options) => handler(new Request(url, options)),
    })
    const operation = make({ importVideo }).enqueue({ ...input, sourceType: 'link', url: 'https://media.example/video.mp4?signature=secret' }, { requestId: 'http-match' })
    await vi.waitFor(() => expect(backend).toHaveBeenCalledOnce())
    expect(tx.set).not.toHaveBeenCalled()
    expect(backend.mock.calls[0][0]).toMatchObject({ matchId: 'http-match', requestContext: { bearerToken: 'test-verified-token' } })
    finish(matchPath('http-match'))
    await operation
    expect(tx.set.mock.calls[0][1]).toMatchObject({ videoPath: matchPath('http-match'), status: 'en cola', orgId: 'org-a' })
    expect(JSON.stringify(tx.set.mock.calls[0][1])).not.toMatch(/signature=secret|test-verified-token/)
  })

  it('no encola si la API rechaza la sesión o devuelve una ruta no válida', async () => {
    const origin = 'https://acecam.example'
    const backend = vi.fn().mockRejectedValueOnce({ code: 'import/permission' }).mockResolvedValueOnce('https://public.example/video.mp4')
    const handler = createVideoImportHttpHandler({ origin, importVideo: backend })
    const importVideo = createHttpVideoImporter({
      enabled: true, origin, endpoint: '/api/video-import',
      getSession: async () => ({ orgId: 'org-a', actorId: 'coach-a', token: 'test-verified-token' }),
      fetcher: (url, options) => handler(new Request(url, options)),
    })
    const service = make({ importVideo })
    const link = { ...input, sourceType: 'link', url: 'https://media.example/video.mp4' }
    await expect(service.enqueue(link, { requestId: 'http-match' })).rejects.toMatchObject({ code: 'import/permission' })
    await expect(service.enqueue(link, { requestId: 'http-match' })).rejects.toMatchObject({ code: 'import/failed' })
    expect(tx.set).not.toHaveBeenCalled()
  })

  it('encola solo después de subir y usa la identidad de sesión', async () => {
    let finish
    upload.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const service = make()
    const operation = service.enqueue(input, { requestId: 'request-1' })
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    expect(runTransaction).not.toHaveBeenCalled()
    finish(matchPath('request-1'))
    await operation
    expect(tx.set.mock.calls[0][1]).toMatchObject({ orgId: 'org-a', createdBy: 'coach-a', playerId: 'p1', status: 'en cola', videoPath: matchPath('request-1'), createdAt: 'server-time' })
    expect(tx.set.mock.calls[0][1]).not.toHaveProperty('file')
  })

  it('no encola una ruta de otro partido u organización y permite reintentar', async () => {
    const service = make()
    const options = { requestId: 'r1' }
    upload.mockResolvedValueOnce(matchPath('r1', 'org-b')).mockResolvedValueOnce(matchPath('r2'))
    await expect(service.enqueue(input, options)).rejects.toMatchObject({ code: 'analysis/video-path' })
    await expect(service.enqueue(input, options)).rejects.toMatchObject({ code: 'analysis/video-path' })
    expect(runTransaction).not.toHaveBeenCalled()
    await expect(service.enqueue(input, options)).resolves.toMatchObject({ videoPath: matchPath('r1') })
    expect(tx.set).toHaveBeenCalledOnce()
  })

  it('rechaza jugadores de otra organización antes de transferir el video', async () => {
    getDoc.mockImplementation(ref => Promise.resolve(ref.kind === 'players' ? { exists: () => true, data: () => ({ orgId: 'org-b' }) } : absent))
    await expect(make().enqueue(input, { requestId: 'r1' })).rejects.toMatchObject({ code: 'analysis/player' })
    expect(upload).not.toHaveBeenCalled()
    expect(tx.set).not.toHaveBeenCalled()
  })

  it('conserva la subida al reintentar un fallo de guardado y comparte envíos simultáneos', async () => {
    const service = make()
    runTransaction.mockRejectedValueOnce({ code: 'unavailable' })
    await expect(service.enqueue(input, { requestId: 'r1' })).rejects.toMatchObject({ code: 'unavailable' })
    const first = service.enqueue(input, { requestId: 'r1' })
    const second = service.enqueue(input, { requestId: 'r1' })
    expect(first).toBe(second)
    await first
    expect(upload).toHaveBeenCalledTimes(1)
    expect(tx.set).toHaveBeenCalledTimes(1)
  })

  it('una cancelación al finalizar la transferencia no crea un partido', async () => {
    const controller = new AbortController()
    upload.mockImplementation(async () => { controller.abort(); return matchPath('r1') })
    await expect(make().enqueue(input, { requestId: 'r1', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(tx.set).not.toHaveBeenCalled()
  })

  it('un fallo de subida no encola; un enlace usa el importador sin persistir su URL', async () => {
    upload.mockRejectedValueOnce(new Error('upload failed'))
    await expect(make().enqueue(input, { requestId: 'r1' })).rejects.toThrow('upload failed')
    expect(tx.set).not.toHaveBeenCalled()
    const importer = vi.fn().mockResolvedValue(matchPath('r2'))
    await make({ importVideo: importer }).enqueue({ ...input, sourceType: 'link', url: 'https://ejemplo.com/video.mp4?signature=secret' }, { requestId: 'r2' })
    expect(importer).toHaveBeenCalledTimes(1)
    const data = tx.set.mock.calls[0][1]
    expect(JSON.stringify(data)).not.toContain('signature=secret')
    expect(data.inputFingerprint).toMatch(/^[a-f0-9]{64}$/)
  })

  it('un reintento no devuelve un partido ajeno ni sobrescribe un estado avanzado', async () => {
    const service = make()
    const saved = await service.enqueue(input, { requestId: 'r1' })
    tx.set.mockClear()
    tx.get.mockResolvedValue({ exists: () => true, data: () => ({ ...saved, status: 'procesando' }) })
    const duplicate = await service.enqueue(input, { requestId: 'r1' })
    expect(duplicate.status).toBe('procesando')
    expect(tx.set).not.toHaveBeenCalled()
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ ...saved, orgId: 'org-b' }) })
    await expect(service.enqueue(input, { requestId: 'r1' })).rejects.toThrow('Conflicting request')
  })

  it('filtra la cola por organización y no permite enlaces sin importador', async () => {
    const stop = vi.fn()
    onSnapshot.mockReturnValue(stop)
    const service = make()
    expect(service.subscribe(vi.fn(), vi.fn())).toBe(stop)
    expect(where).toHaveBeenCalledWith('orgId', '==', 'org-a')
    expect(query).toHaveBeenCalled()
    await expect(service.enqueue({ ...input, sourceType: 'link', url: 'https://ejemplo.com/v.mp4' }, { requestId: 'r1' })).rejects.toMatchObject({ code: 'analysis/validation' })
    expect(upload).not.toHaveBeenCalled()
  })
})
