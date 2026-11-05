import { useEffect, useState } from 'react'
import { analysisErrorMessage } from '../lib/analysis.js'

export function useAnalysisQueue(service, errorMessage = analysisErrorMessage) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState(null)
  useEffect(() => {
    let active = true
    let stop
    const fail = error => { if (active) setState({ service, attempt, rows: [], error: errorMessage(error) }) }
    try {
      stop = service.subscribe(rows => { if (active) setState({ service, attempt, rows, error: null }) }, fail)
    } catch (error) { fail(error) }
    return () => { active = false; stop?.() }
  }, [service, attempt, errorMessage])
  const ready = state?.service === service && state?.attempt === attempt
  return { rows: ready ? state.rows : [], error: ready ? state.error : null, loading: !ready, retry: () => setAttempt(value => value + 1) }
}
