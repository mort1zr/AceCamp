import { addDoc, collection, deleteField, doc, getDocFromServer, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { isValidBirthDate, normalizePlayer, PLAYER_CONSENT_VERSION, PLAYER_EDITABLE_FIELDS } from '../players.js'
import { COLLECTIONS } from '../schema.js'
import { reportMetrics } from '../workerDashboardStatistics.js'

/** db and identity come from Axel's authenticated app, never from form fields. */
export function createFirestorePlayersService({ db, orgId, actorId, role = 'coach', onlyOwned = false, includeDeleted = false }) {
  if (!db || typeof orgId !== 'string' || !orgId.trim() || typeof actorId !== 'string' || !actorId.trim()) {
    throw new Error('Players service requires a database, organization and authenticated user.')
  }
  const players = collection(db, COLLECTIONS.players)
  const isAdmin = role === 'admin'
  if (!['coach', 'admin'].includes(role)) throw new Error('Invalid player role.')
  const canViewProfile = player => player.orgId === orgId && (isAdmin || (role === 'coach' && player.createdBy === actorId))
  function newPlayer(fields) {
    return {
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
    }
  }

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
        const rows = snapshot.docs.flatMap(document => {
          const match = document.data()
          if (match.orgId !== orgId || match.playerId !== player.id || match.status !== 'listo'
            || (!isAdmin && match.createdBy !== actorId)) return []
          const { opponent, matchDate, tournament, result } = match
          return [{
            id: document.id, opponent, tournament, result,
            matchDate: isValidBirthDate(matchDate) ? matchDate : '',
            ...reportMetrics(match),
          }]
        })
        onMatches(rows.sort((a, b) => b.matchDate.localeCompare(a.matchDate) || a.id.localeCompare(b.id)))
      }, onError)
    },
    async create(input) {
      const fields = normalizePlayer(input)
      const reference = await addDoc(players, newPlayer(fields))
      return { ...fields, id: reference.id }
    },
    async assignApplication(applicationId, { playerId, input }) {
      const application = doc(db, COLLECTIONS.applications, applicationId)
      const player = playerId ? doc(players, playerId) : doc(players)
      try {
        return await runTransaction(db, async transaction => {
          const current = (await transaction.get(application)).data()
          if (current?.orgId !== orgId) throw Object.assign(new Error('Application unavailable'), { code: 'permission-denied' })
          if (current.playerId) return { id: current.playerId, alreadyLinked: true }

          if (playerId) {
            const existing = (await transaction.get(player)).data()
            if (!existing || existing.deletedAt != null || !canViewProfile(existing)) {
              throw Object.assign(new Error('Player unavailable'), { code: 'players/not-found' })
            }
          } else {
            const fields = normalizePlayer(input)
            transaction.set(player, { ...newPlayer(fields), sourceApplicationId: applicationId })
          }
          transaction.update(application, { playerId: player.id, updatedAt: serverTimestamp() })
          return { id: player.id, alreadyLinked: false }
        })
      } catch (error) {
        // Las reglas pueden rechazar la escritura del segundo intento antes del reintento automático.
        if (error.code === 'permission-denied') {
          const latest = (await getDocFromServer(application)).data()
          if (latest?.orgId === orgId && latest.playerId) return { id: latest.playerId, alreadyLinked: true }
        }
        throw error
      }
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
