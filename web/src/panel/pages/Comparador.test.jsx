// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import Comparador from './Comparador.jsx'
import { CLAVE_UNIDADES, guardarUnidades } from '../lib/unidades.js'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), onSnapshot: vi.fn(), query: vi.fn(), where: vi.fn(),
}))

const db = { app: { options: { projectId: 'prueba' } } }
const session = { uid: 'coach-a', orgId: 'org-a', role: 'coach' }
const players = ['Ana', 'Bruno', 'Camila', 'Diego'].map(fullName => ({
  id: fullName, fullName, orgId: session.orgId, createdBy: session.uid,
}))
const record = (id, fields) => ({ id, data: () => fields })

beforeEach(() => {
  vi.resetAllMocks()
  collection.mockImplementation((_, name) => name)
  doc.mockImplementation((_, _name, id) => id)
  query.mockImplementation((name, ...filters) => ({ name, filters }))
  where.mockImplementation((field, op, value) => [field, op, value])
  getDoc.mockImplementation(async id => ({ exists: () => true, data: () => players.find(player => player.id === id) }))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  localStorage.removeItem(CLAVE_UNIDADES)
})

it('compara periodos y partidos del mismo jugador sin volver a consultar', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 7, 31, 12))
  const match = (id, matchDate, speed, fields = {}) => record(id, {
    ...readyMatch('Ana', speed).data(), matchDate, opponent: id, ...fields,
  })
  const history = [
    match('Actual primero', '2026-05-31', 50),
    match('Actual último', '2026-08-31', 70),
    match('Previo', '2026-02-28', 40),
    match('Hace seis', '2026-02-27', 30),
    match('Hace nueve', '2025-10-15', 20),
    match('Sin medición', '2026-02-01', 90, { statistics: null }),
    match('Ajeno', '2026-08-31', 250, { createdBy: 'coach-b' }),
    match('En proceso', '2026-08-31', 250, { status: 'procesando' }),
  ]
  const stop = vi.fn()
  onSnapshot.mockImplementation(({ name }, receive) => {
    receive({ docs: name === 'players' ? [record('Ana', players[0])] : history })
    return stop
  })

  const user = userEvent.setup()
  const { rerender } = render(<Comparador db={db} session={session} />)
  await user.click(await screen.findByRole('radio', { name: 'Por periodos', exact: true }))
  await user.selectOptions(screen.getByLabelText('Jugador', { exact: true }), 'Ana')
  const periods = await screen.findByRole('table', { name: 'Comparación por periodos' })
  const speedRow = table => within(within(table).getByText('Velocidad media de golpe').closest('tr'))
  expect(speedRow(periods).getByText('60 km/h')).toBeTruthy()
  expect(speedRow(periods).getByText('40 km/h')).toBeTruthy()
  const offset = screen.getByLabelText('Comparar el periodo actual con')
  await user.selectOptions(offset, '6')
  expect(speedRow(periods).getByText('30 km/h')).toBeTruthy()
  await user.selectOptions(offset, '9')
  expect(speedRow(periods).getByText('20 km/h')).toBeTruthy()

  await user.click(screen.getByRole('radio', { name: 'Partido contra partido', exact: true }))
  const first = screen.getByLabelText('Partido 1')
  const second = screen.getByLabelText('Partido 2')
  expect(within(first).queryByRole('option', { name: /Ajeno|En proceso/ })).toBeNull()
  await user.selectOptions(first, 'Actual último')
  expect(within(second).getByRole('option', { name: /Actual último/ }).disabled).toBe(true)
  await user.selectOptions(second, 'Sin medición')
  const matches = screen.getByRole('table', { name: 'Comparación de partidos' })
  expect(speedRow(matches).getByText('70 km/h')).toBeTruthy()
  expect(speedRow(matches).getByText('Sin datos')).toBeTruthy()
  expect(speedRow(matches).queryByText('Mejor valor')).toBeNull()
  expect(onSnapshot).toHaveBeenCalledTimes(2)
  rerender(<Comparador db={db} />)
  expect(screen.queryByRole('table')).toBeNull()
  expect(stop).toHaveBeenCalledTimes(2)
})

function readyMatch(playerId, speed) {
  return record(`match-${playerId}`, {
    orgId: session.orgId, createdBy: session.uid, playerId, status: 'listo', matchDate: '2026-10-25',
    statistics: {
      schemaVersion: 'acecam.match-stats.v1',
      player: { shots: { count: 1, sumSpeedKmh: speed, maxSpeedKmh: speed } },
    },
  })
}

it('compara de dos a cuatro jugadores distintos, resalta el valor y muestra empates', async () => {
  const speeds = { Ana: 50, Bruno: 70, Camila: 70 }
  const stop = vi.fn()
  onSnapshot.mockImplementation(({ name, filters }, receive) => {
    const playerId = filters.find(([field]) => field === 'playerId')?.[2]
    const docs = name === 'players' ? players.map(player => record(player.id, player))
      : speeds[playerId] ? [readyMatch(playerId, speeds[playerId])] : []
    receive({ docs })
    return stop
  })
  const user = userEvent.setup()
  const { rerender } = render(<Comparador db={db} session={session} />)
  const first = await screen.findByLabelText('Jugador 1')
  await user.selectOptions(first, 'Ana')
  expect(screen.getByText('Selecciona al menos dos jugadores')).toBeTruthy()
  expect(within(screen.getByLabelText('Jugador 2')).getByRole('option', { name: 'Ana' }).disabled).toBe(true)
  await user.selectOptions(screen.getByLabelText('Jugador 2'), 'Bruno')
  const metricRow = label => within(screen.getByText(label).closest('tr'))
  const speed = () => metricRow('Velocidad media de golpe')
  await waitFor(() => expect(speed().getByText('Mejor valor')).toBeTruthy())
  expect(speed().getByText('70 km/h').closest('td')).toBe(speed().getByText('Mejor valor').closest('td'))

  await user.click(screen.getByRole('button', { name: 'Añadir jugador' }))
  await user.selectOptions(screen.getByLabelText('Jugador 3'), 'Camila')
  await waitFor(() => expect(speed().getAllByText('Empate')).toHaveLength(2))
  await user.click(screen.getByRole('button', { name: 'Añadir jugador' }))
  await user.selectOptions(screen.getByLabelText('Jugador 4'), 'Diego')
  expect(screen.getByRole('button', { name: 'Añadir jugador' }).disabled).toBe(true)
  await waitFor(() => expect(speed().getByText('Sin datos')).toBeTruthy())
  expect(metricRow('Velocidad media de saque').getAllByText('Sin datos')).toHaveLength(4)
  act(() => guardarUnidades('mph'))
  expect(speed().getAllByText(/43[.,]5 mph/)).toHaveLength(2)
  expect(where).toHaveBeenCalledWith('createdBy', '==', session.uid)

  await user.click(screen.getByRole('button', { name: 'Quitar columna 4' }))
  await user.click(screen.getByRole('button', { name: 'Quitar columna 3' }))
  expect(screen.queryByRole('button', { name: /Quitar columna/ })).toBeNull()
  rerender(<Comparador db={db} />)
  expect(screen.queryByRole('table')).toBeNull()
  expect(screen.getByText('El comparador aún no está disponible')).toBeTruthy()
  expect(stop).toHaveBeenCalledTimes(5)
})
