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
  localStorage.removeItem(CLAVE_UNIDADES)
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
