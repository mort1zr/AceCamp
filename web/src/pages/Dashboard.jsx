import { useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/ui'
import DashboardMetrics from '../components/dashboard/DashboardMetrics.jsx'
import EvolutionPanel from '../components/dashboard/EvolutionPanel.jsx'
import { usePlayers } from '../hooks/usePlayers.js'
import { useDashboardOverview } from '../hooks/useDashboardOverview.js'
import { playerAge } from '../lib/players.js'
import './jugadores.css'
import './dashboard.css'

function PlayerSummary({ player }) {
  const name = typeof player.fullName === 'string' && player.fullName.trim() ? player.fullName : 'Sin nombre'
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(word => word[0]).join('')
  const age = playerAge(player.birthDate)
  return <div className="dashboard-player-summary"><span className="dashboard-avatar" aria-hidden="true">{initials}</span><div><p className="players-eyebrow">Jugador seleccionado</p><h2>{name}</h2><p>{age == null ? 'Edad sin registrar' : `${age} años`}<span aria-hidden="true"> · </span>{player.academy || 'Sin academia registrada'}</p></div></div>
}

function DashboardWorkspace({ playersService, overviewService, renderEvolution }) {
  const players = usePlayers(playersService)
  const [selectedId, setSelectedId] = useState('')
  const selected = !players.loading && !players.error ? players.rows.find(player => player.id === selectedId) : null
  const overview = useDashboardOverview(overviewService, selected?.id ?? '')
  const ready = overview.status === 'ready'
  const sample = playersService.mode === 'demo'

  return (
    <section className="players-page dashboard-page" aria-labelledby="dashboard-title">
      {sample && <aside className="players-demo-notice"><strong>Modo demostración</strong><span>Jugadores y valores ficticios para revisar la interfaz. No representan resultados de análisis reales.</span></aside>}
      <header className="players-page-heading"><div><p className="players-eyebrow">Una mirada a su rendimiento</p><h1 id="dashboard-title">Dashboard<span className="players-title-dot">.</span></h1><p>Conoce su presente. Acompaña su evolución.</p></div><div className="players-field dashboard-player-select"><label htmlFor="dashboard-player">Jugador</label><select id="dashboard-player" value={selected?.id ?? ''} disabled={players.loading || Boolean(players.error) || players.rows.length === 0} onChange={event => setSelectedId(event.target.value)}><option value="">{players.loading ? 'Cargando jugadores…' : 'Selecciona un jugador'}</option>{players.rows.map(player => <option key={player.id} value={player.id}>{player.fullName}</option>)}</select></div></header>

      {players.loading ? <div className="dashboard-panel dashboard-state" aria-busy="true"><LoadingState title="Cargando jugadores…" /></div> : players.error ? <div className="dashboard-panel dashboard-state"><ErrorState title="No pudimos cargar los jugadores" description={players.error} onRetry={players.retry} /></div> : players.rows.length === 0 ? <div className="dashboard-panel dashboard-state"><EmptyState title="Tu equipo empieza con un jugador" description="Registra un jugador para poder consultar su rendimiento." /></div> : !selected ? <div className="dashboard-panel dashboard-state"><EmptyState title="Cada jugador tiene su propia historia" description="Elige un jugador en el selector para ver su resumen de rendimiento." /></div> : <>
        <div className="dashboard-profile"><PlayerSummary player={selected} /><span className="dashboard-profile-note">{sample ? 'Perfil de ejemplo' : 'Perfil del equipo'}</span></div>
        {overview.status === 'loading' ? <div className="dashboard-panel dashboard-state" aria-busy="true"><LoadingState title="Cargando resumen…" description="Estamos reuniendo los indicadores del jugador seleccionado." /></div> : overview.status === 'error' ? <div className="dashboard-panel dashboard-state"><ErrorState title="No pudimos cargar el resumen" description={overview.error} onRetry={overview.retry} /></div> : <>
          <section aria-labelledby="dashboard-metrics-title"><div className="players-list-heading"><h2 id="dashboard-metrics-title">Resumen de rendimiento</h2><span>{sample ? 'Ejemplos de interfaz' : 'Indicadores disponibles'}</span></div><DashboardMetrics metrics={ready ? overview.data?.metrics : null} sample={sample} /></section>
          {ready && overview.data?.coverage?.incompatibleMatches > 0 && <p className="dashboard-data-notice" role="status">Algunos análisis terminados aún no tienen indicadores disponibles. El resumen incluye únicamente los resultados verificables.</p>}
          {(overview.status === 'unavailable' || !overview.data?.metrics || overview.data?.coverage?.compatibleMatches === 0 || Object.values(overview.data.metrics).every(value => value == null)) && <div className="dashboard-panel dashboard-state"><EmptyState title={overview.status === 'unavailable' ? 'Los indicadores aún no están disponibles' : 'Todavía no hay estadísticas para este jugador'} description="Las métricas disponibles aparecerán aquí cuando se reciban los resultados de sus análisis." /></div>}
          <EvolutionPanel playerId={selected.id} renderEvolution={ready ? renderEvolution : undefined} />
        </>}
      </>}
      <p className="dashboard-footnote">Los datos ausentes se muestran como «Sin datos». Un cero solo se muestra cuando está presente en el resumen.</p>
    </section>
  )
}

export default function Dashboard({ playersService, overviewService, renderEvolution }) {
  const mixedScopes = overviewService && (overviewService.scopeKey !== playersService?.scopeKey || overviewService.mode !== playersService?.mode)
  if (!playersService || mixedScopes) return <section className="players-page"><h1>Dashboard</h1><ErrorState title="El Dashboard aún no está disponible" description="Cuando tu sesión de equipo esté disponible, podrás consultar el resumen de tus jugadores." /></section>
  return <DashboardWorkspace key={playersService.scopeKey} playersService={playersService} overviewService={overviewService} renderEvolution={renderEvolution} />
}
