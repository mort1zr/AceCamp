// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { onSnapshot, where } from 'firebase/firestore'
import Jugadores from './Jugadores.jsx'
import { createDemoPlayersService } from '../previews/demoPlayersService.js'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), where: vi.fn(), query: vi.fn(), onSnapshot: vi.fn(),
  addDoc: vi.fn(), serverTimestamp: vi.fn(),
}))

afterEach(cleanup)

it.each(['coach', 'admin'])('oculta perfiles no permitidos al rol %s aunque el SDK entregue filas ajenas', async role => {
  const rows = [
    { id: 'own', fullName: 'Jugador propio', orgId: 'org-a', createdBy: 'coach-a' },
    { id: 'teammate', fullName: 'Jugador de colega', orgId: 'org-a', createdBy: 'coach-b' },
    { id: 'foreign', fullName: 'Jugador de otra organización', orgId: 'org-b', createdBy: 'coach-a' },
  ]
  onSnapshot.mockImplementation((_, receive) => {
    receive({ docs: rows.map(({ id, ...data }) => ({ id, data: () => data })) })
    return () => {}
  })
  render(<Jugadores db={{ app: { options: { projectId: 'roles-test' } } }} session={{ uid: 'coach-a', orgId: 'org-a', role }} />)
  expect(await screen.findByRole('button', { name: 'Ver perfil de Jugador propio' })).toBeTruthy()
  expect(Boolean(screen.queryByRole('button', { name: 'Ver perfil de Jugador de colega' }))).toBe(role === 'admin')
  expect(screen.queryByText('Jugador de otra organización')).toBeNull()
})

async function fillPlayer(user, name = 'Jugador de prueba') {
  await user.type(screen.getByLabelText('Nombre completo *'), name)
  await user.type(screen.getByLabelText('Fecha de nacimiento *'), '2004-03-10')
  await user.type(screen.getByLabelText(/Academia.*opcional/), 'Club de prueba')
}

describe('Jugadores v1', () => {
  it('pide datos del apoderado para menores y no muestra su contacto en la plantilla', async () => {
    const service = createDemoPlayersService({ initialPlayers: [] })
    const save = vi.spyOn(service, 'create')
    const user = userEvent.setup()
    render(<Jugadores service={service} />)
    await user.click(screen.getByRole('button', { name: /Nuevo jugador/ }))
    await user.type(screen.getByLabelText('Nombre completo *'), 'Jugador menor de ejemplo')
    await user.type(screen.getByLabelText('Fecha de nacimiento *'), '2020-01-01')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Guardar jugador' }))
    expect(save).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByLabelText('Nombre del apoderado *'))
    await user.type(screen.getByLabelText('Nombre del apoderado *'), 'Apoderada de prueba')
    await user.type(screen.getByLabelText('Teléfono del apoderado *'), '900 000 000')
    await user.type(screen.getByLabelText('Correo del apoderado *'), 'demo@example.test')
    await user.click(screen.getByRole('button', { name: 'Guardar jugador' }))
    const table = await screen.findByRole('table', { name: 'Jugadores registrados' })
    expect(within(table).getByText('Jugador menor de ejemplo')).toBeTruthy()
    expect(within(table).queryByText('demo@example.test')).toBeNull()
  })

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

  it('pagina y combina la búsqueda sin acentos con el filtro de academia', async () => {
    const initialPlayers = Array.from({ length: 11 }, (_, index) => ({
      id: `p-${index}`,
      fullName: `Camila Ríos ${String(index + 1).padStart(2, '0')}`,
      academy: 'Club Central',
    }))
    initialPlayers.push({ id: 'p-last', fullName: 'Zoe Sánchez' })
    const user = userEvent.setup()
    render(<Jugadores service={createDemoPlayersService({ initialPlayers })} />)

    const table = await screen.findByRole('table', { name: 'Jugadores registrados' })
    expect(within(table).getAllByRole('row')).toHaveLength(11)
    expect(screen.getByText('Página 1 de 2')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Página 2 de 2')).toBeTruthy()
    expect(within(table).getByText('Camila Ríos 11')).toBeTruthy()

    const search = screen.getByRole('searchbox', { name: 'Buscar por nombre' })
    await user.type(search, 'RIOS')
    expect(screen.getByText('Página 1 de 2')).toBeTruthy()
    expect(within(table).getByText('Camila Ríos 01')).toBeTruthy()
    const academy = screen.getByLabelText('Filtrar por academia')
    await user.selectOptions(academy, within(academy).getByRole('option', { name: 'Sin academia' }))
    expect(screen.getByText('No se encontraron jugadores')).toBeTruthy()
    await user.clear(search)
    expect(screen.getByText('Zoe Sánchez')).toBeTruthy()
    expect(screen.getByText('1 de 12 jugadores')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByText('Página 1 de 2')).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('Jugadores por página'), '50')
    expect(screen.getByText('Página 1 de 1')).toBeTruthy()
    expect(screen.getByText('1–12 de 12')).toBeTruthy()
    expect(screen.getByText('12 jugadores')).toBeTruthy()
  })

  it('no usa ejemplos como respaldo cuando la sesión real no está disponible', () => {
    render(<Jugadores />)
    expect(screen.getByText('Los jugadores aún no están disponibles')).toBeTruthy()
    expect(screen.queryByText('Modo demostración')).toBeNull()
    expect(screen.queryByRole('button', { name: /Nuevo jugador/ })).toBeNull()
  })

  it('abre el perfil con historial, reintenta y devuelve el foco a la plantilla', async () => {
    const user = userEvent.setup()
    const stop = vi.fn()
    const service = createDemoPlayersService({ initialPlayers: [
      { id: 'p1', fullName: 'Camila Ríos', birthDate: '2005-04-12', dominantHand: 'zurdo', guardian: { email: 'reservado@example.test' } },
    ] })
    service.subscribeAnalyzedMatches = vi.fn()
      .mockImplementationOnce((_player, _receive, fail) => { fail({ code: 'unavailable' }); return stop })
      .mockImplementationOnce((_player, receive) => {
        receive([{ id: 'match-1', matchDate: '2026-10-03', opponent: 'Rival de prueba' }])
        return stop
      })
    render(<Jugadores service={service} />)
    await user.click(await screen.findByRole('button', { name: 'Ver perfil de Camila Ríos' }))
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Camila Ríos' }))
    expect(screen.getByText('zurdo')).toBeTruthy()
    expect(await screen.findByRole('alert')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    const history = await screen.findByRole('table', { name: 'Historial de partidos analizados' })
    expect(within(history).getByText('03/10/2026')).toBeTruthy()
    expect(within(history).getByText('Rival de prueba')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Volver a Jugadores' }))
    expect(stop).toHaveBeenCalledTimes(2)
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Tu plantilla' }))
    expect(screen.queryByText('Rival de prueba')).toBeNull()
  })

  it('abre la consulta con la sesión completa y la cierra al salir', async () => {
    const unsubscribe = vi.fn()
    onSnapshot.mockImplementationOnce((_, receive) => {
      receive({ docs: [{ id: 'p1', data: () => ({ fullName: 'Jugador del equipo', orgId: 'equipo-1', createdBy: 'coach-1' }) }] })
      return unsubscribe
    })
    const db = { app: { options: { projectId: 'prueba' } } }
    const { rerender } = render(<Jugadores db={db} session={{ uid: 'coach-1' }} />)
    expect(onSnapshot).not.toHaveBeenCalled()
    rerender(<Jugadores db={db} session={{ uid: 'coach-1', orgId: 'equipo-1' }} />)
    expect(await screen.findByText('Jugador del equipo')).toBeTruthy()
    expect(where).toHaveBeenCalledWith('orgId', '==', 'equipo-1')
    rerender(<Jugadores db={db} />)
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(screen.queryByText('Jugador del equipo')).toBeNull()
  })
})
