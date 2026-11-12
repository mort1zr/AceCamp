import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link } from 'react-router'
import { EmptyState, ErrorState } from '../components/ui'
import DashboardMetrics from '../components/dashboard/DashboardMetrics.jsx'
import DashboardLatestMatch from '../components/dashboard/DashboardLatestMatch.jsx'
import EvolutionPanel from '../components/dashboard/EvolutionPanel.jsx'
import DashboardEvolution from '../components/dashboard/DashboardEvolution.jsx'
import MovimientoCard from '../components/dashboard/MovimientoCard.jsx'
import PeloteosCard from '../components/dashboard/PeloteosCard.jsx'
import SaqueCard from '../components/dashboard/SaqueCard.jsx'
import BloqueVacio from '../components/layout/BloqueVacio.jsx'
import PdfJugador from '../components/pdf/PdfJugador.jsx'
import { BotonPdf } from '../components/pdf/ReportePdf.jsx'
import PanelJugador from '../components/dashboard/PanelJugador.jsx'
import TarjetaJugador from '../components/dashboard/TarjetaJugador.jsx'
import { posicionRanking, valoracionJugador } from '../lib/valoracion.js'
import { useArrastre } from '../hooks/useArrastre.js'
import { useMetricasEquipo } from '../hooks/useMetricasEquipo.js'
import { useNombreOrganizacion } from '../hooks/useNombreOrganizacion.js'
import { usePlayers } from '../hooks/usePlayers.js'
import { useDashboardOverview } from '../hooks/useDashboardOverview.js'
import { dashboardPeriods } from '../lib/dashboardPeriods.js'
import { completeDashboardMetricDefinitions } from '../lib/dashboardOverview.js'
import { createFirestorePlayersService } from '../lib/services/firestorePlayersService.js'
import { createFirestoreDashboardService } from '../lib/services/firestoreDashboardService.js'
import { createFirestoreRankingService } from '../lib/services/firestoreRankingService.js'
import './jugadores.css'
import './dashboard.css'
import { EsqueletoJugadores, EsqueletoResumen } from '../components/dashboard/EsqueletoDashboard.jsx'
import PelotaTitulo from '../components/layout/PelotaTitulo.jsx'

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
    clave: 'saque',
    titulo: 'Saque',
    nota: 'Resultado de cada punto al saque',
    vacio: 'Sin saques medidos',
    texto: 'Primeros y segundos saques adentro, dobles faltas y sus velocidades.',
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

function SeccionesDashboard({ conEvolucion = false, latestMatch, filtered = false, details, serveEvolution, evolution, renderEvolution, playerId, sample }) {
  const [partido] = secciones
  const rejilla = 'grid grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))] gap-4'
  return (
    <>
      <div className={rejilla}>
        {latestMatch ? <DashboardLatestMatch match={latestMatch} /> : (
          <SeccionVacia seccion={filtered
            ? { ...partido, vacio: 'No hay partidos analizados en este periodo', texto: 'Elige otro periodo para consultar sus partidos.' }
            : partido} />
        )}
        {!conEvolucion && <SaqueCard serve={details?.serve} playerId={playerId} />}
      </div>
      <div className={rejilla}>
        {conEvolucion ? (
          <SeccionVacia
            seccion={{
              clave: 'evolucion',
              titulo: 'Evolución del jugador',
              nota: 'Velocidad media de golpe por partido',
              vacio: 'Elige un jugador',
              texto: 'Verás cómo cambia su rendimiento partido a partido.',
            }}
          />
        ) : (
          <>
            <EvolutionPanel playerId={playerId} evolution={evolution} sample={sample} renderEvolution={renderEvolution} />
            <section className="dashboard-panel dashboard-evolution" aria-labelledby="serve-evolution-title">
              <div className="dashboard-panel-heading"><div><p className="players-eyebrow">Hasta el bote, por partido</p><h2 id="serve-evolution-title">Evolución del saque</h2></div><span className="dashboard-unit">Partidos analizados</span></div>
              <DashboardEvolution playerId={playerId} evolution={serveEvolution} metric="averageServeSpeed" sample={sample} />
            </section>
          </>
        )}
      </div>
      {!conEvolucion && (
        <div className={rejilla}>
          <PeloteosCard rallies={details?.rallies} playerId={playerId} />
          <MovimientoCard movement={details?.movement} />
        </div>
      )}
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

function ElegirJugador({ players, metricas, onSelect }) {
  const carrusel = useArrastre()
  return (
    <section
      aria-labelledby="dashboard-elegir"
      className={`${tarjeta} dashboard-hud flex flex-col gap-5`}
    >
      <div className="flex flex-col gap-2">
        <p className="panel-jugador-aviso">
          <span aria-hidden="true" className="panel-jugador-punto" />
          Selección de jugador
        </p>
        <h2 id="dashboard-elegir" className="panel-jugador-titulo">
          Elige un jugador
        </h2>
        <p className="text-[15px] text-muted">
          Selecciona a quién quieres analizar para ver su rendimiento, su evolución y sus últimos
          partidos.
        </p>
      </div>
      <ul
        ref={carrusel}
        aria-label="Jugadores"
        tabIndex={0}
        className="-mx-5 flex cursor-grab snap-x snap-mandatory items-center data-arrastrando:cursor-grabbing data-arrastrando:snap-none data-arrastrando:select-none scroll-px-5 gap-4 overflow-x-auto px-5 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {players.map((player, indice) => {
          const name =
            typeof player.fullName === 'string' && player.fullName.trim()
              ? player.fullName
              : 'Sin nombre'
          return (
            <li key={player.id} className="shrink-0 snap-start">
              <button
                type="button"
                aria-label={name}
                onClick={(evento) => onSelect(player.id, evento.currentTarget)}
                className="block cursor-pointer rounded-[14px] transition-transform duration-300 hover:-translate-y-1"
              >
                <TarjetaJugador
                  player={player}
                  metrics={metricas?.[player.id]}
                  indice={indice}
                  escala={0.62}
                />
              </button>
            </li>
          )
        })}
        <li className="shrink-0 snap-start">
          <Link
            to="/jugadores"
            draggable={false}
            style={{ width: 230 * 0.62, height: 330 * 0.62 }}
            className="flex flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-line3 text-muted transition-colors hover:border-accent-line hover:text-text"
          >
            <span
              aria-hidden="true"
              className="grid size-12 place-items-center rounded-full border border-dashed border-line3"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="text-center">
              <span className="block font-semibold">Agregar jugador</span>
              <span className="block text-[13px]">Ir a Jugadores</span>
            </span>
          </Link>
        </li>
      </ul>
    </section>
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

function Perfil({ player, metrics, indice, ranking, total }) {
  return (
    <div className={`${tarjeta} dashboard-profile flex flex-wrap items-center gap-6 max-sm:justify-center sm:gap-8`}>
      <TarjetaJugador player={player} metrics={metrics} indice={indice} ranking={ranking} />
      <div className="dashboard-perfil-info flex min-w-60 flex-1">
        <PanelJugador
          player={player}
          metrics={metrics}
          ranking={ranking}
          total={total}
        />
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

function useCabeceraFija(activa) {
  const cabecera = useRef(null)
  const centinela = useRef(null)
  const completo = useRef(0)
  const [pegada, setPegada] = useState(false)

  useEffect(() => {
    if (!activa) return undefined
    let cuadro = 0
    const revisar = () => {
      cuadro = 0
      const marca = centinela.current
      const elemento = cabecera.current
      if (!marca || !elemento) return
      const alto = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--barra-alto')) || 0
      const fija = marca.getBoundingClientRect().top < alto
      if (!fija) completo.current = elemento.offsetHeight
      setPegada(fija)
    }
    const programar = () => {
      if (!cuadro) cuadro = requestAnimationFrame(revisar)
    }
    revisar()
    window.addEventListener('scroll', programar, { passive: true })
    window.addEventListener('resize', programar)
    return () => {
      cancelAnimationFrame(cuadro)
      window.removeEventListener('scroll', programar)
      window.removeEventListener('resize', programar)
    }
  }, [activa])

  useLayoutEffect(() => {
    const elemento = cabecera.current
    if (!elemento) return
    if (!pegada || !activa) {
      elemento.style.marginBottom = ''
      return
    }
    const copia = elemento.cloneNode(true)
    copia.removeAttribute('id')
    copia.querySelectorAll('[id]').forEach((nodo) => nodo.removeAttribute('id'))
    copia.classList.add('dashboard-head-medir')
    copia.setAttribute('aria-hidden', 'true')
    copia.dataset.pegada = ''
    Object.assign(copia.style, {
      position: 'absolute',
      visibility: 'hidden',
      pointerEvents: 'none',
      width: `${elemento.offsetWidth}px`,
      marginBottom: '0px',
    })
    elemento.parentElement.appendChild(copia)
    const compacto = copia.offsetHeight
    copia.remove()
    elemento.style.marginBottom = `${Math.max(0, completo.current - compacto)}px`
  }, [pegada, activa])

  return { cabecera, centinela, pegada: pegada && activa }
}

function Cabecera({ players, selected, onSelect, period, onPeriodChange, canFilter, onExportar }) {
  const { cabecera, centinela, pegada } = useCabeceraFija(Boolean(selected))
  return (
    <>
    <div ref={centinela} aria-hidden="true" className="dashboard-centinela" />
    <header
      ref={cabecera}
      className={`dashboard-head ${selected ? 'dashboard-head-fija' : ''}`}
      data-pegada={pegada || undefined}
    >
      <div>
        <p className="players-eyebrow">Una mirada a su rendimiento</p>
        <h1 id="dashboard-title">
          Dashboard<PelotaTitulo />
        </h1>
        <p className="players-subtitle">Rendimiento, evolución y partidos de cada jugador.</p>
      </div>
      {selected && (
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
        <BotonPdf
          onClick={onExportar}
          disabled={!onExportar}
          className="players-button-primary"
        >
          <span className="dashboard-pdf-texto">Exportar PDF</span>
        </BotonPdf>
      </div>
      )}
    </header>
    </>
  )
}

function DashboardWorkspace({
  playersService,
  overviewService,
  rankingService,
  renderEvolution,
  organizacion,
}) {
  const players = usePlayers(playersService)
  const [selectedId, setSelectedId] = useState(
    () => new URLSearchParams(window.location.search).get('jugador') ?? '',
  )
  const [period, setPeriod] = useState('all')
  const [exportando, setExportando] = useState(false)
  const terminarPdf = useCallback(() => setExportando(false), [])
  const selected =
    !players.loading && !players.error
      ? players.rows.find((player) => player.id === selectedId)
      : null
  const overview = useDashboardOverview(overviewService, selected?.id ?? '')
  const metricasEquipo = useMetricasEquipo(rankingService, true)
  const elegirJugador = (id, origen) => {
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const escena = origen?.querySelector('.tarjeta-jugador-escena')
    if (!escena || reducido || typeof document.startViewTransition !== 'function') {
      setSelectedId(id)
      return
    }
    escena.style.viewTransitionName = 'tarjeta-jugador'
    document.startViewTransition(() => flushSync(() => setSelectedId(id)))
  }
  const ready = overview.status === 'ready'
  const [ultimo, setUltimo] = useState(null)
  if (ready && selected && (ultimo?.player.id !== selected.id || ultimo.data !== overview.data)) {
    setUltimo({ player: selected, data: overview.data })
  }
  const enTransicion =
    overview.status === 'loading' &&
    Boolean(selected && ultimo) &&
    ultimo.player.id !== selected.id &&
    players.rows.some((player) => player.id === ultimo.player.id)
  const visible = enTransicion ? ultimo.player : selected
  const datos = enTransicion ? ultimo.data : overview.data
  const estado = enTransicion ? 'ready' : overview.status
  const report =
    ready || enTransicion ? (period === 'all' ? datos : datos?.periods?.[period]) : null
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
          onTerminar={terminarPdf}
        />
      )}

      {players.loading ? (
        <EsqueletoJugadores />
      ) : players.error ? (
        <div className={tarjeta}>
          <ErrorState
            title="No pudimos cargar los jugadores"
            description={players.error}
            onRetry={players.retry}
          />
        </div>
      ) : !selected ? (
        players.rows.length === 0 ? (
          <PerfilVacio>
            <EmptyState
              title="Tu equipo empieza con un jugador"
              description="Registra un jugador para poder consultar su rendimiento."
            />
          </PerfilVacio>
        ) : (
          <ElegirJugador
            players={players.rows}
            metricas={metricasEquipo}
            onSelect={elegirJugador}
          />
        )
      ) : (
        <div className="dashboard-desplegar" aria-busy={enTransicion || undefined}>
          <Perfil
            player={visible}
            metrics={datos?.metrics}
            indice={players.rows.findIndex((player) => player.id === visible.id)}
            ranking={
              metricasEquipo ? posicionRanking(players.rows, metricasEquipo, visible.id) : null
            }
            total={
              metricasEquipo
                ? players.rows.filter(
                    (fila) => valoracionJugador(fila, metricasEquipo[fila.id]).media != null,
                  ).length
                : 0
            }
          />
          {estado === 'loading' ? (
            <EsqueletoResumen />
          ) : estado === 'error' ? (
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
                {datos?.periods && period === 'all' && (
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
              <SeccionesDashboard
                latestMatch={report?.latestMatch?.playerId === visible.id ? report.latestMatch : null}
                filtered={period !== 'all'}
                details={report?.details}
                serveEvolution={report?.serveEvolution}
                evolution={report?.evolution}
                renderEvolution={ready || enTransicion ? renderEvolution : undefined}
                playerId={visible.id}
                sample={sample}
              />
            </>
          )}
        </div>
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
      ranking: createFirestoreRankingService(identity),
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
      rankingService={liveServices?.ranking}
      renderEvolution={renderEvolution}
      organizacion={organizacion}
    />
  )
}
