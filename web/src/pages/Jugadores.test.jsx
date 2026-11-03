// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Jugadores from './Jugadores.jsx'
import { createDemoPlayersService } from '../previews/demoPlayersService.js'

afterEach(cleanup)

async function fillPlayer(user, name = 'Jugador de prueba') {
  await user.type(screen.getByLabelText('Nombre completo *'), name)
  await user.type(screen.getByLabelText('Fecha de nacimiento *'), '2004-03-10')
  await user.type(screen.getByLabelText(/Academia.*opcional/), 'Club de prueba')
}

describe('Jugadores v1', () => {
  it('muestra vacío, exige autorización y agrega sin recargar, sin duplicar', async () => {
    const service = createDemoPlayersService({ initialPlayers: [] })
    const save = vi.spyOn(service, 'create')
    const user = userEvent.setup()
    render(<Jugadores service={service} />)
    expect(await screen.findByText('Tu equipo empieza aquí')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Nuevo jugador/ }))
    expect(document.activeElement).toBe(screen.getByLabelText('Nombre completo *'))
    await fillPlayer(user)
    await user.click(screen.getByRole('button', { name: 'Guardar jugador' }))
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByText('Debes confirmar la autorización antes de registrar al jugador.')).toBeTruthy()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Guardar jugador' }))
    const table = await screen.findByRole('table', { name: 'Jugadores registrados' })
    expect(within(table).getByText('Jugador de prueba')).toBeTruthy()
    expect(within(table).getAllByRole('row')).toHaveLength(2)
    expect(save).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('form', { name: 'Registrar jugador' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Nuevo jugador/ }))
    expect(screen.getByText('Jugador de prueba se registró correctamente.')).toBeTruthy()
  })

  it('conserva los campos tras un error y permite reintentar el guardado', async () => {
    const service = createDemoPlayersService({ initialPlayers: [] })
    const save = vi.spyOn(service, 'create').mockRejectedValueOnce({ code: 'unavailable' })
    const user = userEvent.setup()
    render(<Jugadores service={service} />)
    await screen.findByText('Tu equipo empieza aquí')
    await user.click(screen.getByRole('button', { name: /Nuevo jugador/ }))
    await fillPlayer(user)
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Guardar jugador' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByLabelText('Nombre completo *').value).toBe('Jugador de prueba')
    await user.click(screen.getByRole('button', { name: 'Guardar jugador' }))
    expect(await screen.findByRole('table')).toBeTruthy()
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('bloquea envíos repetidos mientras se guarda', async () => {
    let finish
    const service = createDemoPlayersService({ initialPlayers: [] })
    service.create = vi.fn(() => new Promise(resolve => { finish = resolve }))
    const user = userEvent.setup()
    render(<Jugadores service={service} />)
    await user.click(screen.getByRole('button', { name: /Nuevo jugador/ }))
    await fillPlayer(user)
    await user.click(screen.getByRole('checkbox'))
    await user.dblClick(screen.getByRole('button', { name: 'Guardar jugador' }))
    expect(service.create).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Guardando…' }).matches(':disabled')).toBe(true)
    await act(async () => finish({ fullName: 'Jugador de prueba' }))
  })

  it('reintenta la lectura y no conserva filas de otra organización', async () => {
    let oldReceive
    const unsubscribe = vi.fn()
    const oldService = { scopeKey: 'org-a', subscribe: vi.fn(receive => { oldReceive = receive; receive([{ id: 'one', fullName: 'Jugador privado A' }]); return unsubscribe }) }
    const { rerender } = render(<Jugadores service={oldService} />)
    await screen.findByText('Jugador privado A')
    const newService = { scopeKey: 'org-b', subscribe: vi.fn((receive, fail) => { fail({ code: 'unavailable' }); return () => {} }) }
    rerender(<Jugadores service={newService} />)
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Jugador privado A')).toBeNull()
    act(() => oldReceive([{ id: 'late', fullName: 'Dato tardío A' }]))
    expect(screen.queryByText('Dato tardío A')).toBeNull()
    newService.subscribe.mockImplementation(receive => { receive([]); return () => {} })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(screen.getByText('Tu equipo empieza aquí')).toBeTruthy())
  })

  it('no usa ejemplos como respaldo cuando la sesión real no está disponible', () => {
    render(<Jugadores />)
    expect(screen.getByText('Los jugadores aún no están disponibles')).toBeTruthy()
    expect(screen.queryByText('Modo demostración')).toBeNull()
    expect(screen.queryByRole('button', { name: /Nuevo jugador/ })).toBeNull()
  })
})
