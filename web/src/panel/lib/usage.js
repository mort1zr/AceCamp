// Uso mensual de análisis por organización (PCIT-41).
// Cada partido nuevo suma uno en orgs/{orgId}/usage/{YYYY-MM}, en la misma
// transacción que crea el partido. Las reglas exigen las dos escrituras juntas.

import { doc } from 'firebase/firestore'
import { COLLECTIONS, ORG_USAGE } from './schema.js'

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
