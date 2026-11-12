import { normalizeDashboardStatistics } from './dashboardOverview.js'
import { playerAge } from './players.js'
import { APPLICATION_STATUS, MATCH_STATUS } from './schema.js'
import { decodeWorkerDashboardStatistics } from './workerDashboardStatistics.js'

const DIA = 24 * 60 * 60 * 1000
const UMBRAL_VELOCIDAD = 5
const UMBRAL_PORCENTAJE = 5

export function aFecha(valor) {
  if (!valor) return null
  const fecha = typeof valor.toDate === 'function' ? valor.toDate() : new Date(valor)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

const reciente = (a, b) => (b?.getTime() ?? 0) - (a?.getTime() ?? 0)

function medidas(partido) {
  const stats = normalizeDashboardStatistics(
    decodeWorkerDashboardStatistics(partido, { playerId: partido.playerId }),
    partido.playerId,
  )
  const media = (contador) =>
    contador?.sampleCount > 0 ? contador.sumKmh / contador.sampleCount : null
  return {
    saque: media(stats?.serveSpeed),
    golpe: media(stats?.shots),
    primeros:
      stats?.firstServe?.attempts > 0
        ? (100 * stats.firstServe.in) / stats.firstServe.attempts
        : null,
  }
}

function promedio(valores) {
  const validos = valores.filter((valor) => valor != null)
  return validos.length ? validos.reduce((suma, valor) => suma + valor, 0) / validos.length : null
}

function alertasDeJugador(jugador, partidos, ahora) {
  if (partidos.length < 2) return []
  const [ultimo, ...anteriores] = partidos
  if (!ultimo.terminado || ahora - ultimo.terminado > 30 * DIA) return []
  const previos = anteriores.slice(0, 3)
  return [
    ['saque', UMBRAL_VELOCIDAD],
    ['primeros', UMBRAL_PORCENTAJE],
  ].flatMap(([metrica, umbral]) => {
    const actual = ultimo.medidas[metrica]
    const antes = promedio(previos.map((partido) => partido.medidas[metrica]))
    if (actual == null || antes == null || Math.abs(actual - antes) < umbral) return []
    return [
      {
        id: `${jugador.id}-${metrica}`,
        type: actual > antes ? 'up' : 'down',
        player: jugador.fullName,
        playerId: jugador.id,
        metric: metrica,
        latest: actual,
        previous: antes,
        matches: previos.length,
        fecha: ultimo.terminado,
      },
    ]
  })
}

function destacado(partidos) {
  const conSaque = partidos.filter((partido) => partido.medidas.saque != null)
  if (conSaque.length) {
    const [ultimo, anterior] = conSaque
    return { tipo: 'saque', valor: ultimo.medidas.saque, anterior: anterior?.medidas.saque ?? null }
  }
  const conGolpe = partidos.filter((partido) => partido.medidas.golpe != null)
  if (conGolpe.length) {
    const [ultimo, anterior] = conGolpe
    return { tipo: 'golpe', valor: ultimo.medidas.golpe, anterior: anterior?.medidas.golpe ?? null }
  }
  return { tipo: 'partidos', valor: partidos.length, anterior: null }
}

export function construirInicio({
  coachName = '',
  players = [],
  matches = [],
  applications = [],
  ahora = new Date(),
}) {
  const activos = players.filter((jugador) => jugador.deletedAt == null)
  const nombres = new Map(
    players.map((jugador) => [jugador.id, jugador.fullName || 'Jugador sin nombre']),
  )
  const hoy = ahora.getTime()
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime()

  const partidos = matches.map((partido) => ({
    ...partido,
    jugador: nombres.get(partido.playerId) ?? 'Jugador no disponible',
    subido: aFecha(partido.createdAt),
    terminado: aFecha(partido.finishedAt),
  }))
  const listos = partidos
    .filter((partido) => partido.status === MATCH_STATUS.ready)
    .map((partido) => ({ ...partido, medidas: medidas(partido) }))
    .sort(
      (a, b) =>
        reciente(a.terminado, b.terminado) || (b.matchDate ?? '').localeCompare(a.matchDate ?? ''),
    )
  const enCurso = partidos.filter(
    (partido) =>
      partido.status === MATCH_STATUS.queued || partido.status === MATCH_STATUS.processing,
  )
  const fallidos = partidos.filter(
    (partido) =>
      partido.status === MATCH_STATUS.error &&
      hoy - (partido.terminado ?? partido.subido ?? 0) <= 7 * DIA,
  )
  const semana = listos.filter((partido) => partido.terminado && hoy - partido.terminado <= 7 * DIA)

  const porJugador = new Map()
  for (const partido of listos) {
    if (!porJugador.has(partido.playerId)) porJugador.set(partido.playerId, [])
    porJugador.get(partido.playerId).push(partido)
  }

  const postulaciones = applications
    .map((postulacion) => ({ ...postulacion, enviada: aFecha(postulacion.createdAt) }))
    .sort((a, b) => reciente(a.enviada, b.enviada))
  const contar = (estado) =>
    postulaciones.filter((postulacion) => postulacion.status === estado).length

  const queue = [...enCurso, ...fallidos]
    .sort((a, b) => reciente(a.subido, b.subido))
    .slice(0, 4)
    .map((partido) => ({
      id: partido.id,
      title: `${partido.jugador} vs. ${partido.opponent || 'Rival sin registrar'}`,
      source: partido.tournament || partido.matchDate || '',
      uploadedAt: partido.subido?.toISOString() ?? null,
      status: partido.status,
      progress:
        partido.status === MATCH_STATUS.queued
          ? 0
          : partido.status === MATCH_STATUS.error
            ? 100
            : null,
    }))

  const errores = fallidos.map((partido) => ({
    id: `error-${partido.id}`,
    type: 'error',
    player: partido.jugador,
    opponent: partido.opponent || 'Rival sin registrar',
    message: typeof partido.errorMessage === 'string' ? partido.errorMessage.trim() : '',
    fecha: partido.terminado ?? partido.subido,
  }))
  const cambios = activos.flatMap((jugador) =>
    alertasDeJugador(jugador, porJugador.get(jugador.id) ?? [], hoy),
  )
  const alerts = [...errores, ...cambios].sort((a, b) => reciente(a.fecha, b.fecha)).slice(0, 4)

  const tracked = activos
    .map((jugador) => ({ jugador, partidos: porJugador.get(jugador.id) ?? [] }))
    .sort(
      (a, b) =>
        reciente(a.partidos[0]?.terminado, b.partidos[0]?.terminado) ||
        (a.jugador.fullName ?? '').localeCompare(b.jugador.fullName ?? '', 'es'),
    )
    .slice(0, 4)
    .map(({ jugador, partidos: suyos }) => ({
      id: jugador.id,
      fullName: jugador.fullName || 'Jugador sin nombre',
      category: jugador.category ?? null,
      utr: jugador.utr ?? null,
      kpi: destacado(suyos),
    }))

  return {
    coachName,
    summary: {
      trackedPlayers: activos.length,
      playersAnalyzedThisWeek: new Set(semana.map((partido) => partido.playerId)).size,
      analyzedMatchesThisMonth: listos.filter(
        (partido) => partido.terminado && partido.terminado >= inicioMes,
      ).length,
      newApplications: contar(APPLICATION_STATUS.new),
      applicationsInReview: contar(APPLICATION_STATUS.inReview),
      processing: enCurso.length,
      readyToReview: semana.length,
    },
    applications: postulaciones.slice(0, 4).map((postulacion) => ({
      id: postulacion.id,
      fullName: postulacion.fullName || 'Postulante sin nombre',
      age: playerAge(postulacion.birthDate),
      academy: postulacion.academy || '',
      utr: postulacion.utr ?? null,
      status: postulacion.status,
    })),
    queue,
    recentMatches: listos.slice(0, 4).map((partido) => ({
      id: partido.id,
      player: partido.jugador,
      opponent: partido.opponent || 'Rival sin registrar',
      tournament: partido.tournament || '',
      date: partido.matchDate || null,
      score: partido.result || '',
    })),
    alerts,
    tracked,
  }
}
