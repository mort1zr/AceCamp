import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { buildDashboardOverview } from '../dashboardOverview.js'
import { buildDashboardEvolution } from '../dashboardEvolution.js'

/** No Firebase initialization and no guessed statistics path or player mapping. */
export function createFirestoreDashboardService({ db, orgId, actorId, decodeStatistics }) {
  if (!db || typeof orgId !== 'string' || !orgId.trim() || typeof actorId !== 'string' || !actorId.trim() || typeof decodeStatistics !== 'function') throw new TypeError('Dashboard requires database, organization, user and an agreed statistics decoder.')

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
          if (!player.exists() || player.data().orgId !== orgId) {
            fail(Object.assign(new Error('Player not available to this organization.'), { code: 'permission-denied' }))
            return
          }
          const matches = query(collection(db, 'matches'), where('orgId', '==', orgId), where('playerId', '==', playerId))
          unsubscribe = onSnapshot(matches, snapshot => {
            if (!active) return
            try {
              const rows = snapshot.docs.map(item => ({ ...item.data(), id: item.id }))
              const decoded = new Map()
              const context = { orgId, playerId, decodeStatistics: (match, identity) => {
                if (!decoded.has(match)) decoded.set(match, decodeStatistics(match, identity))
                return decoded.get(match)
              } }
              onData({ ...buildDashboardOverview(rows, context), evolution: buildDashboardEvolution(rows, context) })
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
