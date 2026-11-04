// Subida de videos de partidos a Storage (PCIT-24).
// Recibe { storage } desde fuera para poder probarlo contra el emulador
// sin importar src/panel/lib/firebase.js. Las reglas están en storage.rules.
//
// Contrato con el servicio de análisis de Fabián (PCIT-27 / PCIT-136):
//   uploadVideo({ file, orgId, actorId, matchId, maxBytes, signal, onProgress }) → Promise<string>
// Devuelve exactamente `orgs/${orgId}/matches/${matchId}/video.mp4` o `.mov`.

import { ref, uploadBytesResumable } from 'firebase/storage'

/** Límite de las reglas de Storage. Si cambia, cambiar también storage.rules. */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024

export const VIDEO_CONTENT_TYPES = Object.freeze({ mp4: 'video/mp4', mov: 'video/quicktime' })

const EXTENSION_BY_TYPE = { 'video/mp4': 'mp4', 'video/quicktime': 'mov' }

function videoError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function abortError() {
  return new DOMException('Se canceló la subida del video.', 'AbortError')
}

/** 'mp4' | 'mov' según el nombre o, si no tiene extensión conocida, el tipo; null si no es válido. */
export function videoExtension(file) {
  const fromName = String(file?.name ?? '').toLowerCase().match(/\.(mp4|mov)$/)?.[1]
  return fromName ?? EXTENSION_BY_TYPE[file?.type] ?? null
}

export function videoPath({ orgId, matchId, extension }) {
  return `orgs/${orgId}/matches/${matchId}/video.${extension}`
}

/** Revisa el archivo antes de subirlo; lanza un error con code 'video/...'. */
export function checkVideoFile(file, maxBytes = MAX_VIDEO_BYTES) {
  const extension = videoExtension(file)
  if (!extension) throw videoError('video/invalid-type', 'El video debe ser .mp4 o .mov.')
  if (!file.size) throw videoError('video/empty', 'El archivo de video está vacío.')
  const limit = Math.min(maxBytes ?? MAX_VIDEO_BYTES, MAX_VIDEO_BYTES)
  if (file.size > limit) {
    throw videoError('video/too-large', `El video supera el máximo de ${Math.floor(limit / (1024 * 1024))} MB.`)
  }
  return extension
}

const ERROR_MESSAGES = {
  'storage/unauthorized': 'No tienes permiso para subir videos a esta organización.',
  'storage/unauthenticated': 'Tu sesión expiró. Vuelve a iniciar sesión.',
  'storage/retry-limit-exceeded': 'Se perdió la conexión durante la subida. Inténtalo de nuevo.',
  'storage/quota-exceeded': 'No queda espacio para más videos.',
}

/** Mensaje para el usuario; nunca muestra el error técnico. */
export function videoErrorMessage(error) {
  if (error?.name === 'AbortError') return 'Se canceló la subida del video.'
  if (error?.code?.startsWith('video/')) return error.message
  return ERROR_MESSAGES[error?.code] ?? 'No pudimos subir el video. Inténtalo de nuevo.'
}

export function createVideoUploadService({ storage }) {
  function uploadVideo({ file, orgId, actorId, matchId, maxBytes, signal, onProgress }) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(abortError())
      if (!orgId || !actorId || !matchId) {
        return reject(videoError('video/missing-identity', 'Falta la organización, el usuario o el partido.'))
      }

      let extension
      try {
        extension = checkVideoFile(file, maxBytes)
      } catch (error) {
        return reject(error)
      }

      const path = videoPath({ orgId, matchId, extension })
      const task = uploadBytesResumable(ref(storage, path), file, {
        contentType: VIDEO_CONTENT_TYPES[extension],
        customMetadata: { uploadedBy: actorId },
      })

      const cancel = () => task.cancel()
      signal?.addEventListener('abort', cancel, { once: true })
      const done = () => signal?.removeEventListener('abort', cancel)

      onProgress?.(0)
      task.on(
        'state_changed',
        snapshot => {
          if (snapshot.totalBytes > 0) onProgress?.(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
        },
        error => {
          done()
          reject(error?.code === 'storage/canceled' ? abortError() : error)
        },
        () => {
          done()
          onProgress?.(100)
          resolve(path)
        },
      )
    })
  }

  return { uploadVideo }
}
