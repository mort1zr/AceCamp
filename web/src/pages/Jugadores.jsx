import { useEffect, useMemo, useRef, useState } from 'react'
import { DataTable, ErrorState } from '../components/ui'
import PlayerForm from '../components/players/PlayerForm.jsx'
import { usePlayers } from '../hooks/usePlayers.js'
import { playerAge } from '../lib/players.js'
import { createFirestorePlayersService } from '../lib/services/firestorePlayersService.js'
import './jugadores.css'

const columns = [
  { key: 'fullName', label: 'Jugador', render: name => <div className="players-name"><span className="players-avatar" aria-hidden="true">{(name ?? '?').split(' ').filter(Boolean).slice(0, 2).map(word => word[0]).join('')}</span><span>{name || 'Sin nombre'}</span></div> },
  { key: 'birthDate', label: 'Edad', render: birthDate => { const age = playerAge(birthDate); return age == null ? '—' : `${age} años` } },
  { key: 'academy', label: 'Academia', render: academy => academy || 'Sin academia' },
]

function PlayersWorkspace({ service }) {
  const { rows, loading, error, retry } = usePlayers(service)
  const [showForm, setShowForm] = useState(false)
  const [notice, setNotice] = useState('')
  const addButton = useRef(null)
  const formWasOpen = useRef(false)

  useEffect(() => {
    if (!showForm && formWasOpen.current) addButton.current?.focus()
    formWasOpen.current = showForm
  }, [showForm])

  function closeForm() {
    setShowForm(false)
  }

  return (
    <section className="players-page" aria-labelledby="players-title">
      {service.mode === 'demo' && <aside className="players-demo-notice"><strong>Modo demostración</strong><span>Datos de ejemplo. Usa nombres ficticios: las altas solo duran en esta sesión.</span></aside>}
      <header className="players-page-heading"><div><p className="players-eyebrow">Tu equipo, en un solo lugar</p><h1 id="players-title">Jugadores<span className="players-title-dot">.</span></h1><p>Conoce a tus jugadores. Acompaña su evolución.</p></div><button ref={addButton} type="button" className="players-button-primary" onClick={() => { setShowForm(true); setNotice('') }} aria-expanded={showForm} disabled={showForm}><span aria-hidden="true">＋</span> Nuevo jugador</button></header>
      <p className="players-notice" role="status">{notice}</p>
      {showForm && <PlayerForm service={service} onCancel={closeForm} onCreated={player => { setNotice(`${player.fullName} se registró correctamente.`); closeForm() }} />}
      <div className="players-list-heading"><h2>Tu plantilla</h2><span>{loading ? 'Cargando…' : error ? 'No disponible' : `${rows.length} ${rows.length === 1 ? 'jugador' : 'jugadores'}`}</span></div>
      {!loading && !error && rows.length > 0 && <p className="players-table-hint">Desliza la tabla para ver todas las columnas.</p>}
      <DataTable caption="Jugadores registrados" columns={columns} rows={rows} loading={loading} error={error} onRetry={retry} emptyTitle="Tu equipo empieza aquí" emptyDescription="Registra a tu primer jugador para vincular sus videos y seguir su evolución." />
      <p className="players-footnote">Cada jugador es una historia. El siguiente paso es analizar su juego.</p>
    </section>
  )
}

export default function Jugadores({ service, db, session }) {
  // The authentication provider supplies uid and orgId together from the same verified session.
  const uid = session?.uid
  const orgId = session?.orgId
  const liveService = useMemo(() => {
    if (!db || typeof uid !== 'string' || !uid.trim() || typeof orgId !== 'string' || !orgId.trim()) {
      return null
    }
    return createFirestorePlayersService({ db, actorId: uid, orgId })
  }, [db, uid, orgId])

  const playersService = service ?? liveService
  if (!playersService) return <section className="players-page"><h1>Jugadores</h1><ErrorState title="Los jugadores aún no están disponibles" description="Cuando tu sesión de equipo esté disponible, podrás consultar y registrar jugadores." /></section>
  return <PlayersWorkspace key={playersService.scopeKey} service={playersService} />
}
