#!/usr/bin/env node
// Carga los datos de ejemplo en los emuladores de Firebase (PCIT-22).
//
//   Terminal 1:  npm run emulators
//   Terminal 2:  npm run seed               (borra y vuelve a cargar)
//                npm run seed -- --dry-run  (solo muestra un resumen)
//
// Por seguridad SOLO escribe en los emuladores con el proyecto demo-acecam:
// nunca toca el proyecto real.

import { readFile } from 'node:fs/promises'
import { buildSeedData } from './seedData.mjs'

const PROJECT_ID = 'demo-acecam'
const HOST = process.env.SEED_EMULATOR_HOST || '127.0.0.1'

function localEmulatorAddress(address) {
  const match = /^(?:127\.0\.0\.1|localhost):(\d{1,5})$/.exec(address)
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 65535) {
    throw new Error('El seed solo admite emuladores locales (127.0.0.1 o localhost).')
  }
  return `127.0.0.1:${Number(match[1])}`
}

const data = buildSeedData()
const summary = Object.entries(data).map(([name, list]) => `${name}: ${list.length}`).join(' · ')

if (process.argv.includes('--dry-run')) {
  console.log(`Datos de ejemplo (sin escribir) → ${summary}`)
  for (const user of data.users) console.log(`  usuario ${user.email} / ${user.password} → ${user.doc.orgId}`)
  process.exit(0)
}

const FIRESTORE = localEmulatorAddress(process.env.FIRESTORE_EMULATOR_HOST || `${HOST}:8080`)
const AUTH = localEmulatorAddress(process.env.FIREBASE_AUTH_EMULATOR_HOST || `${HOST}:9099`)
const STORAGE = localEmulatorAddress(process.env.FIREBASE_STORAGE_EMULATOR_HOST || `${HOST}:9199`)
const readyMatches = data.matches.filter(match => match.doc.processedVideoPath)
const demoVideo = await readFile(new URL('../public/demo.mp4', import.meta.url))

// Las variables de los emuladores hacen que firebase-admin no salga a internet.
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH
process.env.FIREBASE_STORAGE_EMULATOR_HOST = STORAGE
process.env.STORAGE_EMULATOR_HOST = `http://${STORAGE}`
process.env.GCLOUD_PROJECT = PROJECT_ID
delete process.env.GOOGLE_APPLICATION_CREDENTIALS

// Si algo se queda esperando, avisar en vez de colgarse sin mensaje.
const watchdog = setTimeout(() => {
  console.error('El script lleva 60 segundos sin terminar. Revisa que los emuladores sigan encendidos')
  console.error('y mándale a Axel el último paso que aparece arriba.')
  process.exit(1)
}, 60_000)

async function reachable(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2000) })
    return true
  } catch {
    return false
  }
}

console.log('1/5 Buscando los emuladores…')
if (!(await Promise.all([FIRESTORE, AUTH, STORAGE].map(address => reachable(`http://${address}/`)))).every(Boolean)) {
  console.error('No encuentro todos los emuladores de Firestore, Auth y Storage.')
  console.error('Primero ejecuta "npm run emulators" en otra terminal y vuelve a intentar.')
  process.exit(1)
}

console.log('2/5 Vaciando los emuladores…')
// Vaciar los emuladores para que el script se pueda correr varias veces.
const clear = await Promise.all([
  fetch(`http://${FIRESTORE}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' }),
  fetch(`http://${AUTH}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' }),
])
if (clear.some(response => !response.ok)) {
  console.error('No pude vaciar los emuladores. ¿Se iniciaron con "npm run emulators" (proyecto demo-acecam)?')
  process.exit(1)
}

const { initializeApp } = await import('firebase-admin/app')
const { getAuth } = await import('firebase-admin/auth')
const { getFirestore } = await import('firebase-admin/firestore')
const { getStorage } = await import('firebase-admin/storage')

const app = initializeApp({ projectId: PROJECT_ID, storageBucket: `${PROJECT_ID}.appspot.com` })
const auth = getAuth(app)
const db = getFirestore(app)

console.log('3/5 Creando usuarios en Auth…')
for (const user of data.users) {
  await auth.createUser({ uid: user.uid, email: user.email, password: user.password, displayName: user.doc.displayName })
}

console.log(`4/5 Subiendo videos de ${readyMatches.length} partidos a Storage…`)
const bucket = getStorage(app).bucket()
for (const { doc: match } of readyMatches) {
  const metadata = { contentType: 'video/mp4', cacheControl: 'private, no-store', metadata: { uploadedBy: match.createdBy } }
  await Promise.all([match.videoPath, match.processedVideoPath].map(path =>
    bucket.file(path).save(demoVideo, { metadata, resumable: false }),
  ))
}

console.log('5/5 Guardando documentos en Firestore…')
const batch = db.batch()
for (const user of data.users) batch.set(db.collection('users').doc(user.uid), user.doc)
for (const name of ['orgs', 'players', 'matches', 'applications', 'invites']) {
  for (const item of data[name]) batch.set(db.collection(name).doc(item.id), item.doc)
}
for (const item of data.usage) batch.set(db.collection('orgs').doc(item.orgId).collection('usage').doc(item.id), item.doc)
await batch.commit()

clearTimeout(watchdog)
console.log(`Listo. Datos de ejemplo cargados → ${summary}`)
for (const user of data.users) console.log(`  Inicia sesión con ${user.email} / ${user.password}`)
for (const invite of data.invites) console.log(`  Invitación pendiente: /registro?invitacion=${encodeURIComponent(invite.id)}`)
console.log('  Revisa los datos en http://127.0.0.1:4000/firestore')
process.exit(0)
