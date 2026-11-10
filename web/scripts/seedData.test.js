import { describe, expect, it } from 'vitest'
import {
  BACKHANDS,
  DOMINANT_HANDS,
  INVITE_STATUS,
  MATCH_STATS_VERSION,
  MATCH_STATUS,
  PLAYER_CATEGORIES,
  PLAYER_POSITIONS,
  ROLES,
  isApplicationStatus,
  isIsoDate,
  isMatchStatus,
} from '../src/panel/lib/schema.js'
import { PLANES, pruebaVencida } from '../src/panel/lib/planes.js'
import { buildSeedData } from './seedData.mjs'

const data = buildSeedData()
const orgIds = new Set(data.orgs.map(org => org.id))
const playersById = new Map(data.players.map(player => [player.id, player.doc]))
const ageOn = (birthDate, today = '2026-11-03') => {
  const [y, m, d] = birthDate.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0)
}

describe('datos de ejemplo de Firestore', () => {
  it('cubren dos organizaciones y todos los estados', () => {
    expect(orgIds.size).toBe(2)
    expect(new Set(data.matches.map(m => m.doc.status))).toEqual(new Set(Object.values(MATCH_STATUS)))
  })

  it('usuarios con rol válido, organización existente y dueño correcto', () => {
    for (const user of data.users) {
      expect(ROLES).toContain(user.doc.role)
      expect(orgIds.has(user.doc.orgId)).toBe(true)
    }
    for (const org of data.orgs) {
      const owner = data.users.find(user => user.uid === org.doc.ownerId)
      expect(owner?.doc.orgId).toBe(org.id)
    }
  })

  it('jugadores válidos, con consentimiento y apoderado si son menores', () => {
    for (const { doc } of data.players) {
      expect(orgIds.has(doc.orgId)).toBe(true)
      expect(isIsoDate(doc.birthDate)).toBe(true)
      expect(doc.consent).toMatchObject({ accepted: true, version: 'players-v1', method: 'coach-attestation' })
      if (doc.category !== null) expect(PLAYER_CATEGORIES).toContain(doc.category)
      if (doc.dominantHand !== null) expect(DOMINANT_HANDS).toContain(doc.dominantHand)
      if (doc.backhand !== null) expect(BACKHANDS).toContain(doc.backhand)
      if (ageOn(doc.birthDate) < 18) expect(doc.guardian?.name).toBeTruthy()
      expect(doc).not.toHaveProperty('age')
    }
  })

  it('partidos del jugador y la organización correctos, con estadísticas solo si están listos', () => {
    for (const { id, doc } of data.matches) {
      expect(isMatchStatus(doc.status)).toBe(true)
      expect(playersById.get(doc.playerId)?.orgId).toBe(doc.orgId)
      expect(PLAYER_POSITIONS).toContain(doc.playerPosition)
      expect(isIsoDate(doc.matchDate)).toBe(true)
      expect(doc.videoPath).toBe(`orgs/${doc.orgId}/matches/${id}/video.mp4`)
      if (doc.status === MATCH_STATUS.ready) {
        expect(doc.statistics.schemaVersion).toBe(MATCH_STATS_VERSION)
        const serve = doc.statistics.player.serve
        expect(serve.firstServeIn).toBeLessThanOrEqual(serve.firstServeAttempts)
      } else {
        expect(doc.statistics).toBeNull()
      }
      if (doc.status === MATCH_STATUS.error) expect(doc.errorMessage).toBeTruthy()
    }
  })

  it('postulaciones con estado válido y sin campos auxiliares', () => {
    for (const { doc } of data.applications) {
      expect(orgIds.has(doc.orgId)).toBe(true)
      expect(isApplicationStatus(doc.status)).toBe(true)
      expect(doc.consent.recordedBy).toBe('public-form')
      expect(doc).not.toHaveProperty('sentOn')
      if (ageOn(doc.birthDate) < 18) expect(doc.guardian?.name).toBeTruthy()
    }
  })

  it('el contador de uso coincide con los partidos de cada organización y mes (PCIT-41)', () => {
    const total = data.usage.reduce((sum, item) => sum + item.doc.analyses, 0)
    expect(total).toBe(data.matches.length)
    for (const { orgId, id, doc } of data.usage) {
      expect(orgIds.has(orgId)).toBe(true)
      expect(id).toMatch(/^\d{4}-\d{2}$/)
      const delMes = data.matches.filter(m => m.doc.orgId === orgId && m.doc.createdAt.toISOString().startsWith(id))
      expect(doc.analyses).toBe(delMes.length)
      expect(delMes.map(m => m.id)).toContain(doc.lastMatchId)
    }
  })

  it('planes válidos: contratados con periodo y fecha (PCIT-158)', () => {
    for (const { doc } of data.orgs) {
      expect(Object.keys(PLANES)).toContain(doc.plan)
      if (doc.plan === 'free') continue
      expect(['mensual', 'anual']).toContain(doc.billingCycle)
      expect(doc.planSince).toBeInstanceOf(Date)
    }
  })

  it('una organización con plan activo y otra con la prueba vencida (PCIT-173)', () => {
    const club = data.orgs.find(org => org.doc.plan === 'prueba')
    expect(club?.id).toBe('org-club')
    // Vencida desde el 4 de noviembre de 2026 (30 días después de planSince).
    expect(pruebaVencida(club.doc, new Date('2026-11-05T00:00:00Z'))).toBe(true)
    expect(pruebaVencida(club.doc)).toBe(true)
    expect(data.orgs.some(org => org.doc.plan === 'ultra' && !pruebaVencida(org.doc))).toBe(true)
  })

  it('invitaciones pendientes con el correo como ID, de un dueño y a alguien sin cuenta (PCIT-40)', () => {
    expect(data.invites.length).toBeGreaterThan(0)
    for (const { id, doc } of data.invites) {
      expect(id).toBe(doc.email)
      expect(id).toBe(id.toLowerCase())
      expect(doc.status).toBe(INVITE_STATUS.pending)
      expect(ROLES).toContain(doc.role)
      expect(data.orgs.find(org => org.id === doc.orgId)?.doc.ownerId).toBe(doc.invitedBy)
      expect(data.users.some(user => user.email === doc.email)).toBe(false)
    }
  })

  it('IDs únicos en cada colección', () => {
    for (const name of ['orgs', 'players', 'matches', 'applications', 'invites']) {
      const ids = data[name].map(item => item.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe('isIsoDate', () => {
  it('acepta fechas reales y rechaza las imposibles', () => {
    expect(isIsoDate('2026-02-28')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('31/10/2026')).toBe(false)
  })
})
