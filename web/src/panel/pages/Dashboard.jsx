import { useCallback, useMemo, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/ui'
import DashboardMetrics from '../components/dashboard/DashboardMetrics.jsx'
import DashboardLatestMatch from '../components/dashboard/DashboardLatestMatch.jsx'
import EvolutionPanel from '../components/dashboard/EvolutionPanel.jsx'
import DashboardDetails from '../components/dashboard/DashboardDetails.jsx'
import BloqueVacio from '../components/layout/BloqueVacio.jsx'
import PdfJugador from '../components/pdf/PdfJugador.jsx'
import { BotonPdf } from '../components/pdf/ReportePdf.jsx'
import { useNombreOrganizacion } from '../hooks/useNombreOrganizacion.js'
import { usePlayers } from '../hooks/usePlayers.js'
import { useDashboardOverview } from '../hooks/useDashboardOverview.js'
import { playerAge } from '../lib/players.js'
import { dashboardPeriods } from '../lib/dashboardPeriods.js'
import { completeDashboardMetricDefinitions } from '../lib/dashboardOverview.js'
import { createFirestorePlayersService } from '../lib/services/firestorePlayersService.js'
import { createFirestoreDashboardService } from '../lib/services/firestoreDashboardService.js'
import './jugadores.css'
import './dashboard.css'

const tarjeta = 'rounded-card border border-line bg-surface p-5'
const subtitulo = 'font-display text-[22px] leading-tight font-bold tracking-[0.01em]'
const etiqueta = 'text-[11px] font-semibold tracking-[0.08em] text-muted uppercase'

const iconos = {
  partido: (
    <>
      <rect x="3" y="5" width="13" height="14" rx="2" />
      <path d="M16 10l5-3v10l-5-3" />
    </>
  ),
  radar: (
    <>
      <path d="M12 3l8 4.6v8.8L12 21l-8-4.6V7.6z" />
      <path d="M12 8l4 2.4v4.2L12 17l-4-2.4v-4.2z" />
    </>
  ),
  saque: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6.2 5.8c3.2 1.8 4.5 4.6 4 7.8M17.8 18.2c-3.2-1.8-4.5-4.6-4-7.8" />
    </>
  ),
  golpes: (
    <>
      <circle cx="14.5" cy="9" r="5.5" />
      <path d="M10.6 13.1L4 20" />
    </>
  ),
  peloteos: (
    <>
      <path d="M4 20V13M10 20V6M16 20v-9M22 20H2" />
    </>
  ),
  fisico: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M4 12h16M8 3v18M16 3v18" />
    </>
  ),
  evolucion: (
    <>
      <path d="M3 17l5-5 4 3 8-8" />
      <path d="M15 7h5v5" />
    </>
  ),
}

const secciones = [
  {
    clave: 'partido',
    titulo: 'Último partido',
    vacio: 'Aún no hay partidos analizados',
    texto: 'El último partido aparecerá aquí con su marcador y sus números clave.',
  },
  {
    clave: 'radar',
    titulo: 'Radar del jugador',
    nota: 'Perfil normalizado',
    vacio: 'Sin datos',
    texto: 'El modelo aún no entrega puntuaciones comparables de 0–100. No se convierten velocidades o distancias en calificaciones inventadas.',
  },
  {
    clave: 'saque',
    titulo: 'Saque',
    nota: 'Resultado de cada punto al saque',
    vacio: 'Sin saques medidos',
    texto: 'Primeros y segundos saques adentro, dobles faltas y sus velocidades.',
  },
  {
    clave: 'golpes',
    titulo: 'Derecha vs. revés',
    vacio: 'Sin datos',
    texto: 'El modelo todavía no clasifica los golpes como derecha o revés. Los golpes medidos no se asignan a un lado sin evidencia.',
  },
  {
    clave: 'peloteos',
    titulo: 'Peloteos',
    nota: 'Distribución por largo',
    vacio: 'Sin peloteos registrados',
    texto: 'Cuántos golpes duran sus puntos y cuál fue el más largo.',
  },
  {
    clave: 'fisico',
    titulo: 'Físico y movimiento',
    nota: 'Dónde pasa más tiempo en su lado de la cancha',
    vacio: 'Sin mapa de movimiento',
    texto: 'Distancia recorrida, velocidad y las zonas donde más se mueve.',
  },
]

const indicadores = completeDashboardMetricDefinitions.map(metric => metric.label)

function iniciales(nombre) {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
}

function SeccionVacia({ seccion }) {
  return (
    <div className={`${tarjeta} flex flex-col gap-4`}>
      <div>
        <h2 className={subtitulo}>{seccion.titulo}</h2>
        {seccion.nota && <p className="mt-1 text-[13px] text-muted">{seccion.nota}</p>}
      </div>
      <BloqueVacio
        icono={iconos[seccion.clave]}
        titulo={seccion.vacio}
        texto={seccion.texto}
        className="flex-1"
      />
    </div>
  )
}

function SeccionesDashboard({ conEvolucion = false, latestMatch, filtered = false, details, serveEvolution, playerId, sample }) {
  const [partido, radar] = secciones
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))] gap-4">
        {latestMatch ? <DashboardLatestMatch match={latestMatch} /> : (
          <SeccionVacia seccion={filtered
            ? { ...partido, vacio: 'No hay partidos analizados en este periodo', texto: 'Elige otro periodo para consultar sus partidos.' }
            : partido} />
        )}
        <SeccionVacia seccion={radar} />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))] gap-4">
        {conEvolucion && (
          <SeccionVacia
            seccion={{
              clave: 'evolucion',
              titulo: 'Evolución del jugador',
              nota: 'Velocidad media de golpe por partido',
              vacio: 'Elige un jugador',
              texto: 'Verás cómo cambia su rendimiento partido a partido.',
            }}
          />
        )}
      </div>
      <DashboardDetails details={details} serveEvolution={serveEvolution} playerId={playerId} sample={sample} />
      <SeccionVacia seccion={secciones.find(section => section.clave === 'golpes')} />
    </>
  )
}

function IndicadoresVacios() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3.5">
      {indicadores.map((nombre) => (
        <div key={nombre} className={`${tarjeta} flex flex-col gap-2 p-4`}>
          <p className={etiqueta}>{nombre}</p>
          <p className="font-display text-4xl leading-none font-bold text-line3">—</p>
          <p className="text-[13px] text-muted">Sin datos</p>
        </div>
      ))}
    </div>
  )
}

function PerfilVacio({ children }) {
  return (
    <div className={`${tarjeta} flex flex-wrap items-center gap-5`}>
      <span
        aria-hidden="true"
        className="grid size-21 shrink-0 place-items-center rounded-full border-2 border-dashed border-line3 text-line3"
      >
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </svg>
      </span>
      <div className="dashboard-perfil-vacio min-w-0 flex-1">{children}</div>
    </div>
  )
}

function Perfil({ player, sample }) {
  const name =
    typeof player.fullName === 'string' && player.fullName.trim() ? player.fullName : 'Sin nombre'
  const age = playerAge(player.birthDate)
  return (
    <div className={`${tarjeta} dashboard-profile flex flex-wrap items-center gap-5`}>
      <span
        aria-hidden="true"
        className="grid size-21 shrink-0 place-items-center rounded-full bg-series1 font-display text-[28px] font-bold text-on-accent uppercase"
      >
        {iniciales(name)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className={etiqueta}>Jugador seleccionado</p>
        <h2 className="font-display text-[40px] leading-none font-bold [overflow-wrap:anywhere]">
          {name}
        </h2>
        <div className="flex flex-wrap gap-2">
          <span className="dashboard-chip">
            {age == null ? 'Edad sin registrar' : `${age} años`}
          </span>
          <span className="dashboard-chip">{player.academy || 'Sin academia registrada'}</span>
          <span className="dashboard-chip">
            {sample ? 'Perfil de ejemplo' : 'Perfil del equipo'}
          </span>
        </div>
      </div>
    </div>
  )
}

function DashboardSelect({ id, label, children, value, disabled, onChange }) {
  return (
    <div className="players-field dashboard-player-select">
      <label htmlFor={id}>{label}</label>
      <div className="dashboard-select-wrap">
        <select id={id} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
          {children}
        </select>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  )
}

function Cabecera({ players, selected, onSelect, period, onPeriodChange, canFilter, onExportar }) {
  return (
    <header className="dashboard-head">
      <div>
        <p className="players-eyebrow">Una mirada a su rendimiento</p>
        <h1 id="dashboard-title">
          Dashboard<span className="players-title-dot">.</span>
        </h1>
      </div>
      <div className="dashboard-controls">
        <DashboardSelect
          id="dashboard-player"
          label="Jugador"
          value={selected?.id ?? ''}
          disabled={players.loading || Boolean(players.error) || players.rows.length === 0}
          onChange={onSelect}
        >
            <option value="">
              {players.loading ? 'Cargando jugadores…' : 'Selecciona un jugador'}
            </option>
            {players.rows.map((player) => (
              <option key={player.id} value={player.id}>
                {player.fullName}
              </option>
            ))}
        </DashboardSelect>
        <DashboardSelect id="dashboard-period" label="Periodo" value={period} disabled={!canFilter} onChange={onPeriodChange}>
          {dashboardPeriods.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </DashboardSelect>
        <BotonPdf onClick={onExportar} disabled={!onExportar} />
      </div>
    </header>
  )
}

function DashboardWorkspace({ playersService, overviewService, renderEvolution, organizacion }) {
  const players = usePlayers(playersService)
  const [selectedId, setSelectedId] = useState('')
  const [period, setPeriod] = useState('all')
  const [exportando, setExportando] = useState(false)
  const terminarPdf = useCallback(() => setExportando(false), [])
  const selected =
    !players.loading && !players.error
      ? players.rows.find((player) => player.id === selectedId)
      : null
  const overview = useDashboardOverview(overviewService, selected?.id ?? '')
  const ready = overview.status === 'ready'
  const report = ready ? (period === 'all' ? overview.data : overview.data?.periods?.[period]) : null
  const sample = playersService.mode === 'demo'
  const sinIndicadores =
    overview.status === 'unavailable' ||
    !report?.metrics ||
    report.coverage?.compatibleMatches === 0 ||
    Object.values(report.metrics).every((value) => value == null)

  return (
    <section className="players-page dashboard-page" aria-labelledby="dashboard-title">
      {sample && (
        <aside className="players-demo-notice">
          <strong>Modo demostración</strong>
          <span>
            Jugadores y valores ficticios para revisar la interfaz. No representan resultados de
            análisis reales.
          </span>
        </aside>
      )}
      <Cabecera
        players={players}
        selected={selected}
        onSelect={setSelectedId}
        period={period}
        onPeriodChange={setPeriod}
        canFilter={Boolean(overview.data?.periods)}
        onExportar={selected && ready ? () => setExportando(true) : undefined}
      />
      {exportando && selected && ready && (
        <PdfJugador
          player={selected}
          report={report}
          periodo={dashboardPeriods.find(({ value }) => value === period)}
          organizacion={organizacion}
          sample={sample}
          onTerminar={terminarPdf}
        />
      )}

      {players.loading ? (
        <div className={tarjeta} aria-busy="true">
          <LoadingState title="Cargando jugadores…" />
        </div>
      ) : players.error ? (
        <div className={tarjeta}>
          <ErrorState
            title="No pudimos cargar los jugadores"
            description={players.error}
            onRetry={players.retry}
          />
        </div>
      ) : !selected ? (
        <>
          <PerfilVacio>
            {players.rows.length === 0 ? (
              <EmptyState
                title="Tu equipo empieza con un jugador"
                description="Registra un jugador para poder consultar su rendimiento."
              />
            ) : (
              <EmptyState
                title="Cada jugador tiene su propia historia"
                description="Elige un jugador en el selector para ver su resumen de rendimiento."
              />
            )}
          </PerfilVacio>
          <IndicadoresVacios />
          <SeccionesDashboard conEvolucion />
        </>
      ) : (
        <>
          <Perfil player={selected} sample={sample} />
          {overview.status === 'loading' ? (
            <div className={tarjeta} aria-busy="true">
              <LoadingState
                title="Cargando resumen…"
                description="Estamos reuniendo los indicadores del jugador seleccionado."
              />
            </div>
          ) : overview.status === 'error' ? (
            <div className={tarjeta}>
              <ErrorState
                title="No pudimos cargar el resumen"
                description={overview.error}
                onRetry={overview.retry}
              />
            </div>
          ) : (
            <>
              <section aria-labelledby="dashboard-metrics-title" className="flex flex-col gap-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id="dashboard-metrics-title" className={subtitulo}>
                    Resumen de rendimiento
                  </h2>
                  <span className="text-[13px] text-muted">
                    {sample ? 'Ejemplos de interfaz' : 'Indicadores disponibles'}
                  </span>
                </div>
                {overview.data?.periods && period === 'all' && (
                  <p className="text-[13px] text-muted">Elige un periodo para ver la comparación con el anterior.</p>
                )}
                <DashboardMetrics
                  metrics={report?.metrics}
                  previousMetrics={report?.previousMetrics}
                  compare={Boolean(report) && period !== 'all'}
                  sample={sample}
                />
              </section>
              {report?.coverage?.incompatibleMatches > 0 && (
                <p className="dashboard-data-notice" role="status">
                  Algunos análisis terminados aún no tienen indicadores disponibles. El resumen
                  incluye únicamente los resultados verificables.
                </p>
              )}
              {sinIndicadores && (
                <div className={tarjeta}>
                  <EmptyState
                    title={
                      overview.status === 'unavailable'
                        ? 'Los indicadores aún no están disponibles'
                        : period === 'all'
                          ? 'Todavía no hay estadísticas para este jugador'
                          : 'No hay estadísticas en este periodo'
                    }
                    description="Las métricas disponibles aparecerán aquí cuando se reciban los resultados de sus análisis."
                  />
                </div>
              )}
              <EvolutionPanel
                playerId={selected.id}
                evolution={report?.evolution}
                sample={sample}
                renderEvolution={ready ? renderEvolution : undefined}
              />
              <SeccionesDashboard
                latestMatch={report?.latestMatch?.playerId === selected.id ? report.latestMatch : null}
                filtered={period !== 'all'}
                details={report?.details}
                serveEvolution={report?.serveEvolution}
                playerId={selected.id}
                sample={sample}
              />
            </>
          )}
        </>
      )}
      <p className="dashboard-footnote">
        Los datos ausentes se muestran como «Sin datos». Un cero solo se muestra cuando está
        presente en el resumen.
      </p>
    </section>
  )
}

function DashboardSinConexion() {
  return (
    <section className="players-page dashboard-page" aria-labelledby="dashboard-title">
      <Cabecera
        players={{ loading: false, rows: [] }}
        selected={null}
        onSelect={() => {}}
        disabled
      />
      <PerfilVacio>
        <p className="font-semibold">El Dashboard aún no está disponible</p>
        <p className="mt-1 text-[13px] text-muted">
          Cuando tu sesión de equipo esté disponible, podrás consultar el resumen de tus jugadores.
        </p>
      </PerfilVacio>
      <IndicadoresVacios />
      <SeccionesDashboard conEvolucion />
    </section>
  )
}

export default function Dashboard({
  playersService,
  overviewService,
  renderEvolution,
  db,
  session,
}) {
  const uid = session?.uid
  const orgId = session?.orgId
  const role = session?.role ?? 'coach'
  const organizacion = useNombreOrganizacion(db, orgId)
  const hasInjectedServices = playersService != null || overviewService != null
  const liveServices = useMemo(() => {
    if (
      hasInjectedServices ||
      !db || !['coach', 'admin'].includes(role) ||
      typeof uid !== 'string' ||
      !uid.trim() ||
      typeof orgId !== 'string' ||
      !orgId.trim()
    )
      return null
    const identity = { db, orgId, actorId: uid, role }
    return {
      players: createFirestorePlayersService(identity),
      overview: createFirestoreDashboardService(identity),
    }
  }, [hasInjectedServices, db, uid, orgId, role])
  const players = playersService ?? liveServices?.players
  const overview = overviewService ?? liveServices?.overview
  const mixedScopes =
    overview && (overview.scopeKey !== players?.scopeKey || overview.mode !== players?.mode)
  if (!players || mixedScopes) return <DashboardSinConexion />
  return (
    <DashboardWorkspace
      key={players.scopeKey}
      playersService={players}
      overviewService={overview}
      renderEvolution={renderEvolution}
      organizacion={organizacion}
    />
  )
}
