// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { getDocsFromServer } from 'firebase/firestore'
import AdminAudit from './AdminAudit.jsx'

vi.mock('../../lib/firebase.js', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  collection: (_db, name) => name,
  orderBy: (...parts) => parts,
  limit: size => size,
  query: (...parts) => parts,
  getDocsFromServer: vi.fn(),
}))

afterEach(cleanup)

it('consulta los registros recientes y muestra el cambio sin repetir campos iguales', async () => {
  getDocsFromServer.mockResolvedValue({ docs: [{
    id: 'audit-1',
    data: () => ({
      actorId: 'operador-1', entity: 'orgs', targetId: 'org-1',
      before: { name: 'Club Ejemplo', plan: 'basico' },
      after: { name: 'Club Ejemplo', plan: 'pro' },
    }),
  }] })
  render(<AdminAudit />)
  expect(await screen.findByRole('table', { name: 'Últimos 100 cambios administrativos' })).toBeTruthy()
  expect(getDocsFromServer).toHaveBeenCalledWith(['platformAudit', ['createdAt', 'desc'], 100])
  expect(screen.getByText('operador-1')).toBeTruthy()
  expect(screen.getByText('basico → pro')).toBeTruthy()
  expect(screen.queryByText('Club Ejemplo')).toBeNull()
})
