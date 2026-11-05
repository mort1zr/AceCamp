import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { normalizeDashboardStatistics } from '../dashboardOverview.js'
import { isValidBirthDate } from '../players.js'
import { decodeWorkerDashboardStatistics } from '../workerDashboardStatistics.js'

function reportMetrics(match) {
  const { playerId } = match
  const statistics = normalizeDashboardStatistics(decodeWorkerDashboardStatistics(match, { playerId }), playerId)
  const shots = statistics?.shots
  const max = shots && match.statistics.player.shots.maxSpeedKmh
  return {
    measuredShots: shots?.sampleCount ?? null,
    averageShotSpeed: shots?.sampleCount > 0 ? shots.sumKmh / shots.sampleCount : null,
    maxShotSpeed: shots?.sampleCount > 0 && Number.isFinite(max) && max >= 0 ? max : null,
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
            ...reportMetrics(row),
          }]
        })
        rows.sort((a, b) => b.matchDate.localeCompare(a.matchDate) || a.id.localeCompare(b.id))
        onMatches(rows)
      }, onError)
    },
  }
}
