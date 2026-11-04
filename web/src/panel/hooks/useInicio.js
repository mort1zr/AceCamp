import { useEffect, useState } from 'react'

export function useInicio(service) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState(null)

  useEffect(() => {
    let active = true
    let stop
    const fail = (error) => {
      if (active) setState({ service, attempt, data: null, error: error ?? true })
    }
    try {
      stop = service.subscribe((data) => {
        if (active) setState({ service, attempt, data, error: null })
      }, fail)
    } catch (error) {
      fail(error)
    }
    return () => {
      active = false
      stop?.()
    }
  }, [service, attempt])

  const ready = state?.service === service && state?.attempt === attempt
  return {
    data: ready ? state.data : null,
    error: ready ? state.error : null,
    loading: !ready,
    retry: () => setAttempt((value) => value + 1),
  }
}
