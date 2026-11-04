// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { collection, getDoc, onSnapshot, query } from 'firebase/firestore'
import userEvent from '@testing-library/user-event'
import Dashboard from './Dashboard.jsx'
import { buildDashboardOverview } from '../lib/dashboardOverview.js'
import { createDemoPlayersService } from '../previews/demoPlayersService.js'

afterEach(cleanup)

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
  expect(screen.getByText('Todavía no hay velocidades de saque disponibles')).toBeTruthy()
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
