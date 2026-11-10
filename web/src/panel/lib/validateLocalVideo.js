import { MAX_VIDEO_SECONDS, MIN_VIDEO_HEIGHT, MIN_VIDEO_WIDTH } from './videoRequirements.js'

const UNREADABLE = 'No se pudo verificar el video. Elige un archivo MP4 o MOV que tu navegador pueda abrir.'
const LOW_RESOLUTION = `El video debe tener al menos 720p (${MIN_VIDEO_WIDTH}×${MIN_VIDEO_HEIGHT}). Grábalo o expórtalo en 720p o 1080p.`

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
      } else if (Math.min(videoWidth, videoHeight) < MIN_VIDEO_HEIGHT || Math.max(videoWidth, videoHeight) < MIN_VIDEO_WIDTH) {
        finish(LOW_RESOLUTION)
      } else if (duration > MAX_VIDEO_SECONDS) {
        finish(`El análisis admite videos de hasta ${MAX_VIDEO_SECONDS / 60} minuto. Recorta el video y vuelve a subirlo.`)
      } else {
        finish(null)
      }
    }
    video.onerror = () => finish(UNREADABLE)
    signal.addEventListener('abort', cancel, { once: true })
    video.src = url
  })
}
