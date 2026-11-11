// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { onSnapshot } from 'firebase/firestore'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthContext } from '../../context/AuthContext.js'
import Login from '../Login.jsx'
import PlatformAdmin from './PlatformAdmin.jsx'

vi.mock('../../lib/firebase.js', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, collection, uid) => `${collection}/${uid}`),
  onSnapshot: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

function openAdmin(session, path = '/admin', state) {
  return render(
    <AuthContext.Provider value={{ user: null, loading: false, logout: vi.fn(), ...session }}>
      <MemoryRouter initialEntries={[{ pathname: path, state }]}>
        <Routes>
          <Route path="/" element={<h1>Landing público</h1>} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<PlatformAdmin />}>
            <Route index element={<p>Datos de administración</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

function publish(exists, fromCache = false) {
  const [, , receive] = onSnapshot.mock.lastCall
  act(() => receive({ metadata: { fromCache }, exists: () => exists }))
}

it('lleva al login a quien entra sin sesión', () => {
  openAdmin({})
  expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeTruthy()
  expect(screen.getByText('Inicia sesión para acceder a la administración de AceCam.')).toBeTruthy()
  expect(onSnapshot).not.toHaveBeenCalled()
})

it('exige el permiso de plataforma aunque el usuario administre una organización', () => {
  onSnapshot.mockReturnValue(vi.fn())
  openAdmin({ user: { uid: 'equipo-admin' }, profile: { role: 'admin', orgId: 'equipo' } })
  expect(onSnapshot).toHaveBeenCalledWith('platformAdmins/equipo-admin', { includeMetadataChanges: true },
    expect.any(Function), expect.any(Function))
  publish(true, true)
  expect(screen.queryByText('Datos de administración')).toBeNull()
  publish(false)
  expect(screen.getByRole('alert').textContent).toContain('no tiene permiso de administrador de plataforma')
  expect(screen.queryByText('Datos de administración')).toBeNull()
})

it('admite un administrador sin ficha de equipo, reacciona a revocación y sale al landing', async () => {
  const stop = vi.fn()
  const logout = vi.fn().mockResolvedValue(undefined)
  onSnapshot.mockReturnValue(stop)
  openAdmin({ user: { uid: 'plataforma' }, profile: null, logout }, '/login', { from: { pathname: '/admin' } })
  publish(true)
  expect(screen.getByRole('heading', { name: 'Administración de AceCam' })).toBeTruthy()
  expect(screen.getByText('Datos de administración')).toBeTruthy()
  publish(false)
  expect(screen.queryByText('Datos de administración')).toBeNull()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }))
  expect(await screen.findByRole('heading', { name: 'Landing público' })).toBeTruthy()
  expect(logout).toHaveBeenCalledOnce()
  expect(stop).toHaveBeenCalledOnce()
})
