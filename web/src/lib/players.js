export const PLAYER_CONSENT_VERSION = 'players-v1'

function localDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function isValidBirthDate(value, today = localDateString(new Date())) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return year >= 1900 && value <= today && parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

export function playerAge(birthDate, today = localDateString(new Date())) {
  if (!isValidBirthDate(birthDate, today)) return null
  const [year, month, day] = birthDate.split('-').map(Number)
  const [currentYear, currentMonth, currentDay] = today.split('-').map(Number)
  return currentYear - year - (currentMonth < month || (currentMonth === month && currentDay < day) ? 1 : 0)
}

export function requiresPlayerGuardian(birthDate, today) {
  const age = playerAge(birthDate, today)
  return age !== null && age < 18
}

export function validatePlayer(input, today) {
  const errors = {}
  const name = typeof input.fullName === 'string' ? input.fullName.trim() : ''
  if (name.length < 2 || name.length > 120) errors.fullName = 'Escribe un nombre de entre 2 y 120 caracteres.'
  if (!isValidBirthDate(input.birthDate, today)) errors.birthDate = 'Ingresa una fecha de nacimiento válida, anterior o igual a hoy.'
  if (typeof input.academy === 'string' && input.academy.trim().length > 120) errors.academy = 'Usa hasta 120 caracteres para la academia.'
  if (requiresPlayerGuardian(input.birthDate, today)) {
    const name = typeof input.guardianName === 'string' ? input.guardianName.trim() : ''
    const phone = typeof input.guardianPhone === 'string' ? input.guardianPhone.trim() : ''
    const email = typeof input.guardianEmail === 'string' ? input.guardianEmail.trim() : ''
    if (name.length < 2 || name.length > 120) errors.guardianName = 'Escribe el nombre del apoderado (entre 2 y 120 caracteres).'
    if (!/^\+?[0-9 ().-]{7,32}$/.test(phone) || phone.replace(/\D/g, '').length < 7) {
      errors.guardianPhone = 'Escribe un teléfono válido del apoderado.'
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.guardianEmail = 'Escribe un correo válido del apoderado.'
    }
  }
  if (input.consentAccepted !== true) errors.consentAccepted = 'Debes confirmar la autorización antes de registrar al jugador.'
  return errors
}

export function normalizePlayer(input, today = localDateString(new Date())) {
  const errors = validatePlayer(input, today)
  if (Object.keys(errors).length) {
    const error = new Error('Revisa los datos del jugador.')
    error.code = 'players/validation'
    error.fields = errors
    throw error
  }
  // Explicit allow-list: callers cannot supply orgId, IDs or consent metadata.
  const fields = {
    fullName: input.fullName.trim().replace(/\s+/g, ' '),
    birthDate: input.birthDate,
    academy: typeof input.academy === 'string' ? input.academy.trim() : '',
  }
  if (requiresPlayerGuardian(input.birthDate, today)) {
    fields.guardian = {
      name: input.guardianName.trim().replace(/\s+/g, ' '),
      phone: input.guardianPhone.trim(),
      email: input.guardianEmail.trim(),
    }
  }
  return fields
}

export function playersErrorMessage(error, action = 'load') {
  if (error?.code === 'permission-denied' || error?.code === 'unauthenticated') {
    return 'Tu sesión no permite acceder a estos jugadores. Vuelve a iniciar sesión o consulta con el administrador.'
  }
  if (error?.code === 'unavailable') return 'No hay conexión con el servicio. Revisa tu conexión y vuelve a intentarlo.'
  return action === 'create' ? 'No pudimos guardar al jugador. Tus datos siguen en el formulario; vuelve a intentarlo.' : 'No pudimos cargar los jugadores. Vuelve a intentarlo.'
}
