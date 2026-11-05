// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { collection, getDoc, onSnapshot, query } from 'firebase/firestore'
import userEvent from '@testing-library/user-event'
import Dashboard from './Dashboard.jsx'
import { buildDashboardOverview } from '../lib/dashboardOverview.js'
import { CLAVE_UNIDADES, guardarUnidades } from '../lib/unidades.js'
import { createDemoPlayersService } from '../previews/demoPlayersService.js'

afterEach(() => {
  cleanup()
  localStorage.removeItem(CLAVE_UNIDADES)
  vi.useRealTimers()
})

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), onSnapshot: vi.fn(),
  query: vi.fn(), where: vi.fn(), addDoc: vi.fn(), serverTimestamp: vi.fn(),
}))

it('muestra en la ruta autenticada la salida de PCIT-35 sin inventar datos de saque', async () => {
  const orgId = 'org-a'
  const playerId = 'p1'
  const records = {
    players: { orgId, fullName: 'Jugador del equipo' },
    matches: {
      orgId, playerId, status: 'listo', matchDate: '2026-01-01', playerPosition: 'abajo',
      statistics: {
        schemaVersion: 'acecam.match-stats.v1', durationSeconds: 4,
        player: { shots: { count: 1, sumSpeedKmh: 62.5, maxSpeedKmh: 62.5 } },
        opponent: { shots: { count: 2, sumSpeedKmh: 175, maxSpeedKmh: 95 } },
      },
    },
  }
  const stop = vi.fn()
  collection.mockImplementation((_, name) => name)
  query.mockImplementation(name => name)
  getDoc.mockResolvedValue({ exists: () => true, data: () => records.players })
  onSnapshot.mockImplementation((name, receive) => {
    receive({ docs: [{ id: name === 'players' ? playerId : 'm1', data: () => records[name] }] })
    return stop
  })
  const db = { app: { options: { projectId: 'prueba' } } }
  const { rerender } = render(<Dashboard db={db} session={{ uid: 'coach-a', orgId }} />)
  await screen.findByRole('option', { name: 'Jugador del equipo' })
  await userEvent.setup().selectOptions(screen.getByLabelText('Jugador'), playerId)
  const card = async label => within((await screen.findByRole('heading', { name: label, exact: true })).closest('article'))
  expect((await card('Golpes medidos')).getByText('1')).toBeTruthy()
  expect((await card('Velocidad media de golpe')).getByText(/62[.,]5/)).toBeTruthy()
  expect((await card('Velocidad media de saque')).getByText('Sin datos')).toBeTruthy()
  const evolution = within(screen.getByRole('region', { name: 'Evolución del jugador' }))
  expect(evolution.getByRole('figure', { name: 'Velocidad media de golpe km/h' })).toBeTruthy()
  expect(evolution.getByText('Solo hay una medición disponible;', { exact: false })).toBeTruthy()
  await userEvent.setup().click(evolution.getByText('Ver datos del gráfico'))
  expect(within(evolution.getByRole('table', { name: 'Velocidades de golpe por partido' })).getByText(/62[.,]5 km\/h/)).toBeTruthy()
  rerender(<Dashboard db={db} />)
  expect(stop).toHaveBeenCalledTimes(2)
  expect(screen.queryByText('Jugador del equipo')).toBeNull()
})

it('avisa de resultados incompatibles y no los convierte en estadísticas de saque', async () => {
  const playersService = createDemoPlayersService()
  const overviewService = {
    scopeKey: playersService.scopeKey, mode: 'demo',
    subscribePlayer(playerId, receive) {
      receive(buildDashboardOverview([{ id: 'legacy', orgId: 'demo-org', playerId, status: 'listo', statistics: { player_1_average_shot_speed: 160 } }], { orgId: 'demo-org', playerId, decodeStatistics: row => row.statistics }))
      return () => {}
    },
  }
  render(<Dashboard playersService={playersService} overviewService={overviewService} />)
  await screen.findByRole('option', { name: 'Valeria Torres' })
  await userEvent.setup().selectOptions(screen.getByLabelText('Jugador'), 'example-1')
  expect(await screen.findByText('Algunos análisis terminados aún no tienen indicadores disponibles. El resumen incluye únicamente los resultados verificables.')).toBeTruthy()
  expect(screen.getByText('Todavía no hay estadísticas para este jugador')).toBeTruthy()
  expect(screen.queryByText('160')).toBeNull()
  expect(screen.getAllByText('Sin datos')).toHaveLength(3)
})

it('recalcula indicadores y evolución del mismo snapshot al cambiar de periodo', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 7, 31, 12))
  const orgId = 'org-a'
  const playerId = 'p1'
  const player = { orgId, fullName: 'Jugador de periodos' }
  const match = (matchDate, speed, overrides = {}) => ({
    id: `m-${speed}`,
    data: () => ({
      orgId, playerId, status: 'listo', matchDate, playerPosition: 'abajo', opponent: `Rival ${speed}`,
      statistics: {
        schemaVersion: 'acecam.match-stats.v1', durationSeconds: 4,
        player: { shots: { count: 1, sumSpeedKmh: speed, maxSpeedKmh: speed } },
        opponent: { shots: { count: 1, sumSpeedKmh: speed, maxSpeedKmh: speed } },
      },
      ...overrides,
    }),
  })
  const dates = [match('2026-02-27', 110), match('2026-02-28', 90), match('2026-05-31', 60),
    match('2026-07-31', 40), match('2026-08-31', 20, { tournament: 'Copa Demo', result: '6-4 6-2' }), match(undefined, 200),
    match('2026-08-31', 900, { status: 'procesando' }),
    match('2026-08-31', 901, { orgId: 'org-b' }),
    match('2026-08-31', 902, { playerId: 'another-player' })]
  let publish
  collection.mockImplementation((_, name) => name)
  query.mockImplementation(name => name)
  getDoc.mockResolvedValue({ exists: () => true, data: () => player })
  onSnapshot.mockClear().mockImplementation((name, receive) => {
    if (name === 'matches') publish = receive
    receive({ docs: name === 'players' ? [{ id: playerId, data: () => player }] : dates })
    return () => {}
  })

  const user = userEvent.setup()
  render(<Dashboard db={{ app: { options: { projectId: 'prueba' } } }} session={{ uid: 'coach-a', orgId }} />)
  await screen.findByRole('option', { name: player.fullName })
  await user.selectOptions(screen.getByLabelText('Jugador'), playerId)
  const kpi = name => within(screen.getByRole('heading', { name, exact: true }).closest('article'))
  await screen.findByRole('heading', { name: 'Partidos analizados', exact: true })
  expect(kpi('Partidos analizados').getByText('6')).toBeTruthy()
  const latest = () => within(screen.getByRole('region', { name: 'Último partido' }))
  expect(latest().getByText('31/08/2026')).toBeTruthy()
  expect(latest().getByText('Rival · Rival 20')).toBeTruthy()
  expect(latest().getByText('Copa Demo')).toBeTruthy()
  expect(latest().getByText('6-4 6-2')).toBeTruthy()
  expect(latest().getByText('20 km/h')).toBeTruthy()
  act(() => guardarUnidades('mph'))
  expect(latest().getByText(/12[.,]4 mph/)).toBeTruthy()
  act(() => guardarUnidades('kmh'))

  const period = screen.getByLabelText('Periodo')
  await user.selectOptions(period, '1')
  expect(kpi('Partidos analizados').getByText('2')).toBeTruthy()
  expect(kpi('Velocidad media de golpe').getByText('30')).toBeTruthy()
  expect(kpi('Velocidad media de saque').getByText('Sin datos')).toBeTruthy()
  const evolution = within(screen.getByRole('region', { name: 'Evolución del jugador' }))
  await user.click(evolution.getByText('Ver datos del gráfico'))
  const graphRows = within(evolution.getByRole('table', { name: 'Velocidades de golpe por partido' }))
  expect(graphRows.getAllByRole('row')).toHaveLength(3)
  expect(graphRows.getByText('Rival 40')).toBeTruthy()
  expect(graphRows.queryByText('Rival 60')).toBeNull()

  await user.selectOptions(period, '3')
  expect(kpi('Partidos analizados').getByText('3')).toBeTruthy()
  await user.selectOptions(period, '6')
  expect(kpi('Partidos analizados').getByText('4')).toBeTruthy()
  act(() => publish({ docs: [dates[0], dates[5]] }))
  expect(screen.getByText('No hay estadísticas en este periodo')).toBeTruthy()
  expect(screen.getByText('No hay partidos analizados en este periodo')).toBeTruthy()
  await user.selectOptions(period, 'all')
  expect(kpi('Partidos analizados').getByText('2')).toBeTruthy()
  expect(latest().getByText('Rival · Rival 110')).toBeTruthy()
  expect(latest().getAllByText('Sin datos')).toHaveLength(2)
  expect(onSnapshot).toHaveBeenCalledTimes(2)
})
