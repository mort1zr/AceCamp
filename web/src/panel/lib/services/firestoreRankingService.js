import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { metricasDeJugador } from './firestoreDashboardService.js'
import { decodeWorkerDashboardStatistics } from '../workerDashboardStatistics.js'

export function createFirestoreRankingService({
  db,
  orgId,
  actorId,
  role = 'coach',
  onlyOwned = false,
  decodeStatistics = decodeWorkerDashboardStatistics,
}) {
  if (
    !db ||
    typeof orgId !== 'string' ||
    !orgId.trim() ||
    typeof actorId !== 'string' ||
    !actorId.trim() ||
    !['admin', 'coach'].includes(role)
  ) {
    throw new TypeError('Ranking requires a database, organization and authenticated role.')
  }
  const restringir = role !== 'admin' || onlyOwned
  const filtros = [
    where('orgId', '==', orgId),
    ...(restringir ? [where('createdBy', '==', actorId)] : []),
  ]

  return {
    scopeKey: `firestore:${db.app?.options?.projectId ?? ''}:${orgId}:${actorId}:ranking`,
    subscribe(onData, onError) {
      return onSnapshot(
        query(collection(db, 'matches'), ...filtros),
        (instantanea) => {
          try {
            const porJugador = new Map()
            for (const documento of instantanea.docs) {
              const fila = { ...documento.data(), id: documento.id }
              if (fila.orgId !== orgId || (restringir && fila.createdBy !== actorId)) continue
              if (typeof fila.playerId !== 'string') continue
              if (!porJugador.has(fila.playerId)) porJugador.set(fila.playerId, [])
              porJugador.get(fila.playerId).push(fila)
            }
            const metricas = {}
            for (const [playerId, filas] of porJugador) {
              metricas[playerId] = metricasDeJugador(filas, { orgId, playerId, decodeStatistics })
            }
            onData(metricas)
          } catch (error) {
            onError(error)
          }
        },
        onError,
      )
    },
  }
}
