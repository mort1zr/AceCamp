import { lookup } from 'node:dns/promises'
import { request as httpsRequest } from 'node:https'
import { createWriteStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { isIP } from 'node:net'
import ipaddr from 'ipaddr.js'
import { invalidSource, validateLimit, VideoImportError } from './errors.js'

const redirects = new Set([301, 302, 303, 307, 308])

export function isPublicAddress(address) {
  try { return ipaddr.process(address).range() === 'unicast' } catch { return false }
}

function parseSource(value, allowedHosts) {
  let url
  try { url = new URL(value) } catch { throw invalidSource() }
  if (typeof value !== 'string' || value.length > 4096 || url.protocol !== 'https:' || (url.port && url.port !== '443') || url.username || url.password || url.hash || !allowedHosts.has(url.hostname) || isIP(url.hostname.replace(/^\[|\]$/g, ''))) throw invalidSource()
  return url
}

function openResponse(url, addresses, signal, request) {
  return new Promise((resolve, reject) => {
    const pinned = addresses[0]
    const req = request(url, {
      method: 'GET', signal, agent: false, autoSelectFamily: false,
      // Pin the checked address; no second, unchecked DNS lookup or pooled socket.
      lookup: (_host, options, callback) => options.all ? callback(null, [pinned]) : callback(null, pinned.address, pinned.family),
      headers: { Accept: 'video/mp4, video/quicktime, application/octet-stream', 'Accept-Encoding': 'identity' },
    }, resolve)
    req.once('error', reject)
    req.end()
  })
}

function resolveWithAbort(resolve, hostname, signal) {
  return new Promise((accept, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason) }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    else Promise.resolve().then(() => resolve(hostname, { all: true, verbatim: true })).then(accept, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

/** Server-only. DNS and HTTP are injectable for offline tests, never from request data. */
export function createPublicVideoDownloader({ allowedHosts, resolve = lookup, request = httpsRequest, timeoutMs = 60_000, maxRedirects = 3 }) {
  if (!Array.isArray(allowedHosts) || !allowedHosts.length || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || !Number.isSafeInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > 5) throw new TypeError('Explicit hosts and bounded download limits are required.')
  const hosts = new Set(allowedHosts.map(host => {
    if (typeof host !== 'string' || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host) || !host.includes('.') || isIP(host) || host.includes('..')) throw new TypeError('Use exact DNS hostnames, without wildcards or IP addresses.')
    return host
  }))

  return async function download({ url: value, destination, maxBytes, signal, onProgress }) {
    validateLimit(maxBytes)
    const bounded = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(timeoutMs)])
    let response
    try {
      let url = parseSource(value, hosts)
      if (!/\.(mp4|mov)$/i.test(decodeURIComponent(url.pathname))) throw invalidSource()
      for (let count = 0; ; count++) {
        bounded.throwIfAborted()
        const addresses = await resolveWithAbort(resolve, url.hostname, bounded)
        bounded.throwIfAborted()
        if (!Array.isArray(addresses) || !addresses.length || addresses.some(item => !isPublicAddress(item.address) || isIP(item.address) !== item.family)) throw new VideoImportError('destination', 'El destino del video no está permitido.')
        response = await openResponse(url, addresses, bounded, request)
        if (!redirects.has(response.statusCode)) break
        const location = response.headers.location
        response.destroy()
        if (!location || count >= maxRedirects) throw new VideoImportError('redirect', 'El enlace tiene demasiadas redirecciones o no es válido.')
        url = parseSource(new URL(location, url).href, hosts)
      }
      if (response.statusCode !== 200) throw new VideoImportError('unavailable', 'El video no está disponible públicamente. Usa otro enlace o un archivo.')
      const encoding = response.headers['content-encoding']
      if (encoding && encoding.toLowerCase() !== 'identity') throw new VideoImportError('format', 'El servidor no entregó un video sin comprimir.')
      const contentType = String(response.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
      if (!['video/mp4', 'video/quicktime', 'application/octet-stream'].includes(contentType)) throw new VideoImportError('format', 'El enlace no entregó un archivo de video admitido.')
      const length = response.headers['content-length']
      const declared = length === undefined ? null : /^\d+$/.test(length) ? Number(length) : NaN
      if (declared !== null && (!Number.isSafeInteger(declared) || declared <= 0 || declared > maxBytes)) throw new VideoImportError('size', 'El tamaño del video no está permitido.')
      let bytes = 0
      const hash = createHash('sha256')
      const meter = new Transform({ transform(chunk, _encoding, callback) {
        bytes += chunk.length
        if (bytes > maxBytes) return callback(new VideoImportError('size', 'El video supera el límite de descarga.'))
        hash.update(chunk)
        try { onProgress?.({ bytes, totalBytes: declared }); callback(null, chunk) }
        catch (error) { callback(error) }
      } })
      await pipeline(response, meter, createWriteStream(destination, { flags: 'wx', mode: 0o600 }), { signal: bounded })
      if (!bytes || (declared !== null && declared !== bytes)) throw new VideoImportError('size', 'El video está vacío o la descarga está incompleta.')
      return { bytes, sha256: hash.digest('hex') }
    } catch (error) {
      if (signal?.aborted) throw signal.reason
      if (bounded.aborted) throw new VideoImportError('timeout', 'La descarga tardó demasiado. Vuelve a intentarlo.')
      if (error instanceof VideoImportError) throw error
      // Raw network errors can include signed URLs; never return them to clients.
      throw new VideoImportError('download', 'No pudimos descargar el video. Prueba otro enlace o un archivo.')
    } finally { response?.destroy() }
  }
}
