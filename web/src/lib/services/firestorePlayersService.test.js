import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore'
import { createFirestorePlayersService } from './firestorePlayersService.js'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), where: vi.fn(), query: vi.fn(), onSnapshot: vi.fn(),
  addDoc: vi.fn(), serverTimestamp: vi.fn(),
}))

const db = { app: { options: { projectId: 'test-project' } } }
const identity = { db, orgId: 'org-a', actorId: 'coach-a' }

beforeEach(() => {
  vi.resetAllMocks()
  collection.mockReturnValue('players-ref')
  where.mockReturnValue('org-filter')
  query.mockReturnValue('players-query')
  serverTimestamp.mockReturnValue('server-time')
})

describe('Contrato del adaptador Firestore (SDK simulado)', () => {
  it('consulta solo la organización de sesión y conserva el ID real del documento', () => {
    const service = createFirestorePlayersService(identity)
    const stop = vi.fn()
    onSnapshot.mockReturnValue(stop)
    const receive = vi.fn()
    const fail = vi.fn()
    expect(service.subscribe(receive, fail)).toBe(stop)
    expect(where).toHaveBeenCalledWith('orgId', '==', 'org-a')
    expect(onSnapshot.mock.calls[0][0]).toBe('players-query')
    onSnapshot.mock.calls[0][1]({ docs: [
      { id: 'real-z', data: () => ({ id: 'forged', fullName: 'Zoe' }) },
      { id: 'real-a', data: () => ({ fullName: 'Ana' }) },
    ] })
    expect(receive.mock.calls[0][0].map(row => row.id)).toEqual(['real-a', 'real-z'])
    const denied = { code: 'permission-denied' }
    onSnapshot.mock.calls[0][2](denied)
    expect(fail).toHaveBeenCalledWith(denied)
  })

  it('impide suplantar la organización y registra consentimiento con identidad y hora del servidor', async () => {
    addDoc.mockResolvedValue({ id: 'new-player' })
    const service = createFirestorePlayersService(identity)
    const result = await service.create({ fullName: 'Ana Torres', birthDate: '2004-01-01', consentAccepted: true, orgId: 'org-b', createdBy: 'attacker' })
    expect(addDoc.mock.calls[0][1]).toMatchObject({
      orgId: 'org-a', createdBy: 'coach-a', createdAt: 'server-time',
      consent: { accepted: true, recordedBy: 'coach-a', recordedAt: 'server-time', method: 'coach-attestation' },
    })
    expect(result.id).toBe('new-player')
  })

  it('no escribe entradas inválidas y propaga errores de escritura', async () => {
    const service = createFirestorePlayersService(identity)
    await expect(service.create({ fullName: 'Ana', birthDate: '2004-01-01', consentAccepted: false })).rejects.toMatchObject({ code: 'players/validation' })
    expect(addDoc).not.toHaveBeenCalled()
    addDoc.mockRejectedValue({ code: 'permission-denied' })
    await expect(service.create({ fullName: 'Ana', birthDate: '2004-01-01', consentAccepted: true })).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('no construye acceso a datos sin usuario u organización', () => {
    expect(() => createFirestorePlayersService({ db, orgId: '', actorId: 'coach' })).toThrow()
    expect(() => createFirestorePlayersService({ db, orgId: 'org', actorId: '' })).toThrow()
    expect(collection).not.toHaveBeenCalled()
  })
})
