import { useEffect, useState } from 'react'

export function useMetricasEquipo(service, activo) {
  const [estado, setEstado] = useState({ service: null, metricas: null })

  useEffect(() => {
    if (!service || !activo) return undefined
    let vigente = true
    let parar
    const recibir = (metricas) => {
      if (vigente) setEstado({ service, metricas })
    }
    try {
      parar = service.subscribe(recibir, () => recibir(null))
    } catch {
      recibir(null)
    }
    return () => {
      vigente = false
      parar?.()
    }
  }, [service, activo])

  return estado.service === service ? estado.metricas : null
}
