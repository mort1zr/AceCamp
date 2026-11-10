// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDoc, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore'
import { afterEach, expect, it, vi } from 'vitest'
import EnlacesPostulacion from './EnlacesPostulacion.jsx'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_, ...parts) => parts.join('/')),
  doc: vi.fn((...parts) => parts.slice(parts.length === 3 ? 1 : 0).join('/')),
  onSnapshot: vi.fn(() => vi.fn()),
  getDoc: vi.fn(),
  addDoc: vi.fn(async () => ({})),
  deleteDoc: vi.fn(async () => {}),
  serverTimestamp: vi.fn(() => 'server-time'),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('el dueño puede crear, compartir y desactivar enlaces', async () => {
  const user = userEvent.setup()
  getDoc.mockResolvedValueOnce({ data: () => ({ ownerId: 'owner' }) })
  render(<EnlacesPostulacion db={{}} orgId="org-demo" uid="owner" role="coach" />)
  const create = await screen.findByRole('button', { name: 'Crear enlace' })
  const [collection, receive] = onSnapshot.mock.lastCall
  expect(collection).toBe('orgs/org-demo/applicationForms')
  act(() => receive({ docs: [] }))
  await user.click(create)
  expect(addDoc).toHaveBeenCalledExactlyOnceWith(collection, { createdAt: 'server-time' })
  const id = 'AcecamFormDemoABC123'
  act(() => receive({ docs: [{ id }] }))
  expect(screen.getByRole('link').getAttribute('href')).toBe(`${window.location.origin}/postular/org-demo/${id}`)
  await user.click(screen.getByRole('button', { name: 'Desactivar' }))
  expect(deleteDoc).toHaveBeenCalledExactlyOnceWith(`${collection}/${id}`)
})
