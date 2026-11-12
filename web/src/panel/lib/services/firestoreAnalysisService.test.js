import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { createFirestoreAnalysisService } from './firestoreAnalysisService.js'
import { analysisSignature, hashAnalysisSignature } from '../analysis.js'
import { createHttpVideoImporter } from './httpVideoImportService.js'
import { createVideoImportHttpHandler } from '../../../../server/video-import/http.js'

vi.mock('firebase/firestore', () => ({ collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), onSnapshot: vi.fn(), query: vi.fn(), runTransaction: vi.fn(), serverTimestamp: vi.fn(), where: vi.fn() }))
const absent = { exists: () => false }
const found = data => ({ exists: () => true, data: () => data })
const proOrg = found({ plan: 'pro' })
const db = { app: { options: { projectId: 'test' } } }
const input = { sourceType: 'file', file: { name: 'video.mp4', type: 'video/mp4', size: 50, lastModified: 1 }, playerId: 'p1', playerPosition: 'arriba', opponent: 'Rival', matchDate: '2026-01-01', orgId: 'forged', status: 'listo' }
let tx
let upload
const matchPath = (matchId, orgId = 'org-a') => `orgs/${orgId}/matches/${matchId}/video.mp4`

beforeEach(() => {
  vi.resetAllMocks()
  collection.mockReturnValue({ kind: 'collection' })
  // doc(db, 'orgs', id) → kind 'orgs'; doc(db, 'orgs', id, 'usage', mes) → kind 'usage'.
  doc.mockImplementation((first, ...path) => first === db ? { kind: path.length > 2 ? path[2] : path[0], id: path.at(-1) } : { kind: 'match', id: path[0] ?? 'generated-id' })
  getDoc.mockImplementation(ref => Promise.resolve(ref.kind === 'players' ? { exists: () => true, data: () => ({ orgId: 'org-a', createdBy: 'coach-a' }) } : ref.kind === 'orgs' ? proOrg : absent))
  tx = { get: vi.fn(ref => Promise.resolve(ref.kind === 'orgs' ? proOrg : absent)), set: vi.fn() }
  runTransaction.mockImplementation((_, work) => work(tx))
  serverTimestamp.mockReturnValue('server-time')
  upload = vi.fn(async ({ matchId, orgId }) => matchPath(matchId, orgId))
})

const make = options => createFirestoreAnalysisService({ db, orgId: 'org-a', actorId: 'coach-a', uploadVideo: upload, maxBytes: 100, ...options })
const matchWrites = () => tx.set.mock.calls.filter(([ref]) => ref.kind === 'match')
const usageWrites = () => tx.set.mock.calls.filter(([ref]) => ref.kind === 'usage')

describe('Cola Firestore (SDK y transferencias simulados)', () => {
  it('exige capacidad explícita del adaptador antes de aceptar YouTube y no guarda su URL', async () => {
    const importer = vi.fn(async () => matchPath('youtube-match'))
    const link = { ...input, sourceType: 'link', url: 'https://youtu.be/abcdefghijk?si=example' }
    expect(make({ importVideo: importer }).supportsYouTube).toBe(false)
    await expect(make({ importVideo: importer }).enqueue(link, { requestId: 'youtube-match' })).rejects.toMatchObject({ code: 'analysis/validation' })
    expect(importer).not.toHaveBeenCalled()
    importer.supportsYouTube = true
    const service = make({ importVideo: importer })
    expect(service.supportsYouTube).toBe(true)
    await service.enqueue(link, { requestId: 'youtube-match' })
    expect(tx.set.mock.calls[0][1]).toMatchObject({ videoPath: matchPath('youtube-match'), status: 'en cola' })
    expect(JSON.stringify(tx.set.mock.calls[0][1])).not.toContain('youtu.be')
  })

  it('espera la respuesta del contrato HTTP antes de encolar un enlace y omite sus tokens', async () => {
    const origin = 'https://acecam.example'
    let finish
    const backend = vi.fn(() => new Promise(resolve => { finish = resolve }))
    const handler = createVideoImportHttpHandler({ origin, importVideo: backend })
    const importVideo = createHttpVideoImporter({
      enabled: true, origin, endpoint: '/api/video-import',
      getSession: async () => ({ orgId: 'org-a', actorId: 'coach-a', token: 'test-verified-token' }),
      fetcher: (url, options) => handler(new Request(url, options)),
    })
    const operation = make({ importVideo }).enqueue({ ...input, sourceType: 'link', url: 'https://media.example/video.mp4?signature=secret' }, { requestId: 'http-match' })
    await vi.waitFor(() => expect(backend).toHaveBeenCalledOnce())
    expect(tx.set).not.toHaveBeenCalled()
    expect(backend.mock.calls[0][0]).toMatchObject({ matchId: 'http-match', requestContext: { bearerToken: 'test-verified-token' } })
    finish(matchPath('http-match'))
    await operation
    expect(tx.set.mock.calls[0][1]).toMatchObject({ videoPath: matchPath('http-match'), status: 'en cola', orgId: 'org-a' })
    expect(JSON.stringify(tx.set.mock.calls[0][1])).not.toMatch(/signature=secret|test-verified-token/)
  })

  it('no encola si la API rechaza la sesión o devuelve una ruta no válida', async () => {
    const origin = 'https://acecam.example'
    const backend = vi.fn().mockRejectedValueOnce({ code: 'import/permission' }).mockResolvedValueOnce('https://public.example/video.mp4')
    const handler = createVideoImportHttpHandler({ origin, importVideo: backend })
    const importVideo = createHttpVideoImporter({
      enabled: true, origin, endpoint: '/api/video-import',
      getSession: async () => ({ orgId: 'org-a', actorId: 'coach-a', token: 'test-verified-token' }),
      fetcher: (url, options) => handler(new Request(url, options)),
    })
    const service = make({ importVideo })
    const link = { ...input, sourceType: 'link', url: 'https://media.example/video.mp4' }
    await expect(service.enqueue(link, { requestId: 'http-match' })).rejects.toMatchObject({ code: 'import/permission' })
    await expect(service.enqueue(link, { requestId: 'http-match' })).rejects.toMatchObject({ code: 'import/failed' })
    expect(tx.set).not.toHaveBeenCalled()
  })

  it('encola solo después de subir y usa la identidad de sesión', async () => {
    let finish
    upload.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const service = make()
    const operation = service.enqueue(input, { requestId: 'request-1' })
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    expect(runTransaction).not.toHaveBeenCalled()
    finish(matchPath('request-1'))
    await operation
    expect(tx.set.mock.calls[0][1]).toMatchObject({ orgId: 'org-a', createdBy: 'coach-a', playerId: 'p1', status: 'en cola', videoPath: matchPath('request-1'), createdAt: 'server-time' })
    expect(tx.set.mock.calls[0][1]).not.toHaveProperty('file')
  })

  it('suma el partido nuevo al contador del mes en la misma transacción (PCIT-41)', async () => {
    tx.get.mockImplementation(ref => Promise.resolve(ref.kind === 'usage' ? found({ analyses: 4, lastMatchId: 'previo' }) : ref.kind === 'orgs' ? proOrg : absent))
    await make().enqueue(input, { requestId: 'r-uso' })
    expect(doc).toHaveBeenCalledWith(db, 'orgs', 'org-a', 'usage', expect.stringMatching(/^\d{4}-\d{2}$/))
    expect(usageWrites()).toEqual([[expect.objectContaining({ kind: 'usage' }), { analyses: 5, lastMatchId: 'r-uso', updatedAt: 'server-time' }]])
  })

  it('con el límite del plan alcanzado no sube el video ni crea el partido', async () => {
    getDoc.mockImplementation(ref => Promise.resolve(ref.kind === 'players' ? found({ orgId: 'org-a', createdBy: 'coach-a' }) : ref.kind === 'orgs' ? found({ plan: 'prueba' }) : ref.kind === 'usage' ? found({ analyses: 15 }) : absent))
    await expect(make().enqueue(input, { requestId: 'r-tope' })).rejects.toMatchObject({ code: 'analysis/limit', used: 15, limit: 15 })
    expect(upload).not.toHaveBeenCalled()
    expect(runTransaction).not.toHaveBeenCalled()
  })

  it('con la prueba de Básico vencida no se analiza (PCIT-170)', async () => {
    const hace = dias => new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
    getDoc.mockImplementation(ref => Promise.resolve(ref.kind === 'players' ? found({ orgId: 'org-a', createdBy: 'coach-a' }) : ref.kind === 'orgs' ? found({ plan: 'prueba', planSince: hace(31) }) : absent))
    await expect(make().enqueue(input, { requestId: 'r-vencida' })).rejects.toMatchObject({ code: 'analysis/limit', limit: 0 })
    expect(upload).not.toHaveBeenCalled()
  })

  it('sin plan no se analiza; Ultra llega hasta 500', async () => {
    getDoc.mockImplementation(ref => Promise.resolve(ref.kind === 'players' ? found({ orgId: 'org-a', createdBy: 'coach-a' }) : ref.kind === 'orgs' ? found({ plan: 'free' }) : absent))
    await expect(make().enqueue(input, { requestId: 'r-free' })).rejects.toMatchObject({ code: 'analysis/limit', limit: 0 })
    const ultra = ref => Promise.resolve(ref.kind === 'players' ? found({ orgId: 'org-a', createdBy: 'coach-a' }) : ref.kind === 'orgs' ? found({ plan: 'ultra' }) : ref.kind === 'usage' ? found({ analyses: 499 }) : absent)
    getDoc.mockImplementation(ultra)
    tx.get.mockImplementation(ultra)
    await make().enqueue(input, { requestId: 'r-ultra' })
    expect(usageWrites()[0][1]).toMatchObject({ analyses: 500 })
  })

  it('si otro entrenador agotó el límite durante la subida, la transacción no crea el partido', async () => {
    tx.get.mockImplementation(ref => Promise.resolve(ref.kind === 'usage' ? found({ analyses: 150 }) : ref.kind === 'orgs' ? proOrg : absent))
    await expect(make().enqueue(input, { requestId: 'r-carrera' })).rejects.toMatchObject({ code: 'analysis/limit' })
    expect(upload).toHaveBeenCalledOnce()
    expect(tx.set).not.toHaveBeenCalled()
  })

  it('un partido que ya existe no vuelve a contar', async () => {
    const fingerprint = await hashAnalysisSignature(analysisSignature(input))
    tx.get.mockImplementation(ref => Promise.resolve(ref.kind === 'match'
      ? { exists: () => true, data: () => ({ orgId: 'org-a', createdBy: 'coach-a', inputFingerprint: fingerprint }) }
      : absent))
    await make().enqueue(input, { requestId: 'r-existente' })
    expect(tx.set).not.toHaveBeenCalled()
  })

  it('no encola una ruta de otro partido u organización y permite reintentar', async () => {
    const service = make()
    const options = { requestId: 'r1' }
    upload.mockResolvedValueOnce(matchPath('r1', 'org-b')).mockResolvedValueOnce(matchPath('r2'))
    await expect(service.enqueue(input, options)).rejects.toMatchObject({ code: 'analysis/video-path' })
    await expect(service.enqueue(input, options)).rejects.toMatchObject({ code: 'analysis/video-path' })
    expect(runTransaction).not.toHaveBeenCalled()
    await expect(service.enqueue(input, options)).resolves.toMatchObject({ videoPath: matchPath('r1') })
    expect(matchWrites()).toHaveLength(1)
  })

  it('rechaza jugadores de otra organización antes de transferir el video', async () => {
    getDoc.mockImplementation(ref => Promise.resolve(ref.kind === 'players' ? { exists: () => true, data: () => ({ orgId: 'org-b' }) } : absent))
    await expect(make().enqueue(input, { requestId: 'r1' })).rejects.toMatchObject({ code: 'analysis/player' })
    expect(upload).not.toHaveBeenCalled()
    expect(tx.set).not.toHaveBeenCalled()
  })

  it('conserva la subida al reintentar un fallo de guardado y comparte envíos simultáneos', async () => {
    const service = make()
    runTransaction.mockRejectedValueOnce({ code: 'unavailable' })
    await expect(service.enqueue(input, { requestId: 'r1' })).rejects.toMatchObject({ code: 'unavailable' })
    const first = service.enqueue(input, { requestId: 'r1' })
    const second = service.enqueue(input, { requestId: 'r1' })
    expect(first).toBe(second)
    await first
    expect(upload).toHaveBeenCalledTimes(1)
    expect(matchWrites()).toHaveLength(1)
  })

  it('una cancelación al finalizar la transferencia no crea un partido', async () => {
    const controller = new AbortController()
    upload.mockImplementation(async () => { controller.abort(); return matchPath('r1') })
    await expect(make().enqueue(input, { requestId: 'r1', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(tx.set).not.toHaveBeenCalled()
  })

  it('un fallo de subida no encola; un enlace usa el importador sin persistir su URL', async () => {
    upload.mockRejectedValueOnce(new Error('upload failed'))
    await expect(make().enqueue(input, { requestId: 'r1' })).rejects.toThrow('upload failed')
    expect(tx.set).not.toHaveBeenCalled()
    const importer = vi.fn().mockResolvedValue(matchPath('r2'))
    await make({ importVideo: importer }).enqueue({ ...input, sourceType: 'link', url: 'https://ejemplo.com/video.mp4?signature=secret' }, { requestId: 'r2' })
    expect(importer).toHaveBeenCalledTimes(1)
    const data = tx.set.mock.calls[0][1]
    expect(JSON.stringify(data)).not.toContain('signature=secret')
    expect(data.inputFingerprint).toMatch(/^[a-f0-9]{64}$/)
  })

  it('un reintento no devuelve un partido ajeno ni sobrescribe un estado avanzado', async () => {
    const service = make()
    const saved = await service.enqueue(input, { requestId: 'r1' })
    tx.set.mockClear()
    tx.get.mockResolvedValue({ exists: () => true, data: () => ({ ...saved, status: 'procesando' }) })
    const duplicate = await service.enqueue(input, { requestId: 'r1' })
    expect(duplicate.status).toBe('procesando')
    expect(tx.set).not.toHaveBeenCalled()
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ ...saved, orgId: 'org-b' }) })
    await expect(service.enqueue(input, { requestId: 'r1' })).rejects.toThrow('Conflicting request')
  })

  it('filtra la cola por organización y no permite enlaces sin importador', async () => {
    const stop = vi.fn()
    onSnapshot.mockReturnValue(stop)
    const service = make()
    expect(service.subscribe(vi.fn(), vi.fn())).toBe(stop)
    expect(where).toHaveBeenCalledWith('orgId', '==', 'org-a')
    expect(query).toHaveBeenCalled()
    await expect(service.enqueue({ ...input, sourceType: 'link', url: 'https://ejemplo.com/v.mp4' }, { requestId: 'r1' })).rejects.toMatchObject({ code: 'analysis/validation' })
    expect(upload).not.toHaveBeenCalled()
  })
})
