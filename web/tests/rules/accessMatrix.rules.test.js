// Pruebas de la matriz de acceso (PCIT-211, parte de PCIT-67) contra el emulador de Firestore.
// Recorre accessMatrix.js: una prueba por rol y operación. Si una regla se debilita o se
// endurece sin actualizar la matriz, falla la celda con su rol y su operación.
// Las filas de Storage están en tests/storage/accessMatrix.storage.test.js.
// Ejecutar con: npm run test:rules

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MATRIX, ROLES, expected } from './accessMatrix.js'

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
const FORM = 'EnlaceClubA000000001'
const INVITE = 'nuevo@club-a.test'
const now = new Date()
const PERIOD = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
const email = uid => `${uid}@acecam.test`
// Un visitante no tiene UID: los IDs que dependen del rol usan su nombre.
const idOf = role => UIDS[role] ?? role

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
  await seed()
})

afterAll(async () => {
  await env?.cleanup()
})

// Datos de partida descritos en accessMatrix.js.
async function seed() {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore()
    const batch = writeBatch(db)
    const set = (path, data) => batch.set(doc(db, path), data)
    set('orgs/org-a', { name: 'Club A', ownerId: 'admin-a', plan: 'pro', createdAt: now })
    set('orgs/org-b', { name: 'Club B', ownerId: 'admin-b', plan: 'pro', createdAt: now })
    for (const [uid, orgId, role] of [
      ['admin-a', 'org-a', 'admin'], ['coach-a', 'org-a', 'coach'], ['coach2-a', 'org-a', 'coach'],
      ['admin-b', 'org-b', 'admin'], ['coach-b', 'org-b', 'coach'],
    ]) set(`users/${uid}`, { email: email(uid), displayName: `Cuenta ${uid}`, orgId, role, createdAt: now })
    set('platformAdmins/plataforma', { createdAt: now })
    set(`orgs/${ORG}/usage/${PERIOD}`, { analyses: 1, lastMatchId: 'm-a', updatedAt: now })
    set('players/p-a', {
      orgId: ORG, fullName: 'Jugador A', birthDate: '2000-01-15', createdBy: 'coach-a', createdAt: now,
      consent: { accepted: true, version: 'players-v1', method: 'coach-attestation', recordedBy: 'coach-a', recordedAt: now },
    })
    set('matches/m-a', {
      orgId: ORG, playerId: 'p-a', playerPosition: 'abajo', opponent: 'Rival', matchDate: '2026-11-01',
      videoPath: `orgs/${ORG}/matches/m-a/video.mp4`, createdBy: 'coach-a', createdAt: now, status: 'listo',
    })
    set('matches/m-a/coachNotes/coach-a', { text: 'Nota privada', updatedAt: now })
    set(`invites/${INVITE}`, { email: INVITE, orgId: ORG, role: 'coach', status: 'pendiente', invitedBy: 'admin-a', createdAt: now })
    set(`orgs/${ORG}/applicationForms/${FORM}`, { createdAt: now })
    set(`orgs/${ORG}/recruitmentIntegrations/googleForms`, { formUrl: 'https://forms.gle/clubA123', spreadsheetId: 'hojaA', sheetId: 0 })
    set('applications/app-a', {
      orgId: ORG, formId: FORM, status: 'nueva', fullName: 'Postulante A', birthDate: '2000-01-15', city: 'Lima',
      email: 'postulante@example.test', graduationYear: 2018, guardian: null, createdAt: now,
      consent: { accepted: true, version: 'applications-v1', method: 'self', recordedBy: 'public-form', recordedAt: now },
    })
    set('platformAudit/audit-1', {
      actorId: 'plataforma', createdAt: now, entity: 'orgs', targetId: 'org-b',
      before: { name: 'Club B', plan: 'basico', archived: false }, after: { name: 'Club B', plan: 'pro', archived: false },
    })
    await batch.commit()
  })
}

const byOrg = (db, name) => query(collection(db, name), where('orgId', '==', ORG))
const ownedByCoachA = (db, name) => query(collection(db, name), where('orgId', '==', ORG), where('createdBy', '==', 'coach-a'))

// Una operación por fila de la matriz. Reciben el Firestore del rol y su nombre.
const OPERATIONS = {
  'platformAdmins.getPropia': (db, role) => getDoc(doc(db, 'platformAdmins', idOf(role))),
  'platformAdmins.getAjena': db => getDoc(doc(db, 'platformAdmins/plataforma')),
  'platformAdmins.list': db => getDocs(collection(db, 'platformAdmins')),
  'platformAdmins.create': (db, role) => setDoc(doc(db, 'platformAdmins', idOf(role)), { createdAt: serverTimestamp() }),

  'users.getPropia': (db, role) => getDoc(doc(db, 'users', idOf(role))),
  'users.get': db => getDoc(doc(db, 'users/coach-a')),
  'users.list': db => getDocs(byOrg(db, 'users')),
  'users.registro': (db, role) => {
    const uid = idOf(role)
    const batch = writeBatch(db)
    batch.set(doc(db, 'orgs', `nueva-${uid}`), { name: 'Club nuevo', ownerId: uid, plan: 'free', createdAt: serverTimestamp() })
    batch.set(doc(db, 'users', uid), {
      email: email(uid), displayName: 'Cuenta nueva', orgId: `nueva-${uid}`, role: 'coach', createdAt: serverTimestamp(),
    })
    return batch.commit()
  },
  'users.update': db => updateDoc(doc(db, 'users/coach-a'), { displayName: 'Nombre editado', updatedAt: serverTimestamp() }),
  'users.delete': db => deleteDoc(doc(db, 'users/coach-a')),

  'orgs.get': db => getDoc(doc(db, 'orgs', ORG)),
  'orgs.list': db => getDocs(collection(db, 'orgs')),
  'orgs.update': db => updateDoc(doc(db, 'orgs', ORG), { name: 'Club A renombrado', updatedAt: serverTimestamp() }),
  'orgs.delete': db => deleteDoc(doc(db, 'orgs', ORG)),

  'usage.get': db => getDoc(doc(db, `orgs/${ORG}/usage/${PERIOD}`)),
  'usage.update': db => updateDoc(doc(db, `orgs/${ORG}/usage/${PERIOD}`), {
    analyses: 2, lastMatchId: 'm-sin-crear', updatedAt: serverTimestamp(),
  }),
  'usage.delete': db => deleteDoc(doc(db, `orgs/${ORG}/usage/${PERIOD}`)),

  'invites.get': db => getDoc(doc(db, 'invites', INVITE)),
  'invites.list': db => getDocs(byOrg(db, 'invites')),
  'invites.create': (db, role) => setDoc(doc(db, 'invites', 'otro@club-a.test'), {
    email: 'otro@club-a.test', orgId: ORG, role: 'coach', status: 'pendiente', invitedBy: idOf(role), createdAt: serverTimestamp(),
  }),
  'invites.accept': (db, role) => updateDoc(doc(db, 'invites', INVITE), {
    status: 'aceptada', acceptedBy: idOf(role), acceptedAt: serverTimestamp(),
  }),
  'invites.delete': db => deleteDoc(doc(db, 'invites', INVITE)),

  'players.get': db => getDoc(doc(db, 'players/p-a')),
  'players.list': db => getDocs(ownedByCoachA(db, 'players')),
  'players.create': (db, role) => setDoc(doc(db, 'players', `nuevo-${idOf(role)}`), {
    orgId: ORG, fullName: 'Jugador Nuevo', birthDate: '1999-05-05', createdBy: idOf(role), createdAt: serverTimestamp(),
    consent: { accepted: true, version: 'players-v1', method: 'coach-attestation', recordedBy: idOf(role), recordedAt: serverTimestamp() },
  }),
  'players.update': db => updateDoc(doc(db, 'players/p-a'), { fullName: 'Jugador Editado', updatedAt: serverTimestamp() }),
  'players.delete': db => deleteDoc(doc(db, 'players/p-a')),

  'matches.get': db => getDoc(doc(db, 'matches/m-a')),
  'matches.list': db => getDocs(ownedByCoachA(db, 'matches')),
  'matches.create': (db, role) => {
    const batch = writeBatch(db)
    batch.set(doc(db, 'matches/m-nuevo'), {
      orgId: ORG, playerId: 'p-a', playerPosition: 'abajo', opponent: 'Rival Nuevo', matchDate: '2026-11-01',
      videoPath: `orgs/${ORG}/matches/m-nuevo/video.mp4`, createdBy: idOf(role), createdAt: serverTimestamp(), status: 'en cola',
    })
    batch.set(doc(db, `orgs/${ORG}/usage/${PERIOD}`), { analyses: 2, lastMatchId: 'm-nuevo', updatedAt: serverTimestamp() })
    return batch.commit()
  },
  'matches.update': db => updateDoc(doc(db, 'matches/m-a'), { opponent: 'Rival Editado', updatedAt: serverTimestamp() }),
  'matches.delete': db => deleteDoc(doc(db, 'matches/m-a')),

  'coachNotes.getPropia': (db, role) => getDoc(doc(db, 'matches/m-a/coachNotes', idOf(role))),
  'coachNotes.getAjena': db => getDoc(doc(db, 'matches/m-a/coachNotes/coach-a')),
  'coachNotes.list': db => getDocs(collection(db, 'matches/m-a/coachNotes')),
  'coachNotes.create': (db, role) => setDoc(doc(db, 'matches/m-a/coachNotes', idOf(role)), {
    text: 'Nota nueva', updatedAt: serverTimestamp(),
  }),
  'coachNotes.delete': (db, role) => deleteDoc(doc(db, 'matches/m-a/coachNotes', idOf(role))),

  'applicationForms.get': db => getDoc(doc(db, `orgs/${ORG}/applicationForms/${FORM}`)),
  'applicationForms.list': db => getDocs(collection(db, `orgs/${ORG}/applicationForms`)),
  'applicationForms.create': db => setDoc(doc(db, `orgs/${ORG}/applicationForms/EnlaceNuevo000000001`), { createdAt: serverTimestamp() }),
  'applicationForms.delete': db => deleteDoc(doc(db, `orgs/${ORG}/applicationForms/${FORM}`)),

  'recruitmentIntegrations.get': db => getDoc(doc(db, `orgs/${ORG}/recruitmentIntegrations/googleForms`)),
  'recruitmentIntegrations.update': db => setDoc(doc(db, `orgs/${ORG}/recruitmentIntegrations/googleForms`), {
    formUrl: 'https://forms.gle/clubA456', spreadsheetId: 'hojaNueva', sheetId: 1,
  }),
  'recruitmentIntegrations.delete': db => deleteDoc(doc(db, `orgs/${ORG}/recruitmentIntegrations/googleForms`)),

  'applications.get': db => getDoc(doc(db, 'applications/app-a')),
  'applications.list': db => getDocs(byOrg(db, 'applications')),
  'applications.createPublica': (db, role) => setDoc(doc(db, 'applications', `publica-${idOf(role)}`), {
    orgId: ORG, formId: FORM, status: 'nueva', fullName: 'Postulante Nuevo', birthDate: '2000-03-03', city: 'Lima',
    email: 'nuevo@example.test', graduationYear: 2018, guardian: null, createdAt: serverTimestamp(),
    consent: { accepted: true, version: 'applications-v1', method: 'self', recordedBy: 'public-form', recordedAt: serverTimestamp() },
  }),
  'applications.createEquipo': (db, role) => setDoc(doc(db, 'applications', `equipo-${idOf(role)}`), {
    orgId: ORG, status: 'nueva', fullName: 'Postulante Manual', birthDate: '2001-02-02', city: 'Lima',
    email: 'manual@example.test', graduationYear: 2019, guardian: null, createdAt: serverTimestamp(),
    consent: { accepted: true, version: 'applications-v1', method: 'self', recordedBy: idOf(role), recordedAt: serverTimestamp() },
  }),
  'applications.update': (db, role) => updateDoc(doc(db, 'applications/app-a'), {
    status: 'en revisión', reviewedBy: idOf(role), updatedAt: serverTimestamp(),
  }),
  'applications.delete': db => deleteDoc(doc(db, 'applications/app-a')),

  'platformAudit.get': db => getDoc(doc(db, 'platformAudit/audit-1')),
  'platformAudit.list': db => getDocs(collection(db, 'platformAudit')),
  'platformAudit.create': (db, role) => setDoc(doc(db, 'platformAudit/audit-nueva'), {
    actorId: idOf(role), createdAt: serverTimestamp(), entity: 'orgs', targetId: ORG,
    before: { name: 'Club A', plan: 'pro', archived: false }, after: { name: 'Club A', plan: 'ultra', archived: false },
  }),
  'platformAudit.delete': db => deleteDoc(doc(db, 'platformAudit/audit-1')),
}

const firestoreRows = MATRIX.filter(row => !row.id.startsWith('storage.'))
const WRITES = new Set(['crear', 'editar', 'borrar'])

const contextFor = role => (role === 'visitante'
  ? env.unauthenticatedContext()
  : env.authenticatedContext(UIDS[role], { email: email(UIDS[role]) }))

describe('matriz de acceso de Firestore (PCIT-211)', () => {
  it('cada fila de Firestore de la matriz tiene su operación, y no sobra ninguna', () => {
    expect(Object.keys(OPERATIONS).sort()).toEqual(firestoreRows.map(row => row.id).sort())
  })

  for (const row of firestoreRows) {
    describe(`${row.id} · ${row.operacion} ${row.recurso}`, () => {
      for (const role of Object.keys(ROLES)) {
        const allowed = expected(row, role)
        it(`${role} (${ROLES[role]}) → ${allowed ? 'permitido' : 'denegado'}`, async () => {
          // Las escrituras parten siempre de los mismos datos.
          if (WRITES.has(row.operacion)) await seed()
          const attempt = OPERATIONS[row.id](contextFor(role).firestore(), role)
          await (allowed ? assertSucceeds(attempt) : assertFails(attempt))
        })
      }
    })
  }
})
