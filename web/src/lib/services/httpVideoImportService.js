import { awaitWithAbort, isStorageVideoPath, readLimitedJson, VIDEO_IMPORT_MESSAGES } from '../videoImportProtocol.js'

const failure = code => Object.assign(new Error(VIDEO_IMPORT_MESSAGES[code] ?? VIDEO_IMPORT_MESSAGES['import/failed']), { code })

/** Opt-in only after the API is deployed and verified; returns undefined when disabled. */
export function createHttpVideoImporter({ enabled = false, supportsYouTube = false, endpoint, origin = globalThis.location?.origin, getSession, fetcher = globalThis.fetch, timeoutMs = 120_000 } = {}) {
  if (enabled !== true) return undefined
  const application = new URL(origin)
  const target = new URL(endpoint, application)
  if (typeof endpoint !== 'string' || target.origin !== application.origin || target.username || target.password || target.hash || application.origin !== origin || (application.protocol !== 'https:' && !(application.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(application.hostname))) || typeof getSession !== 'function' || typeof fetcher !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('Configure a same-origin import API and a session reader.')

  return Object.assign(async function importVideo({ url, matchId, orgId, actorId, signal, onProgress }) {
    const bounded = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(timeoutMs)])
    try {
      bounded.throwIfAborted()
      const session = await awaitWithAbort(getSession({ signal: bounded }), bounded)
      bounded.throwIfAborted()
      if (!orgId || !actorId || session?.orgId !== orgId || session?.actorId !== actorId || typeof session.token !== 'string' || !/^[A-Za-z0-9_.-]{1,8192}$/.test(session.token)) throw failure('import/permission')
      onProgress?.(0)
      const response = await awaitWithAbort(fetcher(target.href, {
        method: 'POST', signal: bounded, redirect: 'error', mode: 'same-origin', credentials: 'omit', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${session.token}` },
        // UID, organization and limits are derived in the server; never sent as authority.
        body: JSON.stringify({ url, matchId }),
      }), bounded)
      bounded.throwIfAborted()
      const body = await awaitWithAbort(readLimitedJson(response, { signal: bounded }), bounded)
      if (!response.ok) throw failure(Object.hasOwn(VIDEO_IMPORT_MESSAGES, body?.error?.code) ? body.error.code : 'import/failed')
      if (!isStorageVideoPath(body?.videoPath)) throw failure('import/response')
      onProgress?.(100)
      return body.videoPath
    } catch (error) {
      if (signal?.aborted) throw signal.reason
      if (bounded.aborted) throw failure('import/timeout')
      if (Object.hasOwn(VIDEO_IMPORT_MESSAGES, error?.code)) throw failure(error.code)
      throw failure('import/failed')
    }
  }, { supportsYouTube: supportsYouTube === true })
}
