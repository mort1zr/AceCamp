// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateLocalVideo } from './validateLocalVideo.js'

const LOW = 'El video debe tener al menos 720p (1280×720). Grábalo o expórtalo en 720p o 1080p.'
const LONG = 'El análisis admite videos de hasta 1 minuto. Recorta el video y vuelve a subirlo.'
const UNKNOWN = 'No se pudo verificar el video. Elige un archivo MP4 o MOV que tu navegador pueda abrir.'

function setup() {
  const video = document.createElement('video')
  const revoke = vi.fn()
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = () => 'blob:acecam-test'
    static revokeObjectURL = revoke
  })
  vi.spyOn(document, 'createElement').mockReturnValue(video)
  vi.spyOn(video, 'load').mockImplementation(() => {})
  const controller = new AbortController()
  const result = validateLocalVideo(new File(['demo'], 'video.mp4'), controller.signal)
  return { video, revoke, controller, result }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('Metadatos del video local', () => {
  it.each([
    [1280, 720, 60, null],
    [720, 1280, 60, null],
    [640, 360, 20, LOW],
    [1279, 720, 20, LOW],
    [1280, 719, 20, LOW],
    [1920, 1080, 60.01, LONG],
    [0, 0, 20, UNKNOWN],
    [1280, 720, Infinity, UNKNOWN],
  ])('valida dimensiones %i×%i y duración %s', async (width, height, duration, expected) => {
    const { video, revoke, result } = setup()
    Object.defineProperties(video, {
      videoWidth: { value: width },
      videoHeight: { value: height },
      duration: { value: duration },
    })
    video.dispatchEvent(new Event('loadedmetadata'))
    await expect(result).resolves.toBe(expected)
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:acecam-test')
    expect(video.hasAttribute('src')).toBe(false)
  })

  it('informa cuando el navegador no puede abrir el archivo', async () => {
    const { video, revoke, result } = setup()
    video.dispatchEvent(new Event('error'))
    await expect(result).resolves.toBe(UNKNOWN)
    expect(revoke).toHaveBeenCalledOnce()
  })

  it('libera el archivo al cancelar la lectura', async () => {
    const { controller, revoke, result } = setup()
    controller.abort()
    await expect(result).rejects.toHaveProperty('name', 'AbortError')
    expect(revoke).toHaveBeenCalledOnce()
  })

  it('deja de esperar cuando el navegador no devuelve metadatos', async () => {
    vi.useFakeTimers()
    const { revoke, result } = setup()
    await vi.advanceTimersByTimeAsync(10_000)
    await expect(result).resolves.toBe(UNKNOWN)
    expect(revoke).toHaveBeenCalledOnce()
  })
})
