import { MATCH_STATUS as M } from '../src/panel/lib/schema.js'

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
  return { players, matches }
}
