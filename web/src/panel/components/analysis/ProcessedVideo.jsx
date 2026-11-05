import { useEffect, useState } from 'react'

export default function ProcessedVideo({ matchId, path, service }) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ status: 'loading' })
  useEffect(() => {
    if (!path || !service) return
    let active = true
    let objectUrl
    const context = { service, path, matchId, attempt }
    service.load({ matchId, path }).then(blob => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setState({ ...context, status: 'ready', url: objectUrl })
    }).catch(() => { if (active) setState({ ...context, status: 'error' }) })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [matchId, path, service, attempt])

  if (!path) return <p className="mt-2 text-sm text-muted">Video procesado no disponible.</p>
  if (!service) return <p className="mt-2 text-sm text-muted">Inicia sesión para cargar el video procesado.</p>
  const current = state.service === service && state.path === path && state.matchId === matchId && state.attempt === attempt
  if (!current || state.status === 'loading') return <p className="mt-2 text-sm text-muted" role="status">Cargando video procesado…</p>
  if (state.status === 'error') return <div className="mt-2"><p role="alert">No pudimos reproducir el video. Comprueba tu sesión y conexión.</p><button type="button" className="players-button-secondary mt-2" onClick={() => setAttempt(value => value + 1)}>Reintentar video</button></div>
  return <video className="mt-3 w-full rounded-lg bg-black" controls playsInline preload="metadata" aria-label="Video procesado del partido" src={state.url} onError={() => setState(previous => ({ ...previous, status: 'error' }))}>Tu navegador no puede reproducir este video.</video>
}
