import { useMemo, useState } from 'react'
import { DataTable, EmptyState, ErrorState, LoadingState, SegmentedControl } from '../components/ui'
import { useDashboardOverview } from '../hooks/useDashboardOverview.js'
import { usePlayers } from '../hooks/usePlayers.js'
import { useUnidades } from '../hooks/useUnidades.js'
import { buildPlayerComparisonHistory, comparisonPeriods } from '../lib/comparisonHistory.js'
import { formatMatchDate } from '../lib/dashboardEvolution.js'
import { dashboardMetricDefinitions, isDashboardMetricValue } from '../lib/dashboardOverview.js'
import { createFirestoreDashboardService } from '../lib/services/firestoreDashboardService.js'
import { createFirestorePlayersService } from '../lib/services/firestorePlayersService.js'
import { convertirVelocidad, etiquetaVelocidad } from '../lib/unidades.js'
import './jugadores.css'

const numberFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })
const comparisonModes = [
  { value: 'players', label: 'Jugador contra jugador' },
  { value: 'periods', label: 'Por periodos' },
  { value: 'matches', label: 'Partido contra partido' },
]

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

function ComparisonTable({ caption, labels, overviews }) {
  const units = useUnidades()
  const columns = [{ key: 'metric', label: 'Indicador' }, ...labels.map((label, index) => ({
    key: `comparison-${index}`,
    label,
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

  return (
    <>
      <DataTable caption={caption} columns={columns} rows={comparisonRows(overviews, units)} />
      <p className="players-footnote">Partidos y golpes medidos indican el volumen de datos. En dobles faltas se destaca el menor valor.</p>
    </>
  )
}

function ComparisonWorkspace({ players, overviewService }) {
  const [selection, setSelection] = useState(['', ''])
  const selectedPlayers = selection.map(id => players.find(player => player.id === id))
  const canCompare = selectedPlayers.filter(Boolean).length >= 2
  const ids = canCompare ? selectedPlayers.map(player => player?.id ?? '') : []
  const overviews = [
    useDashboardOverview(overviewService, ids[0]),
    useDashboardOverview(overviewService, ids[1]),
    useDashboardOverview(overviewService, ids[2]),
    useDashboardOverview(overviewService, ids[3]),
  ].slice(0, selection.length)

  function select(index, id) {
    setSelection(previous => {
      if (id && previous.some((value, position) => value === id && position !== index)) return previous
      return previous.map((value, position) => position === index ? id : value)
    })
  }

  if (players.length < 2) return <EmptyState title="Necesitas dos jugadores" description="Registra al menos dos jugadores para comparar sus indicadores." />

  return (
    <>
      <div className="my-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-3" role="group" aria-label="Columnas del comparador">
        {selection.map((id, index) => (
          <div key={index} className="players-field rounded-card border border-line bg-surface p-4">
            <label htmlFor={`compare-player-${index}`}>Jugador {index + 1}</label>
            <select id={`compare-player-${index}`} value={selectedPlayers[index]?.id ?? ''} onChange={event => select(index, event.target.value)}>
              <option value="">Selecciona un jugador</option>
              {players.map(player => (
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
        disabled={selection.length >= Math.min(4, players.length)}
        onClick={() => setSelection(previous => previous.length < Math.min(4, players.length) ? [...previous, ''] : previous)}
      >Añadir jugador</button>
      {canCompare ? (
        <ComparisonTable
          caption="Comparación de jugadores"
          labels={selectedPlayers.map((player, index) => player?.fullName || `Jugador ${index + 1}`)}
          overviews={overviews}
        />
      ) : <EmptyState title="Selecciona al menos dos jugadores" description="Los indicadores disponibles aparecerán lado a lado." />}
    </>
  )
}

function matchLabel(match) {
  const opponent = match.opponent || 'Rival sin registrar'
  return [formatMatchDate(match.date), opponent, match.tournament].filter(Boolean).join(' · ')
}

function HistoryComparison({ players, historyService, mode }) {
  const [playerId, setPlayerId] = useState('')
  const [period, setPeriod] = useState('3')
  const [matchIds, setMatchIds] = useState(['', ''])
  const selectedId = players.some(player => player.id === playerId) ? playerId : ''
  const history = useDashboardOverview(historyService, selectedId)

  function selectMatch(index, id) {
    setMatchIds(previous => {
      if (id && previous[1 - index] === id) return previous
      return previous.map((value, position) => position === index ? id : value)
    })
  }

  const matches = history.data?.matches ?? []
  const selectedMatches = matchIds.map(id => matches.find(match => match.id === id))
  const historicalPeriod = comparisonPeriods.find(item => item.value === period)

  return (
    <>
      <div className="players-field my-5 max-w-md">
        <label htmlFor="compare-history-player">Jugador</label>
        <select id="compare-history-player" value={selectedId} onChange={event => {
          setPlayerId(event.target.value)
          setMatchIds(['', ''])
        }}>
          <option value="">Selecciona un jugador</option>
          {players.map(player => <option key={player.id} value={player.id}>{player.fullName}</option>)}
        </select>
      </div>
      {history.status === 'idle' && <EmptyState title="Selecciona un jugador" description="Compara sus propios partidos e indicadores." />}
      {history.status === 'loading' && <LoadingState title="Cargando partidos del jugador…" />}
      {history.status === 'error' && <ErrorState title="No pudimos cargar sus partidos" description={history.error} onRetry={history.retry} />}
      {history.status === 'ready' && mode === 'periods' && (
        <>
          <div className="players-field mb-4 max-w-md">
            <label htmlFor="compare-history-period">Comparar el periodo actual con</label>
            <select id="compare-history-period" value={period} onChange={event => setPeriod(event.target.value)}>
              {comparisonPeriods.slice(1).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <p className="players-footnote">Cada columna abarca tres meses. El periodo actual termina hoy.</p>
          <ComparisonTable caption="Comparación por periodos" labels={['Actual', historicalPeriod.label]}
            overviews={['0', period].map(value => ({ status: 'ready', data: history.data.periods[value] }))} />
        </>
      )}
      {history.status === 'ready' && mode === 'matches' && (
        matches.length < 2 ? <EmptyState title="Necesitas dos partidos analizados" description="Los partidos Listo de este jugador aparecerán aquí." /> : (
          <>
            <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-3">
              {matchIds.map((id, index) => (
                <div className="players-field" key={index}>
                  <label htmlFor={`compare-match-${index}`}>Partido {index + 1}</label>
                  <select id={`compare-match-${index}`} value={selectedMatches[index]?.id ?? ''} onChange={event => selectMatch(index, event.target.value)}>
                    <option value="">Selecciona un partido</option>
                    {matches.map(match => (
                      <option key={match.id} value={match.id} disabled={match.id !== id && matchIds[1 - index] === match.id}>
                        {matchLabel(match)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {selectedMatches.every(Boolean) ? (
              <ComparisonTable caption="Comparación de partidos" labels={selectedMatches.map(matchLabel)}
                overviews={selectedMatches.map(data => ({ status: 'ready', data }))} />
            ) : <EmptyState title="Selecciona dos partidos" description="Los indicadores disponibles aparecerán lado a lado." />}
          </>
        )
      )}
    </>
  )
}

function ComparisonPanel({ playersService, overviewService, historyService }) {
  const players = usePlayers(playersService)
  const [mode, setMode] = useState('players')
  if (players.loading) return <LoadingState title="Cargando jugadores…" />
  if (players.error) return <ErrorState title="No pudimos cargar los jugadores" description={players.error} onRetry={players.retry} />
  if (players.rows.length === 0) return <EmptyState title="Aún no hay jugadores" description="Registra un jugador para comparar su rendimiento." />

  return (
    <>
      <div className="mt-5"><SegmentedControl label="Modo de comparación" options={comparisonModes} value={mode} onChange={setMode} /></div>
      {mode === 'players' ? <ComparisonWorkspace players={players.rows} overviewService={overviewService} /> : (
        <HistoryComparison players={players.rows} historyService={historyService} mode={mode} />
      )}
    </>
  )
}

export default function Comparador({ db, session }) {
  const { uid, orgId, role } = session ?? {}
  const services = useMemo(() => {
    if (!db || typeof uid !== 'string' || !uid.trim() || typeof orgId !== 'string' || !orgId.trim()
      || !['coach', 'admin'].includes(role)) return null
    const identity = { db, orgId, actorId: uid, role, onlyOwned: role === 'coach' }
    return {
      playersService: createFirestorePlayersService(identity),
      overviewService: createFirestoreDashboardService(identity),
      historyService: createFirestoreDashboardService({ ...identity, summarizePlayer: buildPlayerComparisonHistory }),
    }
  }, [db, uid, orgId, role])

  return (
    <section className="players-page" aria-labelledby="comparison-title">
      <header className="players-page-heading">
        <div>
          <p className="players-eyebrow">Rendimiento del equipo</p>
          <h1 id="comparison-title">Comparador<span className="players-title-dot">.</span></h1>
          <p>Compara jugadores o revisa el rendimiento de un mismo jugador por periodos y partidos.</p>
        </div>
      </header>
      {services ? <ComparisonPanel key={`${services.playersService.scopeKey}:${role}`} {...services} /> : (
        <EmptyState title="El comparador aún no está disponible" description="Inicia sesión con tu equipo para comparar jugadores." />
      )}
    </section>
  )
}
