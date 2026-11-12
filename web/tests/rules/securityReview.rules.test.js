// Correcciones de la revisión de reglas (PCIT-217, parte de PCIT-67).
// Ver docs/PCIT-67-seguridad-de-datos.md, sección 4. Ejecutar con: npm run test:rules

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const ORG = 'org-a'
const now = new Date()
let env

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: process.env.ACECAM_RULES_PROJECT || 'demo-acecam',
    firestore: {
      rules: readFileSync(fileURLToPath(new URL('../../../firebase/firestore.rules', import.meta.url)), 'utf8'),
      host: '127.0.0.1',
      port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':').at(-1) ?? 8080),
    },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore()
    await setDoc(doc(db, 'users/coach-a'), { email: 'coach-a@acecam.test', displayName: 'Coach A', orgId: ORG, role: 'coach', createdAt: now })
    await setDoc(doc(db, 'applications/app-a'), {
      orgId: ORG, status: 'nueva', fullName: 'Postulante A', birthDate: '2010-01-15', city: 'Lima',
      email: 'postulante@example.test', graduationYear: 2027, createdAt: now,
      guardian: { name: 'Madre de A', phone: '+51 999 888 777', email: 'madre@example.test' },
      consent: { accepted: true, version: 'applications-v1', method: 'guardian', recordedBy: 'public-form', recordedAt: now },
    })
  })
})

const coachDb = () => env.authenticatedContext('coach-a', { email: 'coach-a@acecam.test' }).firestore()

const manualApplication = overrides => ({
  orgId: ORG, status: 'nueva', fullName: 'Postulante Manual', birthDate: '2001-02-02', city: 'Lima',
  email: 'manual@example.test', graduationYear: 2019, guardian: null, createdAt: serverTimestamp(),
  consent: { accepted: true, version: 'applications-v1', method: 'self', recordedBy: 'coach-a', recordedAt: serverTimestamp() },
  ...overrides,
})

describe('revisión de reglas · postulaciones (PCIT-217)', () => {
  it('el equipo avanza el estado, firma la revisión y escribe sus notas', async () => {
    await assertSucceeds(updateDoc(doc(coachDb(), 'applications/app-a'), {
      status: 'en revisión', reviewedBy: 'coach-a', internalNotes: 'Buen saque.', updatedAt: serverTimestamp(),
    }))
  })

  it('el equipo no reescribe los datos que envió la persona ni su apoderado', async () => {
    const ref = doc(coachDb(), 'applications/app-a')
    await assertFails(updateDoc(ref, { city: 'Cusco' }))
    await assertFails(updateDoc(ref, { guardian: null }))
    await assertFails(updateDoc(ref, { message: 'Texto cambiado' }))
    await assertFails(updateDoc(ref, { videoLinks: ['https://www.youtube.com/watch?v=otro'] }))
    await assertFails(updateDoc(ref, { status: 'en revisión', campoInventado: true }))
  })

  it('nadie firma una revisión en nombre de otra persona', async () => {
    await assertFails(updateDoc(doc(coachDb(), 'applications/app-a'), { status: 'en revisión', reviewedBy: 'admin-a' }))
  })

  it('las notas internas tienen un límite', async () => {
    await assertFails(updateDoc(doc(coachDb(), 'applications/app-a'), { internalNotes: 'x'.repeat(2001) }))
  })

  it('el alta manual exige los mismos datos y la autorización que una postulación importada', async () => {
    const db = coachDb()
    await assertSucceeds(setDoc(doc(db, 'applications/manual-ok'), manualApplication()))
    await assertFails(setDoc(doc(db, 'applications/manual-campo'), manualApplication({ playerId: 'p-a' })))
    await assertFails(setDoc(doc(db, 'applications/manual-video'), manualApplication({ videoPaths: ['orgs/org-a/x.mp4'] })))
    await assertFails(setDoc(doc(db, 'applications/manual-email'), manualApplication({ email: 'sin-arroba' })))
    await assertFails(setDoc(doc(db, 'applications/manual-firma'), manualApplication({
      consent: { accepted: true, version: 'applications-v1', method: 'self', recordedBy: 'otra-cuenta', recordedAt: serverTimestamp() },
    })))
  })

  it('un menor registrado a mano necesita los datos y la autorización de su apoderado', async () => {
    const db = coachDb()
    const minor = { birthDate: '2012-06-06', graduationYear: 2030 }
    await assertFails(setDoc(doc(db, 'applications/menor-sin-apoderado'), manualApplication(minor)))
    await assertSucceeds(setDoc(doc(db, 'applications/menor-ok'), manualApplication({
      ...minor,
      guardian: { name: 'Padre de B', phone: '+51 911 222 333', email: 'padre@example.test' },
      consent: { accepted: true, version: 'applications-v1', method: 'guardian', recordedBy: 'coach-a', recordedAt: serverTimestamp() },
    })))
  })
})
