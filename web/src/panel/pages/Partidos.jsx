import { useEffect, useMemo, useRef, useState } from 'react'
import { DataTable, EmptyState } from '../components/ui'
import Marcador from '../components/players/Marcador.jsx'
import PaginacionTabla, { tamanosPagina } from '../components/ui/PaginacionTabla.jsx'
import { EsqueletoTabla } from '../components/dashboard/EsqueletoDashboard.jsx'
import '../components/dashboard/esqueleto.css'
import MatchReport from '../components/analysis/MatchReport.jsx'
import { useAnalysisQueue } from '../hooks/useAnalysisQueue.js'
import { usePlayers } from '../hooks/usePlayers.js'
import { useNombreOrganizacion } from '../hooks/useNombreOrganizacion.js'
import { formatMatchDate } from '../lib/dashboardEvolution.js'
import { createFirestoreMatchesService } from '../lib/services/firestoreMatchesService.js'
import { createFirestoreMatchNotesService } from '../lib/services/firestoreMatchNotesService.js'
import { createFirestorePlayersService } from '../lib/services/firestorePlayersService.js'
import { createAzureProcessedVideoService } from '../lib/azureVideos.js'
import { createProcessedVideoService } from '../lib/services/processedVideoService.js'
import './jugadores.css'
import PelotaTitulo from '../components/layout/PelotaTitulo.jsx'

function matchesErrorMessage(error) {
  if (error?.code === 'permission-denied' || error?.code === 'unauthenticated') {
    return 'Tu sesión no permite consultar los partidos. Vuelve a iniciar sesión o consulta con el administrador.'
  }
  return 'No pudimos cargar los partidos. Revisa tu conexión y vuelve a intentarlo.'
}

function MatchesList({ matchesService, playersService, notesService, videoService, organizacion }) {
  const matches = useAnalysisQueue(matchesService, matchesErrorMessage)
  const players = usePlayers(playersService)
  const [playerId, setPlayerId] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [matchId, setMatchId] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(tamanosPagina[0])
  const historySection = useRef(null)
  const reportWasOpen = useRef(false)
  const playerNames = new Map(players.rows.map(player => [player.id, player.fullName]))
  const columns = [
    { key: 'matchDate', label: 'Fecha', render: value => formatMatchDate(value) },
    { key: 'playerId', label: 'Jugador', render: id => playerNames.get(id) || 'Jugador no disponible' },
    { key: 'opponent', label: 'Rival', render: value => value || '—' },
    { key: 'tournament', label: 'Torneo', render: value => value || '—' },
    { key: 'result', label: 'Marcador', render: value => <Marcador value={value} /> },
    {
      key: 'report', label: 'Reporte', align: 'right',
      render: (_, match) => (
        <button
          type="button"
          className="players-button-secondary"
          aria-label={`Ver reporte del partido con ${match.opponent || 'rival sin registrar'}, ${formatMatchDate(match.matchDate)}`}
          onClick={() => setMatchId(match.id)}
        >Ver reporte</button>
      ),
    },
  ]
  const loading = players.loading || matches.loading
  const error = players.error || matches.error
  const invalidRange = Boolean(start && end && start > end)
  const showRangeError = invalidRange && !loading && !error
  const filtered = Boolean(playerId || start || end)
  const rows = matches.rows.filter(match => (!playerId || match.playerId === playerId)
    && (!(start || end) || (match.matchDate && (!start || match.matchDate >= start) && (!end || match.matchDate <= end))))
  const noMatches = filtered && matches.rows.length > 0
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectedMatch = !loading && !error && matches.rows.find(match => match.id === matchId)
  const reportOpen = Boolean(selectedMatch)

  useEffect(() => {
    if (!reportOpen && reportWasOpen.current) historySection.current?.focus()
    reportWasOpen.current = reportOpen
  }, [reportOpen])

  function clearFilters() {
    setPlayerId('')
    setStart('')
    setEnd('')
    setPage(1)
  }

  function retry() {
    if (players.error) players.retry()
    if (matches.error) matches.retry()
  }

  if (selectedMatch) return (
    <MatchReport
      key={selectedMatch.id}
      match={selectedMatch}
      playerName={playerNames.get(selectedMatch.playerId) || 'Jugador no disponible'}
      notesService={notesService}
      videoService={videoService}
      organizacion={organizacion}
      onBack={() => setMatchId('')}
    />
  )

  return (
    <>
      {!loading && !error && (matches.rows.length > 0 || filtered) && (
        <>
          <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))] items-end gap-3" role="group" aria-label="Filtros de partidos">
            <div className="players-field">
              <label htmlFor="matches-player">Jugador</label>
              <select id="matches-player" value={playerId} onChange={event => { setPlayerId(event.target.value); setPage(1) }}>
                <option value="">Todos los jugadores</option>
                {playerId && !playerNames.has(playerId) && <option value={playerId}>Jugador no disponible</option>}
                {players.rows.map(player => <option value={player.id} key={player.id}>{player.fullName}</option>)}
              </select>
            </div>
            <div className="players-field">
              <label htmlFor="matches-start">Desde</label>
              <input id="matches-start" type="date" value={start} aria-invalid={invalidRange} aria-describedby={invalidRange ? 'matches-range-error' : undefined} onChange={event => { setStart(event.target.value); setPage(1) }} />
            </div>
            <div className="players-field">
              <label htmlFor="matches-end">Hasta</label>
              <input id="matches-end" type="date" value={end} aria-invalid={invalidRange} aria-describedby={invalidRange ? 'matches-range-error' : undefined} onChange={event => { setEnd(event.target.value); setPage(1) }} />
            </div>
            <button type="button" className="players-button-secondary" disabled={!filtered} onClick={clearFilters}>Limpiar filtros</button>
          </div>
          {invalidRange && <p id="matches-range-error" className="players-field-error" role="alert">La fecha inicial debe ser anterior o igual a la final.</p>}
        </>
      )}
      {!showRangeError && (
        <section className="mt-5" aria-label="Historial de partidos" ref={historySection} tabIndex={-1}>
          {!loading && !error && <p className="mb-3 text-sm text-muted" role="status">{rows.length} {rows.length === 1 ? 'partido' : 'partidos'}</p>}
          {!error && loading ? <EsqueletoTabla etiqueta="partidos" /> : (
            <DataTable
              resizable
              caption="Partidos analizados"
              columns={columns}
              rows={visibleRows}
              error={error}
              onRetry={retry}
              emptyTitle={noMatches ? 'No hay partidos con esos filtros' : 'Aún no hay partidos analizados'}
              emptyDescription={noMatches ? 'Cambia el jugador o el rango de fechas.' : 'Los partidos aparecerán aquí cuando termine el análisis del video.'}
            />
          )}
          {!loading && !error && (
            <PaginacionTabla total={rows.length} page={currentPage} pageSize={pageSize} etiqueta="partidos" onPage={setPage} onPageSize={size => { setPageSize(size); setPage(1) }} />
          )}
        </section>
      )}
    </>
  )
}

export default function Partidos({ db, storage, session, videoApi }) {
  const { uid, orgId, role } = session ?? {}
  const organizacion = useNombreOrganizacion(db, orgId)
  const services = useMemo(() => {
    if (!db || typeof uid !== 'string' || !uid.trim() || typeof orgId !== 'string' || !orgId.trim()
      || !['coach', 'admin'].includes(role)) return null
    const identity = { db, orgId, actorId: uid, role }
    return {
      playersService: createFirestorePlayersService({ ...identity, onlyOwned: role === 'coach', includeDeleted: true }),
      matchesService: createFirestoreMatchesService(identity),
      notesService: createFirestoreMatchNotesService(identity),
      videoService: videoApi
        ? createAzureProcessedVideoService({ client: videoApi, orgId })
        : storage ? createProcessedVideoService({ storage, orgId }) : null,
    }
  }, [db, storage, videoApi, uid, orgId, role])

  return (
    <section className="players-page" aria-labelledby="matches-title">
      <header className="players-page-heading">
        <div>
          <p className="players-eyebrow">Del análisis a la cancha</p>
          <h1 id="matches-title">Partidos<PelotaTitulo /></h1>
          <p>Consulta los partidos analizados y su marcador.</p>
        </div>
      </header>
      {services ? <MatchesList key={`${services.playersService.scopeKey}:${role}`} {...services} organizacion={organizacion} /> : (
        <EmptyState title="Los partidos aún no están disponibles" description="Inicia sesión con tu equipo para consultar su historial." />
      )}
    </section>
  )
}
