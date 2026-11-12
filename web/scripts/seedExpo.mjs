import { APPLICATION_STATUS as A, MATCH_STATUS as M } from '../src/panel/lib/schema.js'

const FECHAS = ['2025-11-14', '2026-01-22', '2026-03-24', '2026-04-15', '2026-05-12', '2026-06-02', '2026-07-04', '2026-09-03', '2026-11-05']
const TORNEOS = [
  ['ATP Finals', 'dura'], ['Australian Open', 'dura'], ['Miami Masters', 'dura'], ['Monte Carlo', 'arcilla'], ['Roma', 'arcilla'],
  ['Roland Garros', 'arcilla'], ['Wimbledon', 'césped'], ['US Open', 'dura'], ['Paris Masters', 'dura'],
]
const GANA = ['6-4 6-3', '7-6(5) 6-4', '4-6 6-3 6-4', '6-3 7-5', '6-2 6-4', '7-5 6-7(3) 6-3']
const PIERDE = ['4-6 6-7(4)', '6-4 3-6 4-6', '3-6 6-4 5-7']
const RUIDO = [0, 0.012, -0.009, 0.01, -0.006, 0.008, -0.004, 0.005, 0]

const JUGADORES = [
  {
    id: 'player-roger-federer', fullName: 'Roger Federer', birthDate: '1981-08-08', dominantHand: 'diestro', backhand: 'una mano',
    nationality: 'Suiza', utr: 16.3,
    rivales: ['Rafael Nadal', 'Novak Djokovic', 'Andy Murray', 'Lleyton Hewitt', 'Andy Roddick'],
    victorias: [0, 1, 0, 1, 1, 0, 1, 1, 1],
    promedio: { saque: 174.3, saqueMax: 230, primeros: 62, dobles: 1.8, golpe: 114.4, derecha: 170, reves: 155, distancia: 2050, despMax: 25.5, peloteo: 4.1, largo: [16, 24] },
  },
  {
    id: 'player-novak-djokovic', fullName: 'Novak Djokovic', birthDate: '1987-05-22', dominantHand: 'diestro', backhand: 'dos manos',
    nationality: 'Serbia', utr: 16.5,
    rivales: ['Rafael Nadal', 'Roger Federer', 'Andy Murray', 'Stan Wawrinka', 'Tomas Berdych'],
    victorias: [1, 0, 1, 1, 0, 1, 1, 1, 1],
    promedio: { saque: 179.1, saqueMax: 219, primeros: 65, dobles: 2.5, golpe: 120.5, derecha: 165, reves: 160, distancia: 2400, despMax: 27, peloteo: 5.5, largo: [24, 34] },
  },
  {
    id: 'player-rafael-nadal', fullName: 'Rafael Nadal', birthDate: '1986-06-03', dominantHand: 'zurdo', backhand: 'dos manos',
    nationality: 'Española', utr: 16.4,
    rivales: ['Novak Djokovic', 'Roger Federer', 'Andy Murray', 'David Ferrer', 'Tomas Berdych'],
    victorias: [0, 1, 0, 1, 1, 1, 0, 1, 1],
    promedio: { saque: 173.8, saqueMax: 217, primeros: 68, dobles: 1.7, golpe: 118.6, derecha: 170, reves: 155, distancia: 2750, despMax: 26.8, peloteo: 6.2, largo: [25, 35] },
  },
  {
    id: 'player-andy-murray', fullName: 'Andy Murray', birthDate: '1987-05-15', dominantHand: 'diestro', backhand: 'dos manos',
    nationality: 'Británica', utr: 16,
    rivales: ['Novak Djokovic', 'Roger Federer', 'Rafael Nadal', 'Stan Wawrinka', 'Tomas Berdych'],
    victorias: [0, 0, 1, 0, 1, 1, 1, 0, 1],
    promedio: { saque: 169.3, saqueMax: 233, primeros: 58, dobles: 2.5, golpe: 117.1, derecha: 162, reves: 158, distancia: 2600, despMax: 26.5, peloteo: 5.8, largo: [22, 32] },
  },
]

const redondear = (valor, decimales = 0) => Number(valor.toFixed(decimales))

function estadisticas(promedio, i, desfase) {
  const avance = i / (FECHAS.length - 1)
  const ruido = RUIDO[(i + desfase) % (RUIDO.length - 1)] * (i === FECHAS.length - 1 ? 0 : 1)
  const sube = (valor, caida) => valor * (1 - caida * (1 - avance)) * (1 + ruido)
  const [corto, largo] = promedio.largo
  const despMax = redondear(sube(promedio.despMax, 0.06), 1)
  return {
    serveMax: Math.round(sube(promedio.saqueMax, 0.07)),
    serveAvg: redondear(sube(promedio.saque, 0.09), 1),
    firstIn: Math.round(promedio.primeros - 7 * (1 - avance) + ruido * 100),
    df: Math.max(0, Math.round(promedio.dobles * (1.6 - 0.6 * avance) + ruido * 30)),
    fhMax: Math.round(sube(promedio.derecha, 0.08)),
    bhMax: Math.round(sube(promedio.reves, 0.08)),
    shotAvg: redondear(sube(promedio.golpe, 0.09), 1),
    shots: 420 + Math.round(ruido * 2000) + i * 6,
    rallyAvg: redondear(sube(promedio.peloteo, 0.1), 1),
    longest: Math.round(corto + (largo - corto) * avance + ruido * 150),
    distance: Math.round(sube(promedio.distancia, 0.08) / 10) * 10,
    moveMax: despMax,
    moveAvg: redondear(despMax * 0.28, 1),
  }
}

export function buildExpoData({ orgId, createdBy, player, match, stats, day }) {
  const players = []
  const matches = []
  JUGADORES.forEach((jugador, j) => {
    const { id, rivales, victorias, promedio, ...campos } = jugador
    const ficha = player(id, orgId, createdBy, {
      ...campos, academy: 'Circuito ATP', category: 'Adulto', nationalRanking: 1,
    })
    ficha.doc.createdAt = day('2025-11-01')
    players.push(ficha)
    FECHAS.forEach((matchDate, i) => {
      const [tournament, surface] = TORNEOS[i]
      matches.push(match(`match-${id.replace('player-', '')}-${i + 1}`, orgId, createdBy, id, {
        opponent: rivales[(i + j) % rivales.length], tournament, surface, matchDate,
        result: victorias[i] ? GANA[(i + j) % GANA.length] : PIERDE[(i + j) % PIERDE.length],
        status: M.ready, statistics: stats(estadisticas(promedio, i, j)),
      }))
    })
  })
  const ultimo = FECHAS.length - 1
  const conCambio = (indice, cambios) => ({ ...estadisticas(JUGADORES[indice].promedio, ultimo, indice), ...cambios })
  matches.push(
    match('match-novak-djokovic-10', orgId, createdBy, 'player-novak-djokovic', {
      opponent: 'Andy Murray', tournament: 'ATP Finals', surface: 'dura', matchDate: '2026-11-10', result: '6-3 6-4',
      status: M.ready, statistics: stats(conCambio(1, { serveAvg: 186.4, serveMax: 219, firstIn: 67 })),
    }),
    match('match-andy-murray-10', orgId, createdBy, 'player-andy-murray', {
      opponent: 'Rafael Nadal', tournament: 'ATP Finals', surface: 'dura', matchDate: '2026-11-09', result: '4-6 6-7(3)',
      status: M.ready, statistics: stats(conCambio(3, { firstIn: 49, df: 5 })),
    }),
    match('match-rafael-nadal-10', orgId, createdBy, 'player-rafael-nadal', {
      opponent: 'Roger Federer', tournament: 'ATP Finals', surface: 'dura', matchDate: '2026-11-10', status: M.error,
      errorMessage: 'No se pudo detectar la cancha completa. Prueba con un video grabado desde atrás y en alto.',
    }),
  )
  return { players, matches }
}

const POSTULANTES = [
  ['Carlos Alcaraz', '2003-05-05', 'El Palmar, España', 'diestro', 'dos manos', 16.4, A.new, '2026-11-09'],
  ['Jannik Sinner', '2001-08-16', 'San Candido, Italia', 'diestro', 'dos manos', 16.5, A.new, '2026-11-08'],
  ['Holger Rune', '2003-04-29', 'Gentofte, Dinamarca', 'diestro', 'dos manos', 15.6, A.new, '2026-11-07'],
  ['Taylor Fritz', '1997-10-28', 'Rancho Santa Fe, EE. UU.', 'diestro', 'dos manos', 15.9, A.new, '2026-11-06'],
  ['Casper Ruud', '1998-12-22', 'Oslo, Noruega', 'diestro', 'dos manos', 15.8, A.new, '2026-11-05'],
  ['Karen Khachanov', '1996-05-21', 'Moscú, Rusia', 'diestro', 'dos manos', 15.6, A.new, '2026-11-04'],
  ['Andre Agassi', '1970-04-29', 'Las Vegas, EE. UU.', 'diestro', 'dos manos', 16.1, A.new, '2026-11-03'],
  ['Daniil Medvedev', '1996-02-11', 'Moscú, Rusia', 'diestro', 'dos manos', 16, A.inReview, '2026-11-02'],
  ['Alexander Zverev', '1997-04-20', 'Hamburgo, Alemania', 'diestro', 'dos manos', 16.1, A.inReview, '2026-10-31'],
  ['Stefanos Tsitsipas', '1998-08-12', 'Atenas, Grecia', 'diestro', 'una mano', 15.7, A.inReview, '2026-10-29'],
  ['Pete Sampras', '1971-08-12', 'Washington D. C., EE. UU.', 'diestro', 'una mano', 16.2, A.inReview, '2026-10-27'],
  ['Grigor Dimitrov', '1991-05-16', 'Haskovo, Bulgaria', 'diestro', 'una mano', 15.5, A.inReview, '2026-10-25'],
  ['Dominic Thiem', '1993-09-03', 'Wiener Neustadt, Austria', 'diestro', 'una mano', 15.4, A.analyzed, '2026-10-22'],
  ['Juan Martín del Potro', '1988-09-23', 'Tandil, Argentina', 'diestro', 'dos manos', 15.8, A.analyzed, '2026-10-19'],
  ['Stan Wawrinka', '1985-03-28', 'Lausana, Suiza', 'diestro', 'una mano', 15.3, A.analyzed, '2026-10-16'],
  ['Marin Čilić', '1988-09-28', 'Medjugorje, Bosnia y Herzegovina', 'diestro', 'dos manos', 15.2, A.analyzed, '2026-10-13'],
  ['Kei Nishikori', '1989-12-29', 'Matsue, Japón', 'diestro', 'dos manos', 15.1, A.contacted, '2026-10-10'],
  ['Andy Roddick', '1982-08-30', 'Omaha, EE. UU.', 'diestro', 'dos manos', 15.4, A.contacted, '2026-10-07'],
  ['Gaël Monfils', '1986-09-01', 'París, Francia', 'diestro', 'dos manos', 15.2, A.discarded, '2026-10-04'],
  ['Nick Kyrgios', '1995-04-27', 'Canberra, Australia', 'diestro', 'dos manos', 15.3, A.discarded, '2026-10-01'],
]

const MENSAJES = [
  'Busco un programa competitivo donde seguir mejorando mi saque y mi juego de fondo.',
  'Me interesa entrenar con análisis de video para corregir mi derecha.',
  'Quiero preparar la próxima temporada con un equipo que mida mi progreso.',
  'Adjunto mis últimos partidos. Me gustaría recibir una evaluación completa.',
]

const NOTAS = {
  [A.analyzed]: 'Saque muy sólido y buen revés. Revisar el desplazamiento lateral.',
  [A.contacted]: 'Primera llamada hecha. Interesado en una prueba presencial.',
  [A.discarded]: 'No encaja con el calendario de la temporada.',
}

export function buildExpoApplications({ orgId, reviewer, application }) {
  return POSTULANTES.map(([fullName, birthDate, city, dominantHand, backhand, utr, status, sentOn], i) => {
    const usuario = fullName.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').trim().replace(/ +/g, '.')
    return application(`app-expo-${i + 1}`, orgId, {
      status, fullName, birthDate, city, dominantHand, backhand, utr, sentOn,
      email: `${usuario}@ejemplo.test`, academy: 'Circuito ATP',
      videoLinks: i % 3 === 2 ? [] : [`https://www.youtube.com/watch?v=demo-${i + 1}`],
      message: MENSAJES[i % MENSAJES.length],
      reviewedBy: status === A.new ? null : reviewer,
      internalNotes: NOTAS[status] ?? '',
    })
  })
}
