import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'

export function useNombreOrganizacion(db, orgId) {
  const [nombre, setNombre] = useState('')

  useEffect(() => {
    if (!db || !orgId) return undefined
    let activo = true
    getDoc(doc(db, 'orgs', orgId)).then(
      (instantanea) => activo && setNombre(instantanea.data()?.name ?? ''),
      () => {},
    )
    return () => {
      activo = false
    }
  }, [db, orgId])

  return nombre
}
