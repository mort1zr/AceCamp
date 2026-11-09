import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { PLANES, planVigente } from '../lib/planes.js'
import { usageRef } from '../lib/usage.js'

// Plan de la organización y análisis usados en el mes (PCIT-41).
// El uso sale del contador orgs/{orgId}/usage/{YYYY-MM}: es de toda la organización,
// el mismo número que aplica el límite en las reglas.
export function usePlanOrganizacion(db, orgId) {
  const [plan, setPlan] = useState(null)
  const [usados, setUsados] = useState(null)

  useEffect(() => {
    if (!db || !orgId) return undefined
    const detenerPlan = onSnapshot(
      doc(db, 'orgs', orgId),
      // Con la prueba vencida cuenta como Sin plan (PCIT-170).
      (instantanea) => setPlan(PLANES[planVigente(instantanea.data())]),
      () => setPlan(null),
    )
    const detenerUso = onSnapshot(
      usageRef(db, orgId),
      (instantanea) => setUsados(instantanea.data()?.analyses ?? 0),
      () => setUsados(null),
    )
    return () => {
      detenerPlan()
      detenerUso()
    }
  }, [db, orgId])

  return { plan, usados }
}
