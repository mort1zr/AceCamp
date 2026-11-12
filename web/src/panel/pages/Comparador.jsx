import { useMemo, useState } from 'react'
import { EmptyState, ErrorState, LoadingState, SegmentedControl } from '../components/ui'
import TarjetaJugador from '../components/dashboard/TarjetaJugador.jsx'
import { MarcoComparacion, RadarSuperpuesto, TablaComparacion } from '../components/comparador/ComparacionVisual.jsx'
import { useDashboardOverview } from '../hooks/useDashboardOverview.js'
import { usePlayers } from '../hooks/usePlayers.js'
import { buildPlayerComparisonHistory, comparisonPeriods } from '../lib/comparisonHistory.js'
import { formatMatchDate } from '../lib/dashboardEvolution.js'
import { createFirestoreDashboardService } from '../lib/services/firestoreDashboardService.js'
import { createFirestorePlayersService } from '../lib/services/firestorePlayersService.js'
import './jugadores.css'
import PelotaTitulo from '../components/layout/PelotaTitulo.jsx'

const comparisonModes = [
  { value: 'players', label: 'Jugador contra jugador' },
  { value: 'periods', label: 'Por periodos' },
  { value: 'matches', label: 'Partido contra partido' },
]

function ComparisonTable({ caption, labels, overviews }) {
  const columnas = labels.map((titulo, index) => ({ clave: `col-${index}`, titulo, resumen: overviews[index] }))
  return (
    <MarcoComparacion
      n={columnas.length}
      cabeceras={columnas.map(columna => (
        <div className="cmp-col" key={columna.clave}>
          <h3 className="cmp-titulo">{columna.titulo}</h3>
        </div>
      ))}
    >
      <div className="cmp-scroll"><TablaComparacion caption={caption} columnas={columnas} /></div>
    </MarcoComparacion>
  )
}

function ComparisonWorkspace({ players, overviewService, selection, setSelection }) {
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

  const columnas = selectedPlayers.map((player, index) => ({
    clave: `col-${index}`,
    titulo: player?.fullName || `Jugador ${index + 1}`,
    jugador: player,
    resumen: overviews[index],
  }))
  const comparables = columnas.filter(columna => columna.jugador && columna.resumen.status === 'ready')

  return (
    <>
      <MarcoComparacion
        n={selection.length}
        cabeceras={selection.map((id, index) => {
          const player = selectedPlayers[index]
          const overview = overviews[index]
          return (
            <div key={index} className="cmp-col">
              {selection.length > 2 && (
                <button type="button" className="cmp-quitar" aria-label={`Quitar columna ${index + 1}`} onClick={() => setSelection(previous => previous.length > 2 ? previous.filter((_, position) => position !== index) : previous)}>×</button>
              )}
              {player ? (
                <div className="cmp-carta">
                  <TarjetaJugador
                    player={player}
                    metrics={overview.data?.metrics}
                    indice={Math.max(0, players.findIndex(item => item.id === player.id))}
                    escala={selection.length > 3 ? 0.62 : 0.72}
                  />
                </div>
              ) : <div className="cmp-vacia">Elige un jugador para compararlo</div>}
              <div className="players-field">
                <label className="sr-only" htmlFor={`compare-player-${index}`}>Jugador {index + 1}</label>
                <select id={`compare-player-${index}`} value={player?.id ?? ''} onChange={event => select(index, event.target.value)}>
                  <option value="">Selecciona un jugador</option>
                  {players.map(item => (
                    <option key={item.id} value={item.id} disabled={item.id !== id && selection.includes(item.id)}>{item.fullName}</option>
                  ))}
                </select>
              </div>
              {overview.status === 'loading' && <p role="status" className="cmp-estado">Cargando indicadores…</p>}
              {overview.status === 'error' && (
                <ErrorState title="No pudimos cargar sus indicadores" description={overview.error} onRetry={overview.retry} />
              )}
            </div>
          )
        })}
      >
        {canCompare ? (
          <>
            {comparables.length >= 2 && <RadarSuperpuesto columnas={comparables} />}
            <div className="cmp-scroll"><TablaComparacion caption="Comparación de jugadores" columnas={columnas} /></div>
          </>
        ) : <div className="p-5"><EmptyState title="Selecciona al menos dos jugadores" description="Los indicadores disponibles aparecerán lado a lado." /></div>}
      </MarcoComparacion>
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
  const [selection, setSelection] = useState(['', ''])
  if (players.loading) return <LoadingState title="Cargando jugadores…" />
  if (players.error) return <ErrorState title="No pudimos cargar los jugadores" description={players.error} onRetry={players.retry} />
  if (players.rows.length === 0) return <EmptyState title="Aún no hay jugadores" description="Registra un jugador para comparar su rendimiento." />
  const maxJugadores = Math.min(4, players.rows.length)

  return (
    <>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <SegmentedControl label="Modo de comparación" options={comparisonModes} value={mode} onChange={setMode} />
        {mode === 'players' && players.rows.length >= 2 && (
          <button
            type="button"
            className="players-button-secondary"
            disabled={selection.length >= maxJugadores}
            onClick={() => setSelection(previous => previous.length < maxJugadores ? [...previous, ''] : previous)}
          >Añadir jugador</button>
        )}
      </div>
      {mode === 'players' ? <ComparisonWorkspace players={players.rows} overviewService={overviewService} selection={selection} setSelection={setSelection} /> : (
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
          <h1 id="comparison-title">Comparador<PelotaTitulo /></h1>
          <p>Compara jugadores o revisa el rendimiento de un mismo jugador por periodos y partidos.</p>
        </div>
      </header>
      {services ? <ComparisonPanel key={`${services.playersService.scopeKey}:${role}`} {...services} /> : (
        <EmptyState title="El comparador aún no está disponible" description="Inicia sesión con tu equipo para comparar jugadores." />
      )}
    </section>
  )
}
