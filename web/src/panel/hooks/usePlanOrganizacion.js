import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { PLANES } from '../lib/services/firestoreConfiguracionService.js'

function milisegundos(valor) {
  if (!valor) return 0
  if (typeof valor.toMillis === 'function') return valor.toMillis()
  const fecha = new Date(valor).getTime()
  return Number.isNaN(fecha) ? 0 : fecha
}

export function usePlanOrganizacion(db, orgId) {
  const [plan, setPlan] = useState(null)
  const [usados, setUsados] = useState(null)

  useEffect(() => {
    if (!db || !orgId) return undefined
    const detenerPlan = onSnapshot(
      doc(db, 'orgs', orgId),
      (instantanea) => setPlan(PLANES[instantanea.data()?.plan] ?? PLANES.free),
      () => setPlan(null),
    )
    const detenerUso = onSnapshot(
      query(collection(db, 'matches'), where('orgId', '==', orgId)),
      (instantanea) => {
        const ahora = new Date()
        const desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime()
        setUsados(
          instantanea.docs.filter((partido) => milisegundos(partido.data().createdAt) >= desde)
            .length,
        )
      },
      () => setUsados(null),
    )
    return () => {
      detenerPlan()
      detenerUso()
    }
  }, [db, orgId])

  return { plan, usados }
}
