// Datos de ejemplo para los emuladores (PCIT-22).
// Todo es ficticio. Función pura: no escribe nada, solo arma los documentos.
// Los campos siguen docs/firestore-schema.md.

import {
  APPLICATION_STATUS as A,
  MATCH_STATS_VERSION,
  MATCH_STATUS as M,
  PLAYER_CONSENT_VERSION,
} from '../src/panel/lib/schema.js'
import { usagePeriod } from '../src/panel/lib/usage.js'

export const SEED_PASSWORD = 'acecam123'

const day = iso => new Date(`${iso}T15:00:00Z`)

function coachConsent(uid, iso) {
  return { accepted: true, version: PLAYER_CONSENT_VERSION, method: 'coach-attestation', recordedBy: uid, recordedAt: day(iso) }
}

function formConsent(method, iso) {
  return { accepted: true, version: PLAYER_CONSENT_VERSION, method, recordedBy: 'public-form', recordedAt: day(iso) }
}

/** Estadísticas de un partido terminado, con la forma v1 de matches.statistics. */
function stats({ serveMax, serveAvg, firstIn, df, fhMax, bhMax, shots, rallyAvg, longest, distance }) {
  const serveSamples = 100
  return {
    schemaVersion: MATCH_STATS_VERSION,
    durationSeconds: 5400,
    player: {
      shots: { count: shots, sumSpeedKmh: Math.round(shots * 98.5), maxSpeedKmh: fhMax },
      movement: { distanceMeters: distance, maxSpeedKmh: 23, avgSpeedKmh: 7.2 },
      serve: {
        sumSpeedKmh: serveAvg * serveSamples,
        sampleCount: serveSamples,
        maxSpeedKmh: serveMax,
        firstServeIn: firstIn,
        firstServeAttempts: serveSamples,
        doubleFaults: df,
      },
      forehand: { count: Math.round(shots * 0.55), maxSpeedKmh: fhMax },
      backhand: { count: Math.round(shots * 0.4), maxSpeedKmh: bhMax },
    },
    opponent: {
      shots: { count: shots - 20, sumSpeedKmh: Math.round((shots - 20) * 92), maxSpeedKmh: fhMax - 6 },
      movement: { distanceMeters: distance - 200, maxSpeedKmh: 21, avgSpeedKmh: 6.8 },
    },
    rallies: { count: 96, avgShots: rallyAvg, longestShots: longest },
  }
}

export function buildSeedData() {
  const orgDemo = 'org-demo'
  const orgClub = 'org-club'
  const coach = 'coach-demo'
  const coach2 = 'coach-club'

  const users = [
    { uid: coach, email: 'coach@acecam.test', password: SEED_PASSWORD,
      doc: { email: 'coach@acecam.test', displayName: 'Coach Ramírez', orgId: orgDemo, role: 'coach', jobTitle: 'Entrenador principal', createdAt: day('2026-10-01') } },
    { uid: coach2, email: 'coach2@acecam.test', password: SEED_PASSWORD,
      doc: { email: 'coach2@acecam.test', displayName: 'Coach Paredes', orgId: orgClub, role: 'coach', jobTitle: null, createdAt: day('2026-10-05') } },
  ]

  // Universidad Demo ya contrató Ultra en el checkout (PCIT-158): panel completo y Equipo.
  // Club Ejemplo sigue sin plan, para mostrar el panel bloqueado y el checkout.
  const orgs = [
    { id: orgDemo, doc: { name: 'Universidad Demo', ownerId: coach, program: 'Tenis', plan: 'ultra',
      billingCycle: 'anual', planSince: day('2026-10-01'), createdAt: day('2026-10-01') } },
    { id: orgClub, doc: { name: 'Club Ejemplo', ownerId: coach2, program: null, plan: 'free', createdAt: day('2026-10-05') } },
  ]

  // Invitación pendiente en Universidad Demo (PCIT-40): regístrate con ese correo
  // desde /registro?invitacion=asistente%40acecam.test para unirte al equipo.
  const invites = [
    { id: 'asistente@acecam.test', doc: { email: 'asistente@acecam.test', orgId: orgDemo, role: 'coach',
      status: 'pendiente', invitedBy: coach, createdAt: day('2026-11-02') } },
  ]

  const player = (id, orgId, createdBy, fields) => ({
    id,
    doc: {
      orgId, academy: '', category: null, dominantHand: null, backhand: null, utr: null,
      nationalRanking: null, nationality: 'Peruana', graduationYear: null, coachName: null,
      guardian: null, ...fields, consent: coachConsent(createdBy, '2026-10-02'), createdBy, createdAt: day('2026-10-02'),
    },
  })

  const players = [
    player('player-mateo-rojas', orgDemo, coach, {
      fullName: 'Mateo Rojas', birthDate: '2009-05-14', academy: 'Academia Costa Verde', category: 'Sub-18',
      dominantHand: 'diestro', backhand: 'dos manos', utr: 10.4, nationalRanking: 6, graduationYear: 2027,
      guardian: { name: 'Lucía Rojas', phone: '+51 900 000 001', email: 'apoderado1@ejemplo.test' } }),
    player('player-valentina-quispe', orgDemo, coach, {
      fullName: 'Valentina Quispe', birthDate: '2010-03-02', academy: 'Club Las Lomas', category: 'Sub-16',
      dominantHand: 'zurdo', backhand: 'dos manos', utr: 9.1, nationalRanking: 3, graduationYear: 2028,
      guardian: { name: 'Jorge Quispe', phone: '+51 900 000 002', email: 'apoderado2@ejemplo.test' } }),
    player('player-diego-salazar', orgDemo, coach, {
      fullName: 'Diego Salazar', birthDate: '2008-01-20', academy: 'Academia Pacífico', category: 'Sub-18',
      dominantHand: 'diestro', backhand: 'una mano', utr: 10.9, nationalRanking: 2, graduationYear: 2026 }),
    player('player-camila-torres', orgDemo, coach, {
      fullName: 'Camila Torres', birthDate: '2011-08-09', academy: 'Club Regatas', category: 'Sub-16',
      dominantHand: 'diestro', backhand: 'dos manos', utr: 8.2, nationalRanking: 11, graduationYear: 2029,
      guardian: { name: 'Rosa Torres', phone: '+51 900 000 003', email: 'apoderado3@ejemplo.test' } }),
    // Otra organización: sirve para probar en PCIT-23 que no se ven datos ajenos.
    player('player-club-sofia-vega', orgClub, coach2, {
      fullName: 'Sofía Vega', birthDate: '2007-11-30', academy: 'Club Ejemplo', category: 'Adulto',
      dominantHand: 'diestro', backhand: 'dos manos', utr: 7.5 }),
  ]

  const match = (id, orgId, createdBy, playerId, fields) => {
    const status = fields.status
    return {
      id,
      doc: {
        orgId, playerId, playerPosition: 'abajo', tournament: '', result: '', surface: null,
        videoPath: `orgs/${orgId}/matches/${id}/video.mp4`,
        inputFingerprint: `seed-${id}`, createdBy, createdAt: day(fields.matchDate),
        startedAt: status === M.queued ? null : day(fields.matchDate),
        finishedAt: status === M.ready || status === M.error ? day(fields.matchDate) : null,
        errorMessage: null, workerVersion: status === M.ready ? 'seed' : null, statistics: null,
        ...fields,
      },
    }
  }

  // Evolución de Mateo Rojas: 6 partidos listos con saque en aumento.
  const mateoServe = [163, 165, 166, 168, 170, 171]
  const mateoDates = ['2026-08-15', '2026-08-29', '2026-09-12', '2026-09-26', '2026-10-17', '2026-10-31']
  const rivals = ['A. Medina', 'R. Castro', 'L. Paz', 'F. Núñez', 'G. Soto', 'J. Luna']
  const matches = mateoServe.map((serveMax, i) =>
    match(`match-mateo-${i + 1}`, orgDemo, coach, 'player-mateo-rojas', {
      opponent: rivals[i], tournament: i === 5 ? 'Torneo Nacional Sub-18' : 'Interclubes', matchDate: mateoDates[i],
      result: i % 2 ? '6-4 3-6 7-5' : '6-3 6-4', surface: 'arcilla', status: M.ready,
      statistics: stats({ serveMax, serveAvg: serveMax - 19, firstIn: 54 + i, df: 6 - (i % 3), fhMax: 120 + i, bhMax: 110 + (i % 3),
        shots: 400 + i * 4, rallyAvg: 4.6 + i * 0.06, longest: 17 + i, distance: 3200 + i * 40 }),
    }))

  matches.push(
    match('match-valentina-1', orgDemo, coach, 'player-valentina-quispe', {
      opponent: 'M. Paz', tournament: 'Interclubes', matchDate: '2026-10-30', result: '6-2 6-3', surface: 'dura',
      playerPosition: 'arriba', status: M.ready,
      statistics: stats({ serveMax: 148, serveAvg: 132, firstIn: 67, df: 2, fhMax: 118, bhMax: 106, shots: 455, rallyAvg: 6.4, longest: 27, distance: 3900 }) }),
    match('match-diego-1', orgDemo, coach, 'player-diego-salazar', {
      opponent: 'P. Ortiz', tournament: 'Copa Juvenil', matchDate: '2026-11-01', status: M.processing }),
    match('match-camila-1', orgDemo, coach, 'player-camila-torres', {
      opponent: 'D. Ramos', matchDate: '2026-11-02', status: M.queued }),
    match('match-camila-0', orgDemo, coach, 'player-camila-torres', {
      opponent: 'S. León', matchDate: '2026-10-20', status: M.error,
      errorMessage: 'No se pudo detectar la cancha completa. Prueba con un video grabado desde atrás y en alto.' }),
    match('match-club-1', orgClub, coach2, 'player-club-sofia-vega', {
      opponent: 'C. Díaz', matchDate: '2026-10-25', status: M.ready,
      statistics: stats({ serveMax: 139, serveAvg: 121, firstIn: 61, df: 3, fhMax: 110, bhMax: 98, shots: 380, rallyAvg: 5.1, longest: 19, distance: 3500 }) }),
  )

  const application = (id, orgId, fields) => ({
    id,
    doc: {
      orgId, academy: '', utr: null, nationalRanking: null, dominantHand: null, backhand: null, guardian: null,
      videoLinks: [], videoPaths: [], message: '', playerId: null, internalNotes: '', reviewedBy: null,
      ...fields, createdAt: day(fields.sentOn), consent: formConsent(fields.guardian ? 'guardian' : 'self', fields.sentOn),
    },
  })

  const applications = [
    application('app-1', orgDemo, { status: A.new, fullName: 'Andrés Villanueva', birthDate: '2009-02-11', city: 'Arequipa',
      email: 'postulante1@ejemplo.test', graduationYear: 2027, academy: 'Club Arequipa', utr: 9.6, dominantHand: 'diestro', backhand: 'dos manos',
      guardian: { name: 'Elena Villanueva', phone: '+51 900 000 010', email: 'apoderado10@ejemplo.test' },
      videoLinks: ['https://www.youtube.com/watch?v=ejemplo1'], message: 'Me interesa competir a nivel universitario.', sentOn: '2026-11-02' }),
    application('app-2', orgDemo, { status: A.inReview, fullName: 'Lucía Fernández', birthDate: '2008-06-25', city: 'Lima',
      email: 'postulante2@ejemplo.test', graduationYear: 2026, utr: 8.9, dominantHand: 'zurdo', backhand: 'una mano',
      videoLinks: ['https://www.youtube.com/watch?v=ejemplo2'], sentOn: '2026-10-28', reviewedBy: coach }),
    application('app-3', orgDemo, { status: A.analyzed, fullName: 'Tomás Huamán', birthDate: '2008-09-03', city: 'Trujillo',
      email: 'postulante3@ejemplo.test', graduationYear: 2026, utr: 10.1, dominantHand: 'diestro', backhand: 'dos manos',
      sentOn: '2026-10-20', reviewedBy: coach, internalNotes: 'Buen saque. Revisar movilidad.' }),
    application('app-4', orgDemo, { status: A.discarded, fullName: 'Paula Ríos', birthDate: '2009-12-12', city: 'Cusco',
      email: 'postulante4@ejemplo.test', graduationYear: 2028,
      guardian: { name: 'Mario Ríos', phone: '+51 900 000 011', email: 'apoderado11@ejemplo.test' }, sentOn: '2026-10-10' }),
    application('app-club-1', orgClub, { status: A.new, fullName: 'Iván Salas', birthDate: '2007-04-04', city: 'Piura',
      email: 'postulante5@ejemplo.test', graduationYear: 2025, sentOn: '2026-11-01' }),
  ]

  // sentOn solo arma createdAt; no es un campo del esquema.
  for (const app of applications) delete app.doc.sentOn

  // Contador de análisis por organización y mes, como lo dejaría la web (PCIT-41).
  const usage = []
  for (const { id, doc } of [...matches].sort((a, b) => a.doc.createdAt - b.doc.createdAt)) {
    const period = usagePeriod(doc.createdAt)
    let counter = usage.find(item => item.orgId === doc.orgId && item.id === period)
    if (!counter) usage.push(counter = { orgId: doc.orgId, id: period, doc: { analyses: 0 } })
    counter.doc = { analyses: counter.doc.analyses + 1, lastMatchId: id, updatedAt: doc.createdAt }
  }

  return { users, orgs, players, matches, applications, usage, invites }
}
