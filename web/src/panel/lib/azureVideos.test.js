import { describe, expect, it, vi } from 'vitest'
import { createAzureProcessedVideoService, createAzureVideoClient, createAzureVideoUploadService } from './azureVideos.js'
import { videoErrorMessage } from './videoUpload.js'

const API = 'https://api.acecam.test'
const SIGNED = {
  url: 'https://cuenta.blob.core.windows.net/videos/orgs/org-a/matches/m-1/video.mp4?sig=x',
  expiresOn: '2026-11-12T00:15:00.000Z',
  headers: { 'x-ms-blob-type': 'BlockBlob', 'x-ms-meta-uploadedby': 'coach-a' },
}
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const file = (size = 2048) => new File([new Uint8Array(size)], 'partido.mp4', { type: 'video/mp4' })

// XMLHttpRequest mínimo: registra la petición y deja decidir el resultado.
function fakeRequest(result = { status: 201 }) {
  const request = {
    headers: {}, upload: {},
    open: vi.fn((method, url) => Object.assign(request, { method, url })),
    setRequestHeader: (name, value) => { request.headers[name] = value },
    send: vi.fn(body => {
      request.body = body
      // Con hang, la subida queda en curso hasta que se cancele.
      if (result.hang) return
      queueMicrotask(() => {
        request.upload.onprogress?.({ lengthComputable: true, loaded: 1024, total: 2048 })
        if (result.error) request.onerror()
        else { request.status = result.status; request.onload() }
      })
    }),
    abort: () => request.onabort(),
  }
  return request
}

describe('cliente de la API de videos de Azure (PCIT-225)', () => {
  it('pide el enlace con el token de la sesión y la ruta exacta', async () => {
    const fetchImpl = vi.fn(async () => json(200, SIGNED))
    const client = createAzureVideoClient({ apiUrl: API, getToken: async () => 'token-1', fetchImpl })
    await expect(client.sign('orgs/org-a/matches/m-1/video.mp4', 'upload')).resolves.toEqual(SIGNED)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(`${API}/api/videos/sign`)
    expect(init.headers.Authorization).toBe('Bearer token-1')
    expect(JSON.parse(init.body)).toEqual({ path: 'orgs/org-a/matches/m-1/video.mp4', operation: 'upload' })
  })

  it('exige HTTPS salvo en localhost, y un enlace HTTPS en la respuesta', async () => {
    expect(() => createAzureVideoClient({ apiUrl: 'http://api.acecam.test', getToken: async () => 't' })).toThrow(/HTTPS/)
    expect(() => createAzureVideoClient({ apiUrl: 'http://localhost:8080', getToken: async () => 't' })).not.toThrow()
    const client = createAzureVideoClient({ apiUrl: API, getToken: async () => 't', fetchImpl: async () => json(200, { url: 'http://inseguro' }) })
    await expect(client.sign('orgs/org-a/matches/m-1/video.mp4', 'read')).rejects.toThrow(/inválida/)
  })

  it('traduce 401 y 403 a los mensajes de siempre', async () => {
    for (const [status, text] of [[401, /sesión expiró/], [403, /No tienes permiso/]]) {
      const client = createAzureVideoClient({ apiUrl: API, getToken: async () => 't', fetchImpl: async () => json(status, {}) })
      const error = await client.sign('orgs/org-a/matches/m-1/video.mp4', 'read').catch(e => e)
      expect(videoErrorMessage(error)).toMatch(text)
    }
    const noSession = createAzureVideoClient({ apiUrl: API, getToken: async () => undefined })
    expect(videoErrorMessage(await noSession.sign('x', 'read').catch(e => e))).toMatch(/sesión expiró/)
  })
})

describe('subida a Azure Blob (PCIT-225)', () => {
  const client = { sign: vi.fn(async () => SIGNED) }

  it('sube con PUT al enlace, con sus encabezados, informa el avance y devuelve la ruta', async () => {
    const request = fakeRequest()
    const progress = []
    const path = await createAzureVideoUploadService({ client, createRequest: () => request })
      .uploadVideo({ file: file(), orgId: 'org-a', actorId: 'coach-a', matchId: 'm-1', onProgress: value => progress.push(value) })
    expect(path).toBe('orgs/org-a/matches/m-1/video.mp4')
    expect(client.sign).toHaveBeenCalledWith(path, 'upload', undefined)
    expect(request.method).toBe('PUT')
    expect(request.url).toBe(SIGNED.url)
    expect(request.headers).toMatchObject({ 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'video/mp4' })
    expect(progress).toEqual([0, 50, 100])
  })

  it('valida el archivo antes de pedir el enlace', async () => {
    const sign = vi.fn()
    const service = createAzureVideoUploadService({ client: { sign }, createRequest: fakeRequest })
    await expect(service.uploadVideo({ file: new File(['x'], 'x.avi'), orgId: 'o', actorId: 'a', matchId: 'm' })).rejects.toMatchObject({ code: 'video/invalid-type' })
    await expect(service.uploadVideo({ file: file(), orgId: 'o', actorId: '', matchId: 'm' })).rejects.toMatchObject({ code: 'video/missing-identity' })
    expect(sign).not.toHaveBeenCalled()
  })

  it('un 403 de Azure o un corte de red dan un error claro', async () => {
    const denied = createAzureVideoUploadService({ client, createRequest: () => fakeRequest({ status: 403 }) })
    expect(videoErrorMessage(await denied.uploadVideo({ file: file(), orgId: 'o', actorId: 'a', matchId: 'm' }).catch(e => e))).toMatch(/No tienes permiso/)
    const offline = createAzureVideoUploadService({ client, createRequest: () => fakeRequest({ error: true }) })
    expect(videoErrorMessage(await offline.uploadVideo({ file: file(), orgId: 'o', actorId: 'a', matchId: 'm' }).catch(e => e))).toMatch(/conexión/)
  })

  it('se puede cancelar', async () => {
    const controller = new AbortController()
    const request = fakeRequest({ hang: true })
    const upload = createAzureVideoUploadService({ client, createRequest: () => request })
      .uploadVideo({ file: file(), orgId: 'o', actorId: 'a', matchId: 'm', signal: controller.signal })
    await vi.waitFor(() => expect(request.send).toHaveBeenCalled())
    controller.abort()
    await expect(upload).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('video procesado desde Azure Blob (PCIT-225)', () => {
  it('pide un enlace de lectura solo para el processed.mp4 de su organización', async () => {
    const client = { sign: vi.fn(async () => ({ url: 'https://cuenta.blob.core.windows.net/x?sig=y' })) }
    const fetchImpl = vi.fn(async () => new Response(new Blob(['video']), { status: 200 }))
    const service = createAzureProcessedVideoService({ client, orgId: 'org-a', fetchImpl })
    const blob = await service.load({ matchId: 'm-1', path: 'orgs/org-a/matches/m-1/processed.mp4' })
    expect(await blob.text()).toBe('video')
    expect(client.sign).toHaveBeenCalledWith('orgs/org-a/matches/m-1/processed.mp4', 'read')
    await expect(service.load({ matchId: 'm-1', path: 'orgs/org-b/matches/m-1/processed.mp4' })).rejects.toThrow(TypeError)
    await expect(service.load({ matchId: '../m', path: 'orgs/org-a/matches/../m/processed.mp4' })).rejects.toThrow(TypeError)
  })
})
