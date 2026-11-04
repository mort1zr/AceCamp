import { describe, expect, it } from 'vitest'
import { buildDashboardEvolution, formatMatchDate, selectEvolutionPoints } from './dashboardEvolution.js'
import { DASHBOARD_STATISTICS_SCHEMA } from './dashboardOverview.js'

const scope = { orgId: 'org-a', playerId: 'p1', decodeStatistics: row => row.statistics }
const row = (id, date, sumKmh, sampleCount = 1, extra = {}) => ({ id, orgId: 'org-a', playerId: 'p1', status: 'listo', matchDate: date, statistics: { schemaVersion: DASHBOARD_STATISTICS_SCHEMA, playerId: 'p1', shots: { sumKmh, sampleCount } }, ...extra })

describe('Evolución por partido', () => {
  it('ordena por fecha, conserva varios partidos del mismo día y no modifica las entradas', () => {
    const rows = [row('c', '2026-02-01', 140), row('b', '2026-01-01', 260, 2), row('a', '2026-01-01', 120)]
    const original = structuredClone(rows)
    const result = buildDashboardEvolution(rows, scope)
    expect(result.points.map(point => point.matchId)).toEqual(['a', 'b', 'c'])
    expect(result.points.map(point => point.averageShotSpeed)).toEqual([120, 130, 140])
    expect(rows).toEqual(original)
  })

  it('no adivina fechas desde la fecha de subida o el día actual', () => {
    const result = buildDashboardEvolution([row('missing', undefined, 120, 1, { createdAt: '2026-01-01' }), row('invalid', '2026-02-30', 120), row('future', '2099-01-01', 120)], scope)
    expect(result.points).toEqual([])
    expect(formatMatchDate('2026-02-30')).toBe('Fecha no disponible')
  })

  it('conserva huecos sin ceros ficticios cuando falta la medición o el esquema no coincide', () => {
    const result = buildDashboardEvolution([
      row('a', '2026-01-01', 120),
      row('b', '2026-01-02', 0, 0),
      row('c', '2026-01-03', 140),
      row('legacy', '2026-01-04', 0, 1, { statistics: { player_1_average_shot_speed: 160 } }),
    ], scope)
    expect(result.points.map(point => point.averageShotSpeed)).toEqual([120, null, 140, null])
  })

  it('filtra duplicados, otro jugador, otra organización y partidos aún no listos', () => {
    const valid = row('one', '2026-01-01', 120)
    expect(buildDashboardEvolution([valid, valid, { ...valid, id: 'foreign', orgId: 'org-b' }, { ...valid, id: 'p2', playerId: 'p2' }, { ...valid, id: 'pending', status: 'procesando' }], scope).points).toHaveLength(1)
  })

  it('un cero medido sigue siendo cero y un solo partido no crea otro punto', () => {
    const result = buildDashboardEvolution([row('zero', '2026-01-01', 0, 1)], scope)
    expect(result.points).toHaveLength(1)
    expect(result.points[0].averageShotSpeed).toBe(0)
  })

  it('rechaza una serie anterior de otro jugador y valida los puntos de presentación', () => {
    const data = { playerId: 'p1', points: [
      { matchId: 'valid', playerId: 'p1', date: '2026-01-02', averageShotSpeed: 130 },
      { matchId: 'missing', playerId: 'p1', date: '2026-01-01', averageShotSpeed: '140' },
      { matchId: 'foreign', playerId: 'p2', date: '2026-01-01', averageShotSpeed: 120 },
    ] }
    expect(selectEvolutionPoints(data, 'p2')).toEqual([])
    expect(selectEvolutionPoints(data, 'p1').map(point => point.averageShotSpeed)).toEqual([null, 130])
    expect(formatMatchDate('2026-01-02')).toBe('02/01/2026')
    expect(formatMatchDate('2026-01-02', true)).toBe('02/01')
  })
})
