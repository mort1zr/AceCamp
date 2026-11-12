// Videos en Azure Blob (PCIT-225, historia PCIT-222).
// La API de videos (web/server/azure-videos) comprueba la sesión de Firebase y el rol,
// y devuelve un enlace temporal para subir o leer. La web nunca ve claves de Azure.
// Se activa con VITE_VIDEO_API_URL; sin ella, la web sigue usando Firebase Storage.

import { MAX_VIDEO_BYTES, VIDEO_CONTENT_TYPES, checkVideoFile, videoPath } from './videoUpload.js'

function failure(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

const STATUS_CODES = { 401: 'storage/unauthenticated', 403: 'storage/unauthorized' }

/** Pide a la API un enlace temporal. operation: 'upload' | 'read'. */
export function createAzureVideoClient({ apiUrl, getToken, fetchImpl = (...args) => globalThis.fetch(...args) }) {
  const base = new URL(apiUrl)
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) {
    throw new TypeError('La API de videos debe usar HTTPS.')
  }
  const endpoint = new URL('/api/videos/sign', base).toString()

  return {
    async sign(path, operation, signal) {
      const token = await getToken()
      if (!token) throw failure('storage/unauthenticated', 'Sin sesión.')
      const response = await fetchImpl(endpoint, {
        method: 'POST', signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, operation }),
      })
      if (!response.ok) throw failure(STATUS_CODES[response.status] ?? 'storage/unknown', `La API de videos respondió ${response.status}.`)
      const signed = await response.json()
      if (typeof signed?.url !== 'string' || (base.protocol === 'https:' && !signed.url.startsWith('https://'))) {
        throw failure('storage/unknown', 'Respuesta inválida de la API de videos.')
      }
      return signed
    },
  }
}

/** Mismo contrato que createVideoUploadService (videoUpload.js), pero subiendo a Azure Blob. */
export function createAzureVideoUploadService({ client, createRequest = () => new XMLHttpRequest() }) {
  async function uploadVideo({ file, orgId, actorId, matchId, maxBytes = MAX_VIDEO_BYTES, signal, onProgress }) {
    if (signal?.aborted) throw new DOMException('Se canceló la subida del video.', 'AbortError')
    if (!orgId || !actorId || !matchId) throw failure('video/missing-identity', 'Falta la organización, el usuario o el partido.')
    const extension = checkVideoFile(file, maxBytes)
    const path = videoPath({ orgId, matchId, extension })
    const signed = await client.sign(path, 'upload', signal)

    onProgress?.(0)
    await new Promise((resolve, reject) => {
      const request = createRequest()
      const cancel = () => request.abort()
      signal?.addEventListener('abort', cancel, { once: true })
      const finish = callback => value => { signal?.removeEventListener('abort', cancel); callback(value) }
      request.open('PUT', signed.url)
      for (const [name, value] of Object.entries(signed.headers ?? {})) request.setRequestHeader(name, value)
      request.setRequestHeader('Content-Type', VIDEO_CONTENT_TYPES[extension])
      request.upload.onprogress = event => {
        if (event.lengthComputable && event.total > 0) onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
      request.onload = finish(() => (request.status >= 200 && request.status < 300
        ? resolve()
        : reject(failure(STATUS_CODES[request.status] ?? 'storage/retry-limit-exceeded', `Azure respondió ${request.status}.`))))
      request.onerror = finish(() => reject(failure('storage/retry-limit-exceeded', 'Se perdió la conexión.')))
      request.onabort = finish(() => reject(new DOMException('Se canceló la subida del video.', 'AbortError')))
      request.send(file)
    })
    onProgress?.(100)
    return path
  }

  return { uploadVideo }
}

/** Mismo contrato que createProcessedVideoService: devuelve el video procesado como Blob. */
export function createAzureProcessedVideoService({ client, orgId, fetchImpl = (...args) => globalThis.fetch(...args) }) {
  if (typeof orgId !== 'string' || !orgId || /[/\\]/.test(orgId)) throw new TypeError('Video requires an authenticated organization.')
  return {
    async load({ matchId, path }) {
      if (typeof matchId !== 'string' || !matchId || /[/\\]/.test(matchId)
        || path !== `orgs/${orgId}/matches/${matchId}/processed.mp4`) throw new TypeError('Invalid processed video path.')
      const signed = await client.sign(path, 'read')
      const response = await fetchImpl(signed.url)
      if (!response.ok) throw failure(STATUS_CODES[response.status] ?? 'storage/unknown', `Azure respondió ${response.status}.`)
      return response.blob()
    },
  }
}
