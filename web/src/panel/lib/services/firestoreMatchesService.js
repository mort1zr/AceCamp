import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { buildDashboardDetails } from '../dashboardDetails.js'
import { isValidBirthDate } from '../players.js'
import { reportMetrics } from '../workerDashboardStatistics.js'

export { reportMetrics } from '../workerDashboardStatistics.js'

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
