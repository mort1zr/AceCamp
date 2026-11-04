import { describe, expect, it, vi } from 'vitest'
import { createHttpVideoImporter } from './httpVideoImportService.js'
import { analysisErrorMessage } from '../analysis.js'

const origin = 'https://acecam.example'
const input = { url: 'https://media.example/video.mp4?signature=secret', matchId: 'm1', orgId: 'org1', actorId: 'user1', maxBytes: 99999 }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
function setup(options = {}) {
  const getSession = vi.fn(async () => ({ orgId: 'org1', actorId: 'user1', token: 'verified-token' }))
  const fetcher = vi.fn(async () => json({ videoPath: 'orgs/org1/matches/m1/video.mp4' }))
  return { getSession, fetcher, importVideo: createHttpVideoImporter({ enabled: true, origin, endpoint: '/api/video-import', getSession, fetcher, ...options }) }
}

describe('Adaptador de navegador para importar video', () => {
  it('publica capacidad de YouTube solo cuando se configura explícitamente', () => {
    expect(setup().importVideo.supportsYouTube).toBe(false)
    expect(setup({ supportsYouTube: true }).importVideo.supportsYouTube).toBe(true)
    expect(createHttpVideoImporter({ supportsYouTube: true })).toBeUndefined()
  })

  it('queda deshabilitado por defecto y no permite enviar tokens a otro origen', () => {
    expect(createHttpVideoImporter()).toBeUndefined()
    expect(() => setup({ endpoint: 'https://attacker.example/import' })).toThrow()
    expect(() => setup({ endpoint: 'https://user:password@acecam.example/import' })).toThrow()
  })

  it('envía solo URL e ID con token de la sesión y bloquea redirecciones', async () => {
    const { importVideo, fetcher } = setup()
    const progress = vi.fn()
    expect(await importVideo({ ...input, onProgress: progress })).toBe('orgs/org1/matches/m1/video.mp4')
    const [url, options] = fetcher.mock.calls[0]
    expect(url).toBe(`${origin}/api/video-import`)
    expect(options).toMatchObject({ redirect: 'error', mode: 'same-origin', credentials: 'omit', cache: 'no-store', headers: { Authorization: 'Bearer verified-token' } })
    expect(JSON.parse(options.body)).toEqual({ url: input.url, matchId: input.matchId })
    expect(progress.mock.calls.map(call => call[0])).toEqual([0, 100])
  })

  it('rechaza cambio de sesión antes de transferir y no envía token en cuerpo', async () => {
    const { importVideo, getSession, fetcher } = setup()
    getSession.mockResolvedValue({ orgId: 'other-org', actorId: 'user1', token: 'private-token' })
    await expect(importVideo(input)).rejects.toMatchObject({ code: 'import/permission' })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('traduce códigos del servidor, conserva el intento y no muestra mensajes brutos', async () => {
    const { importVideo, fetcher } = setup()
    fetcher.mockResolvedValueOnce(json({ error: { code: 'import/busy', message: 'private token' } }, 429))
    await expect(importVideo(input)).rejects.toMatchObject({ code: 'import/busy', message: expect.not.stringContaining('private') })
    expect(await importVideo(input)).toBe('orgs/org1/matches/m1/video.mp4')
    expect(JSON.parse(fetcher.mock.calls[0][1].body).matchId).toBe(JSON.parse(fetcher.mock.calls[1][1].body).matchId)
    expect(analysisErrorMessage({ code: 'import/busy' })).toContain('Espera')
  })

  it('rechaza HTML, JSON enorme y rutas peligrosas; no confirma progreso de éxito', async () => {
    const { importVideo, fetcher } = setup()
    const progress = vi.fn()
    for (const response of [new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } }), json({ padding: 'x'.repeat(9000) }), json({ videoPath: 'https://other.example/video.mp4' }), json({ videoPath: '../outside' })]) {
      fetcher.mockResolvedValueOnce(response)
      await expect(importVideo({ ...input, onProgress: progress })).rejects.toMatchObject({ code: expect.stringMatching(/^import\//) })
    }
    expect(progress.mock.calls.some(call => call[0] === 100)).toBe(false)
  })

  it('cancela antes de la petición y durante ella, con señal propagada', async () => {
    const { importVideo, fetcher, getSession } = setup()
    const cancelled = new AbortController()
    cancelled.abort()
    await expect(importVideo({ ...input, signal: cancelled.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(getSession).not.toHaveBeenCalled()
    const controller = new AbortController()
    fetcher.mockImplementationOnce(() => new Promise(() => {}))
    const operation = importVideo({ ...input, signal: controller.signal })
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
    controller.abort()
    await expect(operation).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
  })

  it('acota también una lectura de sesión que no termina', async () => {
    const { importVideo, fetcher } = setup({ timeoutMs: 20, getSession: () => new Promise(() => {}) })
    await expect(importVideo(input)).rejects.toMatchObject({ code: 'import/timeout' })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
