import { useMemo, useState } from 'react'
import { DataTable, EmptyState, ErrorState, LoadingState } from '../components/ui'
import { useDashboardOverview } from '../hooks/useDashboardOverview.js'
import { usePlayers } from '../hooks/usePlayers.js'
import { useUnidades } from '../hooks/useUnidades.js'
import { dashboardMetricDefinitions, isDashboardMetricValue } from '../lib/dashboardOverview.js'
import { createFirestoreDashboardService } from '../lib/services/firestoreDashboardService.js'
import { createFirestorePlayersService } from '../lib/services/firestorePlayersService.js'
import { convertirVelocidad, etiquetaVelocidad } from '../lib/unidades.js'
import './jugadores.css'

const numberFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })

function comparisonRows(overviews, units) {
  const loading = overviews.some(overview => overview.status === 'loading')
  return dashboardMetricDefinitions.map(metric => {
    const values = overviews.map(overview => {
      const value = overview.data?.metrics?.[metric.key]
      if (overview.status !== 'ready' || !isDashboardMetricValue(metric, value)) return null
      return Number((metric.speed ? convertirVelocidad(value, units) : value).toFixed(1))
    })
    const comparable = values.filter(value => value !== null)
    const best = !loading && comparable.length >= 2
      ? (metric.lowerIsBetter ? Math.min(...comparable) : Math.max(...comparable))
      : null
    return {
      id: metric.key,
      metric: metric.label,
      values,
      unit: metric.speed ? etiquetaVelocidad(units) : metric.unit,
      best,
      tied: best !== null && comparable.filter(value => value === best).length > 1,
    }
  })
}

function ComparisonWorkspace({ playersService, overviewService }) {
  const players = usePlayers(playersService)
  const units = useUnidades()
  const [selection, setSelection] = useState(['', ''])
  const selectedPlayers = selection.map(id => players.rows.find(player => player.id === id))
  const canCompare = selectedPlayers.filter(Boolean).length >= 2
  const ids = canCompare ? selectedPlayers.map(player => player?.id ?? '') : []
  const overviews = [
    useDashboardOverview(overviewService, ids[0]),
    useDashboardOverview(overviewService, ids[1]),
    useDashboardOverview(overviewService, ids[2]),
    useDashboardOverview(overviewService, ids[3]),
  ].slice(0, selection.length)
  const columns = [{ key: 'metric', label: 'Indicador' }, ...selectedPlayers.map((player, index) => ({
    key: `player-${index}`,
    label: player?.fullName || `Jugador ${index + 1}`,
    render: (_, row) => {
      const value = row.values[index]
      if (value === null) return overviews[index].status === 'ready' ? 'Sin datos' : '—'
      const unit = row.unit ? ` ${row.unit}` : ''
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span>{numberFormat.format(value)}{unit}</span>
          {value === row.best && (
            <strong className="rounded-full border border-accent-line px-2 py-0.5 text-xs text-accent-ink">
              {row.tied ? 'Empate' : 'Mejor valor'}
            </strong>
          )}
        </div>
      )
    },
  }))]

  function select(index, id) {
    setSelection(previous => {
      if (id && previous.some((value, position) => value === id && position !== index)) return previous
      return previous.map((value, position) => position === index ? id : value)
    })
  }

  if (players.loading) return <LoadingState title="Cargando jugadores…" />
  if (players.error) return <ErrorState title="No pudimos cargar los jugadores" description={players.error} onRetry={players.retry} />
  if (players.rows.length < 2) return <EmptyState title="Necesitas dos jugadores" description="Registra al menos dos jugadores para comparar sus indicadores." />

  return (
    <>
      <div className="my-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-3" role="group" aria-label="Columnas del comparador">
        {selection.map((id, index) => (
          <div key={index} className="players-field rounded-card border border-line bg-surface p-4">
            <label htmlFor={`compare-player-${index}`}>Jugador {index + 1}</label>
            <select id={`compare-player-${index}`} value={selectedPlayers[index]?.id ?? ''} onChange={event => select(index, event.target.value)}>
              <option value="">Selecciona un jugador</option>
              {players.rows.map(player => (
                <option key={player.id} value={player.id} disabled={player.id !== id && selection.includes(player.id)}>{player.fullName}</option>
              ))}
            </select>
            {selection.length > 2 && (
              <button type="button" className="players-button-secondary mt-3" aria-label={`Quitar columna ${index + 1}`} onClick={() => setSelection(previous => previous.length > 2 ? previous.filter((_, position) => position !== index) : previous)}>Quitar</button>
            )}
            {overviews[index].status === 'loading' && <p role="status" className="mt-2 text-sm text-muted">Cargando indicadores…</p>}
            {overviews[index].status === 'error' && (
              <ErrorState title="No pudimos cargar sus indicadores" description={overviews[index].error} onRetry={overviews[index].retry} />
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="players-button-secondary mb-5"
        disabled={selection.length >= Math.min(4, players.rows.length)}
        onClick={() => setSelection(previous => previous.length < Math.min(4, players.rows.length) ? [...previous, ''] : previous)}
      >Añadir jugador</button>
      {canCompare ? (
        <>
          <DataTable caption="Comparación de jugadores" columns={columns} rows={comparisonRows(overviews, units)} />
          <p className="players-footnote">Partidos y golpes medidos indican el volumen de datos. En dobles faltas se destaca el menor valor.</p>
        </>
      ) : <EmptyState title="Selecciona al menos dos jugadores" description="Los indicadores disponibles aparecerán lado a lado." />}
    </>
  )
}

export default function Comparador({ db, session }) {
  const { uid, orgId, role } = session ?? {}
  const services = useMemo(() => {
    if (!db || typeof uid !== 'string' || !uid.trim() || typeof orgId !== 'string' || !orgId.trim()
      || !['coach', 'admin'].includes(role)) return null
    const identity = { db, orgId, actorId: uid, onlyOwned: role === 'coach' }
    return {
      playersService: createFirestorePlayersService(identity),
      overviewService: createFirestoreDashboardService(identity),
    }
  }, [db, uid, orgId, role])

  return (
    <section className="players-page" aria-labelledby="comparison-title">
      <header className="players-page-heading">
        <div>
          <p className="players-eyebrow">Rendimiento del equipo</p>
          <h1 id="comparison-title">Comparador<span className="players-title-dot">.</span></h1>
          <p>Compara los indicadores disponibles de hasta cuatro jugadores.</p>
        </div>
      </header>
      {services ? <ComparisonWorkspace key={`${services.playersService.scopeKey}:${role}`} {...services} /> : (
        <EmptyState title="El comparador aún no está disponible" description="Inicia sesión con tu equipo para comparar jugadores." />
      )}
    </section>
  )
}
