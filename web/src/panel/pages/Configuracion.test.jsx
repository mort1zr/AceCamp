// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import Configuracion from './Configuracion.jsx'
import { createDemoConfiguracionService } from '../previews/demoConfiguracionService.js'

afterEach(cleanup)

function Ubicacion() {
  const { search } = useLocation()
  return <p data-testid="ubicacion">{search}</p>
}

const montar = (service, entrada = '/configuracion') =>
  render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route
          path="/configuracion"
          element={
            <>
              <Configuracion service={service} />
              <Ubicacion />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )

describe('Configuración', () => {
  it('cambia de pestaña y la refleja en la URL', async () => {
    const user = userEvent.setup()
    montar(createDemoConfiguracionService())
    expect(await screen.findByDisplayValue('Coach Ramírez')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Preferencias' }))
    expect(screen.getByTestId('ubicacion').textContent).toBe('?seccion=preferencias')
    expect(screen.getByRole('heading', { name: 'Preferencias' })).toBeTruthy()
  })

  it('abre la pestaña indicada en la URL', async () => {
    montar(createDemoConfiguracionService(), '/configuracion?seccion=plan')
    expect(await screen.findByText('18 análisis este mes')).toBeTruthy()
  })

  it('en un plan personal oculta organización y equipo', async () => {
    montar(
      createDemoConfiguracionService({ plan: { id: 'pro', trial: false, used: 18, limit: 150 } }),
      '/configuracion?seccion=equipo',
    )
    expect(await screen.findByDisplayValue('Coach Ramírez')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Equipo' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Organización' })).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Plan y facturación' }))
    expect(screen.getByText('18 de 150 análisis usados')).toBeTruthy()
    expect(screen.getByText('¿Trabajas con un equipo?')).toBeTruthy()
  })

  it('guarda la cuenta y valida el nombre', async () => {
    const user = userEvent.setup()
    montar(createDemoConfiguracionService())
    const nombre = await screen.findByLabelText('Nombre')
    expect(screen.getByLabelText('Correo').readOnly).toBe(true)
    await user.clear(nombre)
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(screen.getByRole('alert').textContent).toBe('Escribe tu nombre.')
    await user.type(nombre, 'Coach Nuevo')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText('Cambios guardados.')).toBeTruthy()
  })

  it('valida el cambio de contraseña', async () => {
    const user = userEvent.setup()
    montar(createDemoConfiguracionService())
    await user.click(await screen.findByRole('button', { name: 'Cambiar contraseña' }))
    await user.type(screen.getByLabelText('Contraseña actual'), 'otra-clave')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'corta')
    await user.type(screen.getByLabelText('Repite la nueva contraseña'), 'corta')
    await user.click(screen.getByRole('button', { name: 'Actualizar contraseña' }))
    expect(screen.getByText('Usa al menos 8 caracteres.')).toBeTruthy()
    await user.clear(screen.getByLabelText('Nueva contraseña'))
    await user.clear(screen.getByLabelText('Repite la nueva contraseña'))
    await user.type(screen.getByLabelText('Nueva contraseña'), 'clave-segura')
    await user.type(screen.getByLabelText('Repite la nueva contraseña'), 'clave-segura')
    await user.click(screen.getByRole('button', { name: 'Actualizar contraseña' }))
    expect(await screen.findByText('La contraseña actual no es correcta.')).toBeTruthy()
  })

  it('activa interruptores y guarda las preferencias', async () => {
    const user = userEvent.setup()
    montar(createDemoConfiguracionService(), '/configuracion?seccion=preferencias')
    const alertas = await screen.findByRole('switch', { name: 'Alertas de rendimiento' })
    expect(alertas.getAttribute('aria-checked')).toBe('false')
    await user.click(alertas)
    expect(alertas.getAttribute('aria-checked')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'mph' }))
    await user.click(screen.getByRole('button', { name: 'Guardar preferencias' }))
    expect(await screen.findByText('Cambios guardados.')).toBeTruthy()
  })

  it('invita a un miembro al equipo', async () => {
    const user = userEvent.setup()
    montar(createDemoConfiguracionService(), '/configuracion?seccion=equipo')
    const correo = await screen.findByLabelText('Invitar por correo')
    await user.type(correo, 'sin-arroba')
    await user.click(screen.getByRole('button', { name: 'Enviar invitación' }))
    expect(screen.getByText('Escribe un correo válido.')).toBeTruthy()
    await user.clear(correo)
    await user.type(correo, 'nuevo@ejemplo.test')
    await user.click(screen.getByRole('button', { name: 'Enviar invitación' }))
    expect(await screen.findByText('Invitación creada.')).toBeTruthy()
    expect(screen.getAllByText('nuevo@ejemplo.test').length).toBeGreaterThan(0)
    // PCIT-40: sin envío de correos, se comparte el enlace de registro.
    expect(screen.getByText(/\/registro\?invitacion=nuevo%40ejemplo\.test$/)).toBeTruthy()
  })

  it('sin conexión muestra los formularios vacíos y bloqueados', () => {
    montar(undefined)
    expect(screen.getByText('La configuración aún no está disponible')).toBeTruthy()
    expect(screen.getByLabelText('Nombre').matches(':disabled')).toBe(true)
    expect(screen.queryByDisplayValue('Coach Ramírez')).toBeNull()
  })

  it('muestra el error y permite reintentar', async () => {
    const user = userEvent.setup()
    montar(createDemoConfiguracionService({ scenario: 'error' }))
    expect(await screen.findByText('No pudimos cargar tu configuración')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('No pudimos cargar tu configuración')).toBeTruthy()
  })
})
