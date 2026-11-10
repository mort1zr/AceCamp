import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { getBytes, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createApplicationVideoMiddleware, createApplicationVideoStore } from '../../server/video-import/applicationVideo.js'
import { submitPublicApplication } from '../../src/panel/lib/publicApplications.js'

const projectId = process.env.ACECAM_RULES_PROJECT || 'demo-acecam'
const bucketUrl = `gs://${projectId}.appspot.com`
const orgId = 'org-video-test'
const formId = 'AcecamFormDemoABC123'
const body = Buffer.from('fixture del archivo recibido')
let admin
let env
let server
let db
let bucket
let origin
let fps = 24

beforeAll(async () => {
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST
  const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST
  if (!projectId.startsWith('demo-') || !/^127\.0\.0\.1:\d+$/.test(firestoreHost ?? '') ||
      !/^127\.0\.0\.1:\d+$/.test(storageHost ?? '')) throw new Error('Usa emuladores locales aislados.')
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync(new URL('../../../firebase/firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1', port: Number(firestoreHost.split(':')[1]) },
    storage: { rules: readFileSync(new URL('../../../firebase/storage.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1', port: Number(storageHost.split(':')[1]) },
  })
  admin = initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` }, 'application-video-test')
  db = getFirestore(admin)
  bucket = getStorage(admin).bucket()
  server = createServer()
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))
  origin = `http://127.0.0.1:${server.address().port}`
  const handle = createApplicationVideoMiddleware({
    store: createApplicationVideoStore({ db, bucket }),
    probe: async () => ({ durationSeconds: 10, width: 1280, height: 720, fps, extension: 'mp4', contentType: 'video/mp4' }),
    authorize: async ({ bearerToken }) => ({
      orgId: { 'coach-video-test': orgId, 'coach-video-otro': 'org-ajena' }[bearerToken],
    }),
    origin,
  })
  server.on('request', (request, response) => handle(request, response, () => response.writeHead(404).end()))
})

afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve))
  await env?.cleanup()
  if (admin) await deleteApp(admin)
})

it('adjunta una sola vez a la postulación y permite leer el video solo a su equipo', async () => {
  const form = db.doc(`orgs/${orgId}/applicationForms/${formId}`)
  const visitor = env.unauthenticatedContext()
  const team = env.authenticatedContext('coach-video-test')
  const other = env.authenticatedContext('coach-video-otro')
  await form.set({ createdAt: new Date() })
  await db.doc('users/coach-video-test').set({ orgId, role: 'coach' })
  await db.doc('users/coach-video-otro').set({ orgId: 'org-ajena', role: 'admin' })
  const application = await submitPublicApplication(visitor.firestore(), { orgId, formId }, {
    fullName: 'Valentina Demo', birthDate: '2000-02-15', city: 'Lima', email: 'video@example.test',
    graduationYear: '2027', academy: '', message: '', consentAccepted: true, attachVideo: true,
  })
  const applicationRef = db.doc(application.path)
  const path = `orgs/${orgId}/applications/${application.id}/video.mp4`
  const endpoint = (requestOrg = orgId) => `${origin}/api/application-video/${requestOrg}/${formId}/${application.id}`
  const submit = (requestOrg = orgId) => fetch(endpoint(requestOrg), {
    method: 'POST', headers: { origin, 'Content-Type': 'application/octet-stream' }, body,
  })
  const read = (token) => fetch(endpoint(), { headers: token ? { authorization: `Bearer ${token}` } : {} })
  try {
    await assertFails(uploadBytes(ref(visitor.storage(bucketUrl), path), body, { contentType: 'video/mp4' }))
    await assertFails(updateDoc(doc(team.firestore(), application.path), { videoPaths: [path], updatedAt: serverTimestamp() }))
    expect((await submit('org-ajena')).status).toBe(403)
    const invalid = await submit()
    expect(invalid.status).toBe(422)
    expect((await invalid.json()).error).toContain('25 y 60 FPS')
    expect((await applicationRef.get()).data().videoPaths).toBeUndefined()
    expect((await bucket.file(path).exists())[0]).toBe(false)

    fps = 30
    expect((await submit()).status).toBe(200)
    const [stored] = await bucket.file(path).getMetadata()
    expect(stored.metadata?.firebaseStorageDownloadTokens).toBeUndefined()
    expect((await applicationRef.get()).data().videoPaths).toEqual([path])
    expect((await submit()).status).toBe(200)
    expect((await bucket.file(path).getMetadata())[0].generation).toBe(stored.generation)
    const accessible = await read('coach-video-test')
    expect(accessible.status).toBe(200)
    expect(accessible.headers.get('Cache-Control')).toBe('private, no-store')
    expect(Buffer.from(await accessible.arrayBuffer())).toEqual(body)
    expect((await read()).status).toBe(401)
    expect((await read('coach-video-otro')).status).toBe(403)
    await assertFails(getBytes(ref(team.storage(bucketUrl), path)))
    await assertFails(getDownloadURL(ref(team.storage(bucketUrl), path)))
    await assertFails(getBytes(ref(visitor.storage(bucketUrl), path)))
    await assertFails(getBytes(ref(other.storage(bucketUrl), path)))
    await form.delete()
    expect((await submit()).status).toBe(403)
    const retained = await read('coach-video-test')
    expect(retained.status).toBe(200)
    await retained.arrayBuffer()
  } finally {
    await Promise.all([applicationRef.delete(), form.delete(), bucket.file(path).delete({ ignoreNotFound: true })])
  }
})
