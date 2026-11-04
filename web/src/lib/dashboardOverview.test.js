import { describe, expect, it, vi } from 'vitest'
import { buildDashboardOverview, DASHBOARD_STATISTICS_SCHEMA, normalizeDashboardStatistics } from './dashboardOverview.js'
import { decodeWorkerDashboardStatistics } from './workerDashboardStatistics.js'

const statistics = fields => ({ schemaVersion: DASHBOARD_STATISTICS_SCHEMA, playerId: 'p1', ...fields })
const match = (id, fields = {}) => ({ id, orgId: 'org-a', playerId: 'p1', status: 'listo', ...fields })
const context = { orgId: 'org-a', playerId: 'p1', decodeStatistics: row => row.statistics }

describe('KPIs de Dashboard · contrato de adaptación explícito', () => {
  it('lee el jugador registrado del worker y pondera velocidades de golpe por muestras', () => {
    const output = (count, sumSpeedKmh) => ({
      schemaVersion: 'acecam.match-stats.v1',
      player: { shots: { count, sumSpeedKmh } },
      opponent: { shots: { count: 20, sumSpeedKmh: 2000 } },
    })
    const result = buildDashboardOverview([
      match('a', { statistics: output(1, 62.5) }),
      match('b', { statistics: output(2, 175) }),
    ], { ...context, decodeStatistics: decodeWorkerDashboardStatistics })
    expect(result.metrics).toMatchObject({
      analyzedMatches: 2, measuredShots: 3, averageShotSpeed: 237.5 / 3,
      averageServeSpeed: null, firstServeInRate: null, doubleFaults: null,
    })
  })

  it('conserva cero golpes medidos y excluye datos inválidos o de otra versión', () => {
    const output = { schemaVersion: 'acecam.match-stats.v1', player: { shots: { count: 0, sumSpeedKmh: 0 } } }
    const result = buildDashboardOverview([
      match('zero', { statistics: output }),
      match('invalid', { statistics: { ...output, player: { shots: { count: '2', sumSpeedKmh: 110 } } } }),
      match('future', { statistics: { ...output, schemaVersion: 'acecam.match-stats.v2' } }),
    ], { ...context, decodeStatistics: decodeWorkerDashboardStatistics })
    expect(result.metrics).toMatchObject({ analyzedMatches: 1, measuredShots: 0, averageShotSpeed: null })
    expect(result.coverage.incompatibleMatches).toBe(2)
  })

  it('pondera por muestras y suma numeradores/denominadores, sin promediar promedios', () => {
    const result = buildDashboardOverview([
      match('m1', { statistics: statistics({ serveSpeed: { sumKmh: 100, sampleCount: 1 }, firstServe: { in: 1, attempts: 1 }, doubleFaults: 0 }) }),
      match('m2', { statistics: statistics({ serveSpeed: { sumKmh: 1800, sampleCount: 9 }, firstServe: { in: 1, attempts: 9 }, doubleFaults: 2 }) }),
    ], context)
    expect(result.metrics).toEqual({ analyzedMatches: 2, averageServeSpeed: 190, firstServeInRate: 20, doubleFaults: 2 })
    expect(result.coverage).toEqual({ completedMatches: 2, compatibleMatches: 2, incompatibleMatches: 0 })
  })

  it('excluye otra organización, otro jugador, estados incompletos y IDs duplicados', () => {
    const decoder = vi.fn(context.decodeStatistics)
    const valid = match('one', { statistics: statistics({ doubleFaults: 0 }) })
    const result = buildDashboardOverview([valid, valid, { ...valid, id: 'other-org', orgId: 'org-b' }, { ...valid, id: 'other-player', playerId: 'p2' }, { ...valid, id: 'pending', status: 'procesando' }, { ...valid, id: 'failed', status: 'error' }], { ...context, decodeStatistics: decoder })
    expect(result.metrics.analyzedMatches).toBe(1)
    expect(result.metrics.doubleFaults).toBe(0)
    expect(decoder).toHaveBeenCalledTimes(1)
  })

  it('no usa velocidades de golpe como velocidades de saque ni adivina esquemas', () => {
    const result = buildDashboardOverview([
      match('legacy', { statistics: { player_1_average_shot_speed: 140 } }),
      match('wrong-player', { statistics: { ...statistics({ doubleFaults: 1 }), playerId: 'p2' } }),
      match('unknown-version', { statistics: { ...statistics({ doubleFaults: 1 }), schemaVersion: 'future-schema' } }),
    ], context)
    expect(result.metrics).toEqual({ analyzedMatches: 0, averageServeSpeed: null, firstServeInRate: null, doubleFaults: null })
    expect(result.coverage.incompatibleMatches).toBe(3)
  })

  it('un denominador cero no genera Infinity, NaN ni un porcentaje inventado', () => {
    const result = buildDashboardOverview([match('zero', { statistics: statistics({ serveSpeed: { sumKmh: 0, sampleCount: 0 }, firstServe: { in: 0, attempts: 0 }, doubleFaults: 0 }) })], context)
    expect(result.metrics).toEqual({ analyzedMatches: 1, averageServeSpeed: null, firstServeInRate: null, doubleFaults: 0 })
  })

  it('mantiene ceros medidos y porcentajes válidos sin coerción de strings', () => {
    const result = buildDashboardOverview([match('zero', { statistics: statistics({ serveSpeed: { sumKmh: 0, sampleCount: 2 }, firstServe: { in: 0, attempts: 5 }, doubleFaults: 0 }) })], context)
    expect(result.metrics.averageServeSpeed).toBe(0)
    expect(result.metrics.firstServeInRate).toBe(0)
    expect(normalizeDashboardStatistics(statistics({ doubleFaults: '0' }), 'p1')).toBeNull()
  })

  it('no presenta métricas parciales como totales completos', () => {
    const result = buildDashboardOverview([
      match('complete', { statistics: statistics({ serveSpeed: { sumKmh: 200, sampleCount: 2 }, firstServe: { in: 3, attempts: 5 }, doubleFaults: 2 }) }),
      match('partial', { statistics: statistics({ firstServe: { in: 1, attempts: 5 } }) }),
    ], context)
    expect(result.metrics).toEqual({ analyzedMatches: 2, averageServeSpeed: null, firstServeInRate: 40, doubleFaults: null })
  })

  it('rechaza contadores imposibles y métricas no finitas', () => {
    for (const invalid of [
      { serveSpeed: { sumKmh: 5, sampleCount: 0 } },
      { serveSpeed: { sumKmh: Infinity, sampleCount: 2 } },
      { serveSpeed: { sumKmh: 100, sampleCount: -1 } },
      { firstServe: { in: 6, attempts: 5 } },
      { firstServe: { in: 1.5, attempts: 5 } },
      { doubleFaults: -1 }, { doubleFaults: NaN },
    ]) expect(normalizeDashboardStatistics(statistics(invalid), 'p1')).toBeNull()
  })

  it('no convierte desbordamientos numéricos en resultados utilizables', () => {
    const huge = statistics({ serveSpeed: { sumKmh: 1e308, sampleCount: Number.MAX_SAFE_INTEGER }, firstServe: { in: 1, attempts: Number.MAX_SAFE_INTEGER }, doubleFaults: Number.MAX_SAFE_INTEGER })
    const result = buildDashboardOverview([match('a', { statistics: huge }), match('b', { statistics: huge })], context)
    expect(result.metrics).toEqual({ analyzedMatches: 2, averageServeSpeed: null, firstServeInRate: null, doubleFaults: null })
  })

  it('diferencia una consulta vacía de estadísticas incompatibles', () => {
    const result = buildDashboardOverview([], context)
    expect(result.metrics.analyzedMatches).toBe(0)
    expect(result.metrics.averageServeSpeed).toBeNull()
    expect(result.coverage).toEqual({ completedMatches: 0, compatibleMatches: 0, incompatibleMatches: 0 })
  })

  it('exige un decoder explícito y síncrono y conserva la entrada', () => {
    expect(() => buildDashboardOverview([], { ...context, decodeStatistics: undefined })).toThrow()
    const rows = [match('one', { statistics: statistics({ doubleFaults: 0 }) })]
    const original = structuredClone(rows)
    expect(() => buildDashboardOverview(rows, { ...context, decodeStatistics: () => Promise.resolve(null) })).toThrow('synchronous')
    buildDashboardOverview(rows, context)
    expect(rows).toEqual(original)
  })
})
