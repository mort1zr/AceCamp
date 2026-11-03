import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { DASHBOARD_STATISTICS_SCHEMA } from '../dashboardOverview.js'
import { createFirestoreDashboardService } from './firestoreDashboardService.js'

vi.mock('firebase/firestore', () => ({ collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), onSnapshot: vi.fn(), query: vi.fn(), where: vi.fn() }))
const db = { app: { options: { projectId: 'test-project' } } }
const make = options => createFirestoreDashboardService({ db, orgId: 'org-a', actorId: 'coach-a', decodeStatistics: row => row.statistics, ...options })
let stop

beforeEach(() => {
  vi.resetAllMocks()
  doc.mockReturnValue('player-ref')
  collection.mockReturnValue('matches-ref')
  getDoc.mockResolvedValue({ exists: () => true, data: () => ({ orgId: 'org-a' }) })
  where.mockImplementation((field, op, value) => ({ field, op, value }))
  query.mockReturnValue('query-ref')
  stop = vi.fn()
  onSnapshot.mockReturnValue(stop)
})

function snapshot(id = 'actual-id', overrides = {}) {
  return { docs: [{ id, data: () => ({ id: 'forged-id', orgId: 'org-a', playerId: 'p1', status: 'listo', statistics: { schemaVersion: DASHBOARD_STATISTICS_SCHEMA, playerId: 'p1', doubleFaults: 0 }, ...overrides }) }] }
}

describe('Consulta Dashboard (SDK simulado)', () => {
  it('exige identidad y contrato de estadísticas antes de consultar', () => {
    expect(() => make({ decodeStatistics: undefined })).toThrow('decoder')
    expect(() => make({ orgId: '' })).toThrow()
    expect(() => make({ actorId: '' })).toThrow()
    expect(getDoc).not.toHaveBeenCalled()
    expect(onSnapshot).not.toHaveBeenCalled()
  })

  it('verifica el jugador y filtra matches por organización y jugador', async () => {
    const receive = vi.fn()
    const fail = vi.fn()
    const unsubscribe = make().subscribePlayer('p1', receive, fail)
    await vi.waitFor(() => expect(onSnapshot).toHaveBeenCalledTimes(1))
    expect(doc).toHaveBeenCalledWith(db, 'players', 'p1')
    expect(where.mock.calls).toEqual([['orgId', '==', 'org-a'], ['playerId', '==', 'p1']])
    onSnapshot.mock.calls[0][1](snapshot())
    expect(receive.mock.calls[0][0].metrics).toMatchObject({ analyzedMatches: 1, doubleFaults: 0 })
    expect(fail).not.toHaveBeenCalled()
    unsubscribe()
    unsubscribe()
    expect(stop).toHaveBeenCalledTimes(1)
    onSnapshot.mock.calls[0][1](snapshot())
    expect(receive).toHaveBeenCalledTimes(1)
  })

  it('no consulta partidos de un jugador ajeno ni de un jugador inexistente', async () => {
    for (const document of [{ exists: () => false }, { exists: () => true, data: () => ({ orgId: 'org-b' }) }]) {
      getDoc.mockResolvedValue(document)
      const fail = vi.fn()
      make().subscribePlayer('p1', vi.fn(), fail)
      await vi.waitFor(() => expect(fail).toHaveBeenCalledWith(expect.objectContaining({ code: 'permission-denied' })))
    }
    expect(onSnapshot).not.toHaveBeenCalled()
  })

  it('cancelar antes de resolver el jugador impide abrir la suscripción', async () => {
    let finish
    getDoc.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const receive = vi.fn()
    const fail = vi.fn()
    const unsubscribe = make().subscribePlayer('p1', receive, fail)
    unsubscribe()
    finish({ exists: () => true, data: () => ({ orgId: 'org-a' }) })
    await Promise.resolve()
    expect(onSnapshot).not.toHaveBeenCalled()
    expect(receive).not.toHaveBeenCalled()
    expect(fail).not.toHaveBeenCalled()
  })

  it('usa el ID físico del documento y filtra de nuevo datos de otro scope', async () => {
    const receive = vi.fn()
    make().subscribePlayer('p1', receive, vi.fn())
    await vi.waitFor(() => expect(onSnapshot).toHaveBeenCalledTimes(1))
    onSnapshot.mock.calls[0][1]({ docs: [...snapshot('a').docs, ...snapshot('b').docs, ...snapshot('foreign', { orgId: 'org-b' }).docs] })
    expect(receive.mock.calls[0][0].metrics.analyzedMatches).toBe(2)
  })

  it('propaga errores de lectura y no los transforma en un resumen de ceros', async () => {
    getDoc.mockRejectedValue({ code: 'permission-denied' })
    const receive = vi.fn()
    const fail = vi.fn()
    make().subscribePlayer('p1', receive, fail)
    await vi.waitFor(() => expect(fail).toHaveBeenCalledWith({ code: 'permission-denied' }))
    expect(receive).not.toHaveBeenCalled()
  })

  it('un error del decoder cierra la escucha y nunca entrega métricas inventadas', async () => {
    const receive = vi.fn()
    const fail = vi.fn()
    const unsubscribe = make({ decodeStatistics: () => { throw new Error('Unmapped JSON') } }).subscribePlayer('p1', receive, fail)
    await vi.waitFor(() => expect(onSnapshot).toHaveBeenCalledTimes(1))
    onSnapshot.mock.calls[0][1](snapshot())
    expect(fail).toHaveBeenCalledWith(expect.objectContaining({ message: 'Unmapped JSON' }))
    expect(stop).toHaveBeenCalledTimes(1)
    unsubscribe()
    expect(stop).toHaveBeenCalledTimes(1)
    expect(receive).not.toHaveBeenCalled()
  })

  it('una consulta vacía entrega el conteo conocido y deja métricas sin datos', async () => {
    const receive = vi.fn()
    make().subscribePlayer('p1', receive, vi.fn())
    await vi.waitFor(() => expect(onSnapshot).toHaveBeenCalledTimes(1))
    onSnapshot.mock.calls[0][1]({ docs: [] })
    expect(receive.mock.calls[0][0].metrics).toEqual({ analyzedMatches: 0, averageServeSpeed: null, firstServeInRate: null, doubleFaults: null })
  })
})
