import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { Link } from 'react-router'
import { DataTable, StatusBadge } from '../components/ui'
import PlayerProfile from '../components/players/PlayerProfile.jsx'
import AsignarJugador from '../components/recruitment/AsignarJugador.jsx'
import EnlacesPostulacion from '../components/recruitment/EnlacesPostulacion.jsx'
import { incluyeSeccion, usePlanVista } from '../context/PlanVistaContext.js'
import { usePlayers } from '../hooks/usePlayers.js'
import { nextApplicationStates, updateApplicationStatus } from '../lib/applicationStatus.js'
import { APPLICATION_STATUS, COLLECTIONS } from '../lib/schema.js'
import { createFirestorePlayersService } from '../lib/services/firestorePlayersService.js'
import './jugadores.css'

const states = Object.values(APPLICATION_STATUS)
const columns = [
  { key: 'fullName', label: 'Postulante', render: (name, application) => (
    <>
      {name}
      {application.hasVideo && <span className="block text-xs text-muted">Video adjunto</span>}
    </>
  ) },
  { key: 'city', label: 'Ciudad' },
  { key: 'graduationYear', label: 'Año de graduación' },
  { key: 'status', label: 'Estado', render: (status) => <StatusBadge status={status} /> },
]
const normalize = (text) => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const statusLabel = (state) => state[0].toUpperCase() + state.slice(1)

function CambiarEstado({ application, onSave }) {
  const [selection, setSelection] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const options = nextApplicationStates(application.status)
  if (options.length === 0) return '—'
  const selected = options.includes(selection) ? selection : ''

  async function submit(event) {
    event.preventDefault()
    if (!selected || saving) return
    setSaving(true)
    setError('')
    try {
      await onSave(application, selected)
      setSelection('')
    } catch (error) {
      setError(error.message === 'application/status-conflict'
        ? 'La postulación cambió en otra sesión. Revisa el estado actual.'
        : 'No se pudo guardar el estado. Inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="players-field" onSubmit={submit}>
      <select aria-label={`Nuevo estado de ${application.fullName}`} value={selected} disabled={saving} onChange={(e) => setSelection(e.target.value)}>
        <option value="">Cambiar estado</option>
        {options.map((state) => <option key={state} value={state}>{statusLabel(state)}</option>)}
      </select>
      <button type="submit" className="players-button-secondary mt-2" disabled={!selected || saving} aria-label={`Guardar estado de ${application.fullName}`}>
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
      {error && <p className="players-field-error" role="alert">{error}</p>}
    </form>
  )
}

function Bandeja({ db, orgId, uid, role }) {
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [notice, setNotice] = useState('')
  const [assignmentId, setAssignmentId] = useState('')
  const [profileId, setProfileId] = useState('')
  const playerService = useMemo(() => createFirestorePlayersService({ db, orgId, actorId: uid, role }), [db, orgId, uid, role])
  const roster = usePlayers(playerService)

  useEffect(() => {
    let active = true
    const unsubscribe = onSnapshot(
      query(collection(db, COLLECTIONS.applications), where('orgId', '==', orgId)),
      (snapshot) => {
        if (!active) return
        const rows = snapshot.docs
          .map((doc) => {
            const { orgId, fullName, city, graduationYear, status, createdAt, playerId,
              birthDate, academy, guardian, dominantHand, backhand, utr, nationalRanking, videoPaths } = doc.data()
            return { id: doc.id, orgId, fullName, city, graduationYear, status, createdAt, playerId,
              birthDate, academy, guardian, dominantHand, backhand, utr, nationalRanking,
              hasVideo: Array.isArray(videoPaths) && videoPaths.length > 0 }
          })
          .filter((row) => row.orgId === orgId)
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
        setResult({ rows })
      },
      () => {
        if (active) setResult({ error: 'No se pudieron cargar las postulaciones de tu organización.' })
      },
    )
    return () => {
      active = false
      unsubscribe()
    }
  }, [db, orgId, attempt])

  const term = normalize(search.trim())
  const rows = result?.rows ?? []
  const assignment = rows.find(({ id }) => id === assignmentId)
  const profile = roster.rows.find(({ id }) => id === profileId)
  const filtered = rows.filter((row) =>
    (!status || row.status === status) &&
    [row.fullName, row.city].some((value) => normalize(value).includes(term)),
  )
  async function saveStatus(application, nextStatus) {
    setNotice('')
    await updateApplicationStatus(db, { uid, orgId }, application, nextStatus)
    setNotice(`Se guardó el estado de ${application.fullName}: ${nextStatus}.`)
  }

  const editableColumns = [...columns,
    {
      key: 'action',
      label: 'Cambiar estado',
      render: (_, application) => <CambiarEstado application={application} onSave={saveStatus} />,
    },
    {
      key: 'playerId',
      label: 'Jugador',
      render: (playerId, application) => {
        if (!playerId) return (
          <button type="button" className="players-button-secondary"
            aria-label={`Crear o vincular jugador para ${application.fullName}`}
            disabled={Boolean(assignment)} onClick={() => setAssignmentId(application.id)}>
            Crear o vincular
          </button>
        )
        return roster.rows.some(({ id }) => id === playerId) ? (
          <button type="button" className="players-button-secondary" aria-label={`Ver ficha de ${application.fullName}`}
            onClick={() => setProfileId(playerId)}>Ver ficha</button>
        ) : 'Jugador vinculado'
      },
    },
  ]

  function assigned({ alreadyLinked }) {
    setNotice(alreadyLinked ? 'Esta postulación ya tiene un jugador vinculado.' : 'Jugador vinculado a la postulación.')
    setAssignmentId('')
  }

  if (profile) return <PlayerProfile key={profile.id} player={profile} service={playerService} onBack={() => setProfileId('')} />

  return (
    <>
      {rows.length > 0 && (
        <div className="players-filters">
          <div className="players-field">
            <label htmlFor="application-search">Buscar por nombre o ciudad</label>
            <input id="application-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="players-field">
            <label htmlFor="application-status">Estado de postulación</label>
            <select id="application-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos los estados</option>
              {states.map((state) => (
                <option key={state} value={state}>{statusLabel(state)}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      <p className="players-notice" role="status">{notice}</p>
      {assignment && (assignment.playerId ? (
        <div className="players-form-panel">
          <p role="status">Esta postulación ya tiene un jugador vinculado.</p>
          <button type="button" className="players-button-secondary" onClick={() => setAssignmentId('')}>Volver a la bandeja</button>
        </div>
      ) : (
        <AsignarJugador key={assignment.id} application={assignment} roster={roster} service={playerService}
          onAssigned={assigned} onCancel={() => setAssignmentId('')} />
      ))}
      <DataTable
        caption="Bandeja de postulaciones"
        columns={editableColumns}
        rows={filtered}
        loading={!result}
        error={result?.error}
        onRetry={() => {
          setResult(null)
          setAttempt((value) => value + 1)
        }}
        emptyTitle={rows.length > 0 ? 'No hay coincidencias' : 'Aún no llegan postulaciones'}
        emptyDescription={rows.length > 0 ? 'Prueba otro nombre, ciudad o estado.' : 'Aquí aparecerán las postulaciones de tu organización.'}
      />
    </>
  )
}

export default function Reclutamiento({ db, session }) {
  const { plan } = usePlanVista()
  const { uid, orgId, role } = session ?? {}
  const allowed = incluyeSeccion(plan, 'reclutamiento')
  return (
    <section className="players-page" aria-labelledby="recruitment-title">
      <header className="players-page-heading">
        <div>
          <p className="players-eyebrow">Postulaciones de tu organización</p>
          <h1 id="recruitment-title">Reclutamiento<span className="players-title-dot">.</span></h1>
          <p>Consulta las postulaciones y su estado.</p>
        </div>
      </header>
      {plan == null ? (
        <p role="status">La bandeja estará disponible cuando se confirme el plan de tu organización.</p>
      ) : !allowed ? (
        <aside className="players-demo-notice">
          <strong>Reclutamiento está disponible desde el plan Pro.</strong>
          <Link to="/configuracion?seccion=plan">Ver mi plan</Link>
        </aside>
      ) : db && uid && orgId && ['coach', 'admin'].includes(role) ? (
        <div className="space-y-4" key={JSON.stringify([db.app?.options?.projectId, uid, orgId, role])}>
          <EnlacesPostulacion db={db} orgId={orgId} uid={uid} role={role} />
          <Bandeja db={db} orgId={orgId} uid={uid} role={role} />
        </div>
      ) : (
        <p role="status">La bandeja se habilitará cuando tu sesión de equipo esté disponible.</p>
      )}
    </section>
  )
}
