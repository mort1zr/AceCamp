import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { createHash } from 'node:crypto'
import { createPublicVideoDownloader, isPublicAddress } from './download.js'

let directory
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'acecam-download-test-')) })
afterEach(async () => {
  if (dirname(resolvePath(directory)) !== resolvePath(tmpdir())) throw new Error('Invalid test cleanup target.')
  await rm(directory, { recursive: true, force: true })
})

function setup(responses = [{}], options = {}) {
  const resolve = vi.fn(async () => [{ address: '8.8.8.8', family: 4 }])
  const bodies = []
  const request = vi.fn((_url, _options, receive) => {
    const req = new EventEmitter()
    req.end = () => {
      const entry = responses.shift() ?? {}
      const body = Readable.from(entry.chunks ?? [Buffer.from('video-bytes')])
      Object.assign(body, { statusCode: entry.statusCode ?? 200, headers: { 'content-type': 'video/mp4', ...entry.headers } })
      bodies.push(body)
      queueMicrotask(() => receive(body))
    }
    return req
  })
  const download = createPublicVideoDownloader({ allowedHosts: ['media.example.com', 'cdn.example.com'], resolve, request, ...options })
  return { download, request, resolve, bodies, input: { url: 'https://media.example.com/match.mp4', maxBytes: 100, destination: join(directory, 'video') } }
}

describe('Descarga pública de video (transporte simulado, sin red externa)', () => {
  it('escribe los bytes reales, calcula la huella y fija la IP ya comprobada', async () => {
    const { download, request, input } = setup()
    const progress = vi.fn()
    const result = await download({ ...input, onProgress: progress })
    expect(await readFile(input.destination, 'utf8')).toBe('video-bytes')
    expect(result).toEqual({ bytes: 11, sha256: createHash('sha256').update('video-bytes').digest('hex') })
    expect(progress).toHaveBeenLastCalledWith({ bytes: 11, totalBytes: null })
    const options = request.mock.calls[0][1]
    expect(options).toMatchObject({ agent: false, autoSelectFamily: false, headers: { 'Accept-Encoding': 'identity' } })
    const callback = vi.fn()
    options.lookup('media.example.com', { all: true }, callback)
    expect(callback).toHaveBeenCalledWith(null, [{ address: '8.8.8.8', family: 4 }])
  })

  it('rechaza destinos privados, locales, reservados y variantes IPv4 dentro de IPv6', async () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '192.0.2.1', '::1', 'fc00::1', 'fe80::1', '2001:db8::1', '::ffff:127.0.0.1']) expect(isPublicAddress(address), address).toBe(false)
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true)
    const { download, resolve, request, input } = setup()
    resolve.mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }])
    await expect(download(input)).rejects.toMatchObject({ code: 'import/destination' })
    expect(request).not.toHaveBeenCalled()
  })

  it('rechaza URL con credenciales, IP, puerto, proveedor no autorizado y páginas de YouTube', async () => {
    const { download, resolve, request, input } = setup()
    for (const url of ['http://media.example.com/a.mp4', 'https://u:p@media.example.com/a.mp4', 'https://media.example.com:8443/a.mp4', 'https://media.example.com/a.mp4#token', 'https://127.0.0.1/a.mp4', 'https://media.example.com.attacker.example/a.mp4', 'https://youtube.com/watch?v=abcdefghijk']) await expect(download({ ...input, url })).rejects.toMatchObject({ code: 'import/source' })
    expect(resolve).not.toHaveBeenCalled()
    expect(request).not.toHaveBeenCalled()
  })

  it('revalida DNS y destino en cada redirección antes de conectar', async () => {
    const { download, resolve, request, bodies, input } = setup([{ statusCode: 302, headers: { location: 'https://cdn.example.com/video' } }])
    resolve.mockResolvedValueOnce([{ address: '8.8.8.8', family: 4 }]).mockResolvedValueOnce([{ address: '169.254.169.254', family: 4 }])
    await expect(download(input)).rejects.toMatchObject({ code: 'import/destination' })
    expect(request).toHaveBeenCalledTimes(1)
    expect(bodies[0].destroyed).toBe(true)
    const blocked = setup([{ statusCode: 302, headers: { location: 'https://private.example/video.mp4' } }])
    await expect(blocked.download(blocked.input)).rejects.toMatchObject({ code: 'import/source' })
    expect(blocked.request).toHaveBeenCalledTimes(1)
  })

  it('permite redirección pública autorizada y limita bucles', async () => {
    const accepted = setup([{ statusCode: 302, headers: { location: 'https://cdn.example.com/opaque' } }, {}])
    expect((await accepted.download(accepted.input)).bytes).toBe(11)
    expect(accepted.request).toHaveBeenCalledTimes(2)
    const loop = setup(Array.from({ length: 4 }, () => ({ statusCode: 302, headers: { location: '/again.mp4' } })), { maxRedirects: 2 })
    await expect(loop.download({ ...loop.input, destination: join(directory, 'loop') })).rejects.toMatchObject({ code: 'import/redirect' })
    expect(loop.request).toHaveBeenCalledTimes(3)
  })

  it('cuenta el cuerpo aunque falte Content-Length y no acepta límites falsos', async () => {
    const tooLarge = setup([{ chunks: [Buffer.alloc(60), Buffer.alloc(41)] }])
    await expect(tooLarge.download(tooLarge.input)).rejects.toMatchObject({ code: 'import/size' })
    const lied = setup([{ headers: { 'content-length': '5' } }])
    await expect(lied.download({ ...lied.input, destination: join(directory, 'lied') })).rejects.toMatchObject({ code: 'import/size' })
    const declared = setup([{ headers: { 'content-length': '101' } }])
    await expect(declared.download(declared.input)).rejects.toMatchObject({ code: 'import/size' })
    const empty = setup([{ chunks: [] }])
    await expect(empty.download({ ...empty.input, destination: join(directory, 'empty') })).rejects.toMatchObject({ code: 'import/size' })
  })

  it('rechaza HTML, compresión y enlaces privados/no disponibles', async () => {
    for (const [entry, code] of [[{ headers: { 'content-type': 'text/html' } }, 'format'], [{ headers: { 'content-encoding': 'gzip' } }, 'format'], [{ statusCode: 403 }, 'unavailable']]) {
      const { download, input } = setup([entry])
      await expect(download(input)).rejects.toMatchObject({ code: `import/${code}` })
    }
  })

  it('cancela antes de conectar y acota incluso una resolución DNS sin respuesta', async () => {
    const cancelled = setup()
    const controller = new AbortController()
    controller.abort()
    await expect(cancelled.download({ ...cancelled.input, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(cancelled.request).not.toHaveBeenCalled()
    const stalled = setup([], { timeoutMs: 20 })
    stalled.resolve.mockImplementation(() => new Promise(() => {}))
    await expect(stalled.download(stalled.input)).rejects.toMatchObject({ code: 'import/timeout' })
    expect(stalled.request).not.toHaveBeenCalled()
  })

  it('no devuelve errores de red que puedan contener tokens del enlace', async () => {
    const { download, resolve, input } = setup()
    resolve.mockRejectedValue(new Error('https://media.example.com/a.mp4?secret=token'))
    await expect(download(input)).rejects.toMatchObject({ code: 'import/download', message: expect.not.stringContaining('secret') })
  })

  it('interrumpe un cuerpo en transferencia al cancelar, sin devolver un video completo', async () => {
    const controller = new AbortController()
    const chunks = (async function* () {
      yield Buffer.from('partial')
      controller.abort()
      yield Buffer.from('ignored')
    })()
    const { download, input, bodies } = setup([{ chunks }])
    await expect(download({ ...input, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(bodies[0].destroyed).toBe(true)
  })
})
