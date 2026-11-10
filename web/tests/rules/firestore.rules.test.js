// Pruebas de las reglas de Firestore (PCIT-23) contra el emulador.
// Ejecutar con: npm run test:rules   (levanta el emulador solo y lo apaga al terminar)

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createFirestorePlayersService } from '../../src/panel/lib/services/firestorePlayersService.js'
import { createFirestoreMatchesService } from '../../src/panel/lib/services/firestoreMatchesService.js'
import { createFirestoreMatchNotesService } from '../../src/panel/lib/services/firestoreMatchNotesService.js'
import { createFirestoreDashboardService } from '../../src/panel/lib/services/firestoreDashboardService.js'
import { buildPlayerComparisonHistory } from '../../src/panel/lib/comparisonHistory.js'
import { usagePeriod } from '../../src/panel/lib/usage.js'
import { publicFormExists, submitPublicApplication } from '../../src/panel/lib/publicApplications.js'

const ORG = 'org-demo'
const OTHER_ORG = 'org-club'
const COACH = 'coach-demo'
const OTHER_COACH = 'coach-club'

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

const consent = uid => ({
  accepted: true, version: 'players-v1', method: 'coach-attestation', recordedBy: uid, recordedAt: new Date(),
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore()
    const created = new Date('2026-10-01T00:00:00Z')
    await setDoc(doc(db, 'orgs', ORG), { name: 'Universidad Demo', ownerId: COACH, plan: 'pro', createdAt: created })
    await setDoc(doc(db, 'orgs', OTHER_ORG), { name: 'Club Ejemplo', ownerId: OTHER_COACH, plan: 'free', createdAt: created })
    await setDoc(doc(db, 'users', COACH), { email: 'coach@acecam.test', displayName: 'Coach Ramírez', orgId: ORG, role: 'coach', createdAt: created })
    await setDoc(doc(db, 'users', OTHER_COACH), { email: 'coach2@acecam.test', displayName: 'Coach Paredes', orgId: OTHER_ORG, role: 'coach', createdAt: created })
    await setDoc(doc(db, 'players', 'p-demo'), { orgId: ORG, fullName: 'Mateo Rojas', birthDate: '2009-05-14', academy: '', guardian: { name: 'Apoderado Demo', phone: '999999999', email: 'guardian@example.test' }, consent: consent(COACH), createdBy: COACH, createdAt: created })
    await setDoc(doc(db, 'players', 'p-club'), { orgId: OTHER_ORG, fullName: 'Sofía Vega', birthDate: '2007-11-30', academy: '', consent: consent(OTHER_COACH), createdBy: OTHER_COACH, createdAt: created })
    const match = (orgId, playerId, status, extra = {}) => ({
      orgId, playerId, playerPosition: 'abajo', opponent: 'J. Luna', tournament: '', matchDate: '2026-10-31', result: '',
      videoPath: 'x', createdBy: COACH, createdAt: created, status, statistics: null, errorMessage: null, ...extra,
    })
    await setDoc(doc(db, 'matches', 'm-ready'), match(ORG, 'p-demo', 'listo', { statistics: { schemaVersion: 'acecam.match-stats.v1' } }))
    await setDoc(doc(db, 'matches', 'm-error'), match(ORG, 'p-demo', 'error', { errorMessage: 'No se detectó la cancha.' }))
    await setDoc(doc(db, 'matches', 'm-processing'), match(ORG, 'p-demo', 'procesando'))
    await setDoc(doc(db, 'matches', 'm-club'), match(OTHER_ORG, 'p-club', 'listo'))
    await setDoc(doc(db, 'applications', 'a-demo'), { orgId: ORG, status: 'nueva', fullName: 'Andrés Villanueva', birthDate: '2009-02-11', email: 'a@ejemplo.test', consent: { accepted: true }, createdAt: created })
    await setDoc(doc(db, 'applications', 'a-club'), { orgId: OTHER_ORG, status: 'nueva', fullName: 'Iván Salas', birthDate: '2007-04-04', email: 'b@ejemplo.test', consent: { accepted: true }, createdAt: created })
  })
})

const coachDb = () => env.authenticatedContext(COACH, { email: 'coach@acecam.test' }).firestore()
const anonDb = () => env.unauthenticatedContext().firestore()

const newPlayer = (overrides = {}) => ({
  orgId: ORG, fullName: 'Valentina Quispe', birthDate: '2010-03-02', academy: 'Club Las Lomas',
  guardian: { name: 'Apoderado Demo', phone: '999999999', email: 'guardian@example.test' },
  createdBy: COACH, createdAt: serverTimestamp(),
  consent: { accepted: true, version: 'players-v1', method: 'coach-attestation', recordedBy: COACH, recordedAt: serverTimestamp() },
  ...overrides,
})

const newMatch = (matchId, overrides = {}) => ({
  orgId: ORG, playerId: 'p-demo', playerPosition: 'abajo', opponent: 'M. Paz', tournament: '', matchDate: '2026-11-02',
  result: '', videoPath: `orgs/${ORG}/matches/${matchId}/video.mp4`, inputFingerprint: 'abc',
  createdBy: COACH, createdAt: serverTimestamp(), status: 'en cola', ...overrides,
})

// Alta de un partido como la hace la web: partido y contador del mes juntos (PCIT-41).
const usageDoc = (db, orgId = ORG) => doc(db, 'orgs', orgId, 'usage', usagePeriod())
const createMatch = async (db, matchId, overrides = {}, usageOverrides = {}) => {
  const current = await getDoc(usageDoc(db, overrides.orgId ?? ORG))
  const batch = writeBatch(db)
  batch.set(doc(db, 'matches', matchId), newMatch(matchId, overrides))
  batch.set(usageDoc(db, overrides.orgId ?? ORG), { analyses: (current.data()?.analyses ?? 0) + 1, lastMatchId: matchId, updatedAt: serverTimestamp(), ...usageOverrides })
  return batch.commit()
}

describe('sin sesión', () => {
  it('no puede leer ni escribir nada', async () => {
    const db = anonDb()
    await assertFails(getDoc(doc(db, 'players', 'p-demo')))
    await assertFails(getDocs(query(collection(db, 'players'), where('orgId', '==', ORG))))
    await assertFails(getDoc(doc(db, 'orgs', ORG)))
    await assertFails(setDoc(doc(db, 'players', 'nuevo'), newPlayer()))
    await assertFails(setDoc(doc(db, 'applications', 'nueva'), { orgId: ORG, status: 'nueva', fullName: 'X Y', birthDate: '2009-01-01', consent: { accepted: true }, createdAt: serverTimestamp() }))
  })
})

describe('aislamiento por organización', () => {
  it('lee los datos de su organización', async () => {
    const db = coachDb()
    await assertSucceeds(getDoc(doc(db, 'orgs', ORG)))
    await assertSucceeds(getDoc(doc(db, 'players', 'p-demo')))
    await assertSucceeds(getDoc(doc(db, 'matches', 'm-ready')))
    await assertSucceeds(getDoc(doc(db, 'applications', 'a-demo')))
    await assertSucceeds(getDocs(query(collection(db, 'players'), where('orgId', '==', ORG), where('createdBy', '==', COACH))))
    await assertSucceeds(getDocs(query(collection(db, 'matches'), where('orgId', '==', ORG), where('playerId', '==', 'p-demo'), where('createdBy', '==', COACH))))
  })

  it('no lee datos de otra organización', async () => {
    const db = coachDb()
    await assertFails(getDoc(doc(db, 'orgs', OTHER_ORG)))
    await assertFails(getDoc(doc(db, 'users', OTHER_COACH)))
    await assertFails(getDoc(doc(db, 'players', 'p-club')))
    await assertFails(getDoc(doc(db, 'matches', 'm-club')))
    await assertFails(getDoc(doc(db, 'applications', 'a-club')))
    await assertFails(getDocs(query(collection(db, 'players'), where('orgId', '==', OTHER_ORG))))
  })

  it('consulta el historial listo del jugador con el alcance de la sesión', async () => {
    const teammate = 'coach-teammate'
    const admin = 'admin-demo'
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore()
      const ready = (await getDoc(doc(db, 'matches', 'm-ready'))).data()
      await setDoc(doc(db, 'users', admin), { orgId: ORG, role: 'admin' })
      await setDoc(doc(db, 'matches', 'm-teammate'), { ...ready, createdBy: teammate, matchDate: '2026-11-01' })
    })
    const player = { id: 'p-demo', orgId: ORG, createdBy: COACH }
    const coachIdentity = { db: coachDb(), orgId: ORG, actorId: COACH, role: 'coach' }
    const adminIdentity = {
      db: env.authenticatedContext(admin).firestore(), orgId: ORG, actorId: admin, role: 'admin',
    }
    const coach = createFirestorePlayersService(coachIdentity)
    const administrator = createFirestorePlayersService(adminIdentity)
    const read = subscribe => {
      let stop
      return new Promise((resolve, reject) => {
        stop = subscribe(resolve, reject)
      }).finally(() => stop?.())
    }
    const readHistory = (service, currentPlayer) => read((receive, fail) => service.subscribeAnalyzedMatches(currentPlayer, receive, fail))

    const history = await readHistory(coach, player)
    expect(history).toEqual([{ id: 'm-ready', opponent: 'J. Luna', matchDate: '2026-10-31', tournament: '', result: '' }])
    expect((await readHistory(administrator, player)).map(match => match.id)).toEqual(['m-teammate', 'm-ready'])
    await expect(readHistory(coach, { ...player, createdBy: teammate })).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(readHistory(administrator, { ...player, orgId: OTHER_ORG })).rejects.toMatchObject({ code: 'permission-denied' })
    expect((await read(createFirestoreMatchesService(coachIdentity).subscribe)).map(match => match.id)).toEqual(['m-ready'])
    expect((await read(createFirestoreMatchesService(adminIdentity).subscribe)).map(match => match.id)).toEqual(['m-teammate', 'm-ready'])
  })

  it('reutiliza el resumen del Dashboard para comparar solo los partidos del entrenador', async () => {
    const teammate = 'coach-teammate'
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore()
      const ready = (await getDoc(doc(db, 'matches', 'm-ready'))).data()
      const statistics = speed => ({
        schemaVersion: 'acecam.match-stats.v1',
        player: { shots: { count: 1, sumSpeedKmh: speed } },
      })
      await updateDoc(doc(db, 'matches', 'm-ready'), { statistics: statistics(50) })
      await setDoc(doc(db, 'matches', 'm-teammate'), { ...ready, createdBy: teammate, statistics: statistics(90) })
      await setDoc(doc(db, 'players', 'p-teammate'), { orgId: ORG, createdBy: teammate })
    })
    const identity = { db: coachDb(), orgId: ORG, actorId: COACH, onlyOwned: true }
    const service = createFirestoreDashboardService(identity)
    const read = (playerId, selectedService = service) => {
      let stop
      return new Promise((resolve, reject) => {
        stop = selectedService.subscribePlayer(playerId, resolve, reject)
      }).finally(() => stop?.())
    }
    expect((await read('p-demo')).metrics).toMatchObject({ analyzedMatches: 1, measuredShots: 1, averageShotSpeed: 50 })
    await expect(read('p-teammate')).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(read('p-club')).rejects.toMatchObject({ code: 'permission-denied' })
    const historyService = createFirestoreDashboardService({ ...identity, summarizePlayer: buildPlayerComparisonHistory })
    const history = await read('p-demo', historyService)
    expect(history.matches).toHaveLength(1)
    expect(history.matches[0]).toMatchObject({ id: 'm-ready', metrics: { averageShotSpeed: 50 } })
    await expect(read('p-teammate', historyService)).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('una consulta sin filtrar por orgId se rechaza', async () => {
    await assertFails(getDocs(collection(coachDb(), 'players')))
    await assertFails(getDocs(collection(coachDb(), 'orgs')))
  })

  it('un usuario con sesión pero sin ficha en users no ve nada', async () => {
    const db = env.authenticatedContext('sin-perfil', { email: 'x@ejemplo.test' }).firestore()
    await assertFails(getDoc(doc(db, 'players', 'p-demo')))
    await assertFails(getDocs(query(collection(db, 'players'), where('orgId', '==', ORG))))
  })

  it('consultar un documento que no existe no revela nada y se permite', async () => {
    await assertSucceeds(getDoc(doc(coachDb(), 'matches', 'no-existe')))
  })
})

describe('notas privadas de partidos', () => {
  it('guarda, actualiza y borra la nota propia sin sobrescribir un cambio concurrente', async () => {
    const service = createFirestoreMatchNotesService({ db: coachDb(), actorId: COACH })
    expect(await service.load('m-ready')).toBe('')
    expect(await service.save('m-ready', ' Devolución ', '')).toBe('Devolución')
    const otherSession = createFirestoreMatchNotesService({ db: coachDb(), actorId: COACH })
    expect(await otherSession.load('m-ready')).toBe('Devolución')
    await otherSession.save('m-ready', 'Profundidad', 'Devolución')
    await expect(service.save('m-ready', 'Texto anterior', 'Devolución')).rejects.toMatchObject({ code: 'notes/conflict' })
    expect(await service.load('m-ready')).toBe('Profundidad')
    expect(await service.save('m-ready', '', 'Profundidad')).toBe('')
    expect(await otherSession.load('m-ready')).toBe('')
  })

  it('limita las notas al autor y a partidos listos que puede anotar', async () => {
    const teammate = 'coach-teammate'
    const admin = 'admin-demo'
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore()
      await setDoc(doc(db, 'users', teammate), { orgId: ORG, role: 'coach' })
      await setDoc(doc(db, 'users', admin), { orgId: ORG, role: 'admin' })
    })
    const coach = coachDb()
    const teammateDb = env.authenticatedContext(teammate).firestore()
    const adminDb = env.authenticatedContext(admin).firestore()
    const outsideDb = env.authenticatedContext(OTHER_COACH).firestore()
    const path = ['matches', 'm-ready', 'coachNotes']
    const payload = { text: 'Nota de prueba', updatedAt: serverTimestamp() }
    await assertSucceeds(setDoc(doc(coach, ...path, COACH), payload))
    for (const db of [teammateDb, adminDb, outsideDb, anonDb()]) {
      await assertFails(getDoc(doc(db, ...path, COACH)))
    }
    await assertFails(getDocs(collection(coach, ...path)))
    await assertFails(setDoc(doc(teammateDb, ...path, teammate), payload))
    await assertFails(setDoc(doc(outsideDb, ...path, OTHER_COACH), payload))
    await assertFails(setDoc(doc(coach, 'matches', 'm-processing', 'coachNotes', COACH), payload))
    await assertFails(setDoc(doc(coach, ...path, COACH), { ...payload, text: 'x'.repeat(2001) }))
    await assertFails(setDoc(doc(coach, ...path, COACH), { ...payload, orgId: ORG }))
    await assertSucceeds(setDoc(doc(adminDb, ...path, admin), payload))
    await assertFails(getDoc(doc(coach, ...path, admin)))
  })
})

describe('registro (users y orgs)', () => {
  const registerBatch = (db, uid, email, orgId, userOverrides = {}, orgOverrides = {}) => {
    const batch = writeBatch(db)
    batch.set(doc(db, 'orgs', orgId), { name: 'Universidad Nueva', ownerId: uid, program: null, plan: 'free', createdAt: serverTimestamp(), ...orgOverrides })
    batch.set(doc(db, 'users', uid), { email, displayName: 'Coach Nuevo', orgId, role: 'coach', createdAt: serverTimestamp(), ...userOverrides })
    return batch.commit()
  }
  const newUserDb = () => env.authenticatedContext('nuevo', { email: 'nuevo@ejemplo.test' }).firestore()

  it('crea su organización y su ficha en el mismo paso', async () => {
    await assertSucceeds(registerBatch(newUserDb(), 'nuevo', 'nuevo@ejemplo.test', 'org-nueva'))
  })

  it('no puede unirse a una organización ajena', async () => {
    const db = newUserDb()
    await assertFails(setDoc(doc(db, 'users', 'nuevo'), { email: 'nuevo@ejemplo.test', displayName: 'Intruso', orgId: ORG, role: 'coach', createdAt: serverTimestamp() }))
  })

  it('no puede registrarse como administrador ni con otro correo', async () => {
    await assertFails(registerBatch(newUserDb(), 'nuevo', 'nuevo@ejemplo.test', 'org-nueva', { role: 'admin' }))
    await assertFails(registerBatch(newUserDb(), 'nuevo', 'otro@ejemplo.test', 'org-nueva'))
  })

  it('no puede crear la ficha de otra persona ni una organización a nombre de otro', async () => {
    await assertFails(registerBatch(newUserDb(), 'otro-uid', 'nuevo@ejemplo.test', 'org-nueva'))
    await assertFails(registerBatch(newUserDb(), 'nuevo', 'nuevo@ejemplo.test', 'org-nueva', {}, { ownerId: COACH }))
  })

  it('un usuario ya registrado no crea otra organización', async () => {
    await assertFails(setDoc(doc(coachDb(), 'orgs', 'org-extra'), { name: 'Otra', ownerId: COACH, plan: 'free', createdAt: serverTimestamp() }))
  })

  it('edita su nombre, pero no su organización ni su rol', async () => {
    const db = coachDb()
    await assertSucceeds(updateDoc(doc(db, 'users', COACH), { displayName: 'Coach R.' }))
    await assertFails(updateDoc(doc(db, 'users', COACH), { orgId: OTHER_ORG }))
    await assertFails(updateDoc(doc(db, 'users', COACH), { role: 'admin' }))
  })

  it('el plan solo cambia junto con su periodo y fecha, como en el checkout', async () => {
    await assertSucceeds(updateDoc(doc(coachDb(), 'orgs', ORG), { name: 'Universidad Demo Lima' }))
    await assertFails(updateDoc(doc(coachDb(), 'orgs', ORG), { plan: 'ultra' }))
    await assertFails(updateDoc(doc(coachDb(), 'orgs', ORG), { name: 'Otra', plan: 'ultra', billingCycle: 'mensual', planSince: serverTimestamp() }))
  })

  describe('checkout simulado (PCIT-158)', () => {
    const contratar = (db, orgId, cambios = {}) =>
      updateDoc(doc(db, 'orgs', orgId), { plan: 'pro', billingCycle: 'mensual', planSince: serverTimestamp(), ...cambios })

    it('el dueño contrata Pro o Ultra con su periodo', async () => {
      await assertSucceeds(contratar(coachDb(), ORG))
      await assertSucceeds(contratar(coachDb(), ORG, { plan: 'ultra', billingCycle: 'anual' }))
    })

    it('la prueba de Básico es solo para una organización que nunca contrató', async () => {
      const otro = env.authenticatedContext(OTHER_COACH, { email: 'coach2@acecam.test' }).firestore()
      await assertSucceeds(contratar(otro, OTHER_ORG, { plan: 'prueba' }))
      await assertFails(contratar(otro, OTHER_ORG, { plan: 'prueba' }))
      await assertSucceeds(contratar(otro, OTHER_ORG, { plan: 'basico' }))
    })

    it('rechaza planes, periodos o fechas inválidos y campos de más', async () => {
      const db = coachDb()
      await assertFails(contratar(db, ORG, { plan: 'free' }))
      await assertFails(contratar(db, ORG, { plan: 'inventado' }))
      await assertFails(contratar(db, ORG, { billingCycle: 'semanal' }))
      await assertFails(contratar(db, ORG, { planSince: new Date('2030-01-01T00:00:00Z') }))
      await assertFails(contratar(db, ORG, { cardLast4: '4242' }))
      await assertFails(contratar(db, ORG, { ownerId: OTHER_COACH }))
    })

    it('solo el dueño de la organización contrata', async () => {
      await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'users', 'coach-colega'), { email: 'colega@acecam.test', displayName: 'Coach Colega', orgId: ORG, role: 'coach', createdAt: new Date() })
        await setDoc(doc(context.firestore(), 'users', 'admin-demo'), { email: 'admin@acecam.test', displayName: 'Admin Demo', orgId: ORG, role: 'admin', createdAt: new Date() })
      })
      await assertFails(contratar(env.authenticatedContext('coach-colega', { email: 'colega@acecam.test' }).firestore(), ORG))
      await assertFails(contratar(env.authenticatedContext('admin-demo', { email: 'admin@acecam.test' }).firestore(), ORG))
      await assertFails(contratar(env.authenticatedContext(OTHER_COACH, { email: 'coach2@acecam.test' }).firestore(), ORG))
      await assertFails(contratar(anonDb(), ORG))
    })
  })
})

describe('players', () => {
  it('crea un jugador válido de su organización', async () => {
    await assertSucceeds(setDoc(doc(coachDb(), 'players', 'nuevo'), newPlayer()))
  })

  it('rechaza jugadores de otra organización, sin consentimiento o a nombre de otro', async () => {
    const db = coachDb()
    await assertFails(setDoc(doc(db, 'players', 'n1'), newPlayer({ orgId: OTHER_ORG })))
    await assertFails(setDoc(doc(db, 'players', 'n2'), newPlayer({ consent: { accepted: false, version: 'players-v1', method: 'coach-attestation', recordedBy: COACH } })))
    await assertFails(setDoc(doc(db, 'players', 'n3'), newPlayer({ createdBy: OTHER_COACH })))
    await assertFails(setDoc(doc(db, 'players', 'n4'), newPlayer({ birthDate: '14/05/2009' })))
    await assertFails(setDoc(doc(db, 'players', 'n5'), newPlayer({ campoInventado: true })))
  })

  it('edita datos deportivos, pero no la organización ni el consentimiento', async () => {
    const db = coachDb()
    await assertSucceeds(updateDoc(doc(db, 'players', 'p-demo'), { academy: 'Academia Costa Verde', utr: 10.4, category: 'Sub-18' }))
    await assertFails(updateDoc(doc(db, 'players', 'p-demo'), { orgId: OTHER_ORG }))
    await assertFails(updateDoc(doc(db, 'players', 'p-demo'), { 'consent.accepted': false }))
    await assertFails(updateDoc(doc(db, 'players', 'p-demo'), { category: 'Sub-99' }))
  })

  it('no borra jugadores de otra organización', async () => {
    await assertFails(deleteDoc(doc(coachDb(), 'players', 'p-club')))
    await assertSucceeds(deleteDoc(doc(coachDb(), 'players', 'p-demo')))
  })
})

describe('matches', () => {
  it('crea un partido en cola con su video en la carpeta correcta', async () => {
    await assertSucceeds(createMatch(coachDb(), 'm-nuevo'))
  })

  it('no puede crear un partido ya procesado ni con estadísticas', async () => {
    const db = coachDb()
    await assertFails(setDoc(doc(db, 'matches', 'm1'), newMatch('m1', { status: 'listo' })))
    await assertFails(setDoc(doc(db, 'matches', 'm2'), newMatch('m2', { statistics: { schemaVersion: 'x' } })))
  })

  it('rechaza un jugador de otra organización o un jugador que no existe', async () => {
    await assertFails(setDoc(doc(coachDb(), 'matches', 'm3'), newMatch('m3', { playerId: 'p-club' })))
    await assertFails(setDoc(doc(coachDb(), 'matches', 'm4'), newMatch('m4', { playerId: 'no-existe' })))
  })

  it('rechaza un video fuera de la carpeta del partido', async () => {
    const db = coachDb()
    await assertFails(setDoc(doc(db, 'matches', 'm5'), newMatch('m5', { videoPath: `orgs/${OTHER_ORG}/matches/m5/video.mp4` })))
    await assertFails(setDoc(doc(db, 'matches', 'm6'), newMatch('m6', { videoPath: `orgs/${ORG}/matches/otro/video.mp4` })))
    await assertFails(setDoc(doc(db, 'matches', 'm7'), newMatch('m7', { videoPath: `orgs/${ORG}/matches/m7/video.exe` })))
  })

  it('la web no escribe estadísticas ni cambia el estado del worker', async () => {
    const db = coachDb()
    await assertFails(updateDoc(doc(db, 'matches', 'm-ready'), { statistics: null }))
    await assertFails(updateDoc(doc(db, 'matches', 'm-processing'), { status: 'listo' }))
    await assertFails(updateDoc(doc(db, 'matches', 'm-processing'), { status: 'en cola' }))
  })

  it('puede reintentar un partido con error y corregir sus datos', async () => {
    const db = coachDb()
    await assertSucceeds(updateDoc(doc(db, 'matches', 'm-error'), { status: 'en cola', errorMessage: null }))
    await assertSucceeds(updateDoc(doc(db, 'matches', 'm-ready'), { opponent: 'J. Luna Díaz' }))
  })

  it('no borra un partido mientras se procesa', async () => {
    await assertFails(deleteDoc(doc(coachDb(), 'matches', 'm-processing')))
    await assertSucceeds(deleteDoc(doc(coachDb(), 'matches', 'm-ready')))
  })
})

describe('uso mensual de análisis (PCIT-41)', () => {
  it('cada partido nuevo suma uno al contador del mes de la organización', async () => {
    const db = coachDb()
    await assertSucceeds(createMatch(db, 'm-uso-1'))
    await assertSucceeds(createMatch(db, 'm-uso-2'))
    const usage = await assertSucceeds(getDoc(usageDoc(db)))
    expect(usage.data()).toMatchObject({ analyses: 2, lastMatchId: 'm-uso-2' })
  })

  it('no se crea un partido sin contarlo ni se cuenta sin un partido nuevo', async () => {
    const db = coachDb()
    await assertFails(setDoc(doc(db, 'matches', 'm-sin-contar'), newMatch('m-sin-contar')))
    await assertFails(setDoc(usageDoc(db), { analyses: 1, lastMatchId: 'm-fantasma', updatedAt: serverTimestamp() }))
    await assertFails(setDoc(usageDoc(db), { analyses: 1, lastMatchId: 'm-ready', updatedAt: serverTimestamp() }))
  })

  it('no permite saltos, bajar el contador, otro mes ni otro partido', async () => {
    const db = coachDb()
    await assertFails(createMatch(db, 'm-salto', {}, { analyses: 3 }))
    await assertFails(createMatch(db, 'm-otro', {}, { lastMatchId: 'm-ready' }))
    await assertFails(createMatch(db, 'm-campo', {}, { plan: 'ultra' }))
    await assertSucceeds(createMatch(db, 'm-ok'))
    await assertFails(updateDoc(usageDoc(db), { analyses: 0, updatedAt: serverTimestamp() }))
    await assertFails(deleteDoc(usageDoc(db)))
    const batch = writeBatch(db)
    batch.set(doc(db, 'matches', 'm-mes'), newMatch('m-mes'))
    batch.set(doc(db, 'orgs', ORG, 'usage', '2020-01'), { analyses: 1, lastMatchId: 'm-mes', updatedAt: serverTimestamp() })
    await assertFails(batch.commit())
  })

  it('solo la organización lee su contador', async () => {
    await assertSucceeds(createMatch(coachDb(), 'm-lectura'))
    await assertFails(getDoc(usageDoc(env.authenticatedContext(OTHER_COACH, { email: 'coach2@acecam.test' }).firestore())))
    await assertFails(getDoc(usageDoc(anonDb())))
  })

  describe('límite según el plan', () => {
    const preparar = (plan, analyses) => env.withSecurityRulesDisabled(async context => {
      const db = context.firestore()
      await updateDoc(doc(db, 'orgs', ORG), { plan })
      if (analyses != null) await setDoc(usageDoc(db), { analyses, lastMatchId: 'previo', updatedAt: new Date() })
    })

    it('la prueba de Básico vence a los 30 días; sin fecha sigue vigente (PCIT-171)', async () => {
      const hace = dias => new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
      const prueba = planSince => env.withSecurityRulesDisabled(context =>
        updateDoc(doc(context.firestore(), 'orgs', ORG), { plan: 'prueba', billingCycle: 'mensual', planSince }))
      await prueba(hace(29))
      await assertSucceeds(createMatch(coachDb(), 'm-vigente'))
      await prueba(hace(31))
      await assertFails(createMatch(coachDb(), 'm-vencida'))
      // Después de vencida, contratar Básico normal vuelve a permitir análisis.
      await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'orgs', ORG), { plan: 'basico' }))
      await assertSucceeds(createMatch(coachDb(), 'm-basico'))
      // Una prueba cargada a mano, sin planSince, no vence.
      await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'orgs', ORG), { plan: 'prueba', planSince: deleteField() }))
      await assertSucceeds(createMatch(coachDb(), 'm-sin-fecha'))
    })

    it('permite llegar justo al límite y niega el siguiente análisis', async () => {
      await preparar('prueba', 14)
      await assertSucceeds(createMatch(coachDb(), 'm-15'))
      await assertFails(createMatch(coachDb(), 'm-16'))
      await preparar('basico', 30)
      await assertFails(createMatch(coachDb(), 'm-31'))
      await preparar('pro', 149)
      await assertSucceeds(createMatch(coachDb(), 'm-150'))
      await assertFails(createMatch(coachDb(), 'm-151'))
    })

    it('sin plan o con un plan desconocido no se analiza; Ultra no tiene tope', async () => {
      await preparar('free')
      await assertFails(createMatch(coachDb(), 'm-free'))
      await preparar('inventado')
      await assertFails(createMatch(coachDb(), 'm-inventado'))
      await preparar('ultra', 5000)
      await assertSucceeds(createMatch(coachDb(), 'm-ultra'))
    })

    it('el contador es de la organización: suma los análisis de todos sus entrenadores', async () => {
      await env.withSecurityRulesDisabled(async context => {
        const db = context.firestore()
        await setDoc(doc(db, 'users', 'coach-colega'), { email: 'colega@acecam.test', displayName: 'Coach Colega', orgId: ORG, role: 'coach', createdAt: new Date() })
        await setDoc(doc(db, 'players', 'p-colega'), { orgId: ORG, fullName: 'Lucía Torres', birthDate: '2008-01-20', consent: consent('coach-colega'), createdBy: 'coach-colega', createdAt: new Date() })
      })
      await preparar('prueba', 13)
      await assertSucceeds(createMatch(coachDb(), 'm-mio'))
      const colega = env.authenticatedContext('coach-colega', { email: 'colega@acecam.test' }).firestore()
      const delColega = { playerId: 'p-colega', createdBy: 'coach-colega' }
      await assertSucceeds(createMatch(colega, 'm-colega-15', delColega))
      await assertFails(createMatch(colega, 'm-colega-16', delColega))
      await assertFails(createMatch(coachDb(), 'm-mio-16'))
      const usage = await getDoc(usageDoc(coachDb()))
      expect(usage.data().analyses).toBe(15)
    })
  })
})

describe('applications', () => {
  it('cambia el estado de una postulación de su organización', async () => {
    await assertSucceeds(updateDoc(doc(coachDb(), 'applications', 'a-demo'), { status: 'en revisión' }))
  })

  it('rechaza estados inventados y postulaciones ajenas', async () => {
    await assertFails(updateDoc(doc(coachDb(), 'applications', 'a-demo'), { status: 'aprobada' }))
    await assertFails(updateDoc(doc(coachDb(), 'applications', 'a-club'), { status: 'en revisión' }))
  })

  it('impide saltar estados o reabrir una postulación descartada', async () => {
    const ref = doc(coachDb(), 'applications', 'a-demo')
    await assertFails(updateDoc(ref, { status: 'contactada' }))
    await assertSucceeds(updateDoc(ref, { status: 'en revisión' }))
    await assertSucceeds(updateDoc(ref, { status: 'analizada' }))
    await assertSucceeds(updateDoc(ref, { status: 'descartada' }))
    await assertFails(updateDoc(ref, { status: 'en revisión' }))
  })

  it('crea y enlaza un solo jugador cuando dos sesiones procesan la misma postulación', async () => {
    const team = coachDb()
    const makeService = () => createFirestorePlayersService({ db: coachDb(), orgId: ORG, actorId: COACH })
    const input = { fullName: 'Andrés Villanueva', birthDate: '2000-02-15', consentAccepted: true }
    const attempts = await Promise.all([
      makeService().assignApplication('a-demo', { input }),
      makeService().assignApplication('a-demo', { input }),
    ])
    expect(attempts[0].id).toBe(attempts[1].id)
    expect(attempts.map(({ alreadyLinked }) => alreadyLinked).sort()).toEqual([false, true])
    const linked = (await getDoc(doc(team, 'applications', 'a-demo'))).data()
    expect(linked.playerId).toBe(attempts[0].id)
    expect((await getDoc(doc(team, 'players', linked.playerId))).data()).toMatchObject({
      fullName: input.fullName, sourceApplicationId: 'a-demo', createdBy: COACH,
    })
    const players = await getDocs(query(collection(team, 'players'), where('orgId', '==', ORG), where('createdBy', '==', COACH)))
    expect(players.docs.filter((player) => player.data().sourceApplicationId === 'a-demo')).toHaveLength(1)
  })

  it('vincula una ficha existente y las reglas rechazan vínculos ajenos y reemplazos', async () => {
    const team = coachDb()
    const application = doc(team, 'applications', 'a-demo')
    await assertFails(updateDoc(application, { playerId: 'p-club', updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(application, { playerId: 'ausente', updatedAt: serverTimestamp() }))
    await assertFails(setDoc(doc(team, 'players', 'orphan'), newPlayer({ sourceApplicationId: 'a-demo' })))
    const service = createFirestorePlayersService({ db: team, orgId: ORG, actorId: COACH })
    await expect(service.assignApplication('a-demo', { playerId: 'p-demo' })).resolves.toEqual({ id: 'p-demo', alreadyLinked: false })
    await expect(service.assignApplication('a-demo', { input: {} })).resolves.toEqual({ id: 'p-demo', alreadyLinked: true })
    await assertFails(updateDoc(application, { playerId: null, updatedAt: serverTimestamp() }))
    expect((await getDoc(application)).data().playerId).toBe('p-demo')
  })

  const formId = 'AcecamFormDemoABC123'
  const form = (db, orgId = ORG) => doc(db, 'orgs', orgId, 'applicationForms', formId)
  const newPublicApplication = (overrides = {}) => ({
    orgId: ORG, formId, status: 'nueva', fullName: 'Valentina Demo', city: 'Lima',
    birthDate: '2000-02-15', email: 'valentina@example.test', graduationYear: 2027,
    guardian: null, createdAt: serverTimestamp(),
    consent: { accepted: true, version: 'applications-v1', method: 'self', recordedBy: 'public-form', recordedAt: serverTimestamp() },
    ...overrides,
  })

  it('recibe una postulación real del servicio público y solo la organización puede leerla', async () => {
    const team = coachDb()
    const visitor = anonDb()
    await assertSucceeds(setDoc(form(team), { createdAt: serverTimestamp() }))
    await expect(publicFormExists(visitor, ORG, formId)).resolves.toBe(true)
    const submitted = await assertSucceeds(submitPublicApplication(visitor, { orgId: ORG, formId }, {
      fullName: 'Valentina Demo', birthDate: '2000-02-15', city: 'Lima', email: 'valentina@example.test',
      graduationYear: '2027', academy: '', message: '', consentAccepted: true,
    }))
    const saved = await assertSucceeds(getDoc(doc(team, 'applications', submitted.id)))
    expect(saved.data()).toMatchObject({ orgId: ORG, status: 'nueva', consent: { method: 'self', accepted: true } })
    await assertFails(getDoc(submitted))
    await assertFails(updateDoc(submitted, { status: 'en revisión' }))
    await assertFails(getDocs(collection(visitor, 'orgs', ORG, 'applicationForms')))
    const other = env.authenticatedContext(OTHER_COACH).firestore()
    await assertFails(getDoc(doc(other, 'applications', submitted.id)))
    await assertFails(deleteDoc(form(other)))
    await assertSucceeds(deleteDoc(form(team)))
    await assertFails(setDoc(doc(visitor, 'applications', 'revoked'), newPublicApplication()))
  })

  it('rechaza altas públicas ajenas, sin consentimiento o con datos manipulados', async () => {
    const visitor = anonDb()
    await assertFails(setDoc(form(visitor), { createdAt: serverTimestamp() }))
    await assertSucceeds(setDoc(form(coachDb()), { createdAt: serverTimestamp() }))
    const candidates = [
      { orgId: OTHER_ORG },
      { consent: { ...newPublicApplication().consent, accepted: false } },
      { status: 'analizada' },
      { birthDate: '2030-12-01' },
      { birthDate: '2000-02-30' },
      { birthDate: '2020-05-08' },
      { email: 'correo-invalido' },
      { playerId: 'p-demo' },
      { message: 'a'.repeat(1001) },
    ]
    for (const [index, overrides] of candidates.entries()) {
      await assertFails(setDoc(doc(visitor, 'applications', `invalid-${index}`), newPublicApplication(overrides)))
    }
    const validGuardian = newPublicApplication({
      birthDate: '2020-05-08',
      guardian: { name: 'Apoderado Demo', email: 'adulto@example.test', phone: '+51 999 111 222' },
      consent: { ...newPublicApplication().consent, method: 'guardian' },
    })
    await assertSucceeds(setDoc(doc(visitor, 'applications', 'minor'), validGuardian))
  })
})
