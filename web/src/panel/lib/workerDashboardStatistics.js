import { DASHBOARD_STATISTICS_SCHEMA, normalizeDashboardStatistics } from './dashboardOverview.js'

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

export function reportMetrics(match) {
  const { playerId } = match
  const statistics = normalizeDashboardStatistics(decodeWorkerDashboardStatistics(match, { playerId }), playerId)
  const shots = statistics?.shots
  const max = shots && match.statistics.player.shots.maxSpeedKmh
  const available = match.statistics?.schemaVersion === WORKER_MATCH_STATS_VERSION
  const movement = available ? match.statistics.player?.movement : null
  const serve = available ? match.statistics.player?.serve : null
  const rallies = available ? match.statistics.rallies : null
  const value = raw => typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : null
  const count = raw => Number.isSafeInteger(raw) && raw >= 0 ? raw : null
  const sets = available ? match.statistics.score?.sets : null
  const setScores = Array.isArray(sets) ? sets.flatMap((set, index) => {
    const playerGames = count(Array.isArray(set) ? set[0] : set?.playerGames)
    const opponentGames = count(Array.isArray(set) ? set[1] : set?.opponentGames)
    return playerGames == null || opponentGames == null ? [] : [{ set: index + 1, playerGames, opponentGames }]
  }) : []
  return {
    setScores,
    measuredShots: shots?.sampleCount ?? null,
    averageShotSpeed: shots?.sampleCount > 0 ? shots.sumKmh / shots.sampleCount : null,
    maxShotSpeed: shots?.sampleCount > 0 && Number.isFinite(max) && max >= 0 ? max : null,
    distanceMeters: value(movement?.distanceMeters),
    avgMovementSpeed: value(movement?.avgSpeedKmh),
    maxMovementSpeed: value(movement?.maxSpeedKmh),
    serveCount: count(serve?.count),
    averageServeSpeed: statistics?.serveSpeed?.sampleCount > 0 ? statistics.serveSpeed.sumKmh / statistics.serveSpeed.sampleCount : null,
    firstServeInRate: statistics?.firstServe?.attempts > 0 ? 100 * statistics.firstServe.in / statistics.firstServe.attempts : null,
    doubleFaults: statistics?.doubleFaults ?? null,
    ralliesCount: count(rallies?.count),
    averageRallyShots: count(rallies?.count) > 0 && count(rallies?.sumShots) != null ? rallies.sumShots / rallies.count : null,
    longestRally: count(rallies?.longestShots),
  }
}
