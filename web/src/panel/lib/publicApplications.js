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

const VIDEO_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'])

export function parseVideoLinks(text) {
  const lines = String(text ?? '').split(/[\n,]+/).map(line => line.trim()).filter(Boolean)
  if (lines.length > 5) throw Object.assign(new Error('applications/invalid-contact'), { fields: { videoLinks: 'Agrega hasta 5 enlaces.' } })
  return lines.map(line => {
    let url
    try { url = new URL(/^https?:\/\//i.test(line) ? line : `https://${line}`) } catch { url = null }
    if (!url || url.protocol !== 'https:' || !VIDEO_HOSTS.has(url.hostname) || url.href.length > 300) {
      throw Object.assign(new Error('applications/invalid-contact'), { fields: { videoLinks: 'Usa enlaces de YouTube válidos, uno por línea.' } })
    }
    return url.href
  })
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
  const videoLinks = parseVideoLinks(input.videoLinks)
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
    ...Object.fromEntries(['utr', 'nationalRanking', 'dominantHand', 'backhand'].filter(key => player[key] != null).map(key => [key, player[key]])),
    ...(videoLinks.length ? { videoLinks } : {}),
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
