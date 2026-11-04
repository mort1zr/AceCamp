import { execFile } from 'node:child_process'
import { delimiter, dirname, isAbsolute } from 'node:path'
import { promisify } from 'node:util'
import { parseYouTubeUrl } from '../../src/panel/lib/videoSources.js'
import { awaitWithAbort } from '../../src/panel/lib/videoImportProtocol.js'
import { createPublicVideoDownloader } from './download.js'
import { invalidSource, validateLimit, VideoImportError } from './errors.js'

export function isGoogleVideoUrl(value) {
  try {
    const url = new URL(value)
    return typeof value === 'string' && value.length <= 4096 && url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.port && url.hostname.endsWith('.googlevideo.com')
  } catch { return false }
}

export function readYouTubeMetadata(output, expectedId, maxBytes) {
  validateLimit(maxBytes)
  let info
  try { info = JSON.parse(output) } catch { throw new VideoImportError('youtube-service', 'No pudimos consultar el video de YouTube.') }
  if (!info || info.id !== expectedId || info.extractor_key !== 'Youtube' || (info._type && info._type !== 'video') || info.availability !== 'public') throw new VideoImportError('youtube-unavailable', 'El video debe ser público y estar disponible sin iniciar sesión.')
  if (info.is_live === true || !['not_live', 'was_live'].includes(info.live_status)) throw new VideoImportError('youtube-live', 'Usa un video terminado, no una transmisión en directo o programada.')
  if (info.has_drm === true || info.ext !== 'mp4' || info.protocol !== 'https' || typeof info.vcodec !== 'string' || !info.vcodec || info.vcodec === 'none' || info.requested_formats?.length || info.fragments?.length || !isGoogleVideoUrl(info.url) || !Number.isFinite(info.duration) || info.duration <= 0) throw new VideoImportError('youtube-format', 'No encontramos un archivo MP4 compatible para este video.')
  if (info.filesize != null && (!Number.isSafeInteger(info.filesize) || info.filesize <= 0 || info.filesize > maxBytes)) throw new VideoImportError('size', 'El video supera el límite o su tamaño no es válido.')
  // Do not return titles, cookies, headers, tracking details or the full extractor payload.
  return { videoId: info.id, mediaUrl: info.url, durationSeconds: info.duration, declaredBytes: info.filesize ?? null }
}

/** Metadata only; configured executables are not installed or executed by the preview. */
export function createYtDlpResolver({ executable, nodeExecutable = process.execPath, timeoutMs = 30_000, execute = promisify(execFile) }) {
  if (typeof executable !== 'string' || !isAbsolute(executable) || !isAbsolute(nodeExecutable) || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('Configure absolute yt-dlp/Node paths and a bounded metadata timeout.')
  const environment = { PATH: [dirname(executable), dirname(nodeExecutable)].join(delimiter) }
  for (const key of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL']) if (process.env[key]) environment[key] = process.env[key]

  return async function resolve({ url, maxBytes, signal }) {
    validateLimit(maxBytes)
    const source = parseYouTubeUrl(url)
    if (!source) throw invalidSource()
    const bounded = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(timeoutMs)])
    try {
      bounded.throwIfAborted()
      const { stdout } = await awaitWithAbort(execute(executable, [
        '--ignore-config', '--no-config-locations', '--no-plugin-dirs',
        '--no-cookies', '--no-cookies-from-browser', '--no-cache-dir',
        '--no-remote-components', '--no-js-runtimes', '--js-runtimes', `node:${nodeExecutable}`,
        '--use-extractors', '^youtube$', '--no-playlist', '--no-check-formats',
        '--simulate', '--dump-single-json', '--no-progress', '--no-warnings',
        '--proxy', '', '--retries', '0', '--extractor-retries', '0', '--socket-timeout', '10',
        '--format', 'best[ext=mp4][protocol=https]/bestvideo[ext=mp4][protocol=https]',
        '--', source.url,
      ], { signal: bounded, timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024, windowsHide: true, env: environment }), bounded)
      bounded.throwIfAborted()
      return readYouTubeMetadata(stdout, source.videoId, maxBytes)
    } catch (error) {
      if (signal?.aborted) throw signal.reason
      if (bounded.aborted || error?.killed) throw new VideoImportError('timeout', 'La consulta de YouTube tardó demasiado.')
      if (error instanceof VideoImportError) throw error
      if (error?.code === 'ENOENT') throw new VideoImportError('youtube-service', 'El servicio de YouTube aún no está disponible.')
      const stderr = typeof error?.stderr === 'string' ? error.stderr : ''
      if (/requested format.*not available/i.test(stderr)) throw new VideoImportError('youtube-format', 'No encontramos un MP4 compatible para este video.')
      // Classification only; extractor messages/URLs never reach the user.
      if (/private video|video (?:is )?unavailable|not available|sign in|members.only|age.restrict|removed|deleted/i.test(stderr)) throw new VideoImportError('youtube-unavailable', 'El video no está disponible públicamente sin iniciar sesión.')
      throw new VideoImportError('youtube-service', 'No pudimos consultar YouTube. Prueba más tarde o usa un archivo.')
    }
  }
}

/** User URLs never select a transport or change its domain policy. */
export function createVideoSourceDownloader({ directDownload, resolveYouTube, mediaTransport = {}, timeoutMs = 90_000 }) {
  if (typeof directDownload !== 'function' || (resolveYouTube !== undefined && typeof resolveYouTube !== 'function') || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('A direct downloader and bounded source resolution are required.')
  const mediaDownload = resolveYouTube && createPublicVideoDownloader({
    resolve: mediaTransport.resolve, request: mediaTransport.request,
    allowedHostSuffixes: ['googlevideo.com'], requireVideoExtension: false,
  })
  const download = async input => {
    const source = parseYouTubeUrl(input.url)
    if (!source) return directDownload(input)
    if (!resolveYouTube) throw new VideoImportError('youtube-service', 'La importación de YouTube aún no está disponible.')
    validateLimit(input.maxBytes)
    const signal = AbortSignal.any([...(input.signal ? [input.signal] : []), AbortSignal.timeout(timeoutMs)])
    try {
      signal.throwIfAborted()
      const metadata = await awaitWithAbort(resolveYouTube({ url: source.url, maxBytes: input.maxBytes, signal }), signal)
      if (metadata?.videoId !== source.videoId || !isGoogleVideoUrl(metadata?.mediaUrl)) throw new VideoImportError('youtube-format', 'No encontramos un archivo de video compatible.')
      if (metadata.declaredBytes != null && (!Number.isSafeInteger(metadata.declaredBytes) || metadata.declaredBytes <= 0 || metadata.declaredBytes > input.maxBytes)) throw new VideoImportError('size', 'El video supera el límite permitido.')
      signal.throwIfAborted()
      return await mediaDownload({ ...input, url: metadata.mediaUrl, signal })
    } catch (error) {
      if (input.signal?.aborted) throw input.signal.reason
      if (signal.aborted) throw new VideoImportError('timeout', 'La importación de YouTube tardó demasiado.')
      throw error
    }
  }
  return Object.assign(download, { supportsYouTube: Boolean(resolveYouTube) })
}
