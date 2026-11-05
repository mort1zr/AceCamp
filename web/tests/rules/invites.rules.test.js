// PCIT-40: invitar miembros y unirse a la organización con la invitación.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const rules = readFileSync(fileURLToPath(new URL('../../../firebase/firestore.rules', import.meta.url)), 'utf8')
let env
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-acecam-pcit40-invites',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':').at(-1) || 8080) } })
})
afterAll(async () => env?.cleanup())

// org-a: owner (coach dueño), admin y coach; org-b: otro dueño.
const miembros = [['owner', 'coach', 'org-a'], ['admin', 'admin', 'org-a'], ['coach', 'coach', 'org-a'], ['otro', 'coach', 'org-b']]
const db = (uid, email = `${uid}@ejemplo.test`) => env.authenticatedContext(uid, { email }).firestore()
const invitacion = (uid, overrides = {}) => ({
  email: 'nueva@ejemplo.test', orgId: 'org-a', role: 'coach', status: 'pendiente', invitedBy: uid, createdAt: serverTimestamp(), ...overrides,
})
const invitar = (uid, overrides = {}) => {
  const datos = invitacion(uid, overrides)
  return setDoc(doc(db(uid), 'invites', datos.email), datos)
}

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async ctx => {
    const admin = ctx.firestore()
    await setDoc(doc(admin, 'orgs', 'org-a'), { name: 'Universidad A', ownerId: 'owner', plan: 'ultra', createdAt: new Date() })
    await setDoc(doc(admin, 'orgs', 'org-b'), { name: 'Club B', ownerId: 'otro', plan: 'ultra', createdAt: new Date() })
    for (const [uid, role, orgId] of miembros) {
      await setDoc(doc(admin, 'users', uid), { email: `${uid}@ejemplo.test`, displayName: uid, orgId, role, createdAt: new Date() })
    }
  })
})

describe('crear invitaciones', () => {
  it('el dueño y los administradores invitan a su organización', async () => {
    await assertSucceeds(invitar('owner'))
    await assertSucceeds(invitar('admin', { email: 'otra@ejemplo.test', role: 'admin' }))
  })

  it('un entrenador o alguien de otra organización no invita', async () => {
    await assertFails(invitar('coach'))
    await assertFails(invitar('otro'))
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'invites', 'nueva@ejemplo.test'), invitacion('x')))
  })

  it('rechaza datos falsos: otro ID, rol, estado, autor o campos de más', async () => {
    await assertFails(setDoc(doc(db('owner'), 'invites', 'distinta@ejemplo.test'), invitacion('owner')))
    await assertFails(invitar('owner', { email: 'Mayus@ejemplo.test' }))
    await assertFails(invitar('owner', { role: 'dueño' }))
    await assertFails(invitar('owner', { status: 'aceptada' }))
    await assertFails(invitar('owner', { invitedBy: 'admin' }))
    await assertFails(invitar('owner', { orgId: 'org-b' }))
    await assertFails(invitar('owner', { extra: true }))
    await assertFails(invitar('owner', { email: 'owner@ejemplo.test' }))
  })

  it('no pisa una invitación que ya existe', async () => {
    await assertSucceeds(invitar('owner'))
    await assertFails(invitar('otro', { orgId: 'org-b' }))
    await assertFails(invitar('admin'))
  })
})

describe('leer y anular invitaciones', () => {
  beforeEach(() => invitar('owner'))

  it('quien invita las lista; un entrenador u otra organización no', async () => {
    const consulta = d => getDocs(query(collection(d, 'invites'), where('orgId', '==', 'org-a')))
    await assertSucceeds(consulta(db('owner')))
    await assertSucceeds(consulta(db('admin')))
    await assertFails(consulta(db('coach')))
    await assertFails(getDocs(query(collection(db('otro'), 'invites'), where('orgId', '==', 'org-a'))))
  })

  it('la persona invitada lee solo la suya', async () => {
    await assertSucceeds(getDoc(doc(db('nueva', 'nueva@ejemplo.test'), 'invites', 'nueva@ejemplo.test')))
    await assertFails(getDoc(doc(db('intruso', 'intruso@ejemplo.test'), 'invites', 'nueva@ejemplo.test')))
  })

  it('se anula mientras está pendiente', async () => {
    await assertFails(deleteDoc(doc(db('coach'), 'invites', 'nueva@ejemplo.test')))
    await assertSucceeds(deleteDoc(doc(db('admin'), 'invites', 'nueva@ejemplo.test')))
  })
})

describe('unirse con la invitación', () => {
  const unirse = (d, uid, email, userOverrides = {}, inviteOverrides = {}) => {
    const batch = writeBatch(d)
    batch.set(doc(d, 'users', uid), { email, displayName: 'Coach Invitada', orgId: 'org-a', role: 'coach', jobTitle: null, createdAt: serverTimestamp(), ...userOverrides })
    batch.update(doc(d, 'invites', email), { status: 'aceptada', acceptedBy: uid, acceptedAt: serverTimestamp(), ...inviteOverrides })
    return batch.commit()
  }

  it('se une con el orgId y el rol de su invitación', async () => {
    await invitar('owner', { role: 'admin' })
    await assertSucceeds(unirse(db('nueva', 'nueva@ejemplo.test'), 'nueva', 'nueva@ejemplo.test', { role: 'admin' }))
  })

  it('no cambia la organización ni el rol, ni se une sin aceptar la invitación', async () => {
    await invitar('owner')
    const d = db('nueva', 'nueva@ejemplo.test')
    await assertFails(unirse(d, 'nueva', 'nueva@ejemplo.test', { orgId: 'org-b' }))
    await assertFails(unirse(d, 'nueva', 'nueva@ejemplo.test', { role: 'admin' }))
    await assertFails(setDoc(doc(d, 'users', 'nueva'), { email: 'nueva@ejemplo.test', displayName: 'Coach Invitada', orgId: 'org-a', role: 'coach', createdAt: serverTimestamp() }))
  })

  it('sin invitación, con el correo de otra persona o ya usada, no se une', async () => {
    await assertFails(unirse(db('nueva', 'nueva@ejemplo.test'), 'nueva', 'nueva@ejemplo.test'))
    await invitar('owner')
    await assertFails(unirse(db('intruso', 'intruso@ejemplo.test'), 'intruso', 'nueva@ejemplo.test'))
    await assertSucceeds(unirse(db('nueva', 'nueva@ejemplo.test'), 'nueva', 'nueva@ejemplo.test'))
    await assertFails(unirse(db('segunda', 'nueva@ejemplo.test'), 'segunda', 'nueva@ejemplo.test'))
  })

  it('un miembro que ya tiene ficha no acepta otra invitación', async () => {
    await invitar('otro', { email: 'coach@ejemplo.test', orgId: 'org-b' })
    await assertFails(unirse(db('coach'), 'coach', 'coach@ejemplo.test', { orgId: 'org-b' }))
  })
})
