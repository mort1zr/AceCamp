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

export function submitPublicApplication(db, { orgId, formId }, input) {
  // Las reglas calculan la edad con la misma fecha UTC.
  const player = normalizePlayer(input, new Date().toISOString().slice(0, 10))
  const city = input.city.trim()
  const email = input.email.trim()
  const message = input.message.trim()
  if (city.length < 2 || city.length > 100 || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || player.graduationYear == null ||
      !/^\d{4}$/.test(input.graduationYear) || message.length > 1000) {
    throw new Error('applications/invalid-contact')
  }
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
