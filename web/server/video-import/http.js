import { awaitWithAbort, isStorageVideoPath, readLimitedJson, VIDEO_IMPORT_MESSAGES } from '../../src/lib/videoImportProtocol.js'

const statuses = {
  'import/source': 400, 'import/input': 400, 'import/destination': 400, 'import/redirect': 400,
  'import/unavailable': 422, 'import/format': 415, 'import/size': 413, 'import/duration': 422, 'import/permission': 403,
  'import/conflict': 409, 'import/busy': 429, 'import/timeout': 504, 'import/download': 502, 'import/failed': 502,
  'import/youtube-unavailable': 422, 'import/youtube-live': 422, 'import/youtube-format': 422, 'import/youtube-service': 503,
}

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', ...extraHeaders,
  } })
}

function error(status, code, extraHeaders) {
  return json(status, { error: { code, message: VIDEO_IMPORT_MESSAGES[code] ?? VIDEO_IMPORT_MESSAGES['import/failed'] } }, extraHeaders)
}

/** Web Request -> Response. Mount only with the authenticated core, never a demo service. */
export function createVideoImportHttpHandler({ importVideo, origin, maxBodyBytes = 8192, timeoutMs = 120_000 }) {
  const expected = new URL(origin)
  if (typeof importVideo !== 'function' || expected.origin !== origin || (expected.protocol !== 'https:' && !(expected.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(expected.hostname))) || !Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1 || maxBodyBytes > 16384 || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('A secured importer, exact application origin and bounded limits are required.')

  return async function handle(request) {
    const reject = (status, code, headers) => { void request.body?.cancel().catch(() => {}); return error(status, code, headers) }
    if (request.method !== 'POST') return reject(405, 'import/input', { Allow: 'POST' })
    if (new URL(request.url).origin !== origin || (request.headers.has('origin') && request.headers.get('origin') !== origin)) return reject(403, 'import/permission')
    const bearer = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_.-]{1,8192})$/i)?.[1]
    if (!bearer) return reject(401, 'import/permission')
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return reject(415, 'import/input')
    if (request.headers.get('content-encoding') && request.headers.get('content-encoding') !== 'identity') return reject(415, 'import/input')
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)])
    try {
      let input
      try { input = await awaitWithAbort(readLimitedJson(request, { maxBytes: maxBodyBytes, signal }), signal) }
      catch (failure) { signal.throwIfAborted(); return error(failure?.code === 'http/body-size' ? 413 : 400, 'import/input') }
      if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).some(key => !['url', 'matchId'].includes(key)) || typeof input.url !== 'string' || input.url.length > 4096 || typeof input.matchId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(input.matchId)) return error(400, 'import/input')
      // Authorization remains mandatory inside createVideoImporter; body identity is rejected.
      signal.throwIfAborted()
      const videoPath = await awaitWithAbort(importVideo({ url: input.url, matchId: input.matchId, requestContext: { bearerToken: bearer }, signal }), signal)
      signal.throwIfAborted()
      if (!isStorageVideoPath(videoPath)) return error(502, 'import/failed')
      return json(200, { videoPath })
    } catch (failure) {
      if (request.signal.aborted) return error(408, 'import/timeout')
      if (signal.aborted) return error(504, 'import/timeout')
      const code = Object.hasOwn(statuses, failure?.code) ? failure.code : 'import/failed'
      return error(statuses[code], code, code === 'import/busy' ? { 'Retry-After': '5' } : {})
    }
  }
}
