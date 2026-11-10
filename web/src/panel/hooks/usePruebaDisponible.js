import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'

// ¿La organización todavía puede usar la prueba gratis de Básico? (PCIT-172)
// Solo una vez: si ya contrató algún plan (tiene planSince), no. Es la misma
// condición que usan contratarPlan() y las reglas de Firestore.
// Devuelve null mientras no se sabe (sin sesión o cargando).
export function usePruebaDisponible(db, orgId) {
  const [disponible, setDisponible] = useState(null)

  useEffect(() => {
    if (!db || !orgId) return undefined
    return onSnapshot(
      doc(db, 'orgs', orgId),
      (instantanea) => setDisponible(instantanea.data()?.planSince == null),
      () => setDisponible(null),
    )
  }, [db, orgId])

  return disponible
}
