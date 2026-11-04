import { execFile } from 'node:child_process'
import { isAbsolute } from 'node:path'
import { promisify } from 'node:util'
import { VideoImportError } from './errors.js'

export function readVideoMetadata(output) {
  let data
  try { data = JSON.parse(output) } catch { throw new VideoImportError('format', 'No pudimos reconocer el video.') }
  const video = Array.isArray(data?.streams) && data.streams.find(stream => stream?.codec_type === 'video' && stream.disposition?.attached_pic !== 1 && Number.isSafeInteger(stream.width) && Number.isSafeInteger(stream.height) && stream.width > 0 && stream.height > 0)
  const duration = Number(data?.format?.duration)
  // ffprobe uses the same demuxer name for MP4 and QuickTime/MOV.
  const formats = String(data?.format?.format_name ?? '').split(',')
  const brand = String(data?.format?.tags?.major_brand ?? '').trim()
  const supportedBrand = /^(isom|iso[2-9]|avc1|mp41|mp42|M4V|MSNV|dash|qt)$/.test(brand)
  if (!formats.includes('mov') || !formats.includes('mp4') || !supportedBrand || !video || !Number.isFinite(duration) || duration <= 0) throw new VideoImportError('format', 'Usa un MP4 o MOV con una pista de video válida.')
  return { durationSeconds: duration, width: video.width, height: video.height, extension: brand === 'qt' ? 'mov' : 'mp4', contentType: brand === 'qt' ? 'video/quicktime' : 'video/mp4' }
}

/** No shell, network protocols or executable path chosen by the caller. */
export function createLocalVideoProbe({ executable, timeoutMs = 15_000, execute = promisify(execFile) }) {
  if (typeof executable !== 'string' || !isAbsolute(executable) || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('Configure an absolute ffprobe path and a positive timeout.')
  return async function probe({ localPath, signal }) {
    try {
      signal?.throwIfAborted()
      if (!isAbsolute(localPath)) throw new VideoImportError('format', 'No pudimos verificar el video.')
      const { stdout } = await execute(executable, [
        '-v', 'error', '-protocol_whitelist', 'file', '-format_whitelist', 'mov',
        '-enable_drefs', '0', '-use_absolute_path', '0',
        '-show_entries', 'format=format_name,duration:format_tags=major_brand:stream=codec_type,width,height:stream_disposition=attached_pic',
        '-of', 'json', localPath,
      ], { signal, timeout: timeoutMs, maxBuffer: 64 * 1024, windowsHide: true })
      return readVideoMetadata(stdout)
    } catch (error) {
      if (signal?.aborted) throw signal.reason
      if (error instanceof VideoImportError) throw error
      throw new VideoImportError('format', 'No pudimos verificar el video. Usa otro MP4 o MOV.')
    }
  }
}
