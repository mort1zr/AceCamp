import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { createFirestoreAnalysisService } from './firestoreAnalysisService.js'

vi.mock('firebase/firestore', () => ({ collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), onSnapshot: vi.fn(), query: vi.fn(), runTransaction: vi.fn(), serverTimestamp: vi.fn(), where: vi.fn() }))
const absent = { exists: () => false }
const db = { app: { options: { projectId: 'test' } } }
const input = { sourceType: 'file', file: { name: 'video.mp4', type: 'video/mp4', size: 50, lastModified: 1 }, playerId: 'p1', playerPosition: 'arriba', opponent: 'Rival', matchDate: '2026-01-01', orgId: 'forged', status: 'listo' }
let tx
let upload

beforeEach(() => {
  vi.resetAllMocks()
  collection.mockReturnValue({ kind: 'collection' })
  doc.mockImplementation((first, second, third) => first === db ? { kind: second, id: third } : { kind: 'match', id: second ?? 'generated-id' })
  getDoc.mockImplementation(ref => Promise.resolve(ref.kind === 'players' ? { exists: () => true, data: () => ({ orgId: 'org-a' }) } : absent))
  tx = { get: vi.fn().mockResolvedValue(absent), set: vi.fn() }
  runTransaction.mockImplementation((_, work) => work(tx))
  serverTimestamp.mockReturnValue('server-time')
  upload = vi.fn().mockResolvedValue('org-a/videos/id/video.mp4')
})

const make = options => createFirestoreAnalysisService({ db, orgId: 'org-a', actorId: 'coach-a', uploadVideo: upload, maxBytes: 100, ...options })

describe('Cola Firestore (SDK y transferencias simulados)', () => {
  it('encola solo después de subir y usa la identidad de sesión', async () => {
    let finish
    upload.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const service = make()
    const operation = service.enqueue(input, { requestId: 'request-1' })
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    expect(runTransaction).not.toHaveBeenCalled()
    finish('org-a/video.mp4')
    await operation
    expect(tx.set.mock.calls[0][1]).toMatchObject({ orgId: 'org-a', createdBy: 'coach-a', playerId: 'p1', status: 'en cola', videoPath: 'org-a/video.mp4', createdAt: 'server-time' })
    expect(tx.set.mock.calls[0][1]).not.toHaveProperty('file')
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
    expect(tx.set).toHaveBeenCalledTimes(1)
  })

  it('una cancelación al finalizar la transferencia no crea un partido', async () => {
    const controller = new AbortController()
    upload.mockImplementation(async () => { controller.abort(); return 'org-a/video.mp4' })
    await expect(make().enqueue(input, { requestId: 'r1', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(tx.set).not.toHaveBeenCalled()
  })

  it('un fallo de subida no encola; un enlace usa el importador sin persistir su URL', async () => {
    upload.mockRejectedValueOnce(new Error('upload failed'))
    await expect(make().enqueue(input, { requestId: 'r1' })).rejects.toThrow('upload failed')
    expect(tx.set).not.toHaveBeenCalled()
    const importer = vi.fn().mockResolvedValue('org-a/imported.mp4')
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
