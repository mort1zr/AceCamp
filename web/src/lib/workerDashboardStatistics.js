import { DASHBOARD_STATISTICS_SCHEMA } from './dashboardOverview.js'

export const WORKER_MATCH_STATS_VERSION = 'acecam.match-stats.v1'

/** PCIT-35 already maps the registered player's position to statistics.player. */
export function decodeWorkerDashboardStatistics(match, { playerId }) {
  const statistics = match?.statistics
  if (match?.playerId !== playerId || statistics?.schemaVersion !== WORKER_MATCH_STATS_VERSION) return null
  const shots = statistics.player?.shots
  if (!shots) return null

  return {
    schemaVersion: DASHBOARD_STATISTICS_SCHEMA,
    playerId,
    shots: { sampleCount: shots.count, sumKmh: shots.sumSpeedKmh },
  }
}
