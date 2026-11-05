import { useEffect, useMemo, useState } from 'react'
import { PLANES } from '../lib/planes.js'
import { PLANES_VISTA, PlanVistaContexto } from './PlanVistaContext.js'

const CLAVE = 'acecam-plan-vista'

function leerPlan(clave) {
  try {
    const guardado = localStorage.getItem(clave)
    return PLANES_VISTA.some((plan) => plan.id === guardado) ? guardado : null
  } catch {
    return null
  }
}

export default function PlanVistaProvider({ cuenta, planReal = null, usados = null, children }) {
  const clave = `${CLAVE}:${cuenta ?? ''}`
  const [planVista, setPlanVista] = useState(() => leerPlan(clave))

  useEffect(() => {
    try {
      if (planVista) localStorage.setItem(clave, planVista)
      else localStorage.removeItem(clave)
    } catch {
      return
    }
  }, [clave, planVista])

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
