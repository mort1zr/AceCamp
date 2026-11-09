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

/** La prueba de Básico dura 30 días desde planSince (igual que en firestore.rules). */
export const DIAS_PRUEBA = 30
const DIA_MS = 24 * 60 * 60 * 1000

/** planSince puede llegar como Date, Timestamp de Firestore o texto ISO. */
function aFecha(valor) {
  if (!valor) return null
  const fecha = typeof valor.toDate === 'function' ? valor.toDate() : new Date(valor)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

/** Cuándo termina la prueba de Básico, o null si no hay fecha de inicio. */
export function finDePrueba(planSince) {
  const inicio = aFecha(planSince)
  return inicio ? new Date(inicio.getTime() + DIAS_PRUEBA * DIA_MS) : null
}

/**
 * Plan que vale hoy para la organización (PCIT-170): con la prueba vencida cuenta
 * como Sin plan ('free'). Una prueba sin planSince (cargada a mano) sigue vigente.
 * Un plan desconocido también cuenta como 'free'.
 */
export function planVigente({ plan, planSince } = {}, ahora = new Date()) {
  if (!PLANES[plan]) return 'free'
  if (plan !== 'prueba') return plan
  const fin = finDePrueba(planSince)
  return fin && ahora >= fin ? 'free' : 'prueba'
}

/** La organización estaba en prueba y ya se le venció. */
export function pruebaVencida(organizacion = {}, ahora = new Date()) {
  return organizacion.plan === 'prueba' && planVigente(organizacion, ahora) === 'free'
}

const sumarMeses = (fecha, meses) => {
  const resultado = new Date(fecha)
  resultado.setUTCMonth(resultado.getUTCMonth() + meses)
  return resultado
}

/**
 * Próxima fecha de renovación del plan contratado en el checkout (PCIT-158).
 * La prueba de Básico dura DIAS_PRUEBA días y no se renueva: devuelve cuándo termina.
 * Sin fecha de inicio (planes cargados a mano o sin plan) devuelve null.
 */
export function proximaRenovacion({ plan, planSince, billingCycle }, ahora = new Date()) {
  const inicio = aFecha(planSince)
  if (!inicio || !PLANES[plan] || plan === 'free') return null
  if (PLANES[plan].prueba) return finDePrueba(inicio)
  const paso = billingCycle === 'anual' ? 12 : 1
  let siguiente = sumarMeses(inicio, paso)
  for (let veces = 1; siguiente <= ahora && veces < 1200; veces += 1) {
    siguiente = sumarMeses(inicio, paso * (veces + 1))
  }
  return siguiente
}
