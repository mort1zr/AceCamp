import { useEffect, useRef, useState } from 'react'
import { DataTable } from '../ui'
import MatchStatistics from '../analysis/MatchStatistics.jsx'
import { playerAge, playersErrorMessage } from '../../lib/players.js'
import PlayerForm from './PlayerForm.jsx'

const sportFields = [
  ['Academia', 'academy'],
  ['Categoría', 'category'],
  ['Mano dominante', 'dominantHand'],
  ['Revés', 'backhand'],
  ['UTR', 'utr'],
  ['Ranking nacional', 'nationalRanking'],
  ['Entrenador en su academia', 'coachName'],
]

function dateLabel(value) {
  return typeof value === 'string' && value ? value.split('-').reverse().join('/') : 'Sin datos'
}

const matchColumns = [
  { key: 'matchDate', label: 'Fecha', render: dateLabel },
  { key: 'opponent', label: 'Rival' },
  { key: 'tournament', label: 'Torneo', render: value => value || '—' },
  { key: 'result', label: 'Resultado', render: value => value || '—' },
]

export default function PlayerProfile({ service, player, onBack }) {
  const { id, orgId, createdBy } = player
  const heading = useRef(null)
  const [history, setHistory] = useState(null)
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
  const latestMatch = history?.rows?.[0]
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
  if (editing) return <PlayerForm service={service} initialPlayer={player} onCancel={() => setEditing(false)} onCreated={() => setEditing(false)} />

  return (
    <section className="players-page" aria-labelledby="player-profile-title">
      {service.mode === 'demo' && <aside className="players-demo-notice"><strong>Modo demostración</strong><span>Perfil de ejemplo.</span></aside>}
      <button type="button" className="players-button-secondary" onClick={onBack}>Volver a Jugadores</button>
      <header className="players-profile-heading">
        <p className="players-eyebrow">Perfil del jugador</p>
        <h1 id="player-profile-title" ref={heading} tabIndex={-1}>{player.fullName}</h1>
      </header>
      <div className="players-form-actions">
        {allowed && service.update && <button type="button" className="players-button-secondary" onClick={() => { setEditing(true); setConfirmDelete(false) }}>Editar jugador</button>}
        {allowed && service.remove && <button ref={deleteButton} type="button" className="players-button-secondary" onClick={() => { setConfirmDelete(true); setMutationError(null) }}>Eliminar de la plantilla</button>}
      </div>
      {confirmDelete && <section className="players-form-panel" role="alertdialog" aria-labelledby="player-delete-title" aria-describedby="player-delete-description" onKeyDown={event => { if (event.key === 'Escape' && !deleting) closeDelete() }}>
        <h2 id="player-delete-title">Eliminar de la plantilla a {player.fullName}</h2>
        <p id="player-delete-description">El jugador dejará de aparecer en la plantilla y en nuevos análisis. Sus partidos, videos, datos y notas se conservarán para consultar el historial.</p>
        {mutationError && <p role="alert">{mutationError}</p>}
        <div className="players-form-actions"><button ref={cancelDelete} type="button" className="players-button-secondary" disabled={deleting} onClick={closeDelete}>Cancelar</button><button type="button" className="players-button-primary" disabled={deleting} onClick={remove}>{deleting ? 'Eliminando…' : 'Confirmar eliminación'}</button></div>
      </section>}
      <div className="players-profile-grid">
        <section className="players-form-panel">
          <h2>Datos generales</h2>
          <dl>
            <div><dt>Fecha de nacimiento</dt><dd>{dateLabel(player.birthDate)}</dd></div>
            <div><dt>Edad</dt><dd>{age === null ? 'Sin datos' : `${age} años`}</dd></div>
            <div><dt>Nacionalidad</dt><dd>{player.nationality || 'Sin datos'}</dd></div>
            <div><dt>Año de graduación</dt><dd>{player.graduationYear ?? 'Sin datos'}</dd></div>
          </dl>
        </section>
        <section className="players-form-panel">
          <h2>Datos deportivos</h2>
          <dl>
            {sportFields.map(([label, key]) => (
              <div key={key}><dt>{label}</dt><dd>{(player[key] ?? '') === '' ? 'Sin datos' : player[key]}</dd></div>
            ))}
          </dl>
        </section>
      </div>
      <section className="players-form-panel" aria-label="Datos del apoderado">
        <h2>Apoderado</h2>
        {allowed && player.guardian ? <dl><div><dt>Nombre del apoderado</dt><dd>{player.guardian.name || 'Sin datos'}</dd></div><div><dt>Teléfono del apoderado</dt><dd>{player.guardian.phone || 'Sin datos'}</dd></div><div><dt>Correo del apoderado</dt><dd>{player.guardian.email || 'Sin datos'}</dd></div></dl> : <p>Sin apoderado registrado.</p>}
      </section>
      {latestMatch && (
        <section className="players-profile-history" aria-labelledby="player-statistics-title">
          <h2 id="player-statistics-title">Estadísticas del último partido analizado</h2>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">{dateLabel(latestMatch.matchDate)} · {latestMatch.opponent || 'Rival sin registrar'}</p>
            <MatchStatistics match={latestMatch} />
          </div>
        </section>
      )}
      <section className="players-profile-history">
        <h2>Partidos analizados</h2>
        <DataTable
          caption="Historial de partidos analizados"
          columns={matchColumns}
          rows={history?.rows}
          loading={history === null}
          error={history?.error}
          onRetry={retry}
          emptyTitle="Aún no hay partidos analizados"
          emptyDescription="Los partidos aparecerán aquí cuando termine el análisis."
        />
      </section>
    </section>
  )
}
