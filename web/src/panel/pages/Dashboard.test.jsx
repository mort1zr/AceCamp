// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard from './Dashboard.jsx'
import { createDemoPlayersService } from '../previews/demoPlayersService.js'
import { createDemoDashboardService } from '../previews/demoDashboardService.js'
import { MemoryRouter } from 'react-router'

afterEach(cleanup)

function setup(options) {
  const playersService = createDemoPlayersService(options)
  const overviewService = createDemoDashboardService({ scopeKey: playersService.scopeKey })
  return { playersService, overviewService }
}

async function selectPlayer(user, nombre = 'Valeria Torres') {
  await user.click(await screen.findByRole('button', { name: new RegExp(nombre) }))
}

function card(label) {
  return screen.getByRole('heading', { name: label }).closest('article')
}

describe('Dashboard v1 · interfaz PCIT-138', () => {
  it('pide seleccionar un jugador y muestra ejemplos identificados, incluidos ceros', async () => {
    const props = setup()
    const user = userEvent.setup()
    render(<Dashboard {...props} />, { wrapper: MemoryRouter })
    expect(await screen.findByRole('heading', { name: 'Elige un jugador' })).toBeTruthy()
    expect(screen.queryByRole('article')).toBeNull()
    await selectPlayer(user)
    await screen.findByRole('heading', { name: 'Valeria Torres' })
    expect(card('Velocidad media de saque').textContent).toContain('128.5')
    expect(within(card('Dobles faltas')).getByText('0')).toBeTruthy()
    expect(screen.getByText('Modo demostración')).toBeTruthy()
    expect(screen.getAllByText('Valor de ejemplo')).toHaveLength(4)
    expect(screen.getByText('Ver datos del gráfico')).toBeTruthy()
  })

  it('sin jugador elegido muestra la lista y al tocar uno se despliega su resumen', async () => {
    const props = setup()
    const user = userEvent.setup()
    render(<Dashboard {...props} />, { wrapper: MemoryRouter })
    await screen.findByRole('heading', { name: 'Elige un jugador' })
    expect(screen.queryByText('Velocidad media de saque')).toBeNull()
    expect(screen.getByRole('link', { name: /Agregar jugador/ }).getAttribute('href')).toBe('/jugadores')
    await user.click(screen.getByRole('button', { name: /Valeria Torres/ }))
    await screen.findByRole('heading', { name: 'Valeria Torres' })
    expect(screen.queryByRole('heading', { name: 'Elige un jugador' })).toBeNull()
    expect(card('Velocidad media de saque').textContent).toContain('128.5')
  })

  it('al cambiar a un jugador sin estadísticas, oculta todos los valores anteriores', async () => {
    const props = setup()
    const user = userEvent.setup()
    render(<Dashboard {...props} />, { wrapper: MemoryRouter })
    await selectPlayer(user)
    await screen.findByText('128.5')
    await user.selectOptions(screen.getByLabelText('Jugador'), 'example-3')
    expect(await screen.findByText('Todavía no hay estadísticas para este jugador')).toBeTruthy()
    expect(screen.queryByText('128.5')).toBeNull()
    expect(within(card('Velocidad media de saque')).getByText('Sin datos')).toBeTruthy()
    expect(within(card('Distancia recorrida')).getByText('Sin datos')).toBeTruthy()
    expect(within(card('Partidos analizados')).queryByText('0')).toBeNull()
  })

  it('al cambiar de jugador mantiene el anterior hasta recibir el nuevo y no acepta respuestas tardías', async () => {
    const props = setup()
    const receivers = {}
    const stops = []
    props.overviewService.subscribePlayer = vi.fn((id, receive) => {
      receivers[id] = receive
      const stop = vi.fn()
      stops.push(stop)
      return stop
    })
    const user = userEvent.setup()
    render(<Dashboard {...props} />, { wrapper: MemoryRouter })
    await selectPlayer(user)
    act(() => receivers['example-1']({ metrics: { averageServeSpeed: 155.5 } }))
    expect(screen.getByText('155.5')).toBeTruthy()
    await user.selectOptions(screen.getByLabelText('Jugador'), 'example-2')
    expect(screen.queryByText('Cargando resumen…')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Valeria Torres' })).toBeTruthy()
    expect(screen.getByText('155.5')).toBeTruthy()
    expect(stops[0]).toHaveBeenCalledTimes(1)
    act(() => receivers['example-1']({ metrics: { averageServeSpeed: 199.9 } }))
    expect(screen.queryByText('199.9')).toBeNull()
    act(() => receivers['example-2']({ metrics: { averageServeSpeed: 133.3 } }))
    expect(screen.getByText('133.3')).toBeTruthy()
    expect(screen.queryByText('155.5')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Valeria Torres' })).toBeNull()
  })

  it('muestra error sin valores anteriores y permite reintentar', async () => {
    const props = setup()
    props.overviewService.subscribePlayer = vi.fn((_, receive, fail) => { fail({ code: 'unavailable' }); return () => {} })
    const user = userEvent.setup()
    render(<Dashboard {...props} />, { wrapper: MemoryRouter })
    await selectPlayer(user)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('article')).toBeNull()
    props.overviewService.subscribePlayer.mockImplementation((_, receive) => { receive({ metrics: { analyzedMatches: 2 } }); return () => {} })
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByRole('heading', { name: 'Partidos analizados' })
    expect(within(card('Partidos analizados')).getByText('2')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('presenta el vacío de jugadores y no añade registros ni indicadores ficticios', async () => {
    render(<Dashboard {...setup({ initialPlayers: [] })} />, { wrapper: MemoryRouter })
    expect(await screen.findByText('Tu equipo empieza con un jugador')).toBeTruthy()
    expect(screen.queryByLabelText('Jugador')).toBeNull()
    expect(screen.queryByRole('article')).toBeNull()
  })

  it('no usa ejemplos por defecto ni mezcla organizaciones o modos', () => {
    const props = setup()
    const { rerender } = render(<Dashboard />, { wrapper: MemoryRouter })
    expect(screen.getByText('El Dashboard aún no está disponible')).toBeTruthy()
    rerender(<Dashboard {...props} overviewService={{ ...props.overviewService, scopeKey: 'another-org' }} />)
    expect(screen.getByText('El Dashboard aún no está disponible')).toBeTruthy()
    expect(screen.queryByText('Modo demostración')).toBeNull()
    rerender(<Dashboard {...props} overviewService={{ ...props.overviewService, mode: 'live' }} />)
    expect(screen.getByText('El Dashboard aún no está disponible')).toBeTruthy()
  })

  it('descarta valores inválidos en lugar de presentarlos como cero', async () => {
    const props = setup()
    props.overviewService.subscribePlayer = (_, receive) => { receive({ metrics: { analyzedMatches: -1, averageServeSpeed: NaN, firstServeInRate: 110, doubleFaults: 1.5 } }); return () => {} }
    const user = userEvent.setup()
    render(<Dashboard {...props} />, { wrapper: MemoryRouter })
    await selectPlayer(user)
    expect(within(card('Primer saque dentro')).getByText('Sin datos')).toBeTruthy()
    expect(within(card('Dobles faltas')).getByText('Sin datos')).toBeTruthy()
    expect(screen.queryByText('NaN')).toBeNull()
  })

  it('reserva el componente de evolución para el jugador seleccionado, sin dibujar un gráfico ficticio', async () => {
    const props = setup()
    const renderEvolution = vi.fn(({ playerId }) => <p>Evolución recibida para {playerId}</p>)
    const user = userEvent.setup()
    render(<Dashboard {...props} renderEvolution={renderEvolution} />, { wrapper: MemoryRouter })
    await screen.findByRole('heading', { name: 'Elige un jugador' })
    expect(renderEvolution).not.toHaveBeenCalled()
    await selectPlayer(user)
    expect(await screen.findByText('Evolución recibida para example-1')).toBeTruthy()
  })

  it('una organización nueva no conserva la selección ni el resumen anterior', async () => {
    const props = setup()
    const user = userEvent.setup()
    const { rerender } = render(<Dashboard {...props} />, { wrapper: MemoryRouter })
    await selectPlayer(user)
    await screen.findByText('128.5')
    rerender(<Dashboard {...setup({ initialPlayers: [] })} />)
    expect(screen.queryByText('128.5')).toBeNull()
    expect(await screen.findByText('Tu equipo empieza con un jugador')).toBeTruthy()
  })
})
