import { createContext, useContext } from 'react'

export const PlanVistaContexto = createContext({
  plan: null,
  planVista: null,
  uso: { usados: null, limite: null },
  setPlanVista: () => {},
})

export const PLANES_VISTA = [
  { id: 'basico', nombre: 'Básico', corto: 'B' },
  { id: 'pro', nombre: 'Pro', corto: 'P' },
  { id: 'ultra', nombre: 'Ultra', corto: 'U' },
]

export const SECCIONES_POR_PLAN = {
  comparador: ['pro', 'ultra'],
  reclutamiento: ['pro', 'ultra'],
}

export function incluyeSeccion(plan, seccion) {
  const planes = SECCIONES_POR_PLAN[seccion]
  return !planes || !plan || planes.includes(plan)
}

export function usePlanVista() {
  return useContext(PlanVistaContexto)
}
