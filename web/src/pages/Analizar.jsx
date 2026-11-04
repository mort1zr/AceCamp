import { useMemo, useState } from 'react'
import { DataTable, ErrorState, StatusBadge } from '../components/ui'
import AnalysisForm from '../components/analysis/AnalysisForm.jsx'
import PlayerForm from '../components/players/PlayerForm.jsx'
import { usePlayers } from '../hooks/usePlayers.js'
import { useAnalysisQueue } from '../hooks/useAnalysisQueue.js'
import { createFirestoreAnalysisService } from '../lib/services/firestoreAnalysisService.js'
import { createFirestorePlayersService } from '../lib/services/firestorePlayersService.js'
import './jugadores.css'
import './analizar.css'

function AnalysisWorkspace({ service, playersService }) {
  const players = usePlayers(playersService)
  const queue = useAnalysisQueue(service)
  const [playerId, setPlayerId] = useState('')
  const [showNewPlayer, setShowNewPlayer] = useState(false)
  const columns = [
    { key: 'playerId', label: 'Jugador', render: id => players.rows.find(player => player.id === id)?.fullName ?? 'Jugador no disponible' },
    { key: 'opponent', label: 'Rival' },
    { key: 'matchDate', label: 'Fecha' },
    { key: 'status', label: 'Estado', render: status => <StatusBadge status={status} /> },
  ]
  return (
    <section className="players-page analysis-page" aria-labelledby="analysis-title">
      {service.mode === 'demo' && <aside className="players-demo-notice"><strong>Modo demostración</strong><span>Datos ficticios. No se suben, descargan ni procesan videos. La cola se reinicia al recargar.</span></aside>}
      <header className="players-page-heading"><div><p className="players-eyebrow">Del partido a los datos</p><h1 id="analysis-title">Analizar video<span className="players-title-dot">.</span></h1><p>Cada jugada cuenta. Descubre lo que hay detrás.</p></div></header>
      {showNewPlayer && <PlayerForm service={playersService} onCancel={() => setShowNewPlayer(false)} onCreated={player => { setPlayerId(player.id); setShowNewPlayer(false) }} />}
      <div className="analysis-layout"><AnalysisForm service={service} players={players.rows} playersLoading={players.loading} playersError={players.error} playerId={playerId} onPlayerChange={setPlayerId} onNewPlayer={() => setShowNewPlayer(true)} playerCreationOpen={showNewPlayer} />
        <aside className="analysis-guide"><p className="players-eyebrow">Una buena toma, mejores datos</p><h2>Antes de empezar</h2><ul><li>Elige una toma donde se vea la cancha completa.</li><li>Identifica al jugador al inicio del video.</li><li>Vincula el partido a su perfil para seguir su evolución.</li></ul><p>Los indicadores aparecerán cuando el procesamiento termine.</p></aside>
      </div>
      <section aria-labelledby="analysis-queue-title"><div className="players-list-heading"><h2 id="analysis-queue-title">Cola de análisis</h2><span>{queue.loading ? 'Cargando…' : `${queue.rows.length} ${queue.rows.length === 1 ? 'partido' : 'partidos'}`}</span></div><p className="analysis-muted">En cola → Procesando → Listo. Si ocurre un problema, el partido mostrará Error.</p>
        {!queue.loading && !queue.error && queue.rows.length > 0 && <p className="players-table-hint">Desliza la tabla para ver todas las columnas.</p>}
        <DataTable caption="Partidos y estado del análisis" columns={columns} rows={queue.rows} loading={queue.loading} error={queue.error} onRetry={queue.retry} emptyTitle="El próximo análisis empieza aquí" emptyDescription="Carga un video y vincúlalo a un jugador. Su estado aparecerá en esta lista." />
      </section>
    </section>
  )
}

export default function Analizar({ service, playersService, db, session, uploadVideo, importVideo, maxBytes }) {
  const uid = session?.uid
  const orgId = session?.orgId
  const hasInjectedServices = service != null || playersService != null
  const liveServices = useMemo(() => {
    if (hasInjectedServices || !db || typeof uid !== 'string' || !uid.trim() ||
      typeof orgId !== 'string' || !orgId.trim() || typeof uploadVideo !== 'function' ||
      !Number.isFinite(maxBytes) || maxBytes <= 0) return null

    const identity = { db, orgId, actorId: uid }
    return {
      analysis: createFirestoreAnalysisService({ ...identity, uploadVideo, importVideo, maxBytes }),
      players: createFirestorePlayersService(identity),
    }
  }, [hasInjectedServices, db, uid, orgId, uploadVideo, importVideo, maxBytes])

  const analysis = service ?? liveServices?.analysis
  const players = playersService ?? liveServices?.players
  if (!analysis || !players || analysis.scopeKey !== players.scopeKey) return <section className="players-page"><h1>Analizar video</h1><ErrorState title="El análisis aún no está disponible" description="Cuando tu sesión de equipo esté disponible, podrás cargar videos y consultar su estado." /></section>
  return <AnalysisWorkspace key={analysis.scopeKey} service={analysis} playersService={players} />
}
