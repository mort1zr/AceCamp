// Invitar miembros a la organización (PCIT-40).
// Una invitación es el documento invites/{correo}: el ID es el correo en minúsculas,
// así la persona invitada la encuentra al registrarse sin poder listar las de otros.
// El plan Spark no envía correos: quien invita comparte el enlace de registro.

import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { COLLECTIONS, INVITE_STATUS, ROLES } from './schema.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const normalizarCorreo = (correo) => String(correo ?? '').trim().toLowerCase()

export function invitacionRef(db, correo) {
  return doc(db, COLLECTIONS.invites, normalizarCorreo(correo))
}

/** Devuelve el mensaje de error, o null si la invitación es válida. */
export function validarInvitacion({ email, role }) {
  if (!EMAIL_PATTERN.test(normalizarCorreo(email))) return 'El correo no es válido.'
  if (!ROLES.includes(role)) return 'Elige un rol válido.'
  return null
}

/** Crea la invitación pendiente para que esa persona se una a la organización. */
export async function invitarMiembro({ db, orgId, uid, email, role = 'coach' }) {
  if (!db || !orgId || !uid) throw new Error('Se necesita la sesión y la organización para invitar.')
  const error = validarInvitacion({ email, role })
  if (error) throw Object.assign(new Error(error), { code: 'invite/invalid' })
  const correo = normalizarCorreo(email)
  await setDoc(invitacionRef(db, correo), {
    email: correo,
    orgId,
    role,
    status: INVITE_STATUS.pending,
    invitedBy: uid,
    createdAt: serverTimestamp(),
  })
  return correo
}

/** Enlace de registro para compartir con la persona invitada (el plan Spark no envía correos). */
export function enlaceInvitacion(origen, correo) {
  return `${origen}/registro?invitacion=${encodeURIComponent(normalizarCorreo(correo))}`
}
