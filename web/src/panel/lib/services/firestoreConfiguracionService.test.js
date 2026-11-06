// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { collection, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { createFirestoreConfiguracionService } from './firestoreConfiguracionService.js'

vi.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: vi.fn((email, clave) => ({ email, clave })) },
  reauthenticateWithCredential: vi.fn(),
  updatePassword: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'server-time'),
}))

const db = { app: { options: { projectId: 'demo' } } }
const auth = { currentUser: { email: 'coach@acecam.test' } }
const crear = () =>
  createFirestoreConfiguracionService({
    db,
    auth,
    uid: 'u1',
    orgId: 'org-a',
    ahora: () => new Date(2026, 10, 15),
  })

const documento = (datos) => ({ exists: () => true, data: () => datos })
const lista = (filas) => ({
  docs: filas.map(({ id, ...datos }) => ({ id, data: () => datos })),
})

beforeEach(() => {
  vi.resetAllMocks()
  doc.mockImplementation((_, ...ruta) => ruta.join('/'))
  collection.mockImplementation((_, nombre) => nombre)
  where.mockReturnValue('filtro')
  query.mockImplementation((coleccion) => `${coleccion}?org`)
  onSnapshot.mockReturnValue(() => {})
  EmailAuthProvider.credential.mockImplementation((email, clave) => ({ email, clave }))
})

afterEach(() => localStorage.clear())

function emitir(referencia, valor) {
  const llamada = onSnapshot.mock.calls.find(([ref]) => ref === referencia)
  llamada[1](valor)
}

describe('Servicio de Configuración con Firestore', () => {
  it('junta cuenta, organización, equipo y uso del mes', () => {
    const recibir = vi.fn()
    crear().subscribe(recibir, vi.fn())
    expect(where).toHaveBeenCalledWith('orgId', '==', 'org-a')
    emitir(
      'users/u1',
      documento({ displayName: 'Coach', email: 'coach@acecam.test', role: 'coach' }),
    )
    expect(recibir).not.toHaveBeenCalled()
    emitir('users?org', lista([{ id: 'u1', displayName: 'Coach', role: 'coach' }]))
    emitir('players?org', lista([{ id: 'p1', createdBy: 'u1' }]))
    emitir('orgs/org-a', documento({ name: 'Universidad Demo', plan: 'free', ownerId: 'u1' }))
    // Sin contador todavía: 0 análisis este mes.
    expect(recibir.mock.calls.at(-1)[0].plan).toEqual({ id: 'ninguno', trial: false, used: 0, limit: 0, cycle: null, renewsAt: null })
    // El uso es el contador de la organización del mes, no los partidos visibles (PCIT-41).
    expect(onSnapshot.mock.calls.some(([ref]) => ref === 'matches?org')).toBe(false)
    emitir('orgs/org-a/usage/2026-11', documento({ analyses: 7, lastMatchId: 'm7' }))
    emitir('orgs/org-a', documento({ name: 'Universidad Demo', plan: 'prueba', ownerId: 'u1' }))
    const datos = recibir.mock.calls.at(-1)[0]
    expect(datos.account).toMatchObject({ name: 'Coach', email: 'coach@acecam.test' })
    expect(datos.organization).toMatchObject({ name: 'Universidad Demo', canEdit: true })
    expect(datos.plan).toEqual({ id: 'basico', trial: true, used: 7, limit: 15, cycle: null, renewsAt: null })
    // PCIT-158: con plan contratado, periodo y fecha de renovación.
    emitir('orgs/org-a', documento({ name: 'Universidad Demo', plan: 'pro', ownerId: 'u1', billingCycle: 'mensual',
      planSince: { toDate: () => new Date('2026-10-20T12:00:00Z') } }))
    expect(recibir.mock.calls.at(-1)[0].plan).toMatchObject({ id: 'pro', cycle: 'mensual', renewsAt: '2026-11-20T12:00:00.000Z' })
    expect(datos.isOrganization).toBe(false)
    expect(datos.team[0]).toMatchObject({ id: 'u1', players: 1 })
  })

  it('el dueño ve y crea invitaciones pendientes; un entrenador no las escucha (PCIT-40)', async () => {
    const recibir = vi.fn()
    crear().subscribe(recibir, vi.fn())
    emitir('users/u1', documento({ displayName: 'Coach', role: 'coach' }))
    emitir('users?org', lista([{ id: 'u1', displayName: 'Coach', role: 'coach' }]))
    emitir('orgs/org-a', documento({ name: 'Club', plan: 'ultra', ownerId: 'otro' }))
    expect(onSnapshot.mock.calls.some(([ref]) => ref === 'invites?org')).toBe(false)
    expect(recibir.mock.calls.at(-1)[0].organization.canInvite).toBe(false)

    emitir('orgs/org-a', documento({ name: 'Club', plan: 'ultra', ownerId: 'u1' }))
    expect(where).toHaveBeenCalledWith('status', '==', 'pendiente')
    emitir('invites?org', lista([{ id: 'ana@club.pe', email: 'ana@club.pe', role: 'admin' }]))
    const datos = recibir.mock.calls.at(-1)[0]
    expect(datos.organization.canInvite).toBe(true)
    expect(datos.team.at(-1)).toMatchObject({ email: 'ana@club.pe', role: 'admin', status: 'invitado' })

    await crear().inviteMember({ email: 'Luis@Club.pe', role: 'coach' })
    expect(setDoc).toHaveBeenCalledWith('invites/luis@club.pe', expect.objectContaining({ orgId: 'org-a', invitedBy: 'u1', status: 'pendiente' }))
  })

  it('guarda solo los campos que permiten las reglas', async () => {
    const service = crear()
    await service.saveAccount({ name: 'Coach Nuevo', position: '' })
    expect(updateDoc).toHaveBeenCalledWith('users/u1', {
      displayName: 'Coach Nuevo',
      jobTitle: null,
      updatedAt: 'server-time',
    })
    await service.saveOrganization({ name: 'Club', program: 'Tenis' })
    expect(updateDoc).toHaveBeenCalledWith('orgs/org-a', {
      name: 'Club',
      program: 'Tenis',
      updatedAt: 'server-time',
    })
  })

  it('cambia la contraseña después de confirmar la actual', async () => {
    await crear().changePassword({ current: 'vieja', next: 'nueva-clave' })
    expect(reauthenticateWithCredential).toHaveBeenCalledWith(auth.currentUser, {
      email: 'coach@acecam.test',
      clave: 'vieja',
    })
    expect(updatePassword).toHaveBeenCalledWith(auth.currentUser, 'nueva-clave')
  })
})
