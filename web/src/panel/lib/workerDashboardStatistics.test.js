import { describe, expect, it } from 'vitest'
import { buildDashboardOverview } from './dashboardOverview.js'
import { decodeWorkerDashboardStatistics } from './workerDashboardStatistics.js'

const match = (id, statistics) => ({ id, orgId: 'org-a', playerId: 'p1', status: 'listo', statistics })
const context = { orgId: 'org-a', playerId: 'p1', decodeStatistics: decodeWorkerDashboardStatistics }
// Como lo escribe el worker (model/stats/match_stats.py): serve del jugador registrado y del rival.
const workerOutput = (serve, shots = { count: 3, sumSpeedKmh: 300 }) => ({
  schemaVersion: 'acecam.match-stats.v1',
  durationSeconds: 60,
  player: { shots, serve },
  opponent: { shots: { count: 9, sumSpeedKmh: 999 }, serve: { count: 5, sampleCount: 5, sumSpeedKmh: 800 } },
  rallies: { count: 4, sumShots: 20, longestShots: 9, short: 1, medium: 2, long: 1 },
})

describe('decodeWorkerDashboardStatistics · saque del worker', () => {
  it('lleva velocidad de saque, primer saque y dobles faltas del jugador registrado', () => {
    const serve = { count: 6, fromRight: 3, fromLeft: 3, sumSpeedKmh: 600, sampleCount: 4, maxSpeedKmh: 170,
      firstServeAttempts: 5, firstServeIn: 4, doubleFaults: 1 }
    expect(decodeWorkerDashboardStatistics(match('a', workerOutput(serve)), { playerId: 'p1' })).toEqual({
      schemaVersion: 'acecam.player-match.v1', playerId: 'p1',
      shots: { sampleCount: 3, sumKmh: 300 },
      serveSpeed: { sampleCount: 4, sumKmh: 600 },
      firstServe: { attempts: 5, in: 4 },
      doubleFaults: 1,
    })
  })

  it('deja ausente lo que el worker no pudo saber (nunca lo convierte en 0)', () => {
    const decoded = decodeWorkerDashboardStatistics(match('a', workerOutput({ count: 2, sumSpeedKmh: 0, sampleCount: 0 })), { playerId: 'p1' })
    expect(decoded.serveSpeed).toEqual({ sampleCount: 0, sumKmh: 0 })
    expect(decoded).not.toHaveProperty('firstServe')
    expect(decoded).not.toHaveProperty('doubleFaults')
  })

  it('agrega varios partidos ponderando por muestras y sumando intentos', () => {
    const result = buildDashboardOverview([
      match('m1', workerOutput({ count: 2, sumSpeedKmh: 300, sampleCount: 2, firstServeAttempts: 2, firstServeIn: 1, doubleFaults: 0 })),
      match('m2', workerOutput({ count: 3, sumSpeedKmh: 160, sampleCount: 1, firstServeAttempts: 2, firstServeIn: 2, doubleFaults: 1 })),
    ], context)
    expect(result.metrics).toMatchObject({
      analyzedMatches: 2, averageServeSpeed: 460 / 3, firstServeInRate: 75, doubleFaults: 1,
      measuredShots: 6, averageShotSpeed: 100,
    })
  })

  it('si un partido no sabe el primer saque, la métrica global queda sin datos', () => {
    const result = buildDashboardOverview([
      match('m1', workerOutput({ count: 2, sumSpeedKmh: 300, sampleCount: 2, firstServeAttempts: 2, firstServeIn: 1 })),
      match('m2', workerOutput({ count: 1, sumSpeedKmh: 0, sampleCount: 0 })),
    ], context)
    expect(result.metrics.firstServeInRate).toBeNull()
    expect(result.metrics.averageServeSpeed).toBe(150)
  })

  it('un partido sin saques medidos sigue contando por sus golpes', () => {
    const decoded = decodeWorkerDashboardStatistics(match('a', workerOutput(undefined)), { playerId: 'p1' })
    expect(decoded).toEqual({ schemaVersion: 'acecam.player-match.v1', playerId: 'p1', shots: { sampleCount: 3, sumKmh: 300 } })
  })
})
