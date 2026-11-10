import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'

import { anularInvitacion, invitarMiembro } from '../invitaciones.js'
import { finDePrueba, PLANES, planVigente, proximaRenovacion, pruebaVencida } from '../planes.js'
import { INVITE_STATUS } from '../schema.js'
import { usagePeriod, usageRef } from '../usage.js'

export { PLANES }

const PREFERENCIAS = { units: 'kmh', notifications: {} }

function leerPreferencias(clave) {
  try {
    return { ...PREFERENCIAS, ...JSON.parse(localStorage.getItem(clave) ?? '{}') }
  } catch {
    return PREFERENCIAS
  }
}

export function createFirestoreConfiguracionService({
  db,
  auth,
  uid,
  orgId,
  role = 'coach',
  ahora = () => new Date(),
}) {
  if (!db || !auth || !uid || !orgId) {
    throw new Error('Configuración necesita la base de datos, la sesión y la organización.')
  }
  const usuario = doc(db, 'users', uid)
  const organizacion = doc(db, 'orgs', orgId)
  const clavePreferencias = `acecam-preferencias:${uid}`
  const avisos = new Set()

  return {
    scopeKey: `firestore:${db.app?.options?.projectId ?? ''}:${orgId}:${uid}:configuracion`,
    mode: 'live',
    subscribe(onData, onError) {
      const estado = {
        usuario: null,
        organizacion: null,
        miembros: [],
        invitaciones: [],
        jugadores: [],
        uso: {},
      }
      const emitir = () => {
        if (!estado.usuario || !estado.organizacion) return
        // Con la prueba vencida, la organización cuenta como Sin plan (PCIT-170).
        const plan = PLANES[planVigente(estado.organizacion, ahora())]
        const vencida = pruebaVencida(estado.organizacion, ahora())
        // Contador de la organización en el mes (PCIT-41), igual para admin y coach.
        const usados = estado.uso.analyses ?? 0
        const esOrganizacion = plan.id === 'ultra'
        onData({
          isOrganization: esOrganizacion,
          account: {
            name: estado.usuario.displayName ?? '',
            email: estado.usuario.email ?? auth.currentUser?.email ?? '',
            position: estado.usuario.jobTitle ?? '',
            role: estado.usuario.role ?? 'coach',
          },
          organization: {
            name: estado.organizacion.name ?? '',
            program: estado.organizacion.program ?? '',
            canEdit: estado.organizacion.ownerId === uid,
            // Invitan el dueño y los administradores (PCIT-40), igual que en las reglas.
            canInvite: puedeInvitar(),
          },
          team: [
            ...estado.miembros
              .map((miembro) => ({
                id: miembro.id,
                name: miembro.displayName ?? miembro.email ?? '',
                email: miembro.email ?? '',
                role: miembro.role ?? 'coach',
                players: estado.jugadores.filter((jugador) => jugador.createdBy === miembro.id)
                  .length,
                status: 'activo',
              }))
              .sort((a, b) => a.name.localeCompare(b.name, 'es')),
            ...estado.invitaciones
              .map((invitacion) => ({
                id: `invite:${invitacion.id}`,
                name: invitacion.email ?? invitacion.id,
                email: invitacion.email ?? invitacion.id,
                role: invitacion.role ?? 'coach',
                players: 0,
                status: 'invitado',
              }))
              .sort((a, b) => a.email.localeCompare(b.email, 'es')),
          ],
          preferences: leerPreferencias(clavePreferencias),
          plan: {
            id: plan.id,
            trial: plan.prueba,
            used: usados,
            limit: plan.limite,
            // Periodo y renovación guardados por el checkout (PCIT-158).
            cycle: vencida ? null : estado.organizacion.billingCycle ?? null,
            trialEndedAt: vencida ? finDePrueba(estado.organizacion.planSince).toISOString() : null,
            renewsAt: vencida
              ? null
              : proximaRenovacion(
                {
                  plan: estado.organizacion.plan,
                  planSince: estado.organizacion.planSince?.toDate?.() ?? estado.organizacion.planSince,
                  billingCycle: estado.organizacion.billingCycle,
                },
                ahora(),
              )?.toISOString() ?? null,
          },
        })
      }
      avisos.add(emitir)

      const puedeInvitar = () => role === 'admin' || estado.organizacion?.ownerId === uid
      // Las invitaciones solo se escuchan si las reglas dejan leerlas (dueño o admin).
      let detenerInvitaciones = null
      const escucharInvitaciones = () => {
        if (detenerInvitaciones || !puedeInvitar()) return
        detenerInvitaciones = onSnapshot(
          query(
            collection(db, 'invites'),
            where('orgId', '==', orgId),
            where('status', '==', INVITE_STATUS.pending),
          ),
          (instantanea) => {
            estado.invitaciones = instantanea.docs.map((documento) => ({ ...documento.data(), id: documento.id }))
            emitir()
          },
          onError,
        )
      }

      const escuchar = (referencia, clave, lista = false) =>
        onSnapshot(
          referencia,
          (instantanea) => {
            estado[clave] = lista
              ? instantanea.docs.map((documento) => ({ ...documento.data(), id: documento.id }))
              : instantanea.exists()
                ? instantanea.data()
                : {}
            if (clave === 'organizacion') escucharInvitaciones()
            emitir()
          },
          onError,
        )

      const porOrganizacion = nombre => query(collection(db, nombre), where('orgId', '==', orgId),
        ...(['players', 'matches'].includes(nombre) && role !== 'admin' ? [where('createdBy', '==', uid)] : []))

      const detener = [
        escuchar(usuario, 'usuario'),
        escuchar(usageRef(db, orgId, usagePeriod(ahora())), 'uso'),
        escuchar(organizacion, 'organizacion'),
        escuchar(porOrganizacion('users'), 'miembros', true),
        escuchar(porOrganizacion('players'), 'jugadores', true),
      ]

      return () => {
        avisos.delete(emitir)
        detener.forEach((parar) => parar())
        detenerInvitaciones?.()
      }
    },
    async saveAccount({ name, position }) {
      await updateDoc(usuario, {
        displayName: name,
        jobTitle: position || null,
        updatedAt: serverTimestamp(),
      })
    },
    async changePassword({ current, next }) {
      const actual = auth.currentUser
      if (!actual?.email) throw Object.assign(new Error(), { code: 'auth/no-current-user' })
      await reauthenticateWithCredential(
        actual,
        EmailAuthProvider.credential(actual.email, current),
      )
      await updatePassword(actual, next)
    },
    async saveOrganization({ name, program }) {
      await updateDoc(organizacion, {
        name,
        program: program || null,
        updatedAt: serverTimestamp(),
      })
    },
    inviteMember({ email, role: rolInvitado = 'coach' }) {
      return invitarMiembro({ db, orgId, uid, email, role: rolInvitado })
    },
    cancelInvite({ email }) {
      return anularInvitacion({ db, email })
    },
    async savePreferences(preferencias) {
      localStorage.setItem(clavePreferencias, JSON.stringify(preferencias))
      avisos.forEach((emitir) => emitir())
    },
  }
}
