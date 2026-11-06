// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import RequireAuth from '../components/RequireAuth.jsx'
import { AuthContext } from '../context/AuthContext.js'
import Acceso from './Acceso.jsx'
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
          <Route element={<Acceso />}>
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Registro />} />
          </Route>
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

describe('Ver la contraseña', () => {
  it('en el login, el ojo muestra y vuelve a ocultar la contraseña', async () => {
    renderApp('/login', session())
    const user = userEvent.setup()
    const clave = screen.getByLabelText('Contraseña')
    await user.type(clave, 'acecam123')
    expect(clave.getAttribute('type')).toBe('password')
    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(clave.getAttribute('type')).toBe('text')
    expect(clave.value).toBe('acecam123')
    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(clave.getAttribute('type')).toBe('password')
  })

  it('en el registro, cada contraseña tiene su propio ojo y no envía el formulario', async () => {
    const registerCoach = vi.fn()
    renderApp('/registro', session({ registerCoach }))
    const user = userEvent.setup()
    const ojos = screen.getAllByRole('button', { name: 'Mostrar contraseña' })
    expect(ojos).toHaveLength(2)
    await user.click(ojos[1])
    expect(screen.getByLabelText('Repite la contraseña').getAttribute('type')).toBe('text')
    expect(screen.getByLabelText('Contraseña').getAttribute('type')).toBe('password')
    expect(registerCoach).not.toHaveBeenCalled()
  })
})

describe('Registro con invitación (PCIT-40)', () => {
  it('trae el correo invitado, no pide organización y se registra como invitado', async () => {
    const registerCoach = vi.fn().mockResolvedValue({ joined: true })
    renderApp('/registro?invitacion=ana%40club.pe', session({ registerCoach }))
    const user = userEvent.setup()
    expect(screen.queryByLabelText('Organización')).toBeNull()
    expect(screen.getByLabelText('Correo').value).toBe('ana@club.pe')
    await user.type(screen.getByLabelText('Nombre y apellido'), 'Ana Torres')
    await user.type(screen.getByLabelText('Contraseña'), 'acecam123')
    await user.type(screen.getByLabelText('Repite la contraseña'), 'acecam123')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(registerCoach).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@club.pe', invited: true }))
  })
})

describe('Acceso', () => {
  it('el switch alterna entre iniciar sesión y crear cuenta', async () => {
    renderApp('/login', session())
    const user = userEvent.setup()
    expect(screen.getByRole('tab', { name: 'Iniciar sesión' }).getAttribute('aria-selected')).toBe('true')
    await user.click(screen.getByRole('tab', { name: 'Crear cuenta' }))
    expect(screen.getByRole('heading', { name: 'Crear cuenta' })).toBeTruthy()
    expect(screen.getByLabelText('Nombre y apellido')).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: 'Iniciar sesión' }))
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeTruthy()
    expect(screen.queryByLabelText('Nombre y apellido')).toBeNull()
  })
})
