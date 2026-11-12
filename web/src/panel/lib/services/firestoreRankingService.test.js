import { beforeEach, expect, it, vi } from 'vitest'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { createFirestoreRankingService } from './firestoreRankingService.js'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}))

const db = { app: { options: { projectId: 'prueba' } } }
const snap = (filas) => ({ docs: filas.map(({ id, ...data }) => ({ id, data: () => data })) })
const decodificar = (partido) => ({
  schemaVersion: 'acecam.player-match.v1',
  player: { shots: partido.tiros, serve: partido.saque },
})

beforeEach(() => {
  vi.resetAllMocks()
  collection.mockImplementation((_, nombre) => nombre)
  where.mockImplementation((campo, _op, valor) => `${campo}=${valor}`)
  query.mockImplementation((nombre, ...filtros) => ({ nombre, filtros }))
})

it('un entrenador solo escucha sus partidos y el administrador toda la organización', () => {
  onSnapshot.mockReturnValue(() => {})
  createFirestoreRankingService({ db, orgId: 'org', actorId: 'c', role: 'coach' }).subscribe(
    vi.fn(),
    vi.fn(),
  )
  expect(onSnapshot.mock.calls[0][0].filtros).toEqual(['orgId=org', 'createdBy=c'])
  createFirestoreRankingService({ db, orgId: 'org', actorId: 'a', role: 'admin' }).subscribe(
    vi.fn(),
    vi.fn(),
  )
  expect(onSnapshot.mock.calls[1][0].filtros).toEqual(['orgId=org'])
})

it('agrupa los partidos por jugador, ignora los ajenos y avisa de los errores', () => {
  let alCambiar
  let alFallar
  const parar = vi.fn()
  onSnapshot.mockImplementation((_consulta, cambio, fallo) => {
    alCambiar = cambio
    alFallar = fallo
    return parar
  })
  const onData = vi.fn()
  const onError = vi.fn()
  const servicio = createFirestoreRankingService({
    db,
    orgId: 'org',
    actorId: 'c',
    decodeStatistics: decodificar,
  })
  const detener = servicio.subscribe(onData, onError)
  alCambiar(
    snap([
      { id: 'm1', orgId: 'org', createdBy: 'c', playerId: 'p1', status: 'en cola' },
      { id: 'm2', orgId: 'otra', createdBy: 'c', playerId: 'p2', status: 'en cola' },
      { id: 'm3', orgId: 'org', createdBy: 'otro', playerId: 'p3', status: 'en cola' },
    ]),
  )
  expect(Object.keys(onData.mock.lastCall[0])).toEqual(['p1'])
  alFallar(new Error('sin permiso'))
  expect(onError).toHaveBeenCalledOnce()
  detener()
  expect(parar).toHaveBeenCalledOnce()
})
