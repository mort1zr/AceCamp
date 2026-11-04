import { describe, expect, it, vi } from 'vitest'
import { createVideoImportHttpHandler } from './http.js'

const origin = 'https://acecam.example'
const body = { url: 'https://media.example/match.mp4', matchId: 'm1' }
const request = ({ headers = {}, method = 'POST', data = body, signal } = {}) => new Request(`${origin}/api/video-import`, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer verified-token', Origin: origin, ...headers }, ...(method === 'POST' ? { body: typeof data === 'string' ? data : JSON.stringify(data) } : {}), signal })
const setup = options => {
  const importVideo = vi.fn(async () => 'orgs/org1/matches/m1/video.mp4')
  return { importVideo, handle: createVideoImportHttpHandler({ origin, importVideo, ...options }) }
}

describe('Contrato HTTP de importación (sin API desplegada)', () => {
  it('pasa token al núcleo autenticado y devuelve únicamente la ruta persistida', async () => {
    const { handle, importVideo } = setup()
    const response = await handle(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ videoPath: 'orgs/org1/matches/m1/video.mp4' })
    expect(importVideo.mock.calls[0][0]).toMatchObject({ ...body, requestContext: { bearerToken: 'verified-token' } })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('rechaza métodos, origen distinto y falta de token antes de importar', async () => {
    const { handle, importVideo } = setup()
    expect((await handle(request({ method: 'GET' }))).status).toBe(405)
    expect((await handle(request({ headers: { Origin: 'https://attacker.example' } }))).status).toBe(403)
    expect((await handle(request({ headers: { Authorization: '' } }))).status).toBe(401)
    expect((await handle(request({ headers: { Authorization: 'Basic not-a-token' } }))).status).toBe(401)
    expect(importVideo).not.toHaveBeenCalled()
  })

  it('rechaza identidad/límites del navegador, tipos inválidos y JSON defectuoso', async () => {
    const { handle, importVideo } = setup()
    for (const data of [{ ...body, orgId: 'forged' }, { ...body, actorId: 'forged' }, { ...body, maxBytes: 999999 }, { ...body, matchId: '../m1' }, { ...body, matchId: 1 }, [], null, '{broken']) expect((await handle(request({ data }))).status).toBe(400)
    expect((await handle(request({ headers: { 'Content-Type': 'text/plain' } }))).status).toBe(415)
    expect(importVideo).not.toHaveBeenCalled()
  })

  it('acota cuerpos aunque no exista Content-Length y rechaza compresión', async () => {
    const { handle, importVideo } = setup({ maxBodyBytes: 100 })
    expect((await handle(request({ data: { ...body, url: 'x'.repeat(200) } }))).status).toBe(413)
    expect((await handle(request({ headers: { 'Content-Length': '1000' } }))).status).toBe(413)
    expect((await handle(request({ headers: { 'Content-Encoding': 'gzip' } }))).status).toBe(415)
    expect(importVideo).not.toHaveBeenCalled()
  })

  it('mapea permisos, límite, conflicto y saturación sin filtrar errores brutos', async () => {
    const { handle, importVideo } = setup()
    for (const [code, status] of [['import/permission', 403], ['import/size', 413], ['import/conflict', 409], ['import/busy', 429], ['import/youtube-unavailable', 422], ['import/youtube-live', 422], ['import/youtube-format', 422], ['import/youtube-service', 503], ['unknown', 502]]) {
      importVideo.mockRejectedValueOnce(Object.assign(new Error('secret-token/private-path'), { code }))
      const response = await handle(request())
      expect(response.status).toBe(status)
      expect(await response.text()).not.toContain('secret-token')
      if (status === 429) expect(response.headers.get('retry-after')).toBe('5')
    }
  })

  it('no devuelve URLs públicas ni rutas inválidas como videoPath', async () => {
    const { handle, importVideo } = setup()
    for (const path of ['https://public.example/video.mp4', '../outside', 'org1//video', 'org1/video?token=x']) {
      importVideo.mockResolvedValueOnce(path)
      expect((await handle(request())).status).toBe(502)
    }
  })

  it('devuelve timeout aunque un adaptador externo no atienda la señal', async () => {
    const { handle, importVideo } = setup({ timeoutMs: 20 })
    importVideo.mockImplementation(() => new Promise(() => {}))
    const response = await handle(request())
    expect(response.status).toBe(504)
    expect(importVideo.mock.calls[0][0].signal.aborted).toBe(true)
  })

  it('propaga desconexión al núcleo y no devuelve éxito después de cancelar', async () => {
    const { handle, importVideo } = setup()
    const controller = new AbortController()
    importVideo.mockImplementation(() => new Promise(() => {}))
    const operation = handle(request({ signal: controller.signal }))
    await vi.waitFor(() => expect(importVideo).toHaveBeenCalledOnce())
    controller.abort()
    expect((await operation).status).toBe(408)
    expect(importVideo.mock.calls[0][0].signal.aborted).toBe(true)
  })
})
