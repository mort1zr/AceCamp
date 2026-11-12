import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { construirInicio } from '../inicio.js'
import { COLLECTIONS } from '../schema.js'

export function createFirestoreInicioService({ db, orgId, actorId, role, coachName = '' }) {
  if (
    !db ||
    typeof orgId !== 'string' ||
    !orgId.trim() ||
    typeof actorId !== 'string' ||
    !actorId.trim() ||
    !['coach', 'admin'].includes(role)
  ) {
    throw new TypeError('Inicio requires a database, organization and authenticated role.')
  }
  const propios = role === 'coach'
  const filtros = (conAutor) => [
    where('orgId', '==', orgId),
    ...(conAutor && propios ? [where('createdBy', '==', actorId)] : []),
  ]
  const fuentes = {
    players: query(collection(db, COLLECTIONS.players), ...filtros(true)),
    matches: query(collection(db, COLLECTIONS.matches), ...filtros(true)),
    applications: query(collection(db, COLLECTIONS.applications), ...filtros(false)),
  }

  return {
    scopeKey: `firestore:${db.app?.options?.projectId ?? ''}:${orgId}:${actorId}:${role}`,
    mode: 'live',
    subscribe(onData, onError) {
      const datos = {}
      let fallo = false
      const emitir = () => {
        if (fallo || Object.keys(fuentes).some((clave) => !datos[clave])) return
        onData(construirInicio({ coachName, ...datos }))
      }
      const detener = Object.entries(fuentes).map(([clave, consulta]) =>
        onSnapshot(
          consulta,
          (instantanea) => {
            datos[clave] = instantanea.docs
              .map((documento) => ({ ...documento.data(), id: documento.id }))
              .filter(
                (fila) =>
                  fila.orgId === orgId &&
                  (clave === 'applications' || !propios || fila.createdBy === actorId),
              )
            emitir()
          },
          (error) => {
            if (fallo) return
            fallo = true
            onError(error)
          },
        ),
      )
      return () => detener.forEach((parar) => parar())
    },
  }
}
