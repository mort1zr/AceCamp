// Reglas de Storage (PCIT-24) y uploadVideo() contra los emuladores de Storage y Firestore.
// Ejecutar con: npm run test:rules

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import { getBytes, ref, uploadBytes } from 'firebase/storage'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createVideoUploadService } from '../../src/panel/lib/videoUpload.js'

const ORG = 'org-demo'
const OTHER_ORG = 'org-club'
const COACH = 'coach-demo'
const OTHER_COACH = 'coach-club'
const path = (orgId, name = 'video.mp4', matchId = 'm-nuevo') => `orgs/${orgId}/matches/${matchId}/${name}`

const read = file => readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8')
const bytes = (size = 2048) => new Uint8Array(size).fill(7)
const mp4 = (uploadedBy = COACH) => ({ contentType: 'video/mp4', customMetadata: { uploadedBy } })

let env

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-acecam',
    firestore: { rules: read('../../../firebase/firestore.rules'), host: '127.0.0.1', port: 8080 },
    storage: { rules: read('../../../firebase/storage.rules'), host: '127.0.0.1', port: 9199 },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.clearStorage()
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore()
    await setDoc(doc(db, 'users', COACH), { email: 'coach@acecam.test', displayName: 'Coach Ramírez', orgId: ORG, role: 'coach', createdAt: new Date() })
    await setDoc(doc(db, 'users', OTHER_COACH), { email: 'coach2@acecam.test', displayName: 'Coach Paredes', orgId: OTHER_ORG, role: 'coach', createdAt: new Date() })
    await uploadBytes(ref(context.storage(), path(OTHER_ORG, 'video.mp4', 'm-club')), bytes(), mp4(OTHER_COACH))
  })
})

const coachStorage = () => env.authenticatedContext(COACH, { email: 'coach@acecam.test' }).storage()

describe('reglas de Storage', () => {
  it('el entrenador sube a su organización un .mp4 o .mov con su autoría', async () => {
    await assertSucceeds(uploadBytes(ref(coachStorage(), path(ORG)), bytes(), mp4()))
    await assertSucceeds(uploadBytes(ref(coachStorage(), path(ORG, 'video.mov')), bytes(), { contentType: 'video/quicktime', customMetadata: { uploadedBy: COACH } }))
  })

  it('niega sin sesión, a otra organización o a un usuario sin ficha', async () => {
    await assertFails(uploadBytes(ref(env.unauthenticatedContext().storage(), path(ORG)), bytes(), mp4()))
    await assertFails(uploadBytes(ref(coachStorage(), path(OTHER_ORG)), bytes(), mp4()))
    await assertFails(uploadBytes(ref(env.authenticatedContext('sin-ficha').storage(), path(ORG)), bytes(), mp4('sin-ficha')))
  })

  it('niega otros formatos, tipos que no coinciden, archivos vacíos y autoría ajena', async () => {
    await assertFails(uploadBytes(ref(coachStorage(), path(ORG, 'video.avi')), bytes(), { contentType: 'video/x-msvideo', customMetadata: { uploadedBy: COACH } }))
    await assertFails(uploadBytes(ref(coachStorage(), path(ORG, 'video.mov')), bytes(), mp4()))
    await assertFails(uploadBytes(ref(coachStorage(), path(ORG, 'otro.mp4')), bytes(), mp4()))
    await assertFails(uploadBytes(ref(coachStorage(), path(ORG)), new Uint8Array(0), mp4()))
    await assertFails(uploadBytes(ref(coachStorage(), path(ORG)), bytes(), { contentType: 'video/mp4' }))
    await assertFails(uploadBytes(ref(coachStorage(), path(ORG)), bytes(), mp4(OTHER_COACH)))
  })

  it('niega rutas fuera de orgs/{orgId}/matches', async () => {
    await assertFails(uploadBytes(ref(coachStorage(), `orgs/${ORG}/video.mp4`), bytes(), mp4()))
    await assertFails(uploadBytes(ref(coachStorage(), 'publico/video.mp4'), bytes(), mp4()))
  })

  it('solo lee los videos de su organización', async () => {
    await assertFails(getBytes(ref(coachStorage(), path(OTHER_ORG, 'video.mp4', 'm-club'))))
    await uploadBytes(ref(coachStorage(), path(ORG)), bytes(), mp4())
    await assertSucceeds(getBytes(ref(coachStorage(), path(ORG))))
  })
})

describe('uploadVideo() contra el emulador', () => {
  it('sube el archivo, informa el avance y devuelve la ruta que espera matches', async () => {
    const { uploadVideo } = createVideoUploadService({ storage: coachStorage() })
    const progress = []
    const file = new File([bytes(64 * 1024)], 'Final Regional.MP4', { type: 'video/mp4' })
    const videoPath = await uploadVideo({ file, orgId: ORG, actorId: COACH, matchId: 'm-nuevo', onProgress: percent => progress.push(percent) })
    expect(videoPath).toBe('orgs/org-demo/matches/m-nuevo/video.mp4')
    expect(progress.at(0)).toBe(0)
    expect(progress.at(-1)).toBe(100)
    expect((await getBytes(ref(coachStorage(), videoPath))).byteLength).toBe(64 * 1024)
  })

  it('las reglas rechazan subir a otra organización', async () => {
    const { uploadVideo } = createVideoUploadService({ storage: coachStorage() })
    const file = new File([bytes()], 'partido.mov', { type: 'video/quicktime' })
    await expect(uploadVideo({ file, orgId: OTHER_ORG, actorId: COACH, matchId: 'm-x' })).rejects.toMatchObject({ code: 'storage/unauthorized' })
  })
})
