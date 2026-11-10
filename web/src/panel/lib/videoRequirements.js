// Requisitos de calidad de PCIT-147.
export const MIN_VIDEO_WIDTH = 1280
export const MIN_VIDEO_HEIGHT = 720
export const MAX_VIDEO_SECONDS = 60
export const MIN_VIDEO_FPS = 25
export const MAX_VIDEO_FPS = 60

export function videoRequirementsError({ width, height, durationSeconds }) {
  if (Math.min(width, height) < MIN_VIDEO_HEIGHT || Math.max(width, height) < MIN_VIDEO_WIDTH) {
    return `El video debe tener al menos 720p (${MIN_VIDEO_WIDTH}×${MIN_VIDEO_HEIGHT}). Grábalo o expórtalo en 720p o 1080p.`
  }
  if (durationSeconds > MAX_VIDEO_SECONDS) {
    return `El análisis admite videos de hasta ${MAX_VIDEO_SECONDS / 60} minuto. Recorta el video y vuelve a subirlo.`
  }
  return null
}
