import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createVideoSourceDownloader, createYtDlpResolver, isGoogleVideoUrl, readYouTubeMetadata } from './youtube.js'

const id = 'abcdefghijk'
const url = `https://www.youtube.com/watch?v=${id}`
const mediaUrl = 'https://r1---sn-example.googlevideo.com/videoplayback?id=example&expire=9999999999'
const report = override => JSON.stringify({ id, extractor_key: 'Youtube', availability: 'public', live_status: 'not_live', is_live: false, ext: 'mp4', protocol: 'https', vcodec: 'avc1.42001E', duration: 120, filesize: 11, url: mediaUrl, ...override })
let directory
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'acecam-youtube-test-')) })
afterEach(async () => {
  if (dirname(resolve(directory)) !== resolve(tmpdir())) throw new Error('Invalid test cleanup target.')
  await rm(directory, { recursive: true, force: true })
})

function transport({ address = '8.8.8.8', headers = {}, statusCode = 200, chunks = [Buffer.from('video-bytes')] } = {}) {
  const dns = vi.fn(async () => [{ address, family: 4 }])
  const request = vi.fn((_url, _options, receive) => {
    const req = new EventEmitter()
    req.end = () => queueMicrotask(() => receive(Object.assign(Readable.from(chunks), { statusCode, headers: { 'content-type': 'video/mp4', ...headers } })))
    return req
  })
  return { dns, request, options: { resolve: dns, request } }
}

describe('Proveedor de YouTube (sin ejecución de extractor ni red externa)', () => {
  it('reduce metadatos al video público seleccionado, sin conservar cabeceras ni títulos', () => {
    const metadata = readYouTubeMetadata(report({ title: 'private metadata', http_headers: { Cookie: 'secret' } }), id, 100)
    expect(metadata).toEqual({ videoId: id, mediaUrl, durationSeconds: 120, declaredBytes: 11 })
    expect(JSON.stringify(metadata)).not.toMatch(/Cookie|private metadata|secret/)
  })

  it('rechaza privado, no listado, identificación desconocida y playlists', () => {
    for (const override of [{ availability: 'private' }, { availability: 'unlisted' }, { availability: null }, { availability: 'needs_auth' }, { id: 'ABCDEFGHIJK' }, { _type: 'playlist' }, { extractor_key: 'Generic' }]) expect(() => readYouTubeMetadata(report(override), id, 100)).toThrow(expect.objectContaining({ code: 'import/youtube-unavailable' }))
  })

  it('rechaza directos/programados, DRM, audio solo y formatos que requieren mezclar archivos', () => {
    for (const override of [{ is_live: true }, { live_status: 'is_upcoming' }, { live_status: 'post_live' }]) expect(() => readYouTubeMetadata(report(override), id, 100)).toThrow(expect.objectContaining({ code: 'import/youtube-live' }))
    for (const override of [{ has_drm: true }, { vcodec: 'none' }, { protocol: 'm3u8_native' }, { requested_formats: [{}, {}] }, { ext: 'webm' }, { fragments: [{}] }, { duration: 0 }]) expect(() => readYouTubeMetadata(report(override), id, 100)).toThrow(expect.objectContaining({ code: 'import/youtube-format' }))
  })

  it('no confía en aproximaciones de tamaño y limita el tamaño conocido', () => {
    expect(() => readYouTubeMetadata(report({ filesize: 101 }), id, 100)).toThrow(expect.objectContaining({ code: 'import/size' }))
    expect(readYouTubeMetadata(report({ filesize: null, filesize_approx: 9000 }), id, 100).declaredBytes).toBeNull()
  })

  it('acepta solo subdominios HTTPS de Googlevideo, sin credenciales ni nombres parecidos', () => {
    expect(isGoogleVideoUrl(mediaUrl)).toBe(true)
    for (const value of ['https://googlevideo.com/a', 'https://googlevideo.com.attacker.example/a', 'https://evilgooglevideo.com/a', 'https://127.0.0.1/a', 'http://r1.googlevideo.com/a', 'https://user:pass@r1.googlevideo.com/a', 'https://r1.googlevideo.com:8443/a']) expect(isGoogleVideoUrl(value), value).toBe(false)
  })

  it('consulta un ID canónico sin shell, cookies, plugins, configuración ni descarga del archivo', async () => {
    const execute = vi.fn(async () => ({ stdout: report() }))
    const executable = resolve('tools', 'yt-dlp.exe')
    const resolver = createYtDlpResolver({ executable, execute })
    await resolver({ url: `https://youtu.be/${id}?si=tracking`, maxBytes: 100 })
    const [file, args, options] = execute.mock.calls[0]
    expect(file).toBe(executable)
    expect(args).toEqual(expect.arrayContaining(['--ignore-config', '--no-plugin-dirs', '--no-cookies', '--no-cookies-from-browser', '--no-remote-components', '--simulate', '--no-playlist']))
    expect(args.at(-1)).toBe(url)
    expect(args).not.toContain('--no-check-certificates')
    expect(options).toMatchObject({ timeout: 30000, maxBuffer: 2097152, windowsHide: true })
    expect(options.shell).toBeUndefined()
    expect(Object.keys(options.env)).not.toContain('GOOGLE_APPLICATION_CREDENTIALS')
    expect(() => createYtDlpResolver({ executable: 'yt-dlp' })).toThrow()
  })

  it('clasifica video eliminado, formato no disponible o ejecutable ausente sin filtrar stderr', async () => {
    const execute = vi.fn()
    const resolver = createYtDlpResolver({ executable: resolve('yt-dlp'), execute })
    for (const [failure, code] of [
      [{ stderr: 'ERROR: Private video https://private.example?secret=abc' }, 'import/youtube-unavailable'],
      [{ stderr: 'ERROR: This video is unavailable' }, 'import/youtube-unavailable'],
      [{ stderr: 'ERROR: Requested format is not available secret' }, 'import/youtube-format'],
      [{ code: 'ENOENT' }, 'import/youtube-service'],
    ]) {
      execute.mockRejectedValueOnce(failure)
      await expect(resolver({ url, maxBytes: 100 })).rejects.toMatchObject({ code, message: expect.not.stringContaining('secret') })
    }
  })

  it('cancela y acota consultas aunque el ejecutor no termine', async () => {
    const execute = vi.fn(() => new Promise(() => {}))
    const resolver = createYtDlpResolver({ executable: resolve('yt-dlp'), execute, timeoutMs: 20 })
    await expect(resolver({ url, maxBytes: 100 })).rejects.toMatchObject({ code: 'import/timeout' })
    expect(execute.mock.calls[0][2].signal.aborted).toBe(true)
    const controller = new AbortController()
    controller.abort()
    await expect(resolver({ url, maxBytes: 100, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('descarga una URL de medios sin extensión mediante los controles HTTPS y el límite real', async () => {
    const network = transport()
    const resolver = vi.fn(async () => readYouTubeMetadata(report(), id, 100))
    const directDownload = vi.fn()
    const download = createVideoSourceDownloader({ directDownload, resolveYouTube: resolver, mediaTransport: network.options })
    const destination = join(directory, 'video')
    expect(download.supportsYouTube).toBe(true)
    expect((await download({ url: `https://youtu.be/${id}`, destination, maxBytes: 100 })).bytes).toBe(11)
    expect(await readFile(destination, 'utf8')).toBe('video-bytes')
    expect(network.request.mock.calls[0][0].href).toBe(mediaUrl)
    expect(directDownload).not.toHaveBeenCalled()
  })

  it('no permite DNS privado, redirección externa ni exceso real de bytes del archivo resuelto', async () => {
    for (const [config, code] of [[{ address: '10.0.0.1' }, 'import/destination'], [{ statusCode: 302, headers: { location: 'https://attacker.example/video.mp4' } }, 'import/source'], [{ chunks: [Buffer.alloc(101)] }, 'import/size']]) {
      const network = transport(config)
      const download = createVideoSourceDownloader({ directDownload: vi.fn(), resolveYouTube: async () => readYouTubeMetadata(report({ filesize: null }), id, 100), mediaTransport: network.options })
      await expect(download({ url, destination: join(directory, code.split('/')[1]), maxBytes: 100 })).rejects.toMatchObject({ code })
      if (config.address) expect(network.request).not.toHaveBeenCalled()
    }
  })

  it('conserva enlaces directos y deja YouTube no disponible sin resolver configurado', async () => {
    const directDownload = vi.fn(async () => ({ bytes: 10 }))
    const download = createVideoSourceDownloader({ directDownload })
    expect(download.supportsYouTube).toBe(false)
    expect(await download({ url: 'https://media.example/video.mp4' })).toEqual({ bytes: 10 })
    await expect(download({ url, maxBytes: 100 })).rejects.toMatchObject({ code: 'import/youtube-service' })
  })

  it('rechaza resolución de otro video o tamaño excesivo antes de conectar al CDN', async () => {
    const network = transport()
    const resolver = vi.fn()
    const download = createVideoSourceDownloader({ directDownload: vi.fn(), resolveYouTube: resolver, mediaTransport: network.options })
    resolver.mockResolvedValueOnce({ videoId: 'ABCDEFGHIJK', mediaUrl })
    await expect(download({ url, maxBytes: 100 })).rejects.toMatchObject({ code: 'import/youtube-format' })
    resolver.mockResolvedValueOnce({ videoId: id, mediaUrl, declaredBytes: 101 })
    await expect(download({ url, maxBytes: 100 })).rejects.toMatchObject({ code: 'import/size' })
    expect(network.dns).not.toHaveBeenCalled()
    expect(network.request).not.toHaveBeenCalled()
  })
})
