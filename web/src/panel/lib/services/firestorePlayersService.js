import { addDoc, collection, deleteField, doc, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { normalizePlayer, PLAYER_CONSENT_VERSION, PLAYER_EDITABLE_FIELDS } from '../players.js'

/** db and identity come from Axel's authenticated app, never from form fields. */
export function createFirestorePlayersService({ db, orgId, actorId, role = 'coach', onlyOwned = false, includeDeleted = false }) {
  if (!db || typeof orgId !== 'string' || !orgId.trim() || typeof actorId !== 'string' || !actorId.trim()) {
    throw new Error('Players service requires a database, organization and authenticated user.')
  }
  const players = collection(db, 'players')
  const isAdmin = role === 'admin'
  if (!['coach', 'admin'].includes(role)) throw new Error('Invalid player role.')
  const canViewProfile = player => player.orgId === orgId && (isAdmin || (role === 'coach' && player.createdBy === actorId))

  return {
    scopeKey: `firestore:${db.app?.options?.projectId ?? ''}:${orgId}:${actorId}`,
    mode: 'live',
    canViewProfile,
    subscribe(onPlayers, onError) {
      const filters = [where('orgId', '==', orgId)]
      if (!isAdmin || onlyOwned) filters.push(where('createdBy', '==', actorId))
      return onSnapshot(query(players, ...filters), snapshot => {
        const rows = snapshot.docs.map(document => ({ ...document.data(), id: document.id })).filter(player => canViewProfile(player) && (includeDeleted || player.deletedAt == null))
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
    async update(player, input) {
      const fields = normalizePlayer({ ...input, consentAccepted: true })
      const reference = doc(players, player.id)
      await runTransaction(db, async transaction => {
        const current = await transaction.get(reference)
        const data = current.exists() ? current.data() : null
        if (!data || data.deletedAt != null) throw Object.assign(new Error('Player unavailable'), { code: 'players/not-found' })
        if (!canViewProfile(data)) throw Object.assign(new Error('Forbidden'), { code: 'permission-denied' })
        const version = value => value?.toMillis?.() ?? value?.getTime?.() ?? value
        if (data.updatedAt && version(data.updatedAt) !== version(player.updatedAt)) throw Object.assign(new Error('Concurrent edit'), { code: 'players/conflict' })
        const changes = Object.fromEntries(PLAYER_EDITABLE_FIELDS.map(key => [key, fields[key] ?? deleteField()]))
        transaction.update(reference, { ...changes, updatedAt: serverTimestamp() })
      })
      return { ...player, ...fields }
    },
    async remove(player) {
      const reference = doc(players, player.id)
      await runTransaction(db, async transaction => {
        const current = await transaction.get(reference)
        const data = current.exists() ? current.data() : null
        if (!data || !canViewProfile(data)) throw Object.assign(new Error('Forbidden'), { code: 'permission-denied' })
        if (data.deletedAt != null) return
        transaction.update(reference, { deletedAt: serverTimestamp(), updatedAt: serverTimestamp() })
      })
    },
  }
}
