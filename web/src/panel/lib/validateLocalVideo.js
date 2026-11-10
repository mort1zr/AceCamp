import { videoRequirementsError } from './videoRequirements.js'

const UNREADABLE = 'No se pudo verificar el video. Elige un archivo MP4 o MOV que tu navegador pueda abrir.'

export async function validateLocalVideo(file, signal) {
  signal.throwIfAborted()
  const video = document.createElement('video')
  let url
  try {
    url = URL.createObjectURL(file)
  } catch {
    return UNREADABLE
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(UNREADABLE), 10_000)

    function finish(message, aborted = false) {
      clearTimeout(timeout)
      signal.removeEventListener('abort', cancel)
      video.onloadedmetadata = null
      video.onerror = null
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
      if (aborted) reject(signal.reason)
      else resolve(message)
    }

    function cancel() {
      finish(null, true)
    }

    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const { videoWidth, videoHeight, duration } = video
      if (![videoWidth, videoHeight, duration].every((value) => Number.isFinite(value) && value > 0)) {
        finish(UNREADABLE)
      } else {
        finish(videoRequirementsError({ width: videoWidth, height: videoHeight, durationSeconds: duration }))
      }
    }
    video.onerror = () => finish(UNREADABLE)
    signal.addEventListener('abort', cancel, { once: true })
    video.src = url
  })
}
