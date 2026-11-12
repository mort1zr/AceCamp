import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { buildDashboardOverview, normalizeDashboardStatistics } from '../dashboardOverview.js'
import { buildDashboardEvolution } from '../dashboardEvolution.js'
import { buildDashboardPeriods } from '../dashboardPeriods.js'
import { buildDashboardDetails } from '../dashboardDetails.js'
import { decodeWorkerDashboardStatistics } from '../workerDashboardStatistics.js'

export function combinarMetricas(overview, details) {
  return {
    ...overview.metrics,
    maxShotSpeed: details.shots.maxSpeedKmh,
    firstServeAverageSpeed: details.serve.first.averageSpeedKmh,
    firstServeMaxSpeed: details.serve.first.maxSpeedKmh,
    secondServeAverageSpeed: details.serve.second.averageSpeedKmh,
    secondServeMaxSpeed: details.serve.second.maxSpeedKmh,
    averageRallyShots: details.rallies.averageShots,
    longestRally: details.rallies.longestShots,
    distanceMeters: details.movement.distanceMeters,
  }
}

export function metricasDeJugador(rows, context) {
  return combinarMetricas(buildDashboardOverview(rows, context), buildDashboardDetails(rows, context))
}

function summarizeDashboard(rows, context) {
  const { orgId, playerId, decodeStatistics } = context
  const summarize = matches => {
    const overview = buildDashboardOverview(matches, context)
    const evolution = buildDashboardEvolution(matches, context)
    const serveEvolution = buildDashboardEvolution(matches, context, 'averageServeSpeed')
    const details = buildDashboardDetails(matches, context)
    const point = evolution.points.at(-1)
    const row = point && matches.find(match => match.id === point.matchId
      && match.orgId === orgId && match.playerId === playerId
      && match.status === 'listo' && match.matchDate === point.date)
    const own = row?.statistics?.schemaVersion === 'acecam.match-stats.v1' ? row.statistics : null
    const number = value => Number.isFinite(value) && value >= 0 ? value : null
    const serve = own?.player?.serve
    const latestMatch = row ? {
      ...point,
      tournament: row.tournament,
      result: row.result,
      serveMaxSpeed: number(serve?.maxSpeedKmh),
      firstServeRate: Number.isSafeInteger(serve?.firstServeAttempts) && serve.firstServeAttempts > 0 && Number.isSafeInteger(serve?.firstServeIn) && serve.firstServeIn <= serve.firstServeAttempts
        ? serve.firstServeIn / serve.firstServeAttempts * 100 : null,
      doubleFaults: Number.isSafeInteger(serve?.doubleFaults) && serve.doubleFaults >= 0 ? serve.doubleFaults : null,
      longestRally: Number.isSafeInteger(own?.rallies?.longestShots) && own.rallies.longestShots >= 0 ? own.rallies.longestShots : null,
      measuredShots: normalizeDashboardStatistics(decodeStatistics(row, { playerId }), playerId)?.shots?.sampleCount,
    } : null
    return { ...overview, metrics: combinarMetricas(overview, details), evolution, serveEvolution, details, latestMatch }
  }
  return {
    ...summarize(rows),
    periods: buildDashboardPeriods(rows, summarize, summarize),
  }
}

/** No Firebase initialization and no guessed statistics path or player mapping. */
export function createFirestoreDashboardService({
  db, orgId, actorId, role = 'coach', onlyOwned = false, decodeStatistics = decodeWorkerDashboardStatistics, summarizePlayer = summarizeDashboard,
}) {
  if (!db || typeof orgId !== 'string' || !orgId.trim() || typeof actorId !== 'string' || !actorId.trim() || typeof decodeStatistics !== 'function') throw new TypeError('Dashboard requires database, organization, user and an agreed statistics decoder.')
  if (!['admin', 'coach'].includes(role)) throw new TypeError('Invalid dashboard role.')
  const restrictOwner = role !== 'admin' || onlyOwned

  return {
    scopeKey: `firestore:${db.app?.options?.projectId ?? ''}:${orgId}:${actorId}`,
    mode: 'live',
    subscribePlayer(playerId, onData, onError) {
      if (typeof playerId !== 'string' || !playerId.trim() || playerId.includes('/')) throw new TypeError('Invalid player ID.')
      let active = true
      let unsubscribe
      const stop = () => { const cleanup = unsubscribe; unsubscribe = null; cleanup?.() }
      const fail = error => {
        if (!active) return
        active = false
        stop()
        onError(error)
      }

      async function subscribe() {
        try {
          const player = await getDoc(doc(db, 'players', playerId))
          if (!active) return
          const data = player.exists() ? player.data() : null
          if (data?.orgId !== orgId || (restrictOwner && data.createdBy !== actorId)) {
            fail(Object.assign(new Error('Player not available to this organization.'), { code: 'permission-denied' }))
            return
          }
          const filters = [where('orgId', '==', orgId), where('playerId', '==', playerId)]
          if (restrictOwner) filters.push(where('createdBy', '==', actorId))
          const matches = query(collection(db, 'matches'), ...filters)
          unsubscribe = onSnapshot(matches, snapshot => {
            if (!active) return
            try {
              const rows = snapshot.docs.map(item => ({ ...item.data(), id: item.id }))
                .filter(match => !restrictOwner || match.createdBy === actorId)
              const decoded = new Map()
              const context = { orgId, playerId, decodeStatistics: (match, identity) => {
                if (!decoded.has(match)) decoded.set(match, decodeStatistics(match, identity))
                return decoded.get(match)
              } }
              onData(summarizePlayer(rows, context))
            } catch (error) { fail(error) }
          }, fail)
          // Covers an error raised synchronously while attaching a listener.
          if (!active) stop()
        } catch (error) { fail(error) }
      }
      void subscribe()
      return () => { active = false; stop() }
    },
  }
}
