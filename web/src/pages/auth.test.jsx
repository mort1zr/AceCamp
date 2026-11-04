// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import RequireAuth from '../components/RequireAuth.jsx'
import { AuthContext } from '../context/AuthContext.js'
import Login from './Login.jsx'
import Registro from './Registro.jsx'

afterEach(cleanup)

const session = (overrides = {}) => ({
  user: null, profile: null, loading: false,
  login: vi.fn(), logout: vi.fn(), registerCoach: vi.fn(),
  ...overrides,
})

function renderApp(path, value) {
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route element={<RequireAuth />}>
            <Route path="/inicio" element={<p>Pantalla de inicio</p>} />
            <Route path="/jugadores" element={<p>Pantalla de jugadores</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('Rutas protegidas', () => {
  it('sin sesión redirige al login', () => {
    renderApp('/jugadores', session())
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeTruthy()
    expect(screen.queryByText('Pantalla de jugadores')).toBeNull()
  })

  it('con sesión y ficha muestra la página', () => {
    renderApp('/jugadores', session({ user: { uid: 'u1' }, profile: { orgId: 'org-demo' } }))
    expect(screen.getByText('Pantalla de jugadores')).toBeTruthy()
  })
})

describe('Login', () => {
  it('muestra el error de credenciales y no navega', async () => {
    const login = vi.fn().mockRejectedValue({ code: 'auth/invalid-credential' })
    renderApp('/login', session({ login }))
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Correo'), 'coach@acecam.test')
    await user.type(screen.getByLabelText('Contraseña'), 'mala')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Correo o contraseña incorrectos.')
    expect(login).toHaveBeenCalledWith({ email: 'coach@acecam.test', password: 'mala' })
  })

  it('tras iniciar sesión vuelve a la página que pedía', async () => {
    // Como el AuthProvider real: la sesión cambia cuando el login termina.
    function Harness() {
      const [signedIn, setSignedIn] = useState(false)
      const value = signedIn
        ? session({ user: { uid: 'u1' }, profile: { orgId: 'org-demo' } })
        : session({ login: async () => setSignedIn(true) })
      return (
        <AuthContext.Provider value={value}>
          <MemoryRouter initialEntries={['/jugadores']}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<RequireAuth />}>
                <Route path="/jugadores" element={<p>Pantalla de jugadores</p>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      )
    }
    render(<Harness />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Correo'), 'coach@acecam.test')
    await user.type(screen.getByLabelText('Contraseña'), 'acecam123')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('Pantalla de jugadores')).toBeTruthy()
  })
})

describe('Registro', () => {
  it('avisa que las contraseñas no coinciden sin llamar a Firebase', async () => {
    const registerCoach = vi.fn()
    renderApp('/registro', session({ registerCoach }))
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Nombre y apellido'), 'Coach Nuevo')
    await user.type(screen.getByLabelText('Organización'), 'Universidad Nueva')
    await user.type(screen.getByLabelText('Correo'), 'nuevo@acecam.test')
    await user.type(screen.getByLabelText('Contraseña'), 'acecam123')
    await user.type(screen.getByLabelText('Repite la contraseña'), 'acecam124')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeTruthy()
    expect(registerCoach).not.toHaveBeenCalled()
  })

  it('muestra el error de correo en uso', async () => {
    const registerCoach = vi.fn().mockRejectedValue({ code: 'auth/email-already-in-use' })
    renderApp('/registro', session({ registerCoach }))
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Nombre y apellido'), 'Coach Nuevo')
    await user.type(screen.getByLabelText('Organización'), 'Universidad Nueva')
    await user.type(screen.getByLabelText('Correo'), 'coach@acecam.test')
    await user.type(screen.getByLabelText('Contraseña'), 'acecam123')
    await user.type(screen.getByLabelText('Repite la contraseña'), 'acecam123')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Ya existe una cuenta')
  })
})
