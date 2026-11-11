import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import BloqueVacio from '../components/layout/BloqueVacio.jsx'
import { ErrorState, LoadingState, StatusBadge } from '../components/ui'
import { useInicio } from '../hooks/useInicio.js'
import { useUnidades } from '../hooks/useUnidades.js'
import { createFirestoreInicioService } from '../lib/services/firestoreInicioService.js'
import { convertirVelocidad, etiquetaVelocidad } from '../lib/unidades.js'
import { useIdioma } from '../../compartido/lib/idioma.jsx'

const textos = {
  es: {
    locale: 'es-PE',
    coach: 'Coach',
    manana: 'Buenos días',
    tarde: 'Buenas tardes',
    noche: 'Buenas noches',
    tienes: 'Tienes',
    y: 'y',
    paraRevisar: 'para revisar.',
    postulacionNueva: (n) => `${n} ${n === 1 ? 'postulación nueva' : 'postulaciones nuevas'}`,
    analisisListo: (n) => `${n} ${n === 1 ? 'análisis listo' : 'análisis listos'}`,
    analizar: 'Analizar video',
    nuevoJugador: 'Nuevo jugador',
    verPostulaciones: 'Ver postulaciones',
    resumen: 'Resumen',
    seguimiento: 'Jugadores en seguimiento',
    conAnalisis: (n) => `${n} con análisis esta semana`,
    partidosAnalizados: 'Partidos analizados',
    esteMes: (fecha) => `En ${fecha}`,
    postulacionesNuevas: 'Postulaciones nuevas',
    enRevision: (n) => `${n} en revisión`,
    enProcesamiento: 'En procesamiento',
    cortas: ['Jugadores', 'Partidos', 'Postulantes', 'En cola'],
    estimado: (n) => `Tiempo estimado: ${n} min`,
    enCurso: 'En cola o analizándose',
    analizando: 'Analizando…',
    errorAnalisis: 'Error en el análisis',
    postulacionesRecientes: 'Postulaciones recientes',
    verTodas: 'Ver todas',
    cola: 'Cola de procesamiento',
    irAnalizar: 'Ir a Analizar video',
    progresoDe: (titulo) => `Progreso de ${titulo}`,
    subido: 'subido',
    terminado: 'terminado',
    analisisRecientes: 'Análisis recientes',
    verPartidos: 'Ver partidos',
    reporte: 'Reporte',
    reporteDe: (partido) => `Reporte de ${partido}`,
    alertas: 'Alertas',
    activas: (n) => `${n} ${n === 1 ? 'activa' : 'activas'}`,
    verLos: (n) => `Ver los ${n}`,
    años: 'años',
    demo: 'Modo demostración',
    demoTexto: 'Datos de ejemplo para revisar la interfaz. No son resultados reales.',
    sinActividad: 'Todavía no hay actividad. Empieza subiendo el video de un partido.',
    vacio: {
      postulaciones: [
        'Aún no llegan postulaciones',
        'Cuando un jugador complete tu formulario, aparecerá aquí.',
        'Ir a Reclutamiento',
      ],
      cola: [
        'La cola está libre',
        'Sube el video de un partido y sigue aquí su avance.',
        'Analizar video',
      ],
      analisis: [
        'Todavía no hay partidos analizados',
        'Cada análisis terminado aparecerá aquí con su marcador y su reporte.',
      ],
      alertas: ['Todo en orden', 'Te avisaremos cuando un jugador mejore o baje su rendimiento.'],
      seguimiento: [
        'Aún no sigues a ningún jugador',
        'Registra a tus jugadores para ver aquí su mejor métrica y cómo evoluciona.',
        'Ir a Jugadores',
      ],
    },
    notasVacias: [
      'Registra a tu primer jugador',
      'Sube tu primer partido',
      'Comparte tu formulario',
      'Ningún video en cola',
    ],
    cargando: 'Cargando tu resumen…',
    errorTitulo: 'No pudimos cargar tu resumen',
    errorTexto: 'Revisa tu conexión e inténtalo de nuevo.',
    reintentar: 'Reintentar',
    estados: {
      nueva: 'Nueva',
      'en revisión': 'En revisión',
      analizada: 'Analizada',
      procesando: 'Procesando',
      'en cola': 'En cola',
      listo: 'Listo',
      error: 'Error',
      contactada: 'Contactada',
      descartada: 'Descartada',
    },
    metricas: { saque: 'velocidad de saque', primeros: '% de primeros saques' },
    sube: (jugador, metrica) => `${jugador} subió su ${metrica}`,
    baja: (jugador, metrica) => `${jugador} bajó su ${metrica}`,
    cambio: (actual, antes, n) =>
      `${actual} en el último partido (venía de ${antes} en ${n === 1 ? 'el anterior' : `los ${n} anteriores`})`,
    fallo: (titulo) => `Falló el análisis de “${titulo}”`,
    falloTexto: 'Revisa el video y vuelve a subirlo desde Analizar video.',
    kpis: { saque: 'Saque medio', golpe: 'Golpe medio', partidos: 'Partidos analizados' },
    sinUtr: 'UTR sin registrar',
    sinCategoria: 'Sin categoría',
  },
  en: {
    locale: 'en-US',
    coach: 'Coach',
    manana: 'Good morning',
    tarde: 'Good afternoon',
    noche: 'Good evening',
    tienes: 'You have',
    y: 'and',
    paraRevisar: 'to review.',
    postulacionNueva: (n) => `${n} new ${n === 1 ? 'application' : 'applications'}`,
    analisisListo: (n) => `${n} ${n === 1 ? 'analysis' : 'analyses'} ready`,
    analizar: 'Analyze video',
    nuevoJugador: 'New player',
    verPostulaciones: 'View applications',
    resumen: 'Summary',
    seguimiento: 'Tracked players',
    conAnalisis: (n) => `${n} analyzed this week`,
    partidosAnalizados: 'Matches analyzed',
    esteMes: (fecha) => `In ${fecha}`,
    postulacionesNuevas: 'New applications',
    enRevision: (n) => `${n} in review`,
    enProcesamiento: 'Processing',
    cortas: ['Players', 'Matches', 'Applicants', 'In queue'],
    estimado: (n) => `Estimated time: ${n} min`,
    enCurso: 'Queued or being analyzed',
    analizando: 'Analyzing…',
    errorAnalisis: 'Analysis error',
    postulacionesRecientes: 'Recent applications',
    verTodas: 'View all',
    cola: 'Processing queue',
    irAnalizar: 'Go to Analyze video',
    progresoDe: (titulo) => `Progress of ${titulo}`,
    subido: 'uploaded',
    terminado: 'finished',
    analisisRecientes: 'Recent analyses',
    verPartidos: 'View matches',
    reporte: 'Report',
    reporteDe: (partido) => `Report for ${partido}`,
    alertas: 'Alerts',
    activas: (n) => `${n} active`,
    verLos: (n) => `View all ${n}`,
    años: 'years',
    demo: 'Demo mode',
    demoTexto: 'Sample data to review the interface. These are not real results.',
    sinActividad: 'No activity yet. Start by uploading a match video.',
    vacio: {
      postulaciones: [
        'No applications yet',
        'When a player fills out your form, it will show up here.',
        'Go to Recruiting',
      ],
      cola: [
        'The queue is clear',
        'Upload a match video and follow its progress here.',
        'Analyze video',
      ],
      analisis: [
        'No analyzed matches yet',
        'Each finished analysis will show up here with its score and report.',
      ],
      alertas: ['All good', 'We’ll let you know when a player improves or drops in performance.'],
      seguimiento: [
        'You’re not tracking any players yet',
        'Register your players to see their best metric and how it evolves.',
        'Go to Players',
      ],
    },
    notasVacias: [
      'Register your first player',
      'Upload your first match',
      'Share your form',
      'No videos queued',
    ],
    cargando: 'Loading your summary…',
    errorTitulo: 'We couldn’t load your summary',
    errorTexto: 'Check your connection and try again.',
    reintentar: 'Try again',
    estados: {
      nueva: 'New',
      'en revisión': 'In review',
      analizada: 'Analyzed',
      procesando: 'Processing',
      'en cola': 'Queued',
      listo: 'Ready',
      error: 'Error',
      contactada: 'Contacted',
      descartada: 'Discarded',
    },
    metricas: { saque: 'serve speed', primeros: 'first-serve %' },
    sube: (jugador, metrica) => `${jugador} improved their ${metrica}`,
    baja: (jugador, metrica) => `${jugador} dropped their ${metrica}`,
    cambio: (actual, antes, n) =>
      `${actual} in the last match (was ${antes} over the previous ${n === 1 ? 'match' : `${n} matches`})`,
    fallo: (titulo) => `The analysis of “${titulo}” failed`,
    falloTexto: 'Check the video and upload it again from Analyze video.',
    kpis: { saque: 'Average serve', golpe: 'Average shot', partidos: 'Analyzed matches' },
    sinUtr: 'UTR not recorded',
    sinCategoria: 'No category',
  },
}

const cifra = (locale, valor) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(valor)

function medida(t, unidades, metrica, valor) {
  if (metrica === 'primeros') return `${cifra(t.locale, valor)}%`
  return `${cifra(t.locale, convertirVelocidad(valor, unidades))} ${etiquetaVelocidad(unidades)}`
}

const barra = {
  procesando: 'bg-electric',
  'en cola': 'bg-muted',
  listo: 'bg-good',
  error: 'bg-bad',
}

const colores = ['bg-series1', 'bg-electric', 'bg-series3', 'bg-accent']

const tarjeta = 'rounded-card border border-line bg-surface p-5'
const etiqueta = 'text-xs font-semibold tracking-[0.08em] text-muted uppercase'
const subtitulo = 'font-display text-[22px] leading-tight font-bold tracking-[0.01em]'
const enlace =
  '-mx-2 -my-3 inline-flex min-h-11 items-center px-2 text-sm font-semibold text-accent-ink hover:underline'
const boton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border px-4 text-sm font-semibold whitespace-nowrap transition-colors'
const botonNormal = `${boton} border-line2 bg-surface2 text-text hover:bg-line`
const fila = 'flex items-center gap-3 border-t border-chip py-3 first:border-t-0 first:pt-0'

function iniciales(nombre = '') {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0])
    .join('')
    .toUpperCase()
}

function saludo(t, hora) {
  if (hora < 12) return t.manana
  if (hora < 19) return t.tarde
  return t.noche
}

function capital(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function haceCuanto(fecha, locale) {
  const minutos = Math.round((new Date(fecha).getTime() - Date.now()) / 60000)
  const formato = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (Math.abs(minutos) < 60) return formato.format(minutos, 'minute')
  const horas = Math.round(minutos / 60)
  if (Math.abs(horas) < 24) return formato.format(horas, 'hour')
  return formato.format(Math.round(horas / 24), 'day')
}

function fechaCorta(fecha, locale) {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(fecha))
    .replace('.', '')
}

function Trazo({ children, size = 18, className = '', strokeWidth = 2 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  )
}

function Encabezado({ titulo, children }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className={subtitulo}>{titulo}</h2>
      {children}
    </div>
  )
}

const iconos = {
  postulaciones: (
    <>
      <path d="M3 13l2.6-7.4A1 1 0 016.5 5h11a1 1 0 01.9.6L21 13v6a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
      <path d="M3 13h5l1.5 2.5h5L16 13h5" />
    </>
  ),
  cola: (
    <>
      <path d="M12 15V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" />
    </>
  ),
  analisis: (
    <>
      <rect x="3" y="5" width="13" height="14" rx="2" />
      <path d="M16 10l5-3v10l-5-3" />
    </>
  ),
  alertas: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </>
  ),
  seguimiento: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 010 6.8" />
      <path d="M21.5 20c0-2.6-1.4-4.3-3.5-5" />
    </>
  ),
}

function Vacio({ t, tipo, to, principal = false }) {
  const [titulo, texto, accion] = t.vacio[tipo]
  return (
    <BloqueVacio icono={iconos[tipo]} titulo={titulo} texto={texto}>
      {accion && to && (
        <Link
          to={to}
          className={`${principal ? `${boton} border-accent-line bg-accent text-on-accent hover:opacity-90` : botonNormal} min-h-9.5 px-3.5 text-[13px]`}
        >
          {accion}
        </Link>
      )}
    </BloqueVacio>
  )
}

function Bienvenida({ t, nombre, resumen, ahora }) {
  const fecha = capital(
    new Intl.DateTimeFormat(t.locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(
      ahora,
    ),
  )
  return (
    <section className="flex flex-wrap items-end justify-between gap-5">
      <div>
        <p className={etiqueta}>{fecha}</p>
        <h1 className="my-1.5 font-display text-[44px] leading-none font-bold">
          {saludo(t, ahora.getHours())}
          {`, ${nombre || t.coach}`}
        </h1>
        {!resumen && <p className="text-base text-muted">{t.sinActividad}</p>}
        {resumen && (
          <p className="text-base text-muted">
            {t.tienes}{' '}
            <strong className="text-text">{t.postulacionNueva(resumen.newApplications)}</strong>{' '}
            {t.y} <strong className="text-text">{t.analisisListo(resumen.readyToReview)}</strong>{' '}
            {t.paraRevisar}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Link
          to="/analizar"
          className={`${boton} border-accent-line bg-accent text-on-accent hover:opacity-90`}
        >
          <Trazo>
            <path d="M12 15V4" />
            <path d="M7 9l5-5 5 5" />
            <path d="M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" />
          </Trazo>
          {t.analizar}
        </Link>
        <Link to="/jugadores" className={botonNormal}>
          <Trazo>
            <path d="M12 5v14M5 12h14" />
          </Trazo>
          {t.nuevoJugador}
        </Link>
        <Link to="/reclutamiento" className={botonNormal}>
          {t.verPostulaciones}
        </Link>
      </div>
    </section>
  )
}

function Tarjetas({ t, resumen, ahora }) {
  const mes = new Intl.DateTimeFormat(t.locale, { month: 'long' }).format(ahora)
  const datos = [
    {
      etiqueta: t.seguimiento,
      valor: resumen?.trackedPlayers,
      nota: resumen && t.conAnalisis(resumen.playersAnalyzedThisWeek),
    },
    {
      etiqueta: t.partidosAnalizados,
      valor: resumen?.analyzedMatchesThisMonth,
      nota: resumen && t.esteMes(mes),
    },
    {
      etiqueta: t.postulacionesNuevas,
      valor: resumen?.newApplications,
      nota: resumen && t.enRevision(resumen.applicationsInReview),
    },
    {
      etiqueta: t.enProcesamiento,
      valor: resumen?.processing,
      nota:
        resumen &&
        (resumen.estimatedMinutes == null ? t.enCurso : t.estimado(resumen.estimatedMinutes)),
    },
  ]
  return (
    <section
      aria-label={t.resumen}
      className="grid grid-cols-4 gap-1.5 md:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] md:gap-4"
    >
      {datos.map((dato, indice) => {
        const vacio = dato.valor == null
        return (
          <div
            key={dato.etiqueta}
            className={`${tarjeta} flex min-w-0 flex-col gap-2.5 max-md:items-center max-md:gap-1.5 max-md:rounded-xl max-md:px-1 max-md:py-5 max-md:text-center`}
          >
            <p className={`${etiqueta} max-md:hidden`}>{dato.etiqueta}</p>
            <p
              className={`font-display text-[44px] leading-none font-bold max-md:text-[28px] ${vacio ? 'text-line3' : ''}`}
            >
              {vacio ? 0 : dato.valor}
            </p>
            <p className="w-full truncate text-[10.5px] font-semibold text-muted md:hidden">
              {t.cortas[indice]}
            </p>
            <p className="text-[13px] text-muted max-md:hidden">
              {vacio ? t.notasVacias[indice] : dato.nota}
            </p>
          </div>
        )
      })}
    </section>
  )
}

function Postulaciones({ t, filas }) {
  return (
    <div className={tarjeta}>
      <Encabezado titulo={t.postulacionesRecientes}>
        <Link to="/reclutamiento" className={enlace}>
          {t.verTodas}
        </Link>
      </Encabezado>
      {filas.length === 0 ? (
        <Vacio t={t} tipo="postulaciones" to="/reclutamiento" />
      ) : (
        <ul>
          {filas.map((postulacion) => (
            <li key={postulacion.id} className={fila}>
              <span className="grid size-9.5 shrink-0 place-items-center rounded-full bg-line text-[13px] font-bold">
                {iniciales(postulacion.fullName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{postulacion.fullName}</p>
                <p className="truncate text-[13px] text-muted">
                  {[
                    postulacion.age != null && `${postulacion.age} ${t.años}`,
                    postulacion.academy,
                    postulacion.utr != null && `UTR ${postulacion.utr}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <StatusBadge status={postulacion.status} label={t.estados[postulacion.status]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Cola({ t, filas }) {
  return (
    <div className={tarjeta}>
      <Encabezado titulo={t.cola}>
        <Link to="/analizar" className={enlace}>
          {t.irAnalizar}
        </Link>
      </Encabezado>
      {filas.length === 0 ? (
        <Vacio t={t} tipo="cola" to="/analizar" principal />
      ) : (
        <ul className="flex flex-col gap-4.5">
          {filas.map((video) => {
            const listo = video.status === 'listo'
            const estado = t.estados[video.status] ?? video.status
            const sinPorcentaje = video.progress == null
            return (
              <li key={video.id} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{video.title}</p>
                    <p className="truncate text-[13px] text-muted">
                      {[
                        video.source,
                        listo
                          ? t.terminado
                          : video.status === 'error'
                            ? t.errorAnalisis
                            : video.uploadedAt &&
                              `${t.subido} ${haceCuanto(video.uploadedAt, t.locale)}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <StatusBadge
                    status={video.status}
                    label={
                      video.status === 'procesando' && !sinPorcentaje
                        ? `${estado} ${video.progress}%`
                        : estado
                    }
                  />
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={sinPorcentaje ? undefined : video.progress}
                  aria-valuetext={sinPorcentaje ? t.analizando : undefined}
                  aria-label={t.progresoDe(video.title)}
                  className="h-2 overflow-hidden rounded-full bg-line"
                >
                  <div
                    className={`h-full rounded-full ${barra[video.status] ?? 'bg-muted'} ${sinPorcentaje ? 'w-full animate-pulse' : ''}`}
                    style={sinPorcentaje ? undefined : { width: `${video.progress}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Analisis({ t, filas }) {
  return (
    <div className={tarjeta}>
      <Encabezado titulo={t.analisisRecientes}>
        <Link to="/partidos" className={enlace}>
          {t.verPartidos}
        </Link>
      </Encabezado>
      {filas.length === 0 ? (
        <Vacio t={t} tipo="analisis" />
      ) : (
        <ul>
          {filas.map((partido) => {
            const nombre = `${partido.player} vs. ${partido.opponent}`
            return (
              <li key={partido.id} className={fila}>
                <span className="grid size-11 shrink-0 place-items-center rounded-[10px] border border-line bg-surface2 text-accent-ink">
                  <Trazo strokeWidth={1.8}>
                    <rect x="3" y="5" width="13" height="14" rx="2" />
                    <path d="M16 10l5-3v10l-5-3" />
                  </Trazo>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{nombre}</p>
                  <p className="truncate text-[13px] text-muted">
                    {partido.tournament} · {fechaCorta(partido.date, t.locale)}
                  </p>
                </div>
                <span className="font-display text-lg font-bold whitespace-nowrap">
                  {partido.score}
                </span>
                <Link
                  to="/partidos"
                  aria-label={t.reporteDe(nombre)}
                  className={`${botonNormal} min-h-9.5 px-3 text-[13px]`}
                >
                  {t.reporte}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function textoAlerta(t, unidades, alerta) {
  if (alerta.title) return [alerta.title, alerta.detail]
  if (alerta.type === 'error') {
    const titulo = `${alerta.player} vs. ${alerta.opponent}`
    return [t.fallo(titulo), alerta.message || t.falloTexto]
  }
  const nombre = t.metricas[alerta.metric]
  return [
    (alerta.type === 'up' ? t.sube : t.baja)(alerta.player, nombre),
    t.cambio(
      medida(t, unidades, alerta.metric, alerta.latest),
      medida(t, unidades, alerta.metric, alerta.previous),
      alerta.matches,
    ),
  ]
}

function Alertas({ t, filas }) {
  const unidades = useUnidades()
  return (
    <div className={tarjeta}>
      <Encabezado titulo={t.alertas}>
        {filas.length > 0 && (
          <span className="rounded-full bg-surface2 px-2.5 py-0.5 text-xs font-semibold text-text3">
            {t.activas(filas.length)}
          </span>
        )}
      </Encabezado>
      {filas.length === 0 ? (
        <Vacio t={t} tipo="alertas" />
      ) : (
        <ul>
          {filas.map((alerta) => {
            const [titulo, detalle] = textoAlerta(t, unidades, alerta)
            return (
              <li key={alerta.id} className={`${fila} items-start`}>
                <span
                  className={`grid size-8.5 shrink-0 place-items-center rounded-full bg-chip ${
                    alerta.type === 'up' ? 'text-good' : 'text-bad'
                  }`}
                >
                  <Trazo size={16} strokeWidth={2.2}>
                    {alerta.type === 'up' && (
                      <>
                        <path d="M12 19V5" />
                        <path d="M6 11l6-6 6 6" />
                      </>
                    )}
                    {alerta.type === 'down' && (
                      <>
                        <path d="M12 5v14" />
                        <path d="M6 13l6 6 6-6" />
                      </>
                    )}
                    {alerta.type !== 'up' && alerta.type !== 'down' && (
                      <>
                        <path d="M12 7v6" />
                        <path d="M12 17h.01" />
                      </>
                    )}
                  </Trazo>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{titulo}</p>
                  <p className="mt-0.5 text-[13px] text-muted">{detalle}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function destacado(t, unidades, jugador) {
  if (!jugador.kpi)
    return { etiqueta: jugador.kpiLabel, valor: jugador.kpiValue, delta: jugador.delta, sube: true }
  const { tipo, valor, anterior } = jugador.kpi
  if (tipo === 'partidos') return { etiqueta: t.kpis.partidos, valor: cifra(t.locale, valor) }
  const diferencia = anterior == null ? null : convertirVelocidad(valor - anterior, unidades)
  return {
    etiqueta: t.kpis[tipo],
    valor: medida(t, unidades, tipo, valor),
    delta:
      diferencia == null || Math.abs(diferencia) < 0.05
        ? null
        : new Intl.NumberFormat(t.locale, {
            maximumFractionDigits: 1,
            signDisplay: 'always',
          }).format(diferencia),
    sube: diferencia > 0,
  }
}

function Seguimiento({ t, filas, total }) {
  const unidades = useUnidades()
  if (filas.length === 0) {
    return (
      <section>
        <h2 className={`${subtitulo} mb-3.5`}>{t.seguimiento}</h2>
        <Vacio t={t} tipo="seguimiento" to="/jugadores" />
      </section>
    )
  }
  return (
    <section>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2 className={subtitulo}>{t.seguimiento}</h2>
        <Link to="/jugadores" className={enlace}>
          {t.verLos(total)}
        </Link>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
        {filas.map((jugador, indice) => {
          const kpi = destacado(t, unidades, jugador)
          return (
            <li key={jugador.id}>
              <Link
                to={`/dashboard?jugador=${encodeURIComponent(jugador.id)}`}
                className={`${tarjeta} flex h-full flex-col gap-3.5 transition-colors hover:border-line3`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`grid size-11.5 shrink-0 place-items-center rounded-full text-[15px] font-bold text-on-accent ${
                      colores[indice % colores.length]
                    }`}
                  >
                    {iniciales(jugador.fullName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{jugador.fullName}</p>
                    <p className="text-[13px] text-muted">
                      {jugador.category || t.sinCategoria} ·{' '}
                      {jugador.utr == null ? t.sinUtr : `UTR ${jugador.utr}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-end justify-between gap-2 border-t border-chip pt-3">
                  <div>
                    <p className={etiqueta}>{kpi.etiqueta}</p>
                    <p className="mt-1 font-display text-3xl leading-none font-bold">{kpi.valor}</p>
                  </div>
                  {kpi.delta && (
                    <span
                      className={`inline-flex items-center gap-1 text-[13px] font-semibold ${kpi.sube ? 'text-good' : 'text-bad'}`}
                    >
                      <Trazo size={14} strokeWidth={2.4}>
                        {kpi.sube ? (
                          <>
                            <path d="M12 19V5" />
                            <path d="M6 11l6-6 6 6" />
                          </>
                        ) : (
                          <>
                            <path d="M12 5v14" />
                            <path d="M6 13l6 6 6-6" />
                          </>
                        )}
                      </Trazo>
                      {kpi.delta}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Contenido({ t, data, ahora }) {
  return (
    <>
      <Tarjetas t={t} resumen={data?.summary} ahora={ahora} />
      <section className="grid grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] gap-4">
        <Postulaciones t={t} filas={data?.applications ?? []} />
        <Cola t={t} filas={data?.queue ?? []} />
      </section>
      <section className="grid grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] gap-4">
        <Analisis t={t} filas={data?.recentMatches ?? []} />
        <Alertas t={t} filas={data?.alerts ?? []} />
      </section>
      <Seguimiento
        t={t}
        filas={data?.tracked ?? []}
        total={data?.summary?.trackedPlayers ?? data?.tracked?.length ?? 0}
      />
    </>
  )
}

function Panel({ service, t }) {
  const { data, error, loading, retry } = useInicio(service)
  const [ahora] = useState(() => new Date())

  return (
    <div className="mx-auto flex w-full max-w-310 flex-col gap-6">
      {service.mode === 'demo' && (
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-[10px] border border-line2 px-4 py-3 text-[13px] text-muted">
          <strong className="font-semibold text-accent-ink">{t.demo}</strong>
          {t.demoTexto}
        </p>
      )}

      <Bienvenida t={t} nombre={data?.coachName} resumen={data?.summary} ahora={ahora} />

      {loading ? (
        <div className={tarjeta} aria-busy="true">
          <LoadingState title={t.cargando} />
        </div>
      ) : error || !data ? (
        <div className={tarjeta}>
          <ErrorState
            title={t.errorTitulo}
            description={t.errorTexto}
            onRetry={retry}
            retryLabel={t.reintentar}
          />
        </div>
      ) : (
        <Contenido t={t} data={data} ahora={ahora} />
      )}
    </div>
  )
}

export default function Inicio({ service: inyectado, db, session, nombre }) {
  const { idioma } = useIdioma()
  const t = textos[idioma]
  const [ahora] = useState(() => new Date())
  const { uid, orgId, role } = session ?? {}
  const vivo = useMemo(() => {
    if (inyectado || !db || !uid || !orgId || !['coach', 'admin'].includes(role)) return null
    return createFirestoreInicioService({ db, orgId, actorId: uid, role, coachName: nombre })
  }, [inyectado, db, uid, orgId, role, nombre])
  const service = inyectado ?? vivo

  if (!service) {
    return (
      <div className="mx-auto flex w-full max-w-310 flex-col gap-6">
        <Bienvenida t={t} ahora={ahora} />
        <Contenido t={t} ahora={ahora} />
      </div>
    )
  }

  return <Panel key={service.scopeKey} service={service} t={t} />
}
