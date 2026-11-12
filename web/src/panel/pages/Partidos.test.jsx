// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { collection, doc, getDoc, getDocFromServer, onSnapshot, query, runTransaction, where } from 'firebase/firestore'
import Partidos from './Partidos.jsx'
import { CLAVE_UNIDADES, guardarUnidades } from '../lib/unidades.js'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), getDocFromServer: vi.fn(), onSnapshot: vi.fn(), query: vi.fn(),
  runTransaction: vi.fn(), serverTimestamp: vi.fn(), where: vi.fn(),
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
  getDocFromServer.mockResolvedValue({ exists: () => false })
  getDoc.mockResolvedValue({ data: () => ({ name: 'Club de prueba' }) })
})
afterEach(() => {
  cleanup()
  localStorage.removeItem(CLAVE_UNIDADES)
})

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

it('abre el reporte con el contrato del worker y mantiene los filtros al volver', async () => {
  const player = record('p-a', { fullName: 'Valeria Torres' })
  const fields = { playerId: 'p-a', matchDate: '2026-10-23', status: 'listo', tournament: 'Copa', result: '6-4' }
  const matches = [
    record('m-ready', {
      ...fields,
      opponent: 'Rival de prueba',
      statistics: {
        schemaVersion: 'acecam.match-stats.v1',
        player: { shots: { count: 2, sumSpeedKmh: 100, maxSpeedKmh: 70 },
          movement: { distanceMeters: 31, avgSpeedKmh: 3, maxSpeedKmh: 10 },
          serve: { count: 1, sampleCount: 1, sumSpeedKmh: 100, firstServeAttempts: 2, firstServeIn: 1, doubleFaults: 0 } },
        rallies: { count: 2, sumShots: 10, longestShots: 7 },
        score: { sets: [{ playerGames: 6, opponentGames: 0 }, { playerGames: 4, opponentGames: 6 }] },
      },
    }),
    record('m-partial', {
      ...fields,
      opponent: 'Rival con medición parcial',
      statistics: { schemaVersion: 'acecam.match-stats.v1', player: { movement: { distanceMeters: 42 }, serve: { doubleFaults: 0 } } },
    }),
    record('m-unknown', { ...fields, opponent: 'Rival sin medición', statistics: { schemaVersion: 'anterior' } }),
  ]
  onSnapshot.mockImplementation((name, receive) => {
    receive({ docs: name === 'players' ? [player] : matches })
    return stop
  })
  const user = userEvent.setup()
  const { rerender } = render(<Partidos db={db} session={session} />)
  await user.selectOptions(await screen.findByLabelText('Jugador'), 'p-a')
  fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-23' } })
  await user.click(screen.getByRole('button', { name: /Ver reporte del partido con Rival de prueba/ }))
  const title = screen.getByRole('heading', { name: 'Valeria Torres · Rival de prueba' })
  expect(document.activeElement).toBe(title)
  const report = within(screen.getByRole('region', { name: title.textContent.trim() }))
  const card = label => within(report.getByRole('heading', { name: label }).closest('article'))
  expect(card('Golpes medidos').getByText('2')).toBeTruthy()
  expect(card('Velocidad media de golpe').getByText('50')).toBeTruthy()
  expect(card('Velocidad máxima de golpe').getByText('70')).toBeTruthy()
  expect(card('Distancia recorrida').getByText('31')).toBeTruthy()
  expect(card('Velocidad media de saque').getByText('100')).toBeTruthy()
  expect(card('Primer saque dentro').getByText('50')).toBeTruthy()
  expect(card('Dobles faltas').getByText('0')).toBeTruthy()
  expect(card('Golpes por peloteo').getByText('5')).toBeTruthy()
  act(() => guardarUnidades('mph'))
  expect(card('Velocidad máxima de golpe').getByText(/43[.,]5/)).toBeTruthy()
  expect(report.getByText('Video procesado no disponible.')).toBeTruthy()
  const sets = within(report.getByRole('table', { name: 'Desglose por set' }))
  expect(sets.getAllByRole('row').map(row => Array.from(row.cells, cell => cell.textContent))).toEqual([
    ['Set', 'Jugador', 'Rival'], ['1', '6', '0'], ['2', '4', '6'],
  ])
  await user.click(report.getByRole('button', { name: 'Volver al listado' }))
  expect(screen.getByLabelText('Jugador').value).toBe('p-a')
  expect(screen.getByLabelText('Desde').value).toBe('2026-10-23')
  expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Historial de partidos' }))
  await user.click(screen.getByRole('button', { name: /Ver reporte del partido con Rival con medición parcial/ }))
  const partial = within(screen.getByRole('region', { name: 'Indicadores del jugador' }))
  expect(partial.getAllByRole('article')).toHaveLength(2)
  expect(partial.getByText('42')).toBeTruthy()
  expect(partial.getByText('0')).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'Peloteos del partido' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Volver al listado' }))
  await user.click(screen.getByRole('button', { name: /Ver reporte del partido con Rival sin medición/ }))
  expect(screen.getByText('Sin datos del desglose por set.')).toBeTruthy()
  const empty = within(screen.getByRole('region', { name: 'Indicadores del jugador' }))
  expect(empty.getByText('Sin datos de estadísticas.')).toBeTruthy()
  expect(empty.queryByRole('article')).toBeNull()
  expect(onSnapshot).toHaveBeenCalledTimes(2)
  rerender(<Partidos db={db} />)
  expect(screen.queryByText(/Rival sin medición/)).toBeNull()
})

it('conserva el borrador si falla el guardado y confirma la nota escrita', async () => {
  onSnapshot.mockImplementation((name, receive) => {
    receive({ docs: name === 'players' ? [] : [record('m-1', { status: 'listo', opponent: 'Rival' })] })
    return stop
  })
  const set = vi.fn()
  runTransaction.mockRejectedValueOnce({ code: 'unavailable' })
    .mockImplementationOnce((_, action) => action({ get: async () => ({ exists: () => false }), set }))

  const user = userEvent.setup()
  render(<Partidos db={db} session={session} />)
  await user.click(await screen.findByRole('button', { name: /Ver reporte del partido con Rival/ }))
  const note = await screen.findByLabelText('Tu nota')
  await user.type(note, 'Practicar devolución')
  const save = screen.getByRole('button', { name: 'Guardar nota' })
  await user.click(save)
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(note.value).toBe('Practicar devolución')
  await user.click(save)
  expect(await screen.findByText('Nota guardada.')).toBeTruthy()
  expect(doc).toHaveBeenCalledWith(db, 'matches', 'm-1', 'coachNotes', session.uid)
  expect(set.mock.calls[0][1].text).toBe('Practicar devolución')
  expect(save.disabled).toBe(true)
})
