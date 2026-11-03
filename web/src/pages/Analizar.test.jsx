// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Analizar from './Analizar.jsx'
import { createDemoPlayersService } from '../previews/demoPlayersService.js'
import { createDemoAnalysisService } from '../previews/demoAnalysisService.js'

afterEach(cleanup)
function setup(options) {
  const playersService = createDemoPlayersService(options)
  const service = createDemoAnalysisService({ playersService, transferDelay: 0 })
  const send = vi.spyOn(service, 'enqueue')
  return { playersService, service, send }
}

async function fillMatch(user) {
  await user.selectOptions(await screen.findByLabelText('Jugador *'), 'example-1')
  await user.selectOptions(screen.getByLabelText('Posición al inicio del video *'), 'abajo')
  await user.type(screen.getByLabelText('Rival *'), 'Rival de ejemplo')
  await user.type(screen.getByLabelText('Fecha del partido *'), '2026-01-01')
}

describe('Analizar video v1', () => {
  it('valida el formulario y encola un archivo sin recargar', async () => {
    const props = setup()
    const user = userEvent.setup()
    render(<Analizar {...props} />)
    await screen.findByText('El próximo análisis empieza aquí')
    await user.click(screen.getByRole('button', { name: /Añadir a la cola/ }))
    expect(props.send).not.toHaveBeenCalled()
    await fillMatch(user)
    await user.upload(screen.getByLabelText('Selecciona el video del partido'), new File(['demo'], 'partido.mp4', { type: 'video/mp4' }))
    await user.click(screen.getByRole('button', { name: /Añadir a la cola/ }))
    const table = await screen.findByRole('table', { name: 'Partidos y estado del análisis' })
    expect(within(table).getByRole('cell', { name: 'En cola' })).toBeTruthy()
    expect(within(table).getByRole('cell', { name: 'Valeria Torres' })).toBeTruthy()
    expect(props.send).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Partido añadido a la cola de demostración. No se subió ni procesó ningún video.')).toBeTruthy()
  })

  it('acepta un enlace de ejemplo sin descargar ni procesar videos', async () => {
    const props = setup()
    const user = userEvent.setup()
    render(<Analizar {...props} />)
    await screen.findByText('El próximo análisis empieza aquí')
    await fillMatch(user)
    await user.click(screen.getByText('Usar enlace', { exact: true }))
    await user.type(screen.getByLabelText('Enlace del video *'), 'https://ejemplo.com/partido.mp4')
    await user.click(screen.getByRole('button', { name: /Añadir a la cola/ }))
    expect(await screen.findByRole('table')).toBeTruthy()
    expect(props.send.mock.calls[0][0].sourceType).toBe('link')
  })

  it('conserva el mismo ID tras fallo y bloquea doble envío', async () => {
    const props = setup()
    props.send.mockRejectedValueOnce({ code: 'unavailable' })
    const user = userEvent.setup()
    render(<Analizar {...props} />)
    await screen.findByText('El próximo análisis empieza aquí')
    await fillMatch(user)
    await user.upload(screen.getByLabelText('Selecciona el video del partido'), new File(['demo'], 'video.mov', { type: 'video/quicktime' }))
    await user.click(screen.getByRole('button', { name: /Añadir a la cola/ }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByLabelText('Rival *').value).toBe('Rival de ejemplo')
    await user.dblClick(screen.getByRole('button', { name: /Añadir a la cola/ }))
    await screen.findByRole('table')
    expect(props.send).toHaveBeenCalledTimes(2)
    expect(props.send.mock.calls[0][1].requestId).toBe(props.send.mock.calls[1][1].requestId)
  })

  it('cancela una transferencia y no crea un partido', async () => {
    const props = setup()
    props.send.mockImplementation((_, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true })))
    const user = userEvent.setup()
    render(<Analizar {...props} />)
    await screen.findByText('El próximo análisis empieza aquí')
    await fillMatch(user)
    await user.upload(screen.getByLabelText('Selecciona el video del partido'), new File(['demo'], 'video.mp4', { type: 'video/mp4' }))
    await user.click(screen.getByRole('button', { name: /Añadir a la cola/ }))
    await user.click(await screen.findByRole('button', { name: 'Cancelar carga' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('permite registrar y seleccionar un jugador sin perder el contexto del partido', async () => {
    const props = setup({ initialPlayers: [] })
    const user = userEvent.setup()
    render(<Analizar {...props} />)
    await screen.findByText('Registra un jugador para vincularle este video.')
    await user.type(screen.getByLabelText('Rival *'), 'Rival guardado')
    await user.click(screen.getByRole('button', { name: 'Nuevo jugador' }))
    await user.type(screen.getByLabelText('Nombre completo *'), 'Nuevo jugador de ejemplo')
    await user.type(screen.getByLabelText('Fecha de nacimiento *'), '2004-01-01')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Guardar jugador' }))
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Registrar jugador' })).toBeNull())
    expect(screen.getByLabelText('Rival *').value).toBe('Rival guardado')
    expect(screen.getByRole('option', { name: 'Nuevo jugador de ejemplo' }).selected).toBe(true)
  })
})
