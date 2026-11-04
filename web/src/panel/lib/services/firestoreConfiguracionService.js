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

export const PLANES = {
  free: { id: 'basico', prueba: true, limite: 15 },
  basico: { id: 'basico', prueba: false, limite: 30 },
  pro: { id: 'pro', prueba: false, limite: 150 },
  ultra: { id: 'ultra', prueba: false, limite: null },
}

const PREFERENCIAS = { units: 'kmh', notifications: {} }

function leerPreferencias(clave) {
  try {
    return { ...PREFERENCIAS, ...JSON.parse(localStorage.getItem(clave) ?? '{}') }
  } catch {
    return PREFERENCIAS
  }
}

function inicioDelMes(ahora) {
  return new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime()
}

function milisegundos(valor) {
  if (!valor) return null
  if (typeof valor.toMillis === 'function') return valor.toMillis()
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? null : fecha.getTime()
}

export function createFirestoreConfiguracionService({
  db,
  auth,
  uid,
  orgId,
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
        jugadores: [],
        partidos: [],
      }
      const emitir = () => {
        if (!estado.usuario || !estado.organizacion) return
        const plan = PLANES[estado.organizacion.plan] ?? PLANES.free
        const desde = inicioDelMes(ahora())
        const usados = estado.partidos.filter(
          (partido) => (milisegundos(partido.createdAt) ?? 0) >= desde,
        ).length
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
          },
          team: estado.miembros
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
          preferences: leerPreferencias(clavePreferencias),
          plan: { id: plan.id, trial: plan.prueba, used: usados, limit: plan.limite },
        })
      }
      avisos.add(emitir)

      const escuchar = (referencia, clave, lista = false) =>
        onSnapshot(
          referencia,
          (instantanea) => {
            estado[clave] = lista
              ? instantanea.docs.map((documento) => ({ ...documento.data(), id: documento.id }))
              : instantanea.exists()
                ? instantanea.data()
                : {}
            emitir()
          },
          onError,
        )

      const porOrganizacion = (nombre) => query(collection(db, nombre), where('orgId', '==', orgId))

      const detener = [
        escuchar(usuario, 'usuario'),
        escuchar(porOrganizacion('matches'), 'partidos', true),
        escuchar(organizacion, 'organizacion'),
        escuchar(porOrganizacion('users'), 'miembros', true),
        escuchar(porOrganizacion('players'), 'jugadores', true),
      ]

      return () => {
        avisos.delete(emitir)
        detener.forEach((parar) => parar())
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
    async savePreferences(preferencias) {
      localStorage.setItem(clavePreferencias, JSON.stringify(preferencias))
      avisos.forEach((emitir) => emitir())
    },
  }
}
