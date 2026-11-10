import { addDoc, collection, doc, getDocFromServer, serverTimestamp } from 'firebase/firestore'
import { normalizePlayer } from './players.js'
import { APPLICATION_CONSENT_VERSION, APPLICATION_STATUS, APPLICATION_VIDEO_CONSENT_VERSION, COLLECTIONS } from './schema.js'

export function applicationForms(db, orgId) {
  return collection(db, COLLECTIONS.orgs, orgId, COLLECTIONS.applicationForms)
}

export function publicApplicationPath(orgId, formId) {
  return `/postular/${encodeURIComponent(orgId)}/${encodeURIComponent(formId)}`
}

export async function publicFormExists(db, orgId, formId) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(orgId) || !/^[A-Za-z0-9]{20}$/.test(formId)) return false
  return (await getDocFromServer(doc(applicationForms(db, orgId), formId))).exists()
}

const text = (value) => (typeof value === 'string' ? value.trim() : '')

/**
 * Errores de los datos de contacto, campo por campo (PCIT-183).
 * Mismos límites que las reglas de `applications` en firestore.rules.
 */
export function validateApplicationContact(input) {
  const errors = {}
  const city = text(input.city)
  const email = text(input.email)
  const year = text(String(input.graduationYear ?? ''))
  if (city.length < 2 || city.length > 100) errors.city = 'Escribe tu ciudad (entre 2 y 100 caracteres).'
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Escribe un correo válido.'
  if (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > 2100) {
    errors.graduationYear = 'Escribe el año con 4 cifras, por ejemplo 2027.'
  }
  if (text(input.message).length > 1000) errors.message = 'El mensaje puede tener hasta 1000 caracteres.'
  return errors
}

export function submitPublicApplication(db, { orgId, formId }, input) {
  // Se juntan los errores del jugador y los de contacto para mostrarlos todos a la vez.
  const errors = validateApplicationContact(input)
  let player
  try {
    // Las reglas calculan la edad con la misma fecha UTC.
    player = normalizePlayer(input, new Date().toISOString().slice(0, 10))
  } catch (failure) {
    if (!failure.fields) throw failure
    Object.assign(errors, failure.fields, errors)
  }
  if (Object.keys(errors).length) {
    throw Object.assign(new Error('applications/invalid-contact'), { code: 'applications/validation', fields: errors })
  }
  const city = text(input.city)
  const email = text(input.email)
  const message = text(input.message)
  const now = serverTimestamp()
  return addDoc(collection(db, COLLECTIONS.applications), {
    orgId,
    formId,
    status: APPLICATION_STATUS.new,
    fullName: player.fullName,
    birthDate: player.birthDate,
    city,
    email,
    graduationYear: player.graduationYear,
    academy: player.academy,
    guardian: player.guardian ?? null,
    message,
    consent: {
      accepted: true,
      version: input.attachVideo ? APPLICATION_VIDEO_CONSENT_VERSION : APPLICATION_CONSENT_VERSION,
      method: player.guardian ? 'guardian' : 'self',
      recordedBy: 'public-form',
      recordedAt: now,
    },
    createdAt: now,
  })
}
