// Guardar el plan que el dueño contrata en el checkout simulado (PCIT-158).
// No hay cobro real ni se guarda la tarjeta: solo orgs/{orgId}.plan, el periodo
// (billingCycle) y la fecha de inicio o renovación (planSince).
// Las reglas (firebase/firestore.rules) aceptan exactamente estos campos y solo del dueño.

import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { COLLECTIONS } from './schema.js'

export const PLANES_CHECKOUT = Object.freeze(['basico', 'pro', 'ultra'])
export const PERIODOS = Object.freeze(['mensual', 'anual'])

/**
 * Valor que se guarda en orgs/{orgId}.plan para el plan elegido en el checkout.
 * Básico entra como mes de prueba solo la primera vez que la organización contrata
 * (sin planSince); después ya es Básico normal. Pro y Ultra se guardan tal cual.
 */
export function planAGuardar(plan, organizacion = {}) {
  if (!PLANES_CHECKOUT.includes(plan)) throw new Error(`Plan desconocido: ${plan}`)
  if (plan !== 'basico') return plan
  return organizacion.planSince == null ? 'prueba' : 'basico'
}

/** Guarda el plan contratado y devuelve el valor guardado ('prueba', 'basico', 'pro' o 'ultra'). */
export async function contratarPlan({ db, orgId, plan, periodo }) {
  if (!db || !orgId) throw new Error('Se necesita la organización de la sesión para contratar un plan.')
  if (!PERIODOS.includes(periodo)) throw new Error(`Periodo desconocido: ${periodo}`)
  if (!PLANES_CHECKOUT.includes(plan)) throw new Error(`Plan desconocido: ${plan}`)

  const ref = doc(db, COLLECTIONS.orgs, orgId)
  return runTransaction(db, async (transaccion) => {
    const instantanea = await transaccion.get(ref)
    if (!instantanea.exists()) throw new Error('La organización no existe.')
    const guardado = planAGuardar(plan, instantanea.data())
    transaccion.update(ref, { plan: guardado, billingCycle: periodo, planSince: serverTimestamp() })
    return guardado
  })
}
