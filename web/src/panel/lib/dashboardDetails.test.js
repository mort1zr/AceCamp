import { expect, it } from 'vitest'
import { buildDashboardDetails } from './dashboardDetails.js'
import { buildDashboardEvolution } from './dashboardEvolution.js'
import { decodeWorkerDashboardStatistics } from './workerDashboardStatistics.js'

const context = { orgId: 'org-a', playerId: 'p1', decodeStatistics: decodeWorkerDashboardStatistics }
const row = (id, overrides = {}) => ({ id, orgId: 'org-a', playerId: 'p1', status: 'listo', matchDate: '2026-11-01',
  statistics: { schemaVersion: 'acecam.match-stats.v1', player: {
    shots: { count: 1, sumSpeedKmh: 50 },
    serve: { sampleCount: 2, sumSpeedKmh: 200, firstServeAttempts: 4, firstServeIn: 3, doubleFaults: 0 },
    movement: { distanceMeters: 10, maxSpeedKmh: 12 },
  }, rallies: { count: 2, sumShots: 10, longestShots: 7, short: 1, medium: 1, long: 0 } }, ...overrides })

it('agrega solo el jugador y organización, sin duplicar partidos; pondera por conteos y conserva ceros', () => {
  const first = row('a')
  const second = row('b')
  second.statistics.rallies = { count: 1, sumShots: 15, longestShots: 15, short: 0, medium: 0, long: 1 }
  const result = buildDashboardDetails([first, first, second, row('other', { orgId: 'org-b' }), row('pending', { status: 'procesando' }), row('p2', { playerId: 'p2' })], context)
  expect(result.serve).toEqual({ firstIn: 6, secondIn: null, doubleFaults: 0 })
  expect(result.movement).toEqual({ distanceMeters: 20, maxSpeedKmh: 12 })
  expect(result.rallies).toMatchObject({ count: 3, short: 1, medium: 1, long: 1, averageShots: 25 / 3, longestShots: 15 })
})

it('no completa un periodo con ceros si faltan campos o los contadores son inconsistentes', () => {
  const missing = row('b')
  delete missing.statistics.player.serve.firstServeIn
  missing.statistics.rallies.short = 9
  missing.statistics.player.movement.distanceMeters = '10'
  const result = buildDashboardDetails([row('a'), missing], context)
  expect(result.serve.firstIn).toBeNull()
  expect(result.serve.doubleFaults).toBe(0)
  expect(result.rallies.short).toBe(1)
  expect(result.rallies).toMatchObject({ coveredMatches: 1, totalMatches: 2 })
  expect(result.movement.distanceMeters).toBeNull()
  expect(buildDashboardDetails([], context).rallies.count).toBeNull()
})

it('evolución de saque usa las muestras de saque y conserva huecos sin recurrir a la velocidad de golpe', () => {
  const missing = row('b', { matchDate: '2026-11-02' })
  delete missing.statistics.player.serve
  const result = buildDashboardEvolution([missing, row('a')], context, 'averageServeSpeed')
  expect(result.points.map(p => p.averageServeSpeed)).toEqual([100, null])
  expect(result.points[0]).not.toHaveProperty('averageShotSpeed')
})
