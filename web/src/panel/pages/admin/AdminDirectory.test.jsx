// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getDocFromServer, getDocsFromServer } from 'firebase/firestore'
import { afterEach, expect, it, vi } from 'vitest'
import { usagePeriod } from '../../lib/usage.js'
import AdminDirectory from './AdminDirectory.jsx'

vi.mock('../../lib/firebase.js', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: (_db, name) => name,
  doc: (_db, ...parts) => parts.join('/'),
  getDocFromServer: vi.fn(),
  getDocsFromServer: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

const record = (id, fields) => ({ id, data: () => fields, exists: () => fields !== undefined })

it('muestra miembros, uso mensual y altas a partir de lecturas de Firestore', async () => {
  getDocsFromServer.mockImplementation(async name => ({ docs: name === 'orgs'
    ? [record('club', { name: 'Club', plan: 'pro' }), record('equipo', { name: 'Equipo', plan: 'ultra' })]
    : [
        record('coach', { email: 'coach@example.test', orgId: 'equipo', role: 'coach', createdAt: { toDate: () => new Date('2026-11-01') } }),
        record('admin', { email: 'admin@example.test', orgId: 'equipo', role: 'admin' }),
      ] }))
  const period = usagePeriod()
  getDocFromServer.mockImplementation(async path => record(period, path.startsWith('orgs/equipo/') ? { analyses: 7 } : undefined))
  render(<AdminDirectory />)
  const organizations = await screen.findByRole('table', { name: 'Organizaciones' })
  const users = screen.getByRole('table', { name: 'Usuarios' })
  const cells = table => within(table).getAllByRole('row').slice(1).map(row => Array.from(row.cells, cell => cell.textContent))

  expect(getDocFromServer.mock.calls).toEqual([[`orgs/club/usage/${period}`], [`orgs/equipo/usage/${period}`]])
  expect(cells(organizations)).toEqual([['Club', 'Pro', '0', '0'], ['Equipo', 'Ultra', '2', '7']])
  const date = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date('2026-11-01'))
  expect(cells(users)).toEqual([
    ['admin@example.test', 'Equipo', 'Administrador de equipo', '—'],
    ['coach@example.test', 'Equipo', 'Entrenador', date],
  ])
  expect(screen.queryByRole('button')).toBeNull()
})

it('permite reintentar una consulta fallida y muestra un directorio vacío', async () => {
  getDocsFromServer.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue({ docs: [] })
  render(<AdminDirectory />)
  expect(await screen.findByText('No pudimos cargar los datos de administración.')).toBeTruthy()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findAllByText('Todavía no hay registros')).toHaveLength(2)
  expect(getDocFromServer).not.toHaveBeenCalled()
})
