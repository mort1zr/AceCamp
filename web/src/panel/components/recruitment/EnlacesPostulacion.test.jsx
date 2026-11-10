// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
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
  await waitFor(() => expect(onSnapshot).toHaveBeenCalledWith(
    'orgs/org-demo/applicationForms', expect.any(Function), expect.any(Function),
  ))
  const [collection, receive] = onSnapshot.mock.lastCall
  act(() => receive({ docs: [] }))
  await user.click(create)
  expect(addDoc).toHaveBeenCalledExactlyOnceWith(collection, { createdAt: 'server-time' })
  const id = 'AcecamFormDemoABC123'
  act(() => receive({ docs: [{ id }] }))
  expect(screen.getByRole('link').getAttribute('href')).toBe(`${window.location.origin}/postular/org-demo/${id}`)
  await user.click(screen.getByRole('button', { name: 'Desactivar' }))
  expect(deleteDoc).toHaveBeenCalledExactlyOnceWith(`${collection}/${id}`)
})

it('copia el enlace con un clic y avisa si el navegador no lo permite (PCIT-184)', async () => {
  const user = userEvent.setup()
  const writeText = vi.fn().mockResolvedValueOnce().mockRejectedValueOnce(new Error('denied'))
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  render(<EnlacesPostulacion db={{}} orgId="org-demo" uid="admin-1" role="admin" />)
  await waitFor(() => expect(onSnapshot).toHaveBeenCalled())
  const id = 'AcecamFormDemoABC123'
  act(() => onSnapshot.mock.lastCall[1]({ docs: [{ id }] }))
  await user.click(screen.getByRole('button', { name: 'Copiar enlace' }))
  expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/postular/org-demo/${id}`)
  expect(screen.getByRole('button', { name: 'Enlace copiado' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Enlace copiado' }))
  expect((await screen.findByRole('alert')).textContent).toContain('cópialo a mano')
  expect(screen.getByRole('button', { name: 'Copiar enlace' })).toBeTruthy()
})
