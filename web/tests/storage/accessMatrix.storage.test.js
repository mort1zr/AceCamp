// Filas de Storage de la matriz de acceso (PCIT-211, parte de PCIT-67).
// Las reglas de Storage leen la ficha del usuario y el partido en Firestore, por eso
// necesitan los dos emuladores. Ejecutar con: npm run test:rules

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MATRIX, ROLES, expected } from '../rules/accessMatrix.js'

const UIDS = {
  visitante: null,
  sinOrganizacion: 'sin-org',
  entrenador: 'coach-a',
  otroEntrenador: 'coach2-a',
  admin: 'admin-a',
  entrenadorAjeno: 'coach-b',
  adminAjeno: 'admin-b',
  plataforma: 'plataforma',
}
const ORG = 'org-a'
const VIDEO = `orgs/${ORG}/matches/m-a/video.mp4`
const APPLICATION_VIDEO = `orgs/${ORG}/applications/app-a/video.mp4`
const read = file => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8')
const bytes = () => new Uint8Array(2048).fill(7)
const mp4 = uploadedBy => ({ contentType: 'video/mp4', customMetadata: { uploadedBy } })
const idOf = role => UIDS[role] ?? role
const now = new Date()

let env

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: process.env.ACECAM_RULES_PROJECT || 'demo-acecam',
    firestore: { rules: read('../../../firebase/firestore.rules'), host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':').at(-1) || 8080) },
    storage: { rules: read('../../../firebase/storage.rules'), host: '127.0.0.1', port: Number(process.env.STORAGE_EMULATOR_HOST?.split(':').at(-1) || 9199) },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

// Los mismos datos de partida que la matriz de Firestore, reducidos a lo que leen las reglas de Storage.
async function seed() {
  await env.clearFirestore()
  await env.clearStorage()
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore()
    for (const [uid, orgId, role] of [
      ['admin-a', 'org-a', 'admin'], ['coach-a', 'org-a', 'coach'], ['coach2-a', 'org-a', 'coach'],
      ['admin-b', 'org-b', 'admin'], ['coach-b', 'org-b', 'coach'],
    ]) await setDoc(doc(db, 'users', uid), { email: `${uid}@acecam.test`, displayName: `Cuenta ${uid}`, orgId, role, createdAt: now })
    await setDoc(doc(db, 'platformAdmins/plataforma'), { createdAt: now })
    await setDoc(doc(db, 'matches/m-a'), {
      orgId: ORG, playerId: 'p-a', playerPosition: 'abajo', opponent: 'Rival', matchDate: '2026-11-01',
      videoPath: VIDEO, createdBy: 'coach-a', createdAt: now, status: 'listo',
    })
    await uploadBytes(ref(context.storage(), VIDEO), bytes(), mp4('coach-a'))
    await uploadBytes(ref(context.storage(), APPLICATION_VIDEO), bytes(), { contentType: 'video/mp4' })
  })
}

const OPERATIONS = {
  'storage.videoRead': storage => getBytes(ref(storage, VIDEO)),
  'storage.videoUpload': (storage, role) => uploadBytes(ref(storage, `orgs/${ORG}/matches/m-nuevo/video.mp4`), bytes(), mp4(idOf(role))),
  'storage.videoDelete': storage => deleteObject(ref(storage, VIDEO)),
  'storage.processedWrite': (storage, role) => uploadBytes(ref(storage, `orgs/${ORG}/matches/m-a/processed.mp4`), bytes(), mp4(idOf(role))),
  'storage.applicationVideoRead': storage => getBytes(ref(storage, APPLICATION_VIDEO)),
}

const storageRows = MATRIX.filter(row => row.id.startsWith('storage.'))
const contextFor = role => (role === 'visitante'
  ? env.unauthenticatedContext()
  : env.authenticatedContext(UIDS[role], { email: `${UIDS[role]}@acecam.test` }))

describe('matriz de acceso de Storage (PCIT-211)', () => {
  it('cada fila de Storage de la matriz tiene su operación, y no sobra ninguna', () => {
    expect(Object.keys(OPERATIONS).sort()).toEqual(storageRows.map(row => row.id).sort())
  })

  for (const row of storageRows) {
    describe(`${row.id} · ${row.operacion} ${row.recurso}`, () => {
      for (const role of Object.keys(ROLES)) {
        const allowed = expected(row, role)
        it(`${role} (${ROLES[role]}) → ${allowed ? 'permitido' : 'denegado'}`, async () => {
          await seed()
          const attempt = OPERATIONS[row.id](contextFor(role).storage(), role)
          await (allowed ? assertSucceeds(attempt) : assertFails(attempt))
        })
      }
    })
  }
})
