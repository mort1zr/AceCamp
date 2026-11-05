import { DASHBOARD_STATISTICS_SCHEMA } from './dashboardOverview.js'

export const WORKER_MATCH_STATS_VERSION = 'acecam.match-stats.v1'

const has = (object, key) => object != null && Object.prototype.hasOwnProperty.call(object, key)

/**
 * PCIT-35 already maps the registered player's position to statistics.player.
 * Traduce matches.statistics (docs/firestore-schema.md) al modelo del Dashboard.
 * Un campo que el worker no escribió queda ausente (desconocido), nunca 0:
 * normalizeDashboardStatistics valida tipos y contadores.
 */
export function decodeWorkerDashboardStatistics(match, { playerId }) {
  const statistics = match?.statistics
  if (match?.playerId !== playerId || statistics?.schemaVersion !== WORKER_MATCH_STATS_VERSION) return null
  const shots = statistics.player?.shots
  const serve = statistics.player?.serve
  if (!shots && !serve) return null

  const decoded = { schemaVersion: DASHBOARD_STATISTICS_SCHEMA, playerId }
  if (shots) decoded.shots = { sampleCount: shots.count, sumKmh: shots.sumSpeedKmh }
  if (serve) {
    // Velocidad media del saque hasta el bote: solo de los saques con bote visto (sampleCount).
    if (has(serve, 'sampleCount') && has(serve, 'sumSpeedKmh')) {
      decoded.serveSpeed = { sampleCount: serve.sampleCount, sumKmh: serve.sumSpeedKmh }
    }
    if (has(serve, 'firstServeAttempts') && has(serve, 'firstServeIn')) {
      decoded.firstServe = { attempts: serve.firstServeAttempts, in: serve.firstServeIn }
    }
    if (has(serve, 'doubleFaults')) decoded.doubleFaults = serve.doubleFaults
  }
  return decoded
}
