import { beforeEach, expect, it, vi } from 'vitest'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { createFirestoreInicioService } from './firestoreInicioService.js'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}))

const db = { app: { options: { projectId: 'prueba' } } }
const snap = (filas) => ({ docs: filas.map(({ id, ...data }) => ({ id, data: () => data })) })

beforeEach(() => {
  vi.resetAllMocks()
  collection.mockImplementation((_, nombre) => nombre)
  where.mockImplementation((campo, _op, valor) => `${campo}=${valor}`)
  query.mockImplementation((nombre, ...filtros) => ({ nombre, filtros }))
})

it('espera las tres fuentes, filtra por autor y se actualiza en vivo', () => {
  const escuchas = {}
  const paradas = []
  onSnapshot.mockImplementation((consulta, alCambiar) => {
    escuchas[consulta.nombre] = { consulta, alCambiar }
    const parar = vi.fn()
    paradas.push(parar)
    return parar
  })
  const onData = vi.fn()
  const service = createFirestoreInicioService({
    db,
    orgId: 'org',
    actorId: 'coach',
    role: 'coach',
    coachName: 'Coach',
  })
  const detener = service.subscribe(onData, vi.fn())

  expect(escuchas.players.consulta.filtros).toEqual(['orgId=org', 'createdBy=coach'])
  expect(escuchas.applications.consulta.filtros).toEqual(['orgId=org'])

  escuchas.players.alCambiar(
    snap([{ id: 'p1', orgId: 'org', createdBy: 'coach', fullName: 'Ana' }]),
  )
  escuchas.applications.alCambiar(snap([]))
  expect(onData).not.toHaveBeenCalled()

  escuchas.matches.alCambiar(
    snap([{ id: 'm1', orgId: 'org', createdBy: 'coach', playerId: 'p1', status: 'en cola' }]),
  )
  expect(onData.mock.lastCall[0].summary.processing).toBe(1)

  escuchas.matches.alCambiar(
    snap([
      { id: 'm1', orgId: 'org', createdBy: 'coach', playerId: 'p1', status: 'procesando' },
      { id: 'm2', orgId: 'org', createdBy: 'otro', playerId: 'p1', status: 'en cola' },
    ]),
  )
  expect(onData.mock.lastCall[0].queue.map((fila) => [fila.id, fila.status])).toEqual([
    ['m1', 'procesando'],
  ])

  detener()
  paradas.forEach((parar) => expect(parar).toHaveBeenCalled())
})

it('avisa un solo error aunque fallen varias consultas', () => {
  const errores = []
  onSnapshot.mockImplementation((_consulta, _alCambiar, alFallar) => {
    errores.push(alFallar)
    return vi.fn()
  })
  const onError = vi.fn()
  createFirestoreInicioService({ db, orgId: 'org', actorId: 'admin', role: 'admin' }).subscribe(
    vi.fn(),
    onError,
  )
  errores.forEach((alFallar) => alFallar({ code: 'permission-denied' }))
  expect(onError).toHaveBeenCalledTimes(1)
})
