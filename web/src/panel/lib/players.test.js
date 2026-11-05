import { describe, expect, it } from 'vitest'
import { normalizePlayer, playerAge, validatePlayer } from './players.js'

const valid = { fullName: '  Ana   Torres  ', birthDate: '2004-11-03', academy: '  Club Central ', consentAccepted: true }

it('normaliza los datos deportivos y rechaza números o categorías inválidos', () => {
  expect(normalizePlayer({ ...valid, category: 'Adulto', dominantHand: 'diestro', backhand: 'dos manos', utr: '10.4', nationalRanking: '20', graduationYear: '2027', nationality: ' Perú ' }, '2026-11-03')).toMatchObject({ category: 'Adulto', utr: 10.4, nationalRanking: 20, graduationYear: 2027, nationality: 'Perú' })
  for (const fields of [{ utr: 'Infinity' }, { utr: true }, { category: 'inventada' }, { nationalRanking: '0' }, { nationalRanking: '1.5' }, { graduationYear: '2200' }]) {
    const key = Object.keys(fields)[0]
    expect(validatePlayer({ ...valid, ...fields }, '2026-11-03')[key]).toBeTruthy()
  }
})

describe('Validación de jugadores', () => {
  it('calcula edad por fecha calendario y conserva el cumpleaños correcto', () => {
    expect(playerAge('2004-11-03', '2026-11-02')).toBe(21)
    expect(playerAge('2004-11-03', '2026-11-03')).toBe(22)
    expect(playerAge('2004-11-03', '2026-11-04')).toBe(22)
    expect(playerAge('2026-11-04', '2026-11-03')).toBeNull()
  })

  it('rechaza fechas inexistentes, futuras y entradas incompletas', () => {
    for (const birthDate of ['2025-02-29', '2024-02-30', '2024-13-01', '2099-01-01', '', '2004-1-3']) {
      expect(validatePlayer({ ...valid, birthDate }, '2026-11-02').birthDate).toBeTruthy()
    }
    expect(validatePlayer({ ...valid, birthDate: '2024-02-29' }, '2026-11-02').birthDate).toBeUndefined()
  })

  it('exige apoderado hasta el día anterior al cumpleaños 18 y omite sus datos para un adulto', () => {
    const minor = { ...valid, birthDate: '2008-11-03' }
    const today = '2026-11-02'
    expect(validatePlayer(minor, today)).toMatchObject({
      guardianName: expect.any(String), guardianPhone: expect.any(String), guardianEmail: expect.any(String),
    })
    const fields = { ...minor, guardianName: '  Ana   de Prueba  ', guardianPhone: ' +51 900 000 000 ', guardianEmail: ' demo@example.test ' }
    expect(normalizePlayer(fields, today).guardian).toEqual({
      name: 'Ana de Prueba', phone: '+51 900 000 000', email: 'demo@example.test',
    })
    expect(normalizePlayer(fields, '2026-11-03')).not.toHaveProperty('guardian')
  })

  it('exige consentimiento explícito y no admite cadenas equivalentes a true', () => {
    for (const consentAccepted of [false, undefined, 'true', 1]) {
      expect(() => normalizePlayer({ ...valid, consentAccepted })).toThrow('Revisa los datos')
    }
  })

  it('normaliza texto y descarta campos ajenos al formulario', () => {
    expect(normalizePlayer({ ...valid, orgId: 'otra-org', createdBy: 'otro-usuario', consent: { accepted: false } })).toEqual({
      fullName: 'Ana Torres', birthDate: '2004-11-03', academy: 'Club Central',
    })
  })
})
