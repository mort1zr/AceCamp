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
  expect(result.serve).toMatchObject({ attempts: 8, firstIn: 6, secondIn: 2, doubleFaults: 0 })
  expect(result.movement).toMatchObject({ distanceMeters: 20, distancePerMatch: 10, maxSpeedKmh: 12, averageSpeedKmh: null, heatmap: null })
  expect(result.rallies).toMatchObject({ count: 3, short: 1, medium: 1, long: 1, averageShots: 25 / 3, longestShots: 15 })
})

it('suma la velocidad máxima de golpe y la velocidad del primer y segundo saque cuando el modelo las entrega', () => {
  const grupo = (count, total, max) => ({ sampleCount: count, sumSpeedKmh: total, maxSpeedKmh: max })
  const a = row('a')
  const b = row('b')
  a.statistics.player.shots.maxSpeedKmh = 150
  b.statistics.player.shots.maxSpeedKmh = 162
  a.statistics.player.serve.firstServe = grupo(2, 380, 200)
  b.statistics.player.serve.firstServe = grupo(2, 400, 215)
  a.statistics.player.serve.secondServe = grupo(1, 150, 150)
  b.statistics.player.serve.secondServe = grupo(1, 160, 160)
  const result = buildDashboardDetails([a, b], context)
  expect(result.shots.maxSpeedKmh).toBe(162)
  expect(result.serve.first).toEqual({ averageSpeedKmh: 195, maxSpeedKmh: 215 })
  expect(result.serve.second).toEqual({ averageSpeedKmh: 155, maxSpeedKmh: 160 })
})

it('calcula los segundos saques dentro solo si todo partido trae intentos, primeros dentro y dobles faltas coherentes', () => {
  const a = row('a')
  const b = row('b')
  a.statistics.player.serve = { ...a.statistics.player.serve, firstServeAttempts: 10, firstServeIn: 6, doubleFaults: 1 }
  b.statistics.player.serve = { ...b.statistics.player.serve, firstServeAttempts: 10, firstServeIn: 7, doubleFaults: 0 }
  expect(buildDashboardDetails([a, b], context).serve).toMatchObject({ attempts: 20, firstIn: 13, secondIn: 6, doubleFaults: 1 })
  delete b.statistics.player.serve.doubleFaults
  expect(buildDashboardDetails([a, b], context).serve.secondIn).toBeNull()
  b.statistics.player.serve.doubleFaults = 5
  expect(buildDashboardDetails([a, b], context).serve.secondIn).toBeNull()
})

it('suma los mapas de calor del mismo tamaño y rechaza los incompletos', () => {
  const mapa = cells => ({ columns: 2, rows: 2, cells })
  const a = row('a')
  const b = row('b')
  a.statistics.player.movement.heatmap = mapa([1, 2, 3, 4])
  b.statistics.player.movement.heatmap = mapa([4, 3, 2, 1])
  a.statistics.player.movement.avgSpeedKmh = 6
  b.statistics.player.movement.avgSpeedKmh = 8
  const result = buildDashboardDetails([a, b], context).movement
  expect(result.heatmap).toEqual({ columns: 2, rows: 2, cells: [5, 5, 5, 5] })
  expect(result.averageSpeedKmh).toBe(7)
  b.statistics.player.movement.heatmap = { columns: 3, rows: 1, cells: [1, 1, 1] }
  expect(buildDashboardDetails([a, b], context).movement.heatmap).toBeNull()
  delete b.statistics.player.movement.heatmap
  expect(buildDashboardDetails([a, b], context).movement.heatmap).toBeNull()
})

it('deja sin datos el saque por tipo mientras el modelo no lo entregue', () => {
  const result = buildDashboardDetails([row('a'), row('b')], context)
  expect(result.shots.maxSpeedKmh).toBeNull()
  expect(result.serve.first).toEqual({ averageSpeedKmh: null, maxSpeedKmh: null })
  expect(result.serve.second).toEqual({ averageSpeedKmh: null, maxSpeedKmh: null })
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
