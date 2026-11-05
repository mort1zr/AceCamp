// Planes que se guardan en orgs/{orgId}.plan y sus análisis por mes.
// limite: null = sin tope. Los mismos valores están en withinPlan de
// firebase/firestore.rules (PCIT-41): si cambian aquí, cambiarlos allá.
export const PLANES = {
  free: { id: 'ninguno', prueba: false, limite: 0 },
  prueba: { id: 'basico', prueba: true, limite: 15 },
  basico: { id: 'basico', prueba: false, limite: 30 },
  pro: { id: 'pro', prueba: false, limite: 150 },
  ultra: { id: 'ultra', prueba: false, limite: null },
}
