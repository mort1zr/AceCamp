// Esquema de Firestore compartido (PCIT-22).
// Fuente única de nombres de colecciones, estados y valores permitidos.
// Documentación completa: docs/firestore-schema.md
// Si cambias algo aquí, actualiza también ese documento y avisa al worker (PCIT-35).

export const SCHEMA_VERSION = 1

export const COLLECTIONS = Object.freeze({
  users: 'users',
  orgs: 'orgs',
  players: 'players',
  matches: 'matches',
  applications: 'applications',
  applicationForms: 'applicationForms',
  invites: 'invites',
})

export const ROLES = Object.freeze(['coach', 'admin'])
export const MATCH_NOTES = Object.freeze({ collection: 'coachNotes', maxLength: 2000 })
/** Contador mensual de análisis: orgs/{orgId}/usage/{YYYY-MM} (PCIT-41). */
export const ORG_USAGE = Object.freeze({ collection: 'usage' })
/** Estados de una invitación invites/{correo} (PCIT-40). */
export const INVITE_STATUS = Object.freeze({ pending: 'pendiente', accepted: 'aceptada' })

/** Estados de un partido. Los escribe la web ('en cola') y el worker (el resto). */
export const MATCH_STATUS = Object.freeze({
  queued: 'en cola',
  processing: 'procesando',
  ready: 'listo',
  error: 'error',
})

/** Estados de una postulación de reclutamiento. */
export const APPLICATION_STATUS = Object.freeze({
  new: 'nueva',
  inReview: 'en revisión',
  analyzed: 'analizada',
  contacted: 'contactada',
  discarded: 'descartada',
})

export const PLAYER_CATEGORIES = Object.freeze(['Sub-14', 'Sub-16', 'Sub-18', 'Adulto'])
export const DOMINANT_HANDS = Object.freeze(['diestro', 'zurdo'])
export const BACKHANDS = Object.freeze(['dos manos', 'una mano'])
export const PLAYER_POSITIONS = Object.freeze(['arriba', 'abajo'])
export const COURT_SURFACES = Object.freeze(['arcilla', 'dura', 'césped', 'otra'])

/** Versión del texto de autorización (Ley N.° 29733) que acepta el entrenador. */
export const PLAYER_CONSENT_VERSION = 'players-v1'
export const APPLICATION_CONSENT_VERSION = 'applications-v1'
export const APPLICATION_VIDEO_CONSENT_VERSION = 'applications-video-v1'
export const CONSENT_METHODS = Object.freeze(['coach-attestation', 'self', 'guardian'])

/** Versión del objeto matches.statistics que escribe el worker. */
export const MATCH_STATS_VERSION = 'acecam.match-stats.v1'

export const isMatchStatus = value => Object.values(MATCH_STATUS).includes(value)
export const isApplicationStatus = value => Object.values(APPLICATION_STATUS).includes(value)

/** Fecha calendario sin hora, como se guardan birthDate y matchDate. */
export const isIsoDate = value =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value)
