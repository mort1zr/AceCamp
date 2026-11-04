// Registro e inicio de sesión (PCIT-21) contra los emuladores de Auth y Firestore,
// con las reglas reales de firestore.rules. Ejecutar con: npm run test:rules

import { deleteApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from 'firebase/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAuthService } from '../../src/panel/lib/auth.js'

const PROJECT = 'demo-acecam'
const HOST = '127.0.0.1'

let app
let auth
let db
let service

beforeAll(async () => {
  await fetch(`http://${HOST}:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' })
  app = initializeApp({ projectId: PROJECT, apiKey: 'demo-api-key' }, `auth-test-${Date.now()}`)
  auth = getAuth(app)
  connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true })
  db = getFirestore(app)
  connectFirestoreEmulator(db, HOST, 8080)
  service = createAuthService({ auth, db })
})

afterAll(async () => {
  await auth?.signOut()
  if (app) await deleteApp(app)
})

const account = { name: 'Coach Nuevo', orgName: 'Universidad Nueva', email: 'Nuevo@AceCam.test', password: 'acecam123' }

describe('registro con las reglas reales', () => {
  it('crea la cuenta, su organización y su ficha de coach', async () => {
    const { user, orgId } = await service.registerCoach(account)

    expect(user.email).toBe('nuevo@acecam.test')
    expect(user.displayName).toBe('Coach Nuevo')
    const profile = (await getDoc(doc(db, 'users', user.uid))).data()
    expect(profile).toMatchObject({ email: 'nuevo@acecam.test', displayName: 'Coach Nuevo', orgId, role: 'coach' })
    const org = (await getDoc(doc(db, 'orgs', orgId))).data()
    expect(org).toMatchObject({ name: 'Universidad Nueva', ownerId: user.uid, plan: 'free' })
  })

  it('cierra e inicia sesión', async () => {
    await service.logout()
    expect(auth.currentUser).toBeNull()
    await service.login({ email: account.email, password: account.password })
    expect(auth.currentUser?.email).toBe('nuevo@acecam.test')
  })

  it('rechaza un correo en uso y una contraseña incorrecta', async () => {
    await service.logout()
    await expect(service.registerCoach(account)).rejects.toMatchObject({ code: 'auth/email-already-in-use' })
    await expect(service.login({ email: account.email, password: 'mala-clave' })).rejects.toHaveProperty('code')
  })
})
