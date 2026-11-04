import { useEffect, useState } from 'react'

function errorMessage(error) {
  if (error?.code === 'permission-denied' || error?.code === 'unauthenticated') return 'Tu sesión no permite consultar estos indicadores. Vuelve a iniciar sesión o consulta con el administrador.'
  return 'No pudimos cargar el resumen del jugador. Vuelve a intentarlo.'
}

/** Receives a view-model service. Aggregation and Firestore belong to PCIT-139. */
export function useDashboardOverview(service, playerId) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState(null)

  useEffect(() => {
    if (!service || !playerId) return
    let active = true
    let unsubscribe
    const fail = error => {
      if (active) setState({ service, playerId, attempt, data: null, error: errorMessage(error) })
    }
    try {
      unsubscribe = service.subscribePlayer(playerId,
        data => { if (active) setState({ service, playerId, attempt, data, error: null }) },
        fail,
      )
    } catch (error) { fail(error) }
    return () => { active = false; unsubscribe?.() }
  }, [service, playerId, attempt])

  const retry = () => setAttempt(value => value + 1)
  if (!playerId) return { status: 'idle', data: null, error: null, retry }
  if (!service) return { status: 'unavailable', data: null, error: null, retry }
  if (state?.service !== service || state?.playerId !== playerId || state?.attempt !== attempt) return { status: 'loading', data: null, error: null, retry }
  return { status: state.error ? 'error' : 'ready', data: state.data, error: state.error, retry }
}
