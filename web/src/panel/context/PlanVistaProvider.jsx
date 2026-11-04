import { useEffect, useMemo, useState } from 'react'
import { PLANES } from '../lib/services/firestoreConfiguracionService.js'
import { PLANES_VISTA, PlanVistaContexto } from './PlanVistaContext.js'

const CLAVE = 'acecam-plan-vista'

function leerPlan() {
  try {
    const guardado = localStorage.getItem(CLAVE)
    return PLANES_VISTA.some((plan) => plan.id === guardado) ? guardado : null
  } catch {
    return null
  }
}

export default function PlanVistaProvider({ planReal = null, usados = null, children }) {
  const [planVista, setPlanVista] = useState(leerPlan)

  useEffect(() => {
    try {
      if (planVista) localStorage.setItem(CLAVE, planVista)
      else localStorage.removeItem(CLAVE)
    } catch {
      return
    }
  }, [planVista])

  const valor = useMemo(() => {
    const limite = planVista ? PLANES[planVista].limite : (planReal?.limite ?? null)
    return {
      plan: planVista ?? planReal?.id ?? null,
      planReal: planReal?.id ?? null,
      planVista,
      setPlanVista,
      uso: { usados, limite },
    }
  }, [planVista, planReal, usados])
  return <PlanVistaContexto value={valor}>{children}</PlanVistaContexto>
}
