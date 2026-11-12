import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { buildDashboardDetails } from '../dashboardDetails.js'
import { normalizeDashboardStatistics } from '../dashboardOverview.js'
import { isValidBirthDate } from '../players.js'
import { decodeWorkerDashboardStatistics } from '../workerDashboardStatistics.js'

function reportMetrics(match) {
  const { playerId } = match
  const statistics = normalizeDashboardStatistics(decodeWorkerDashboardStatistics(match, { playerId }), playerId)
  const shots = statistics?.shots
  const max = shots && match.statistics.player.shots.maxSpeedKmh
  const available = match.statistics?.schemaVersion === 'acecam.match-stats.v1'
  const movement = available ? match.statistics.player?.movement : null
  const serve = available ? match.statistics.player?.serve : null
  const rallies = available ? match.statistics.rallies : null
  const value = raw => typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : null
  const count = raw => Number.isSafeInteger(raw) && raw >= 0 ? raw : null
  return {
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

export function createFirestoreMatchesService({ db, orgId, actorId, role }) {
  if (!db || typeof orgId !== 'string' || !orgId.trim() || typeof actorId !== 'string'
    || !actorId.trim() || !['coach', 'admin'].includes(role)) {
    throw new TypeError('Match history requires a database, organization and authenticated role.')
  }
  const onlyOwned = role === 'coach'
  return {
    subscribe(onMatches, onError) {
      const filters = [where('orgId', '==', orgId), where('status', '==', 'listo')]
      if (onlyOwned) filters.push(where('createdBy', '==', actorId))
      const matches = query(collection(db, 'matches'), ...filters)
      return onSnapshot(matches, snapshot => {
        const rows = snapshot.docs.flatMap(document => {
          const row = document.data()
          if (row.orgId !== orgId || row.status !== 'listo' || (onlyOwned && row.createdBy !== actorId)) return []
          return [{
            id: document.id,
            playerId: row.playerId,
            matchDate: isValidBirthDate(row.matchDate) ? row.matchDate : '',
            opponent: row.opponent,
            tournament: row.tournament,
            result: row.result,
            processedVideoPath: row.processedVideoPath,
            ...reportMetrics(row),
            details: buildDashboardDetails([{ ...row, id: document.id }], { orgId, playerId: row.playerId }),
          }]
        })
        rows.sort((a, b) => b.matchDate.localeCompare(a.matchDate) || a.id.localeCompare(b.id))
        onMatches(rows)
      }, onError)
    },
  }
}
