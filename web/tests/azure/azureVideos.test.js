// Prueba de concepto de videos en Azure Blob (PCIT-223, historia PCIT-222).
// Azurite (emulador oficial de Azure Storage) + emuladores de Auth y Firestore.
// Ejecutar con: npm run test:rules   (Azurite se enciende y apaga dentro de la prueba)

import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'
import { fileURLToPath } from 'node:url'
import { BlobServiceClient } from '@azure/storage-blob'
import { deleteApp, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAzureVideoHandler } from '../../server/azure-videos/http.js'
import { createSasSigner } from '../../server/azure-videos/sas.js'

const ORIGIN = 'http://localhost:5173'
const CONTAINER = 'videos'
const PROJECT = process.env.ACECAM_RULES_PROJECT || 'demo-acecam'
const VIDEO = 'orgs/org-a/matches/m-a/video.mp4'
const PROCESSED = 'orgs/org-a/matches/m-a/processed.mp4'
const NEW_VIDEO = 'orgs/org-a/matches/m-nuevo/video.mp4'
const bytes = new Uint8Array(4096).fill(7)

let azurite
let app
let db
let serviceClient
let handler
const tokens = {}

const waitForPort = (port, deadline = Date.now() + 30_000) => new Promise((resolve, reject) => {
  const attempt = () => {
    const socket = createConnection({ host: '127.0.0.1', port }, () => { socket.end(); resolve() })
    socket.on('error', () => (Date.now() > deadline ? reject(new Error('Azurite no arrancó')) : setTimeout(attempt, 250)))
  }
  attempt()
})

async function idToken(uid) {
  const auth = getAuth(app)
  const email = `${uid}@acecam.test`
  await auth.deleteUser(uid).catch(() => {})
  await auth.createUser({ uid, email, password: 'clave-de-prueba' })
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'clave-de-prueba', returnSecureToken: true }),
  })
  return (await response.json()).idToken
}

beforeAll(async () => {
  const bin = fileURLToPath(new URL('../../node_modules/azurite/dist/src/blob/main.js', import.meta.url))
  azurite = spawn(process.execPath, [bin, '--blobHost', '127.0.0.1', '--blobPort', '10000', '--inMemoryPersistence', '--skipApiVersionCheck', '--silent'], { stdio: 'ignore' })
  await waitForPort(10000)

  app = initializeApp({ projectId: PROJECT }, `azure-videos-${Date.now()}`)
  db = getFirestore(app)
  for (const [uid, orgId, role] of [['coach-a', 'org-a', 'coach'], ['coach2-a', 'org-a', 'coach'], ['admin-a', 'org-a', 'admin'], ['coach-b', 'org-b', 'coach']]) {
    await db.doc(`users/${uid}`).set({ orgId, role, email: `${uid}@acecam.test`, displayName: uid, createdAt: new Date() })
    tokens[uid] = await idToken(uid)
  }
  await db.doc('matches/m-a').set({ orgId: 'org-a', createdBy: 'coach-a', status: 'listo', videoPath: VIDEO })
  await db.doc('matches/m-nuevo').delete()

  // "UseDevelopmentStorage=true" apunta a Azurite con su cuenta pública de desarrollo.
  serviceClient = BlobServiceClient.fromConnectionString('UseDevelopmentStorage=true')
  const container = serviceClient.getContainerClient(CONTAINER)
  await container.createIfNotExists()
  await container.getBlockBlobClient(VIDEO).uploadData(bytes, { metadata: { uploadedby: 'coach-a' } })
  await container.getBlockBlobClient(PROCESSED).uploadData(bytes)

  const signer = createSasSigner({ serviceClient, container: CONTAINER, allowHttp: true })
  handler = createAzureVideoHandler({ verifyIdToken: token => getAuth(app).verifyIdToken(token), db, signer, origin: ORIGIN })
}, 60_000)

afterAll(async () => {
  if (app) await deleteApp(app)
  azurite?.kill()
})

const sign = (uid, body) => handler(new Request(`${ORIGIN}/api/videos/sign`, {
  method: 'POST',
  headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(uid ? { Authorization: `Bearer ${tokens[uid] ?? uid}` } : {}) },
  body: JSON.stringify(body),
}))

const upload = (signed, data = bytes) => fetch(signed.url, { method: 'PUT', headers: signed.headers, body: data })

describe('videos en Azure Blob con enlaces temporales (PCIT-223)', () => {
  it('el entrenador sube un video nuevo y luego lo lee con un enlace temporal', async () => {
    const response = await sign('coach-a', { path: NEW_VIDEO, operation: 'upload' })
    expect(response.status).toBe(200)
    const signed = await response.json()
    expect(signed.headers['x-ms-meta-uploadedby']).toBe('coach-a')
    expect((await upload(signed)).status).toBe(201)

    const read = await (await sign('coach-a', { path: NEW_VIDEO, operation: 'read' })).json()
    const download = await fetch(read.url)
    expect(download.status).toBe(200)
    expect(download.headers.get('content-type')).toBe('video/mp4')
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(bytes)
  })

  it('antes de crear el partido, solo quien subió el video puede leerlo', async () => {
    expect((await sign('coach2-a', { path: NEW_VIDEO, operation: 'read' })).status).toBe(403)
    expect((await sign('admin-a', { path: NEW_VIDEO, operation: 'read' })).status).toBe(200)
  })

  it('un partido creado: lo leen su entrenador y el admin, no otro entrenador ni otro club', async () => {
    expect((await sign('coach-a', { path: VIDEO, operation: 'read' })).status).toBe(200)
    expect((await sign('admin-a', { path: VIDEO, operation: 'read' })).status).toBe(200)
    expect((await sign('coach2-a', { path: VIDEO, operation: 'read' })).status).toBe(403)
    expect((await sign('coach-b', { path: VIDEO, operation: 'read' })).status).toBe(403)
    expect((await sign('coach-b', { path: NEW_VIDEO, operation: 'upload' })).status).toBe(403)
  })

  it('el video procesado se lee, pero nadie lo sube desde la web', async () => {
    expect((await sign('coach-a', { path: PROCESSED, operation: 'read' })).status).toBe(200)
    expect((await sign('admin-a', { path: PROCESSED, operation: 'upload' })).status).toBe(403)
  })

  it('sin sesión o con un token falso no hay enlace', async () => {
    expect((await sign(null, { path: VIDEO, operation: 'read' })).status).toBe(401)
    expect((await sign('token-falso', { path: VIDEO, operation: 'read' })).status).toBe(401)
  })

  it('rechaza rutas inventadas, campos extra y otros orígenes', async () => {
    for (const path of ['orgs/org-a/matches/m-a/../../org-b/x.mp4', 'orgs/org-a/applications/a/video.mp4', 'otra/ruta.mp4']) {
      expect((await sign('admin-a', { path, operation: 'read' })).status, path).toBe(400)
    }
    expect((await sign('admin-a', { path: VIDEO, operation: 'read', extra: 1 })).status).toBe(400)
    expect((await sign('admin-a', { path: VIDEO, operation: 'delete' })).status).toBe(400)
    const foreign = await handler(new Request(`${ORIGIN}/api/videos/sign`, {
      method: 'POST', headers: { Origin: 'https://otro-sitio.test', Authorization: `Bearer ${tokens['admin-a']}` },
      body: JSON.stringify({ path: VIDEO, operation: 'read' }),
    }))
    expect(foreign.status).toBe(403)
  })

  it('un enlace de lectura no sirve para escribir', async () => {
    const read = await (await sign('coach-a', { path: VIDEO, operation: 'read' })).json()
    const overwrite = await fetch(read.url, { method: 'PUT', headers: { 'x-ms-blob-type': 'BlockBlob' }, body: new Uint8Array(10) })
    expect(overwrite.status).toBe(403)
  })

  it('un enlace caducado deja de funcionar', async () => {
    const past = createSasSigner({ serviceClient, container: CONTAINER, allowHttp: true, now: () => new Date(Date.now() - 20 * 60_000) })
    const expired = await past.sign(VIDEO, { permissions: 'r', minutes: 10 })
    expect((await fetch(expired.url)).status).toBe(403)
  })
})
