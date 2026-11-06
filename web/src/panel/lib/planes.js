// Planes que se guardan en orgs/{orgId}.plan y sus análisis por mes.
// limite: null = sin tope. Los mismos valores están en withinPlan de
// firebase/firestore.rules (PCIT-41): si cambian aquí, cambiarlos allá.
// planes.test.js falla si los dos lugares no coinciden.
export const PLANES = {
  free: { id: 'ninguno', prueba: false, limite: 0 },
  prueba: { id: 'basico', prueba: true, limite: 15 },
  basico: { id: 'basico', prueba: false, limite: 30 },
  pro: { id: 'pro', prueba: false, limite: 150 },
  ultra: { id: 'ultra', prueba: false, limite: null },
}

const sumarMeses = (fecha, meses) => {
  const resultado = new Date(fecha)
  resultado.setUTCMonth(resultado.getUTCMonth() + meses)
  return resultado
}

/**
 * Próxima fecha de renovación del plan contratado en el checkout (PCIT-158).
 * La prueba de Básico dura un mes y no se renueva: devuelve cuándo termina.
 * Sin fecha de inicio (planes cargados a mano o sin plan) devuelve null.
 */
export function proximaRenovacion({ plan, planSince, billingCycle }, ahora = new Date()) {
  if (!planSince || !PLANES[plan] || plan === 'free') return null
  const inicio = planSince instanceof Date ? planSince : new Date(planSince)
  if (Number.isNaN(inicio.getTime())) return null
  if (PLANES[plan].prueba) return sumarMeses(inicio, 1)
  const paso = billingCycle === 'anual' ? 12 : 1
  let siguiente = sumarMeses(inicio, paso)
  for (let veces = 1; siguiente <= ahora && veces < 1200; veces += 1) {
    siguiente = sumarMeses(inicio, paso * (veces + 1))
  }
  return siguiente
}
