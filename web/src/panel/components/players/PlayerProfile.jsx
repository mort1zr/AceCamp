import { useEffect, useRef, useState } from 'react'
import { DataTable } from '../ui'
import { playerAge, playersErrorMessage } from '../../lib/players.js'
import PaginacionTabla, { tamanosPagina } from '../ui/PaginacionTabla.jsx'
import { EsqueletoTabla } from '../dashboard/EsqueletoDashboard.jsx'
import '../dashboard/esqueleto.css'
import TarjetaJugador from '../dashboard/TarjetaJugador.jsx'
import { useMetricasEquipo } from '../../hooks/useMetricasEquipo.js'
import { posicionRanking, valoracionJugador } from '../../lib/valoracion.js'
import Marcador from './Marcador.jsx'
import PlayerForm from './PlayerForm.jsx'

const sportFields = [
  ['Academia', 'academy'],
  ['Categoría', 'category'],
  ['Mano dominante', 'dominantHand'],
  ['Revés', 'backhand'],
  ['UTR', 'utr'],
  ['Entrenador en su academia', 'coachName'],
]

function dateLabel(value) {
  return typeof value === 'string' && value ? value.split('-').reverse().join('/') : 'Sin datos'
}

const matchColumns = [
  { key: 'matchDate', label: 'Fecha', render: dateLabel },
  { key: 'opponent', label: 'Rival' },
  { key: 'tournament', label: 'Torneo', render: value => value || '—' },
  { key: 'result', label: 'Resultado', render: value => <Marcador value={value} /> },
]

export default function PlayerProfile({ service, player, onBack, roster = [], rankingService }) {
  const metricas = useMetricasEquipo(rankingService, true)
  const indice = Math.max(0, roster.findIndex(fila => fila.id === player.id))
  const ranking = metricas ? posicionRanking(roster, metricas, player.id) : null
  const totalRanking = metricas ? roster.filter(fila => valoracionJugador(fila, metricas[fila.id]).media != null).length : 0
  const { id, orgId, createdBy } = player
  const heading = useRef(null)
  const [history, setHistory] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(tamanosPagina[0])
  const [attempt, setAttempt] = useState(0)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mutationError, setMutationError] = useState(null)
  const cancelDelete = useRef(null)
  const deleteButton = useRef(null)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => { if (confirmDelete) cancelDelete.current?.focus() }, [confirmDelete])

  useEffect(() => { if (!editing) heading.current?.focus() }, [editing])

  useEffect(() => {
    let active = true
    let stop
    const fail = error => {
      if (active) setHistory({ error: playersErrorMessage(error) })
    }
    try {
      stop = service.subscribeAnalyzedMatches({ id, orgId, createdBy }, rows => {
        if (active) setHistory({ rows })
      }, fail)
    } catch (error) {
      fail(error)
    }
    return () => { active = false; stop?.() }
  }, [service, id, orgId, createdBy, attempt])

  function retry() {
    setHistory(null)
    setAttempt(value => value + 1)
  }

  const age = playerAge(player.birthDate)
  const allowed = service.canViewProfile?.(player)
  function closeDelete() {
    setConfirmDelete(false)
    deleteButton.current?.focus()
  }
  async function remove() {
    if (deleting) return
    setDeleting(true)
    setMutationError(null)
    try {
      await service.remove(player)
      if (active.current) onBack()
    } catch (error) {
      if (active.current) setMutationError(playersErrorMessage(error, 'remove'))
    } finally { if (active.current) setDeleting(false) }
  }

  const pages = Math.max(1, Math.ceil((history?.rows?.length ?? 0) / pageSize))
  const currentPage = Math.min(page, pages)
  const visibleRows = history?.rows?.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <section className="players-page" aria-labelledby="player-profile-title">
      {service.mode === 'demo' && <aside className="players-demo-notice"><strong>Modo demostración</strong><span>Perfil de ejemplo.</span></aside>}
      <button type="button" className="players-button-secondary players-volver" onClick={onBack}><span aria-hidden="true">←</span> Volver a Jugadores</button>
      <div className="players-profile-top">
        <header className="players-profile-heading">
          <p className="players-eyebrow">Perfil del jugador</p>
          <h1 id="player-profile-title" ref={heading} tabIndex={-1}>{player.fullName}</h1>
        </header>
      <div className="players-form-actions players-profile-actions">
          {allowed && service.update && <button type="button" className="players-button-secondary" onClick={() => { setEditing(true); setConfirmDelete(false) }}>Editar jugador</button>}
          {allowed && service.remove && <button ref={deleteButton} type="button" className="players-button-secondary players-button-borde-peligro" onClick={() => { setConfirmDelete(true); setMutationError(null) }}>Eliminar de la lista</button>}
        </div>
      </div>
      {confirmDelete && <div className="players-modal players-popup" onMouseDown={event => { if (event.target === event.currentTarget && !deleting) closeDelete() }}>
        <section className="players-popup-card" role="alertdialog" aria-modal="true" aria-labelledby="player-delete-title" aria-describedby="player-delete-description" onKeyDown={event => { if (event.key === 'Escape' && !deleting) closeDelete() }}>
          <span className="players-popup-icono" aria-hidden="true">!</span>
          <h2 id="player-delete-title">Eliminar de la lista a {player.fullName}</h2>
          <p id="player-delete-description">El jugador dejará de aparecer en la lista de jugadores y en nuevos análisis. Sus partidos, videos, datos y notas se conservarán para consultar el historial.</p>
          {mutationError && <p role="alert" className="players-save-error">{mutationError}</p>}
          <div className="players-form-actions"><button ref={cancelDelete} type="button" className="players-button-secondary" disabled={deleting} onClick={closeDelete}>Cancelar</button><button type="button" className="players-button-peligro" disabled={deleting} onClick={remove}>{deleting ? 'Eliminando…' : 'Confirmar eliminación'}</button></div>
        </section>
      </div>}
      <div className="players-profile-layout">
      <div className="players-profile-carta"><TarjetaJugador player={player} metrics={metricas?.[player.id]} indice={indice} ranking={ranking} /></div>
      <div className="players-profile-datos">
      <div className="players-profile-grid">
        <section className="players-form-panel">
          <h2>Datos generales</h2>
          <dl>
            <div><dt>Fecha de nacimiento</dt><dd>{dateLabel(player.birthDate)}</dd></div>
            <div><dt>Edad</dt><dd>{age === null ? 'Sin datos' : `${age} años`}</dd></div>
            <div><dt>País de nacimiento</dt><dd>{player.nationality || 'Sin datos'}</dd></div>
          </dl>
        </section>
        <section className="players-form-panel">
          <h2>Datos deportivos</h2>
          <dl>
            {sportFields.map(([label, key]) => (
              <div key={key}><dt>{label}</dt><dd>{(player[key] ?? '') === '' ? 'Sin datos' : player[key]}</dd></div>
            ))}
            <div><dt>Ranking AceCam</dt><dd>{ranking == null ? 'Sin datos' : `#${ranking}${totalRanking ? ` de ${totalRanking}` : ''}`}</dd></div>
          </dl>
        </section>
      </div>
      </div>
      </div>
      {editing && <PlayerForm service={service} initialPlayer={player} onCancel={() => setEditing(false)} onCreated={() => setEditing(false)} />}
      <section className="players-profile-history">
        <h2>Partidos analizados</h2>
        {history === null ? <EsqueletoTabla etiqueta="partidos" /> : <DataTable
          resizable
          caption="Historial de partidos analizados"
          columns={matchColumns}
          rows={visibleRows}
          error={history?.error}
          onRetry={retry}
          emptyTitle="Aún no hay partidos analizados"
          emptyDescription="Los partidos aparecerán aquí cuando termine el análisis."
        />}
        {history?.rows && <PaginacionTabla total={history.rows.length} page={currentPage} pageSize={pageSize} etiqueta="partidos" onPage={setPage} onPageSize={size => { setPageSize(size); setPage(1) }} />}
      </section>
    </section>
  )
}
