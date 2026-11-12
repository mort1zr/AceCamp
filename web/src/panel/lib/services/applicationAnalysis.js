import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { hashAnalysisSignature } from '../analysis.js'
import { localDateString } from '../players.js'
import { COLLECTIONS, MATCH_STATUS, PLAYER_POSITIONS } from '../schema.js'
import { nextUsage, usageRef } from '../usage.js'
import { checkQuota } from './firestoreAnalysisService.js'

export function createApplicationAnalysisService({ db, orgId, uid, role, applicationId }) {
  const matches = collection(db, COLLECTIONS.matches)
  const applicationRef = doc(db, COLLECTIONS.applications, applicationId)
  const organization = doc(db, COLLECTIONS.orgs, orgId)

  function canAccess(match) {
    return match.orgId === orgId && match.applicationId === applicationId &&
      (role === 'admin' || match.createdBy === uid)
  }

  return {
    subscribe(onRows, onError) {
      const filters = [where('orgId', '==', orgId), where('applicationId', '==', applicationId)]
      if (role !== 'admin') filters.push(where('createdBy', '==', uid))
      return onSnapshot(query(matches, ...filters), (snapshot) => {
        onRows(snapshot.docs.map((row) => ({ ...row.data(), id: row.id })).filter(canAccess))
      }, onError)
    },
    async enqueue(videoPath, playerPosition) {
      if (!PLAYER_POSITIONS.includes(playerPosition)) throw new Error('Indica si el postulante aparece arriba o abajo.')
      const base = `orgs/${orgId}/applications/${applicationId}/video`
      if (videoPath !== base + '.mp4' && videoPath !== base + '.mov') throw new Error('El video de esta postulación no está disponible.')
      const matchId = 'app-' + await hashAnalysisSignature(JSON.stringify([orgId, applicationId, videoPath]))
      const matchRef = doc(matches, matchId)
      const usage = usageRef(db, orgId)
      await runTransaction(db, async (transaction) => {
        const current = (await transaction.get(matchRef)).data()
        if (current) {
          if (!canAccess(current) || current.videoPath !== videoPath) throw new Error('El análisis ya pertenece a otra sesión.')
          return
        }
        const application = (await transaction.get(applicationRef)).data()
        if (application?.orgId !== orgId || !application.playerId || !application.videoPaths?.includes(videoPath)) {
          throw new Error('Vincula un jugador antes de analizar el video.')
        }
        const player = (await transaction.get(doc(db, COLLECTIONS.players, application.playerId))).data()
        if (player?.orgId !== orgId || player.deletedAt != null || (role !== 'admin' && player.createdBy !== uid)) {
          throw new Error('La ficha vinculada no está disponible para esta sesión.')
        }
        const date = application.createdAt?.toDate?.()
        if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error('Falta la fecha de la postulación.')
        const counter = await transaction.get(usage)
        checkQuota(await transaction.get(organization), counter)
        transaction.set(matchRef, {
          orgId, applicationId, playerId: application.playerId, playerPosition, videoPath,
          opponent: 'Video de postulación', matchDate: localDateString(date),
          status: MATCH_STATUS.queued, createdAt: serverTimestamp(), createdBy: uid,
        })
        transaction.set(usage, nextUsage(counter.data(), matchId, serverTimestamp()))
      })
    },
    async retry(matchId) {
      const reference = doc(matches, matchId)
      await runTransaction(db, async (transaction) => {
        const current = (await transaction.get(reference)).data()
        if (!current || !canAccess(current) || current.status !== MATCH_STATUS.error) return
        transaction.update(reference, {
          status: MATCH_STATUS.queued, errorMessage: null, startedAt: null, finishedAt: null, updatedAt: serverTimestamp(),
        })
      })
    },
  }
}
