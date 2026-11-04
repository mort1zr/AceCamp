// Shared wire values only: this module has no server APIs or session state.
export const VIDEO_IMPORT_MESSAGES = Object.freeze({
  'import/source': 'Usa un enlace directo HTTPS de un proveedor admitido.',
  'import/input': 'Revisa el enlace y los datos del partido.',
  'import/destination': 'El destino de este enlace no está permitido.',
  'import/redirect': 'El enlace tiene redirecciones que no podemos aceptar.',
  'import/unavailable': 'El video no está disponible públicamente. Prueba otro enlace o un archivo.',
  'import/format': 'Usa un MP4 o MOV válido con una pista de video.',
  'import/size': 'El video supera el límite o la descarga está incompleta.',
  'import/duration': 'La demo admite enlaces a videos de hasta 30 segundos.',
  'import/permission': 'Tu sesión no permite importar este video. Vuelve a iniciar sesión.',
  'import/conflict': 'Este intento corresponde a otro video o sesión. Inicia un intento nuevo.',
  'import/busy': 'Hay una importación en curso. Espera un momento y vuelve a intentarlo.',
  'import/timeout': 'La importación tardó demasiado. Conservamos los datos para que puedas reintentarlo.',
  'import/download': 'No pudimos descargar el video. Prueba otro enlace o un archivo.',
  'import/failed': 'No pudimos importar el video. Conservamos los datos para que puedas reintentarlo.',
  'import/response': 'El servicio devolvió una respuesta no válida. Vuelve a intentarlo.',
  'import/youtube-unavailable': 'El video de YouTube debe ser público y estar disponible sin iniciar sesión. Usa otro enlace o un archivo.',
  'import/youtube-live': 'Espera a que termine la transmisión o usa un video ya grabado.',
  'import/youtube-format': 'Este video de YouTube no ofrece un MP4 compatible. Prueba otro enlace o un archivo.',
  'import/youtube-service': 'El servicio de YouTube no está disponible ahora. Inténtalo más tarde o usa un archivo.',
})

export function isStorageVideoPath(value) {
  return typeof value === 'string' && value.length <= 1024 && /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(value) && !value.includes('//') && !value.split('/').some(segment => segment === '.' || segment === '..') && !value.endsWith('/')
}

/** Bound bytes before JSON parsing, including chunked bodies without a length header. */
export async function readLimitedJson(message, { maxBytes = 8192, signal } = {}) {
  const rejectBody = error => { void message.body?.cancel().catch(() => {}); throw error }
  const contentType = message.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
  if (contentType !== 'application/json') rejectBody(new Error('Expected JSON.'))
  const length = message.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) rejectBody(Object.assign(new Error('Body too large.'), { code: 'http/body-size' }))
  if (!message.body) throw new Error('Missing JSON body.')
  const reader = message.body.getReader()
  const chunks = []
  let size = 0
  const abort = () => { void reader.cancel().catch(() => {}) }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    signal?.throwIfAborted()
    while (true) {
      const { done, value } = await reader.read()
      signal?.throwIfAborted()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) throw Object.assign(new Error('Body too large.'), { code: 'http/body-size' })
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } finally {
    signal?.removeEventListener('abort', abort)
    try { await reader.cancel() } catch { /* A failed/aborted body is already closed. */ }
    reader.releaseLock()
  }
}

/** Bound a callback that cannot itself be interrupted (e.g. a token refresh). */
export function awaitWithAbort(operation, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason) }
    signal.addEventListener('abort', abort, { once: true })
    Promise.resolve(operation).then(value => { signal.removeEventListener('abort', abort); if (!signal.aborted) resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
    if (signal.aborted) abort()
  })
}
