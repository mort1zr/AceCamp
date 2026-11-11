import { describe, expect, it } from 'vitest'
import { construirInicio } from './inicio.js'

const ahora = new Date('2026-11-11T15:00:00Z')
const dia = (iso) => new Date(`${iso}T15:00:00Z`)
const stats = (saque, primeros) => ({
  schemaVersion: 'acecam.match-stats.v1',
  player: {
    shots: { count: 100, sumSpeedKmh: 10000 },
    serve: {
      sampleCount: 10,
      sumSpeedKmh: saque * 10,
      firstServeAttempts: 100,
      firstServeIn: primeros,
      doubleFaults: 2,
    },
  },
})
const partido = (id, campos) => ({
  id,
  orgId: 'org',
  playerId: 'p1',
  opponent: 'Rival',
  matchDate: '2026-11-01',
  createdAt: dia('2026-11-01'),
  ...campos,
})
const jugadores = [
  { id: 'p1', fullName: 'Ana Ruiz', category: 'Sub-16', utr: 8.5 },
  { id: 'p2', fullName: 'Beto Paz', category: null, utr: null },
  { id: 'p3', fullName: 'Borrado', deletedAt: dia('2026-10-01') },
]

describe('construirInicio', () => {
  it('resume jugadores, partidos y postulaciones reales', () => {
    const data = construirInicio({
      coachName: 'Coach Ruiz',
      ahora,
      players: jugadores,
      matches: [
        partido('m1', {
          status: 'listo',
          finishedAt: dia('2026-11-09'),
          result: '6-4 6-3',
          statistics: stats(150, 60),
        }),
        partido('m2', { status: 'procesando', createdAt: dia('2026-11-10') }),
        partido('m3', { status: 'en cola', playerId: 'p2', createdAt: dia('2026-11-11') }),
      ],
      applications: [
        {
          id: 'a1',
          fullName: 'Leo',
          status: 'nueva',
          birthDate: '2009-01-01',
          createdAt: dia('2026-11-02'),
        },
        { id: 'a2', fullName: 'Sol', status: 'en revisión', createdAt: dia('2026-11-05') },
      ],
    })
    expect(data.coachName).toBe('Coach Ruiz')
    expect(data.summary).toEqual({
      trackedPlayers: 2,
      playersAnalyzedThisWeek: 1,
      analyzedMatchesThisMonth: 1,
      newApplications: 1,
      applicationsInReview: 1,
      processing: 2,
      readyToReview: 1,
    })
    expect(data.applications.map((fila) => fila.id)).toEqual(['a2', 'a1'])
    expect(data.applications[1].age).toBe(17)
    expect(data.queue.map((fila) => [fila.title, fila.progress])).toEqual([
      ['Beto Paz vs. Rival', 0],
      ['Ana Ruiz vs. Rival', null],
    ])
    expect(data.recentMatches).toEqual([
      {
        id: 'm1',
        player: 'Ana Ruiz',
        opponent: 'Rival',
        tournament: '',
        date: '2026-11-01',
        score: '6-4 6-3',
      },
    ])
    expect(data.tracked[0]).toMatchObject({
      id: 'p1',
      kpi: { tipo: 'saque', valor: 150, anterior: null },
    })
    expect(data.tracked[1]).toMatchObject({ id: 'p2', kpi: { tipo: 'partidos', valor: 0 } })
  })

  it('avisa cuando el último partido sube o baja frente a los anteriores', () => {
    const { alerts } = construirInicio({
      ahora,
      players: jugadores,
      matches: [
        partido('m1', {
          status: 'listo',
          finishedAt: dia('2026-10-20'),
          statistics: stats(140, 70),
        }),
        partido('m2', {
          status: 'listo',
          finishedAt: dia('2026-11-08'),
          statistics: stats(150, 60),
        }),
      ],
    })
    expect(
      alerts.map((alerta) => [alerta.metric, alerta.type, alerta.latest, alerta.previous]),
    ).toEqual([
      ['saque', 'up', 150, 140],
      ['primeros', 'down', 60, 70],
    ])
  })

  it('no avisa por cambios pequeños ni por partidos de hace más de un mes', () => {
    const { alerts } = construirInicio({
      ahora,
      players: jugadores,
      matches: [
        partido('m1', {
          status: 'listo',
          finishedAt: dia('2026-09-01'),
          statistics: stats(120, 40),
        }),
        partido('m2', {
          status: 'listo',
          finishedAt: dia('2026-09-20'),
          statistics: stats(150, 70),
        }),
      ],
    })
    expect(alerts).toEqual([])
  })

  it('muestra los análisis fallidos de la última semana en la cola y en alertas', () => {
    const data = construirInicio({
      ahora,
      players: jugadores,
      matches: [
        partido('m1', {
          status: 'error',
          finishedAt: dia('2026-11-10'),
          errorMessage: 'Video borroso',
        }),
        partido('m2', { status: 'error', finishedAt: dia('2026-10-01') }),
      ],
    })
    expect(data.queue.map((fila) => [fila.id, fila.progress])).toEqual([['m1', 100]])
    expect(data.alerts).toMatchObject([
      { type: 'error', player: 'Ana Ruiz', message: 'Video borroso' },
    ])
    expect(data.summary.processing).toBe(0)
  })
})
