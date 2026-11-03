import { useEffect, useState } from 'react'
import { playersErrorMessage } from '../lib/players.js'

export function usePlayers(service) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ service: null, attempt: -1, loading: true, rows: [], error: null })

  useEffect(() => {
    let active = true
    let unsubscribe
    const fail = error => {
      if (active) setState({ service, attempt, loading: false, rows: [], error: playersErrorMessage(error) })
    }
    try {
      unsubscribe = service.subscribe(
        rows => { if (active) setState({ service, attempt, loading: false, rows, error: null }) },
        fail,
      )
    } catch (error) {
      fail(error)
    }
    return () => { active = false; unsubscribe?.() }
  }, [service, attempt])

  // Never render rows from a previous organization while the effect is changing.
  const current = state.service === service && state.attempt === attempt ? state : { loading: true, rows: [], error: null }
  return { ...current, retry: () => setAttempt(value => value + 1) }
}
