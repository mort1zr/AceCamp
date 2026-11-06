// Uso mensual de análisis por organización (PCIT-41).
// Cada partido nuevo suma uno en orgs/{orgId}/usage/{YYYY-MM}, en la misma
// transacción que crea el partido. Las reglas exigen las dos escrituras juntas.

import { doc } from 'firebase/firestore'
import { COLLECTIONS, ORG_USAGE } from './schema.js'
import { PLANES } from './planes.js'

/** Error que usa la web cuando el plan ya no permite más análisis este mes. */
export const LIMIT_ERROR_CODE = 'analysis/limit'

/** Análisis por mes del plan de la organización; null = sin tope. Igual que withinPlan en las reglas. */
export function planLimit(plan) {
  return (PLANES[plan] ?? PLANES.free).limite
}

export function quotaReached(used, limit) {
  return limit != null && (used ?? 0) >= limit
}

/** Análisis que quedan en el mes; null = sin tope. */
export function remainingAnalyses(used, limit) {
  return limit == null ? null : Math.max(0, limit - (used ?? 0))
}

/** Quedan pocos análisis: el último 20 % del plan, y como mínimo los 3 últimos. */
export function quotaLow(used, limit) {
  const quedan = remainingAnalyses(used, limit)
  return quedan != null && quedan > 0 && quedan <= Math.max(3, Math.ceil(limit * 0.2))
}

export function limitError(used, limit) {
  return Object.assign(new Error('Plan limit reached'), { code: LIMIT_ERROR_CODE, used, limit })
}

/** Mes del contador, en UTC como request.time en las reglas: '2026-11'. */
export function usagePeriod(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function usageRef(db, orgId, period = usagePeriod()) {
  return doc(db, COLLECTIONS.orgs, orgId, ORG_USAGE.collection, period)
}

/** Datos del contador después de sumar el partido matchId. */
export function nextUsage(current, matchId, updatedAt) {
  return { analyses: (current?.analyses ?? 0) + 1, lastMatchId: matchId, updatedAt }
}
