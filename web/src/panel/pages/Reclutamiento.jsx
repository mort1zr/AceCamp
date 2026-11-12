import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { Link } from 'react-router'
import { EmptyState, ErrorState, StatusBadge } from '../components/ui'
import DetallePostulacion, { fechaCorta, iniciales } from '../components/recruitment/DetallePostulacion.jsx'
import PlayerProfile from '../components/players/PlayerProfile.jsx'
import AnalisisPostulacion from '../components/recruitment/AnalisisPostulacion.jsx'
import AsignarJugador from '../components/recruitment/AsignarJugador.jsx'
import EnlacesPostulacion from '../components/recruitment/EnlacesPostulacion.jsx'
import { incluyeSeccion, usePlanVista } from '../context/PlanVistaContext.js'
import { usePlayers } from '../hooks/usePlayers.js'
import { updateApplicationNotes, updateApplicationStatus } from '../lib/applicationStatus.js'
import { playerAge } from '../lib/players.js'
import { applicationReference } from '../lib/publicApplications.js'
import { APPLICATION_STATUS, COLLECTIONS } from '../lib/schema.js'
import { createFirestorePlayersService } from '../lib/services/firestorePlayersService.js'
import './jugadores.css'
import { EsqueletoBandeja } from '../components/dashboard/EsqueletoDashboard.jsx'
import '../components/dashboard/esqueleto.css'
import '../components/recruitment/bandeja.css'
import PelotaTitulo from '../components/layout/PelotaTitulo.jsx'

const states = Object.values(APPLICATION_STATUS)
const PAGE_SIZE = 10
const normalize = (text) => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const statusLabel = (state) => state[0].toUpperCase() + state.slice(1)

function resumenLinea(row) {
  const edad = playerAge(row.birthDate)
  return [edad == null ? null : `${edad} años`, row.academy, row.utr == null ? null : `UTR ${row.utr}`].filter(Boolean).join(' · ')
}

function Estadisticas({ rows }) {
  const ahora = new Date()
  const esteMes = rows.filter((row) => {
    const ms = row.createdAt?.toMillis?.()
    if (!Number.isFinite(ms)) return false
    const fecha = new Date(ms)
    return fecha.getFullYear() === ahora.getFullYear() && fecha.getMonth() === ahora.getMonth()
  }).length
  const sinRevisar = rows.filter((row) => row.status === APPLICATION_STATUS.new).length
  const videos = rows.reduce((total, row) => total + row.videoLinks.length + row.videoCount, 0)
  return (
    <dl className="rec-stats" aria-label="Resumen de postulaciones">
      <div><dt>Este mes</dt><dd>{esteMes}</dd></div>
      <div><dt>Sin revisar</dt><dd data-resalta={sinRevisar > 0 || undefined}>{sinRevisar}</dd></div>
      <div><dt>Videos recibidos</dt><dd>{videos}</dd></div>
    </dl>
  )
}

function Bandeja({ db, orgId, uid, role, children }) {
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [page, setPage] = useState(1)
  const [assignmentId, setAssignmentId] = useState('')
  const [profileId, setProfileId] = useState('')
  const [videoApplicationId, setVideoApplicationId] = useState('')
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
              birthDate, academy, guardian, dominantHand, backhand, utr, nationalRanking,
              email, message, videoLinks, videoPaths, internalNotes } = doc.data()
            const paths = Array.isArray(videoPaths) ? [...new Set(videoPaths.filter(path => typeof path === 'string'))] : []
            return { id: doc.id, orgId, fullName, city, graduationYear, status, createdAt, playerId,
              birthDate, academy, guardian, dominantHand, backhand, utr, nationalRanking,
              email, message, internalNotes,
              videoLinks: Array.isArray(videoLinks) ? videoLinks.filter((link) => typeof link === 'string') : [],
              videoPaths: paths,
              videoCount: paths.length,
              hasVideo: paths.length > 0 }
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
  const profile = roster.rows.find(({ id }) => id === profileId)
  const videoApplication = rows.find(({ id }) => id === videoApplicationId)
  const filtered = rows.filter((row) =>
    (!status || row.status === status) &&
    [row.fullName, row.city, applicationReference(row.id)].some((value) => normalize(value).includes(term)),
  )
  const selected = filtered.find(({ id }) => id === selectedId) ?? filtered[0]
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const assignment = selected && selected.id === assignmentId ? selected : null
  const countByStatus = (state) => rows.filter((row) => row.status === state).length

  async function saveStatus(application, nextStatus) {
    setNotice('')
    await updateApplicationStatus(db, { uid, orgId }, application, nextStatus)
    setNotice(`Se guardó el estado de ${application.fullName}: ${nextStatus}.`)
  }

  function assigned({ alreadyLinked }) {
    setNotice(alreadyLinked ? 'Esta postulación ya tiene un jugador vinculado.' : 'Jugador vinculado a la postulación.')
    setAssignmentId('')
  }

  if (profile) return <PlayerProfile key={profile.id} player={profile} service={playerService} onBack={() => setProfileId('')} />
  if (videoApplication) return <AnalisisPostulacion key={videoApplication.id} db={db} orgId={orgId} uid={uid} role={role}
    application={videoApplication} canAnalyze={roster.rows.some(({ id }) => id === videoApplication.playerId)}
    onBack={() => setVideoApplicationId('')} />

  const tabs = [{ value: '', label: 'Todas', count: rows.length }, ...states.map((state) => ({ value: state, label: statusLabel(state), count: countByStatus(state) }))]

  return (
    <>
      <div className="rec-barra-superior">
        {children}
        {result?.rows && <Estadisticas rows={rows} />}
      </div>
      {rows.length > 0 && (
        <div className="rec-filtros">
          <div className="rec-tabs" role="tablist" aria-label="Estado de postulación">
            {tabs.map((tab) => (
              <button key={tab.value || 'todas'} type="button" role="tab" aria-selected={status === tab.value} onClick={() => { setStatus(tab.value); setPage(1) }}>
                {tab.label} <span>{tab.count}</span>
              </button>
            ))}
          </div>
          <div className="players-field rec-buscar">
            <label className="sr-only" htmlFor="application-search">Buscar por nombre, ciudad o referencia</label>
            <input id="application-search" type="search" placeholder="Nombre, ciudad o referencia" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          </div>
        </div>
      )}
      <p className="players-notice" role="status">{notice}</p>
      {!result ? <EsqueletoBandeja /> : result.error ? (
        <ErrorState
          description={result.error}
          onRetry={() => {
            setResult(null)
            setAttempt((value) => value + 1)
          }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={rows.length > 0 ? 'No hay coincidencias' : 'Aún no llegan postulaciones'}
          description={rows.length > 0 ? 'Prueba otro nombre, ciudad o estado.' : 'Aquí aparecerán las postulaciones de tu organización.'}
        />
      ) : (
        <div className="rec-layout">
          <div className="rec-columna">
            <ul className="rec-lista" aria-label="Postulaciones">
              {pageRows.map((row) => (
                <li key={row.id}>
                  <button type="button" className="rec-item" aria-pressed={row.id === selected.id} aria-label={`Postulación de ${row.fullName}`} onClick={() => setSelectedId(row.id)}>
                    <span className="rec-avatar" aria-hidden="true">{iniciales(row.fullName)}</span>
                    <span className="rec-item-texto">
                      <span className="rec-item-fila">
                        <strong>{row.fullName}</strong>
                        <time>{fechaCorta(row.createdAt)}</time>
                      </span>
                      <span className="rec-item-meta">{resumenLinea(row) || row.city}</span>
                      <span className="rec-item-pie">
                        <StatusBadge status={row.status} />
                        {row.hasVideo && <span className="rec-video">Video adjunto</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {pageCount > 1 && (
              <nav className="rec-pager" aria-label="Páginas de postulaciones">
                <span role="status">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}</span>
                <span>
                  <button type="button" className="players-button-secondary" aria-label="Anterior" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button>
                  <button type="button" className="players-button-secondary" aria-label="Siguiente" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>›</button>
                </span>
              </nav>
            )}
          </div>
          <DetallePostulacion
            key={selected.id}
            application={selected}
            enFicha={roster.rows.some(({ id }) => id === selected.playerId)}
            bloqueado={Boolean(assignment)}
            onSaveStatus={saveStatus}
            onSaveNotes={(application, text) => updateApplicationNotes(db, application, text)}
            onAssign={() => setAssignmentId(selected.id)}
            onVideos={() => setVideoApplicationId(selected.id)}
            onProfile={() => setProfileId(selected.playerId)}
          >
            {assignment && (assignment.playerId ? (
              <div className="players-form-panel">
                <p role="status">Esta postulación ya tiene un jugador vinculado.</p>
                <button type="button" className="players-button-secondary" onClick={() => setAssignmentId('')}>Volver a la bandeja</button>
              </div>
            ) : (
              <AsignarJugador key={assignment.id} application={assignment} roster={roster} service={playerService}
                onAssigned={assigned} onCancel={() => setAssignmentId('')} />
            ))}
          </DetallePostulacion>
        </div>
      )}
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
          <h1 id="recruitment-title">Reclutamiento<PelotaTitulo /></h1>
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
          <Bandeja db={db} orgId={orgId} uid={uid} role={role}>
            <EnlacesPostulacion db={db} orgId={orgId} uid={uid} role={role} />
          </Bandeja>
        </div>
      ) : (
        <p role="status">La bandeja se habilitará cuando tu sesión de equipo esté disponible.</p>
      )}
    </section>
  )
}
