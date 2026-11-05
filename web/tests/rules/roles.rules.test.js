// PCIT-39: aislamiento real por rol, propietario y organización.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { getBytes, ref, uploadBytes } from 'firebase/storage'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { createFirestorePlayersService } from '../../src/panel/lib/services/firestorePlayersService.js'

const read = name => readFileSync(fileURLToPath(new URL(`../../../firebase/${name}`, import.meta.url)), 'utf8')
let env
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: process.env.ACECAM_RULES_PROJECT || 'demo-acecam',
    firestore: { rules: read('firestore.rules'), host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':').at(-1) || 8080) },
    storage: { rules: read('storage.rules'), host: '127.0.0.1', port: Number(process.env.STORAGE_EMULATOR_HOST?.split(':').at(-1) || 9199) } })
})
afterAll(async () => env?.cleanup())
const context = uid => env.authenticatedContext(uid)
const player = uid => ({ orgId: 'org-a', fullName: 'Jugador de prueba', birthDate: '2000-01-01', createdBy: uid,
  createdAt: new Date(), consent: { accepted: true, version: 'players-v1', method: 'self', recordedBy: uid },
  guardian: { name: 'Contacto privado', email: 'guardian@example.test', phone: '999999999' } })
beforeEach(async () => {
  await env.clearFirestore()
  await env.clearStorage()
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore()
    for (const [uid, role, orgId] of [['a', 'coach', 'org-a'], ['b', 'coach', 'org-a'], ['admin', 'admin', 'org-a'], ['outside', 'admin', 'org-b'], ['unknown', 'viewer', 'org-a']]) {
      await setDoc(doc(db, 'users', uid), { role, orgId, displayName: uid, email: `${uid}@example.test` })
    }
    for (const uid of ['a', 'b']) {
      await setDoc(doc(db, 'players', uid), player(uid))
      await setDoc(doc(db, 'matches', uid), { orgId: 'org-a', playerId: uid, createdBy: uid, status: 'listo', opponent: 'Rival', matchDate: '2026-11-01' })
      for (const name of ['video.mp4', 'processed.mp4']) await uploadBytes(ref(ctx.storage(), `orgs/org-a/matches/${uid}/${name}`), new Uint8Array([1, 2, 3]), { contentType: 'video/mp4', customMetadata: name === 'video.mp4' ? { uploadedBy: uid } : {} })
    }
  })
})

it('coach lee solo sus jugadores y partidos; admin lee toda su organización', async () => {
  const a = context('a').firestore()
  await assertSucceeds(getDoc(doc(a, 'players', 'a')))
  await assertFails(getDoc(doc(a, 'players', 'b')))
  await assertFails(getDocs(query(collection(a, 'players'), where('orgId', '==', 'org-a'))))
  const own = await assertSucceeds(getDocs(query(collection(a, 'players'), where('orgId', '==', 'org-a'), where('createdBy', '==', 'a'))))
  expect(own.size).toBe(1)
  await assertFails(getDoc(doc(a, 'matches', 'b')))
  const all = await assertSucceeds(getDocs(query(collection(context('admin').firestore(), 'players'), where('orgId', '==', 'org-a'))))
  expect(all.size).toBe(2)
  await assertSucceeds(getDoc(doc(context('admin').firestore(), 'matches', 'b')))
})

it('rechaza editar o borrar otro entrenador, otra organización y roles desconocidos', async () => {
  await assertFails(updateDoc(doc(context('a').firestore(), 'players', 'b'), { fullName: 'Cambio ajeno' }))
  await assertFails(deleteDoc(doc(context('a').firestore(), 'players', 'b')))
  await assertSucceeds(updateDoc(doc(context('admin').firestore(), 'players', 'b'), { fullName: 'Cambio autorizado' }))
  for (const uid of ['outside', 'unknown']) await assertFails(getDoc(doc(context(uid).firestore(), 'players', 'a')))
})

it('no permite autoconcederse admin, cambiar de organización ni falsificar ownership', async () => {
  const a = context('a').firestore()
  await assertFails(updateDoc(doc(a, 'users', 'a'), { role: 'admin' }))
  await assertFails(updateDoc(doc(a, 'users', 'a'), { orgId: 'org-b' }))
  await assertFails(updateDoc(doc(a, 'players', 'a'), { createdBy: 'b' }))
  await assertFails(setDoc(doc(a, 'players', 'forged'), { ...player('b'), createdAt: serverTimestamp() }))
  await assertFails(getDoc(doc(env.authenticatedContext('a', { role: 'admin' }).firestore(), 'players', 'b')))
})

it('coach no puede encolar un partido de un jugador de otro entrenador', async () => {
  const match = { orgId: 'org-a', playerId: 'b', playerPosition: 'abajo', createdBy: 'a', createdAt: serverTimestamp(), status: 'en cola', opponent: 'Rival', matchDate: '2026-11-01', videoPath: 'orgs/org-a/matches/new/video.mp4' }
  await assertFails(setDoc(doc(context('a').firestore(), 'matches', 'new'), match))
})

it('las consultas de los servicios funcionan por rol con el SDK y reglas reales', async () => {
  for (const [uid, role, expected] of [['a', 'coach', ['a']], ['admin', 'admin', ['a', 'b']]]) {
    const service = createFirestorePlayersService({ db: context(uid).firestore(), orgId: 'org-a', actorId: uid, role })
    const ids = await new Promise((resolve, reject) => { const stop = service.subscribe(rows => { stop(); resolve(rows.map(row => row.id).sort()) }, reject) })
    expect(ids).toEqual(expected)
  }
})

it('adivinar una ruta de video no permite leer ni reemplazar los archivos de otro entrenador', async () => {
  for (const name of ['video.mp4', 'processed.mp4']) {
    const path = `orgs/org-a/matches/b/${name}`
    await assertFails(getBytes(ref(context('a').storage(), path)))
    await assertSucceeds(getBytes(ref(context('b').storage(), path)))
    await assertSucceeds(getBytes(ref(context('admin').storage(), path)))
    await assertFails(getBytes(ref(context('outside').storage(), path)))
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), path)))
  }
  await assertFails(uploadBytes(ref(context('a').storage(), 'orgs/org-a/matches/b/video.mp4'), new Uint8Array([1]), { contentType: 'video/mp4', customMetadata: { uploadedBy: 'a' } }))
})

it('PCIT-42 actualiza datos con consentimiento inmutable y rechaza una edición obsoleta', async () => {
  const db = context('a').firestore()
  const service = createFirestorePlayersService({ db, orgId: 'org-a', actorId: 'a', role: 'coach' })
  const original = { id: 'a', ...(await getDoc(doc(db, 'players', 'a'))).data() }
  const input = { fullName: 'Nombre actualizado', birthDate: '2000-01-01', academy: 'Club de prueba', category: 'Adulto', utr: '10.5', orgId: 'forged', createdBy: 'forged' }
  await service.update(original, input)
  const saved = (await getDoc(doc(db, 'players', 'a'))).data()
  expect(saved).toMatchObject({ fullName: 'Nombre actualizado', utr: 10.5, createdBy: 'a', orgId: 'org-a', consent: original.consent })
  expect(saved).not.toHaveProperty('guardian')
  await expect(service.update(original, input)).rejects.toMatchObject({ code: 'players/conflict' })
  const adminDb = context('admin').firestore()
  const admin = createFirestorePlayersService({ db: adminDb, orgId: 'org-a', actorId: 'admin', role: 'admin' })
  const other = { id: 'b', ...(await getDoc(doc(adminDb, 'players', 'b'))).data() }
  await admin.update(other, input)
  expect((await getDoc(doc(adminDb, 'players', 'b'))).data().createdBy).toBe('b')
})

it('PCIT-42 valida fecha, apoderado y deporte en el servidor aunque se evite el formulario', async () => {
  const ref = doc(context('a').firestore(), 'players', 'a')
  for (const fields of [{ birthDate: '2099-01-01' }, { birthDate: '2025-02-31' }, { birthDate: '2014-01-01', guardian: null }, { guardian: { name: 'A', phone: 'no', email: 'no' } }, { utr: -1 }, { utr: Infinity }, { utr: NaN }, { nationalRanking: 1.5 }, { graduationYear: 2200 }]) {
    await assertFails(updateDoc(ref, fields))
  }
})

it('PCIT-42 elimina de plantilla conservando historial y bloquea nuevos análisis', async () => {
  const db = context('a').firestore()
  const identity = { db, orgId: 'org-a', actorId: 'a', role: 'coach' }
  const service = createFirestorePlayersService(identity)
  await service.remove({ id: 'a' })
  const removed = (await getDoc(doc(db, 'players', 'a'))).data()
  expect(removed.deletedAt).toBeTruthy()
  await assertSucceeds(getDoc(doc(db, 'matches', 'a')))
  const readRows = service => new Promise((resolve, reject) => { const stop = service.subscribe(rows => { stop(); resolve(rows) }, reject) })
  expect(await readRows(service)).toHaveLength(0)
  expect(await readRows(createFirestorePlayersService({ ...identity, includeDeleted: true }))).toHaveLength(1)
  const adminDb = context('admin').firestore()
  await createFirestorePlayersService({ db: adminDb, orgId: 'org-a', actorId: 'admin', role: 'admin' }).remove({ id: 'b' })
  expect((await getDoc(doc(adminDb, 'players', 'b'))).data().deletedAt).toBeTruthy()
  await assertFails(setDoc(doc(db, 'matches', 'after-delete'), { orgId: 'org-a', playerId: 'a', playerPosition: 'abajo', createdBy: 'a', createdAt: serverTimestamp(), status: 'en cola', opponent: 'Rival', matchDate: '2026-11-01', videoPath: 'orgs/org-a/matches/after-delete/video.mp4' }))
})
