// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import Partidos from './Partidos.jsx'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), onSnapshot: vi.fn(), query: vi.fn(), where: vi.fn(),
}))

const db = { app: { options: { projectId: 'prueba' } } }
const session = { uid: 'coach-a', orgId: 'org-a', role: 'coach' }
const stop = vi.fn()
const record = (id, fields) => ({
  id, data: () => ({ orgId: session.orgId, createdBy: session.uid, ...fields }),
})

beforeEach(() => {
  vi.resetAllMocks()
  collection.mockImplementation((_, name) => name)
  query.mockImplementation(name => name)
})
afterEach(cleanup)

it('muestra partidos listos, filtra ambos extremos y conserva la consulta de sesión', async () => {
  const players = [record('p-a', { fullName: 'Valeria Torres' }), record('p-b', { fullName: 'Mateo Ríos' })]
  const match = (id, playerId, matchDate, opponent, overrides = {}) =>
    record(id, { playerId, matchDate, opponent, status: 'listo', ...overrides })
  const matches = [
    match('old', 'p-a', '2026-09-01', 'Rival anterior'),
    match('pending', 'p-a', '2026-10-23', 'Pendiente', { status: 'en cola' }),
    match('ready', 'p-a', '2026-10-23', 'Rival de octubre', { tournament: 'Copa', result: '6-4' }),
    match('same-date', 'p-b', '2026-10-23', 'Rival de Mateo'),
    match('teammate', 'p-a', '2026-10-30', 'Rival ajeno', { createdBy: 'coach-b' }),
    match('other-org', 'p-a', '2026-10-30', 'Otra organización', { orgId: 'org-b' }),
  ]
  onSnapshot.mockImplementation((name, receive) => {
    receive({ docs: name === 'players' ? players : matches })
    return stop
  })
  const user = userEvent.setup()
  render(<Partidos db={db} session={session} />)
  const table = await screen.findByRole('table', { name: 'Partidos analizados' })
  const rows = () => within(table).getAllByRole('row').slice(1)
  expect(rows()).toHaveLength(3)
  expect(within(rows()[0]).getByText('Rival de octubre')).toBeTruthy()
  expect(within(rows()[0]).getByText('6-4')).toBeTruthy()
  expect(where.mock.calls).toContainEqual(['status', '==', 'listo'])
  expect(where.mock.calls.filter(([field]) => field === 'createdBy')).toEqual([
    ['createdBy', '==', session.uid], ['createdBy', '==', session.uid],
  ])

  await user.selectOptions(screen.getByLabelText('Jugador'), 'p-a')
  fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-23' } })
  fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-23' } })
  expect(rows()).toHaveLength(1)
  expect(within(rows()[0]).getByText('23/10/2026')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-09-30' } })
  expect(screen.getByRole('alert').textContent).toMatch(/fecha inicial/)
  expect(screen.queryByRole('table')).toBeNull()
  fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09-02' } })
  expect(screen.getByText('No hay partidos con esos filtros')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
  expect(screen.getByText('3 partidos')).toBeTruthy()
  expect(onSnapshot).toHaveBeenCalledTimes(2)
})

it('permite reintentar y descarta resultados de una sesión anterior', async () => {
  let publish
  let shouldFail = true
  onSnapshot.mockImplementation((name, receive, fail) => {
    if (name === 'players') receive({ docs: [] })
    else {
      publish = receive
      if (shouldFail) fail({ code: 'unavailable' })
    }
    return stop
  })
  const { rerender } = render(<Partidos db={db} session={session} />)
  expect(await screen.findByRole('alert')).toBeTruthy()
  shouldFail = false
  await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
  act(() => publish({ docs: [record('old', { status: 'listo', opponent: 'Dato privado' })] }))
  expect(screen.getByText('Dato privado')).toBeTruthy()
  rerender(<Partidos db={db} />)
  act(() => publish({ docs: [record('late', { status: 'listo', opponent: 'Dato tardío' })] }))
  expect(screen.getByText('Los partidos aún no están disponibles')).toBeTruthy()
  expect(screen.queryByText('Dato privado')).toBeNull()
  expect(screen.queryByText('Dato tardío')).toBeNull()
  expect(stop).toHaveBeenCalledTimes(3)
})
