// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { onSnapshot, where } from 'firebase/firestore'
import { MemoryRouter } from 'react-router'
import Analizar from './Analizar.jsx'
import { PlanVistaContexto } from '../context/PlanVistaContext.js'
import { validateLocalVideo } from '../lib/validateLocalVideo.js'
import { createDemoPlayersService } from '../previews/demoPlayersService.js'
import { createDemoAnalysisService } from '../previews/demoAnalysisService.js'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), where: vi.fn(), query: vi.fn(), onSnapshot: vi.fn(),
  addDoc: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), runTransaction: vi.fn(), serverTimestamp: vi.fn(),
}))

vi.mock('../lib/validateLocalVideo.js', () => ({ validateLocalVideo: vi.fn(async () => null) }))

afterEach(() => {
  cleanup()
  validateLocalVideo.mockClear()
})
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
  it('abre Jugadores y la cola para la misma sesión cuando hay un adaptador de subida', async () => {
    const stop = vi.fn()
    onSnapshot.mockImplementation((_, receive) => { receive({ docs: [] }); return stop })
    const db = { app: { options: { projectId: 'prueba' } } }
    const session = { uid: 'coach-1', orgId: 'equipo-1' }
    const uploadVideo = vi.fn()
    const { rerender } = render(<Analizar db={db} session={session} maxBytes={1024} />)
    expect(onSnapshot).not.toHaveBeenCalled()
    rerender(<Analizar db={db} session={session} uploadVideo={uploadVideo} maxBytes={1024} />)
    expect(await screen.findByText('El próximo análisis empieza aquí')).toBeTruthy()
    expect(where.mock.calls).toEqual([['orgId', '==', 'equipo-1'], ['createdBy', '==', 'coach-1'], ['orgId', '==', 'equipo-1'], ['createdBy', '==', 'coach-1']])
    expect(screen.queryByText('Modo demostración')).toBeNull()
    rerender(<Analizar db={db} uploadVideo={uploadVideo} maxBytes={1024} />)
    expect(stop).toHaveBeenCalledTimes(2)
    expect(screen.getByText('El análisis aún no está disponible')).toBeTruthy()
  })

  it('informa los requisitos del video antes de elegir un archivo', () => {
    render(<Analizar {...setup()} />)
    const input = screen.getByLabelText('Selecciona el video del partido')
    const notice = document.getElementById(input.getAttribute('aria-describedby'))
    expect(notice.textContent).toContain('MP4 o MOV de hasta 1 minuto')
    expect(notice.textContent).toContain('720p (1280×720) y de 25 a 60 FPS')
    expect(notice.textContent).toContain('1080p a 30 FPS')
    expect(notice.textContent).toContain('con toda la cancha visible y sin cortes')
    expect(input.files).toHaveLength(0)
  })

  it('admite YouTube en la demostración dejando explícito que no descarga videos', async () => {
    const props = setup()
    const user = userEvent.setup()
    render(<Analizar {...props} />)
    await screen.findByText('El próximo análisis empieza aquí')
    await fillMatch(user)
    await user.click(screen.getByText('Usar enlace', { exact: true }))
    expect(screen.getByText(/En esta demostración solo se valida el enlace/)).toBeTruthy()
    await user.type(screen.getByLabelText('Enlace del video *'), 'https://youtu.be/abcdefghijk?si=example')
    await user.click(screen.getByRole('button', { name: /Añadir a la cola/ }))
    expect(await screen.findByText('Partido añadido a la cola de demostración. No se subió ni procesó ningún video.')).toBeTruthy()
    expect(props.send.mock.calls[0][0].url).toContain('youtu.be/abcdefghijk')
  })

  it('muestra progreso indeterminado por partido solo mientras Firestore indica que se procesa', () => {
    onSnapshot.mockImplementation(() => vi.fn())
    const db = { app: { options: { projectId: 'prueba' } } }
    const session = { uid: 'coach-1', orgId: 'equipo-1' }
    render(<Analizar db={db} session={session} uploadVideo={vi.fn()} maxBytes={1024} />)
    const [receivePlayers, receiveMatches] = onSnapshot.mock.calls.slice(-2).map(([, receive]) => receive)
    const base = { orgId: 'equipo-1', createdBy: 'coach-1' }
    const player = { id: 'player-1', data: () => ({ ...base, fullName: 'Valeria Torres' }) }
    const match = (id, opponent, status, errorMessage, progress = {}) => ({
      id,
      data: () => ({ ...base, opponent, status, errorMessage, playerId: player.id, matchDate: '2026-01-01', ...progress }),
    })

    act(() => {
      receivePlayers({ docs: [player] })
      receiveMatches({ docs: [match('a', 'Rival A', 'en cola'), match('b', 'Rival B', 'en cola')] })
    })
    expect(screen.queryByRole('progressbar')).toBeNull()

    act(() => receiveMatches({ docs: [match('a', 'Rival A', 'procesando'), match('b', 'Rival B', 'procesando')] }))
    const first = screen.getByRole('progressbar', { name: 'Análisis de Valeria Torres contra Rival A (2026-01-01)' })
    expect(first.getAttribute('aria-valuenow')).toBeNull()
    expect(within(first.closest('tr')).getByText(/El modelo está analizando/)).toBeTruthy()
    expect(screen.getAllByRole('progressbar')).toHaveLength(2)

    const started = Date.now() - 65_000
    const startedAt = { toMillis: () => started }
    act(() => receiveMatches({ docs: [match('a', 'Rival A', 'procesando', undefined, {
      startedAt, analysisStage: 'detecting', analysisFrames: { done: 40, total: 100 },
    })] }))
    expect(screen.getByRole('progressbar').value).toBe(40)
    expect(screen.getByText('40 de 100 fotogramas en esta etapa')).toBeTruthy()
    expect(screen.getByText(/Tiempo transcurrido: 1 min/)).toBeTruthy()

    const fpsError = 'El video debe tener entre 25 y 60 FPS. Grábalo o expórtalo dentro de ese rango.'
    act(() => receiveMatches({ docs: [match('a', 'Rival A', 'listo'), match('b', 'Rival B', 'error', fpsError)] }))
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.getByRole('cell', { name: 'Listo' })).toBeTruthy()
    const errorCell = screen.getByRole('cell', { name: /Error El video debe tener/ })
    expect(within(errorCell).getByText(fpsError)).toBeTruthy()
  })

  it('conserva el enlace y los datos si YouTube no ofrece un video público', async () => {
    const props = setup()
    props.send.mockRejectedValueOnce({ code: 'import/youtube-unavailable' })
    const user = userEvent.setup()
    render(<Analizar {...props} />)
    await screen.findByText('El próximo análisis empieza aquí')
    await fillMatch(user)
    await user.click(screen.getByText('Usar enlace', { exact: true }))
    await user.type(screen.getByLabelText('Enlace del video *'), 'https://youtu.be/abcdefghijk')
    await user.click(screen.getByRole('button', { name: /Añadir a la cola/ }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('público'))
    expect(screen.getByLabelText('Enlace del video *').value).toBe('https://youtu.be/abcdefghijk')
    expect(screen.getByLabelText('Rival *').value).toBe('Rival de ejemplo')
    expect(screen.queryByRole('table')).toBeNull()
  })

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
    expect(validateLocalVideo).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Partido añadido a la cola de demostración. No se subió ni procesó ningún video.')).toBeTruthy()
  })

  it('rechaza un archivo de baja resolución antes de encolar y permite reemplazarlo', async () => {
    const message = 'El video debe tener al menos 720p (1280×720). Grábalo o expórtalo en 720p o 1080p.'
    validateLocalVideo.mockResolvedValueOnce(message)
    const props = setup()
    const user = userEvent.setup()
    render(<Analizar {...props} />)
    await fillMatch(user)
    const fileInput = screen.getByLabelText('Selecciona el video del partido')
    const submit = screen.getByRole('button', { name: /Añadir a la cola/ })
    await user.upload(fileInput, new File(['demo'], 'baja-resolucion.mp4', { type: 'video/mp4' }))
    await user.click(submit)
    expect((await screen.findByRole('alert')).textContent).toBe(message)
    expect(fileInput.getAttribute('aria-invalid')).toBe('true')
    expect(props.send).not.toHaveBeenCalled()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByLabelText('Rival *').value).toBe('Rival de ejemplo')

    const replacement = new File(['demo'], '720p.mp4', { type: 'video/mp4' })
    await user.upload(fileInput, replacement)
    await user.click(submit)
    await screen.findByRole('table')
    expect(props.send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ file: replacement }), expect.any(Object))
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
    expect(validateLocalVideo).not.toHaveBeenCalled()
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

describe('Límite de análisis del plan (PCIT-41)', () => {
  const live = uso => {
    onSnapshot.mockImplementation((_, receive) => { receive({ docs: [] }); return vi.fn() })
    const db = { app: { options: { projectId: 'prueba' } } }
    return render(
      <MemoryRouter>
        <PlanVistaContexto value={{ plan: 'basico', uso }}>
          <Analizar db={db} session={{ uid: 'coach-1', orgId: 'equipo-1' }} uploadVideo={vi.fn()} maxBytes={1024} />
        </PlanVistaContexto>
      </MemoryRouter>,
    )
  }

  it('al llegar al límite avisa y desactiva el formulario', async () => {
    live({ usados: 15, limite: 15 })
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain('Llegaste al límite de tu plan')
    expect(alerta.textContent).toContain('15 de 15 análisis')
    expect(within(alerta).getByRole('link', { name: 'Ver mi plan' }).getAttribute('href')).toBe('/configuracion')
    expect(screen.getByLabelText('Rival *').closest('fieldset').disabled).toBe(true)
  })

  it('cuando quedan pocos análisis avisa sin bloquear el formulario', async () => {
    live({ usados: 14, limite: 15 })
    const aviso = (await screen.findByText('Te queda 1 análisis este mes')).closest('[role="status"]')
    expect(aviso).toBeTruthy()
    expect(aviso.textContent).toContain('14 de 15')
    expect(screen.getByLabelText('Rival *').closest('fieldset').disabled).toBe(false)
    cleanup()
    live({ usados: 5, limite: 15 })
    expect(await screen.findByText('El próximo análisis empieza aquí')).toBeTruthy()
    expect(screen.queryByText(/Te quedan? \d* ?análisis/)).toBeNull()
  })

  it('con análisis disponibles, o sin tope, no muestra el aviso', async () => {
    live({ usados: 14, limite: 15 })
    expect(await screen.findByText('El próximo análisis empieza aquí')).toBeTruthy()
    expect(screen.queryByText('Llegaste al límite de tu plan')).toBeNull()
    expect(screen.getByLabelText('Rival *').closest('fieldset').disabled).toBe(false)
    cleanup()
    live({ usados: 900, limite: null })
    expect(await screen.findByText('El próximo análisis empieza aquí')).toBeTruthy()
    expect(screen.queryByText('Llegaste al límite de tu plan')).toBeNull()
  })
})
