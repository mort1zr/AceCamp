import { describe, expect, it } from 'vitest'
import { normalizePlayer, playerAge, validatePlayer } from './players.js'

const valid = { fullName: '  Ana   Torres  ', birthDate: '2004-11-03', academy: '  Club Central ', consentAccepted: true }

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
    expect(validatePlayer({ ...valid, birthDate: '2024-02-29' }, '2026-11-02')).toEqual({})
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
