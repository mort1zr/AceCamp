import { useEffect, useMemo, useRef, useState } from 'react'
import { DataTable } from '../components/ui'
import PlayerForm from '../components/players/PlayerForm.jsx'
import PlayerProfile from '../components/players/PlayerProfile.jsx'
import { usePlayers } from '../hooks/usePlayers.js'
import { playerAge } from '../lib/players.js'
import { createFirestorePlayersService } from '../lib/services/firestorePlayersService.js'
import './jugadores.css'

const pageSize = 10

function searchName(value) {
  return (value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es')
}

function academyName(player) {
  return player.academy?.trim() ?? ''
}

const columns = [
  { key: 'fullName', label: 'Jugador', render: name => <div className="players-name"><span className="players-avatar" aria-hidden="true">{(name ?? '?').split(' ').filter(Boolean).slice(0, 2).map(word => word[0]).join('')}</span><span>{name || 'Sin nombre'}</span></div> },
  { key: 'birthDate', label: 'Edad', render: birthDate => { const age = playerAge(birthDate); return age == null ? '—' : `${age} años` } },
  { key: 'academy', label: 'Academia', render: (_, player) => academyName(player) || 'Sin academia' },
]

function PlayersWorkspace({ service }) {
  const { rows, loading, error, retry } = usePlayers(service)
  const [showForm, setShowForm] = useState(false)
  const [notice, setNotice] = useState('')
  const [name, setName] = useState('')
  const [academy, setAcademy] = useState('')
  const [page, setPage] = useState(1)
  const [profileId, setProfileId] = useState('')
  const addButton = useRef(null)
  const formWasOpen = useRef(false)
  const listHeading = useRef(null)
  const profileWasOpen = useRef(false)
  const academyOptions = [...new Set(rows.map(academyName))]
    .sort((a, b) => a.localeCompare(b, 'es'))
  const query = searchName(name.trim())
  const matchingRows = rows.filter(player => searchName(player.fullName).includes(query)
    && (!academy || academy === `academy:${academyName(player)}`))
  const pageCount = Math.max(1, Math.ceil(matchingRows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const offset = (currentPage - 1) * pageSize
  const filtered = Boolean(query || academy)
  const hasPlayers = !loading && !error && rows.length > 0
  const showFilters = hasPlayers || (!loading && !error && filtered)
  const noMatches = hasPlayers && filtered
  const profilePlayer = rows.find(player => player.id === profileId && service.canViewProfile?.(player))
  const listColumns = service.canViewProfile ? [...columns, {
    key: 'profile',
    label: 'Perfil',
    render: (_, player) => service.canViewProfile(player) && (
      <button type="button" className="players-button-secondary" disabled={showForm} aria-label={`Ver perfil de ${player.fullName}`} onClick={() => setProfileId(player.id)}>Ver perfil</button>
    ),
  }] : columns

  useEffect(() => {
    if (!showForm && formWasOpen.current) addButton.current?.focus()
    formWasOpen.current = showForm
  }, [showForm])

  const profileOpen = Boolean(profilePlayer)
  useEffect(() => {
    if (!profileOpen && profileWasOpen.current) listHeading.current?.focus()
    profileWasOpen.current = profileOpen
  }, [profileOpen])

  function closeForm() {
    setShowForm(false)
  }

  if (profilePlayer) return (
    <PlayerProfile key={profilePlayer.id} service={service} player={profilePlayer} onBack={() => setProfileId('')} />
  )

  return (
    <section className="players-page" aria-labelledby="players-title">
      {service.mode === 'demo' && <aside className="players-demo-notice"><strong>Modo demostración</strong><span>Datos de ejemplo. Usa nombres ficticios: las altas solo duran en esta sesión.</span></aside>}
      <header className="players-page-heading"><div><p className="players-eyebrow">Tu equipo, en un solo lugar</p><h1 id="players-title">Jugadores<span className="players-title-dot">.</span></h1><p>Conoce a tus jugadores. Acompaña su evolución.</p></div><button ref={addButton} type="button" className="players-button-primary" onClick={() => { setShowForm(true); setNotice('') }} aria-expanded={showForm} disabled={showForm}><span aria-hidden="true">＋</span> Nuevo jugador</button></header>
      <p className="players-notice" role="status">{notice}</p>
      {showForm && <PlayerForm service={service} onCancel={closeForm} onCreated={player => { setNotice(`${player.fullName} se registró correctamente.`); closeForm() }} />}
      <div className="players-list-heading">
        <h2 ref={listHeading} tabIndex={-1}>Tu plantilla</h2>
        <span role="status">{loading ? 'Cargando…' : error ? 'No disponible' : filtered
          ? `${matchingRows.length} de ${rows.length} jugadores`
          : `${rows.length} ${rows.length === 1 ? 'jugador' : 'jugadores'}`}</span>
      </div>
      {showFilters && (
        <div className="players-filters" role="group" aria-label="Filtros de jugadores">
          <div className="players-field">
            <label htmlFor="players-search">Buscar por nombre</label>
            <input id="players-search" type="search" value={name} placeholder="Nombre o apellido" onChange={event => { setName(event.target.value); setPage(1) }} />
          </div>
          <div className="players-field">
            <label htmlFor="players-academy">Filtrar por academia</label>
            <select id="players-academy" value={academy} onChange={event => { setAcademy(event.target.value); setPage(1) }}>
              <option value="">Todas las academias</option>
              {academy && !academyOptions.some(option => academy === `academy:${option}`) && (
                <option value={academy}>{academy.slice('academy:'.length) || 'Sin academia'}</option>
              )}
              {academyOptions.map(option => <option key={option} value={`academy:${option}`}>{option || 'Sin academia'}</option>)}
            </select>
          </div>
          {filtered && <button type="button" className="players-button-secondary" onClick={() => { setName(''); setAcademy(''); setPage(1) }}>Limpiar filtros</button>}
        </div>
      )}
      {hasPlayers && matchingRows.length > 0 && <p className="players-table-hint">Desliza la tabla para ver todas las columnas.</p>}
      <DataTable
        caption="Jugadores registrados"
        columns={listColumns}
        rows={matchingRows.slice(offset, offset + pageSize)}
        loading={loading}
        error={error}
        onRetry={retry}
        emptyTitle={noMatches ? 'No se encontraron jugadores' : 'Tu equipo empieza aquí'}
        emptyDescription={noMatches ? 'Cambia el nombre o la academia, o limpia los filtros.' : 'Registra a tu primer jugador para vincular sus videos y seguir su evolución.'}
      />
      {hasPlayers && pageCount > 1 && (
        <nav className="players-pagination" aria-label="Páginas de jugadores">
          <button type="button" className="players-button-secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button>
          <span role="status">Página {currentPage} de {pageCount}</span>
          <button type="button" className="players-button-secondary" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Siguiente</button>
        </nav>
      )}
      <p className="players-footnote">Cada jugador es una historia. El siguiente paso es analizar su juego.</p>
    </section>
  )
}

export default function Jugadores({ service, db, session }) {
  // The authentication provider supplies uid and orgId together from the same verified session.
  const uid = session?.uid
  const orgId = session?.orgId
  const role = session?.role ?? 'coach'
  const liveService = useMemo(() => {
    if (!db || !['coach', 'admin'].includes(role) || typeof uid !== 'string' || !uid.trim() || typeof orgId !== 'string' || !orgId.trim()) {
      return null
    }
    return createFirestorePlayersService({ db, actorId: uid, orgId, role })
  }, [db, uid, orgId, role])

  const playersService = service ?? liveService
  if (!playersService) return (
    <section className="players-page" aria-labelledby="players-title">
      <aside className="players-demo-notice"><strong>Los jugadores aún no están disponibles</strong><span>Cuando tu sesión de equipo esté disponible, podrás consultar y registrar jugadores.</span></aside>
      <header className="players-page-heading"><div><p className="players-eyebrow">Tu equipo, en un solo lugar</p><h1 id="players-title">Jugadores<span className="players-title-dot">.</span></h1><p>Conoce a tus jugadores. Acompaña su evolución.</p></div></header>
      <div className="players-list-heading"><h2>Tu plantilla</h2><span>0 jugadores</span></div>
      <DataTable caption="Jugadores registrados" columns={columns} rows={[]} loading={false} error={null} emptyTitle="Tu equipo empieza aquí" emptyDescription="Registra a tu primer jugador para vincular sus videos y seguir su evolución." />
      <p className="players-footnote">Cada jugador es una historia. El siguiente paso es analizar su juego.</p>
    </section>
  )
  return <PlayersWorkspace key={`${playersService.scopeKey}:${role ?? ''}`} service={playersService} />
}
