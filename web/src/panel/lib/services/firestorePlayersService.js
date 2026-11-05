import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore'
import { normalizePlayer, PLAYER_CONSENT_VERSION } from '../players.js'

/** db and identity come from Axel's authenticated app, never from form fields. */
export function createFirestorePlayersService({ db, orgId, actorId, role }) {
  if (!db || typeof orgId !== 'string' || !orgId.trim() || typeof actorId !== 'string' || !actorId.trim()) {
    throw new Error('Players service requires a database, organization and authenticated user.')
  }
  const players = collection(db, 'players')
  const isAdmin = role === 'admin'
  const canViewProfile = player => player.orgId === orgId && (isAdmin || (role === 'coach' && player.createdBy === actorId))

  return {
    scopeKey: `firestore:${db.app?.options?.projectId ?? ''}:${orgId}:${actorId}`,
    mode: 'live',
    canViewProfile,
    subscribe(onPlayers, onError) {
      return onSnapshot(query(players, where('orgId', '==', orgId)), snapshot => {
        const rows = snapshot.docs.map(document => ({ ...document.data(), id: document.id }))
        onPlayers(rows.sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '', 'es')))
      }, onError)
    },
    subscribeAnalyzedMatches(player, onMatches, onError) {
      if (!canViewProfile(player)) {
        onError({ code: 'permission-denied' })
        return
      }
      const filters = [
        where('orgId', '==', orgId),
        where('playerId', '==', player.id),
        where('status', '==', 'listo'),
      ]
      if (!isAdmin) filters.push(where('createdBy', '==', actorId))
      return onSnapshot(query(collection(db, 'matches'), ...filters), snapshot => {
        const rows = snapshot.docs.map(document => {
          const { opponent, matchDate, tournament, result } = document.data()
          return { id: document.id, opponent, matchDate, tournament, result }
        })
        onMatches(rows.sort((a, b) => (b.matchDate ?? '').localeCompare(a.matchDate ?? '')))
      }, onError)
    },
    async create(input) {
      const fields = normalizePlayer(input)
      const reference = await addDoc(players, {
        ...fields,
        orgId,
        createdBy: actorId,
        createdAt: serverTimestamp(),
        consent: {
          accepted: true,
          version: PLAYER_CONSENT_VERSION,
          recordedBy: actorId,
          recordedAt: serverTimestamp(),
          method: 'coach-attestation',
        },
      })
      return { ...fields, id: reference.id }
    },
  }
}
