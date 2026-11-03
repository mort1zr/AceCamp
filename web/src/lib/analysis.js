import { isValidBirthDate } from './players.js'

export const VIDEO_EXTENSIONS = ['mp4', 'mov']

export function validateVideoFile(file, maxBytes) {
  if (!file) return 'Selecciona un video.'
  const extension = String(file.name ?? '').split('.').pop().toLowerCase()
  const mime = String(file.type ?? '').toLowerCase()
  if (!VIDEO_EXTENSIONS.includes(extension) || (mime && !['video/mp4', 'application/mp4', 'video/quicktime'].includes(mime))) return 'Usa un archivo MP4 o MOV.'
  if (!Number.isFinite(file.size) || file.size <= 0) return 'El archivo está vacío o no se puede leer.'
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) return 'El límite de carga aún no está disponible.'
  if (file.size > maxBytes) return `El video supera el límite de ${formatBytes(maxBytes)}.`
  return null
}

export function validateVideoUrl(value) {
  try {
    const url = new URL(value)
    const extension = decodeURIComponent(url.pathname).split('.').pop().toLowerCase()
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || !VIDEO_EXTENSIONS.includes(extension)) throw new Error('invalid')
    return null
  } catch {
    return 'Usa un enlace HTTPS directo a un video MP4 o MOV, sin usuario ni contraseña.'
  }
}

export function formatBytes(bytes) {
  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`
}

export function validateAnalysis(input, { maxBytes, supportsLinks = false } = {}) {
  const errors = {}
  if (typeof input.playerId !== 'string' || !input.playerId || input.playerId.includes('/')) errors.playerId = 'Selecciona un jugador.'
  if (!['arriba', 'abajo'].includes(input.playerPosition)) errors.playerPosition = 'Indica dónde está el jugador al inicio del video.'
  if (typeof input.opponent !== 'string' || input.opponent.trim().length < 2 || input.opponent.trim().length > 120) errors.opponent = 'Escribe el rival (entre 2 y 120 caracteres).'
  if (!isValidBirthDate(input.matchDate)) errors.matchDate = 'Ingresa una fecha de partido válida, anterior o igual a hoy.'
  for (const field of ['tournament', 'result']) {
    if (typeof input[field] === 'string' && input[field].trim().length > 120) errors[field] = 'Usa hasta 120 caracteres.'
  }
  if (input.sourceType === 'file') {
    const error = validateVideoFile(input.file, maxBytes)
    if (error) errors.file = error
  } else if (input.sourceType === 'link') {
    const error = validateVideoUrl(input.url)
    if (!supportsLinks) errors.url = 'La importación por enlace aún no está disponible. Usa un archivo.'
    else if (error) errors.url = error
  } else errors.sourceType = 'Elige un archivo o un enlace.'
  return errors
}

export function normalizedMatch(input) {
  return {
    playerId: input.playerId,
    playerPosition: input.playerPosition,
    opponent: input.opponent.trim(),
    tournament: typeof input.tournament === 'string' ? input.tournament.trim() : '',
    matchDate: input.matchDate,
    result: typeof input.result === 'string' ? input.result.trim() : '',
  }
}

export function analysisSignature(input) {
  return JSON.stringify({ ...normalizedMatch(input), source: input.sourceType === 'file' ? [input.file.name, input.file.size, input.file.lastModified] : input.url.trim() })
}

export async function hashAnalysisSignature(signature) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature))
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export function throwIfAborted(signal) {
  if (signal?.aborted) throw new DOMException('Carga cancelada.', 'AbortError')
}

export function analysisErrorMessage(error) {
  if (error?.name === 'AbortError') return 'Carga cancelada antes de crear el partido. Puedes volver a intentarlo.'
  if (error?.code === 'analysis/player') return 'El jugador ya no está disponible en tu organización. Actualiza la lista.'
  if (error?.code === 'analysis/validation') return 'Revisa los datos y el video antes de continuar.'
  if (error?.code === 'permission-denied' || error?.code === 'unauthenticated') return 'Tu sesión no permite realizar esta operación. Vuelve a iniciar sesión o consulta con el administrador.'
  if (error?.code === 'unavailable') return 'No hay conexión con el servicio. Tus datos siguen en el formulario; vuelve a intentarlo.'
  return 'No pudimos completar la operación. Conservamos el formulario para que puedas reintentarlo.'
}
