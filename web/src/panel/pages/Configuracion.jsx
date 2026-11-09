import { useId, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import Avatar from '../components/Avatar.jsx'
import BotonVerContrasena from '../components/BotonVerContrasena.jsx'
import { ErrorState, LoadingState } from '../components/ui'
import { useAvatar } from '../hooks/useAvatar.js'
import { useConfiguracion } from '../hooks/useConfiguracion.js'
import { useUnidades } from '../hooks/useUnidades.js'
import { enlaceInvitacion } from '../lib/invitaciones.js'
import { guardarUnidades } from '../lib/unidades.js'
import { useIdioma } from '../../compartido/lib/idioma.jsx'
import { usePlanVista } from '../context/PlanVistaContext.js'
import {
  createFirestoreConfiguracionService,
  PLANES,
} from '../lib/services/firestoreConfiguracionService.js'
import './configuracion.css'

const secciones = ['cuenta', 'organizacion', 'equipo', 'preferencias', 'plan']
const seccionesPersonales = ['cuenta', 'preferencias', 'plan']

const textos = {
  es: {
    titulo: 'Configuración',
    menu: 'Secciones de configuración',
    pestanas: {
      cuenta: 'Cuenta',
      organizacion: 'Organización',
      equipo: 'Equipo',
      preferencias: 'Preferencias',
      plan: 'Plan y facturación',
    },
    sinConexion: 'La configuración aún no está disponible',
    sinConexionTexto:
      'Cuando tu sesión de equipo esté disponible, podrás editar y guardar estos datos.',
    cargando: 'Cargando tu configuración…',
    errorTitulo: 'No pudimos cargar tu configuración',
    errorTexto: 'Revisa tu conexión e inténtalo de nuevo.',
    reintentar: 'Reintentar',
    guardando: 'Guardando…',
    guardado: 'Cambios guardados.',
    errorGuardar: 'No pudimos guardar los cambios. Inténtalo de nuevo.',
    nombre: 'Nombre',
    correo: 'Correo',
    cargo: 'Cargo',
    rol: 'Rol',
    roles: { admin: 'Administrador', coach: 'Entrenador' },
    guardarCambios: 'Guardar cambios',
    avatar: 'Tu avatar',
    avatarTexto: 'Tócalo para cambiarlo.',
    cambiarAvatar: 'Cambiar avatar',
    cambiarContrasena: 'Cambiar contraseña',
    contrasenaActual: 'Contraseña actual',
    contrasenaNueva: 'Nueva contraseña',
    contrasenaRepetir: 'Repite la nueva contraseña',
    actualizarContrasena: 'Actualizar contraseña',
    cancelar: 'Cancelar',
    contrasenaCorta: 'Usa al menos 8 caracteres.',
    contrasenaDistinta: 'Las contraseñas no coinciden.',
    contrasenaIncorrecta: 'La contraseña actual no es correcta.',
    contrasenaLista: 'Contraseña actualizada.',
    nombreRequerido: 'Escribe tu nombre.',
    nombreOrg: 'Nombre de la organización',
    programa: 'Programa',
    soloDueno: 'Solo quien creó la organización puede cambiar estos datos.',
    guardar: 'Guardar',
    invitar: 'Invitar por correo',
    invitarPlaceholder: 'correo@universidad.edu',
    enviarInvitacion: 'Enviar invitación',
    invitacionEnviada: 'Invitación creada.',
    invitacionesPronto: 'Las invitaciones estarán disponibles muy pronto.',
    soloInvitan: 'Solo quien creó la organización o un administrador puede invitar.',
    compartirEnlace: 'Comparte este enlace para que se registre con ese correo y se una a tu equipo:',
    copiarEnlace: 'Copiar enlace',
    enlaceCopiado: 'Enlace copiado',
    invitacionExiste: 'Ese correo ya tiene una invitación o no se puede invitar.',
    yaEsMiembro: 'Esa persona ya es parte de tu equipo.',
    yaInvitado: 'Ese correo ya tiene una invitación pendiente. Anúlala para invitarlo con otro rol.',
    anular: 'Anular',
    anularInvitacion: (correo) => `Anular la invitación a ${correo}`,
    invitacionAnulada: 'Invitación anulada.',
    correoInvalido: 'Escribe un correo válido.',
    miembro: 'Miembro',
    jugadoresACargo: 'Jugadores a cargo',
    estado: 'Estado',
    todos: 'Todos',
    estados: { activo: 'Activo', invitado: 'Invitación enviada' },
    sinMiembros: 'Aún no hay miembros en tu equipo',
    sinMiembrosTexto: 'Invita a otros entrenadores para que vean y gestionen a sus jugadores.',
    notaRoles:
      'Administrador: ve todo y gestiona el equipo y el plan. Entrenador: ve y gestiona solo a sus jugadores.',
    unidades: 'Unidades de velocidad',
    idioma: 'Idioma',
    notificaciones: 'Notificaciones',
    avisos: {
      analysis: ['Análisis terminado', 'Cuando un video termina de procesarse'],
      application: ['Nueva postulación', 'Cuando un jugador envía el formulario'],
      alerts: ['Alertas de rendimiento', 'Cuando un jugador sube o baja mucho una métrica'],
      weekly: ['Resumen semanal por correo', 'Lunes por la mañana'],
    },
    guardarPreferencias: 'Guardar preferencias',
    planActual: 'Plan actual',
    sinPlan: 'Sin plan activo',
    sinPlanTexto: 'Elige un plan para empezar a analizar partidos.',
    usados: (usados, limite) => `${usados} de ${limite} análisis usados`,
    usadosSinLimite: (usados) => `${usados} análisis este mes`,
    prueba: 'Mes de prueba',
    equipoTitulo: '¿Trabajas con un equipo?',
    equipoTexto:
      'Con Ultra tu organización tiene su propio espacio e invitas a todo tu cuerpo técnico.',
    conocerUltra: 'Conocer Ultra',
    renueva: (fecha) => `Se renueva el ${fecha}`,
    pruebaTermina: (fecha) => `La prueba termina el ${fecha}`,
    pruebaTermino: (fecha) => `Tu mes de prueba terminó el ${fecha}. Elige un plan para seguir analizando partidos.`,
    ciclos: { mensual: 'Pago mensual', anual: 'Pago anual' },
    planes: [
      { id: 'basico', nombre: 'Básico', detalle: 'Para jugadores y padres. Hasta 2 jugadores.' },
      {
        id: 'pro',
        nombre: 'Pro',
        detalle: 'Para entrenadores y reclutadores. Hasta 24 jugadores.',
      },
      {
        id: 'ultra',
        nombre: 'Ultra',
        detalle: 'Para academias, clubes y universidades con varios entrenadores.',
      },
    ],
    verPrecios: 'Ver precios',
    elegirPlan: 'Elegir plan',
    cambiarA: 'Cambiar a este plan',
    metodoPago: 'Método de pago',
    sinMetodo: 'Sin método de pago registrado',
    actualizar: 'Actualizar',
  },
  en: {
    titulo: 'Settings',
    menu: 'Settings sections',
    pestanas: {
      cuenta: 'Account',
      organizacion: 'Organization',
      equipo: 'Team',
      preferencias: 'Preferences',
      plan: 'Plan and billing',
    },
    sinConexion: 'Settings aren’t available yet',
    sinConexionTexto:
      'Once your team session is available, you’ll be able to edit and save this data.',
    cargando: 'Loading your settings…',
    errorTitulo: 'We couldn’t load your settings',
    errorTexto: 'Check your connection and try again.',
    reintentar: 'Try again',
    guardando: 'Saving…',
    guardado: 'Changes saved.',
    errorGuardar: 'We couldn’t save your changes. Try again.',
    nombre: 'Name',
    correo: 'Email',
    cargo: 'Position',
    rol: 'Role',
    roles: { admin: 'Administrator', coach: 'Coach' },
    guardarCambios: 'Save changes',
    avatar: 'Your avatar',
    avatarTexto: 'Tap it to change it.',
    cambiarAvatar: 'Change avatar',
    cambiarContrasena: 'Change password',
    contrasenaActual: 'Current password',
    contrasenaNueva: 'New password',
    contrasenaRepetir: 'Repeat the new password',
    actualizarContrasena: 'Update password',
    cancelar: 'Cancel',
    contrasenaCorta: 'Use at least 8 characters.',
    contrasenaDistinta: 'Passwords don’t match.',
    contrasenaIncorrecta: 'Your current password is incorrect.',
    contrasenaLista: 'Password updated.',
    nombreRequerido: 'Enter your name.',
    nombreOrg: 'Organization name',
    programa: 'Program',
    soloDueno: 'Only the person who created the organization can change this.',
    guardar: 'Save',
    invitar: 'Invite by email',
    invitarPlaceholder: 'email@university.edu',
    enviarInvitacion: 'Send invitation',
    invitacionEnviada: 'Invitation created.',
    invitacionesPronto: 'Invitations will be available very soon.',
    soloInvitan: 'Only the organization creator or an administrator can invite.',
    compartirEnlace: 'Share this link so they sign up with that email and join your team:',
    copiarEnlace: 'Copy link',
    enlaceCopiado: 'Link copied',
    invitacionExiste: 'That email already has an invitation or cannot be invited.',
    yaEsMiembro: 'That person is already on your team.',
    yaInvitado: 'That email already has a pending invitation. Cancel it to invite them with another role.',
    anular: 'Cancel',
    anularInvitacion: (correo) => `Cancel the invitation to ${correo}`,
    invitacionAnulada: 'Invitation cancelled.',
    correoInvalido: 'Enter a valid email.',
    miembro: 'Member',
    jugadoresACargo: 'Players in charge',
    estado: 'Status',
    todos: 'All',
    estados: { activo: 'Active', invitado: 'Invitation sent' },
    sinMiembros: 'No team members yet',
    sinMiembrosTexto: 'Invite other coaches so they can see and manage their players.',
    notaRoles:
      'Administrator: sees everything and manages the team and plan. Coach: sees and manages only their players.',
    unidades: 'Speed units',
    idioma: 'Language',
    notificaciones: 'Notifications',
    avisos: {
      analysis: ['Analysis finished', 'When a video finishes processing'],
      application: ['New application', 'When a player submits the form'],
      alerts: ['Performance alerts', 'When a player’s metric rises or drops sharply'],
      weekly: ['Weekly email summary', 'Monday mornings'],
    },
    guardarPreferencias: 'Save preferences',
    planActual: 'Current plan',
    sinPlan: 'No active plan',
    sinPlanTexto: 'Choose a plan to start analyzing matches.',
    usados: (usados, limite) => `${usados} of ${limite} analyses used`,
    usadosSinLimite: (usados) => `${usados} analyses this month`,
    prueba: 'Trial month',
    equipoTitulo: 'Working with a team?',
    equipoTexto:
      'With Ultra your organization gets its own space and you invite your whole coaching staff.',
    conocerUltra: 'Discover Ultra',
    renueva: (fecha) => `Renews on ${fecha}`,
    pruebaTermina: (fecha) => `Trial ends on ${fecha}`,
    pruebaTermino: (fecha) => `Your trial ended on ${fecha}. Choose a plan to keep analyzing matches.`,
    ciclos: { mensual: 'Billed monthly', anual: 'Billed yearly' },
    planes: [
      { id: 'basico', nombre: 'Basic', detalle: 'For players and parents. Up to 2 players.' },
      { id: 'pro', nombre: 'Pro', detalle: 'For coaches and recruiters. Up to 24 players.' },
      {
        id: 'ultra',
        nombre: 'Ultra',
        detalle: 'For academies, clubs and universities with several coaches.',
      },
    ],
    verPrecios: 'View pricing',
    elegirPlan: 'Choose a plan',
    cambiarA: 'Switch to this plan',
    metodoPago: 'Payment method',
    sinMetodo: 'No payment method on file',
    actualizar: 'Update',
  },
}

const tarjeta = 'rounded-card border border-line bg-surface p-5'
const subtitulo = 'font-display text-[22px] leading-tight font-bold tracking-[0.01em]'
const etiqueta = 'text-xs font-semibold tracking-[0.08em] text-muted uppercase'
const campo = 'flex flex-col gap-1.5 text-[13px] font-semibold text-text2'
const entrada =
  'h-11 w-full min-w-0 rounded-[10px] border border-line2 bg-bg px-3.5 text-[15px] font-normal text-text transition-colors placeholder:text-placeholder hover:border-line3 focus:border-accent-line focus:outline-none read-only:text-muted read-only:hover:border-line2 disabled:cursor-not-allowed disabled:opacity-60'
const boton =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] border px-4 text-sm font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50'
const botonPrincipal = `${boton} border-accent-line bg-accent text-on-accent hover:opacity-90`
const botonNormal = `${boton} border-line2 bg-surface2 text-text hover:bg-line`
const fila = 'flex items-center justify-between gap-4 border-t border-chip py-3.5 first:border-t-0'

function iniciales(nombre = '') {
  return (
    nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((palabra) => palabra[0])
      .join('')
      .toUpperCase() || '—'
  )
}

function Interruptor({ activo, onChange, etiqueta: nombre, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={nombre}
      disabled={disabled}
      onClick={() => onChange(!activo)}
      className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        activo ? 'bg-accent' : 'bg-line2'
      }`}
    >
      <span
        className={`absolute top-0.75 left-0.75 size-5.5 rounded-full transition-[translate,background-color] duration-150 ${
          activo ? 'translate-x-5 bg-on-accent' : 'bg-text2'
        }`}
      />
    </button>
  )
}

function Mensaje({ estado }) {
  if (!estado) return <p role="status" className="min-h-5 text-sm" />
  return (
    <p
      role={estado.tipo === 'error' ? 'alert' : 'status'}
      className={`min-h-5 text-sm font-medium ${estado.tipo === 'error' ? 'text-bad' : 'text-good'}`}
    >
      {estado.texto}
    </p>
  )
}

function useGuardar(t) {
  const [estado, setEstado] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const guardar = async (accion, exito = t.guardado, traducirError) => {
    setOcupado(true)
    setEstado(null)
    try {
      await accion()
      setEstado({ tipo: 'ok', texto: exito })
    } catch (error) {
      setEstado({ tipo: 'error', texto: traducirError?.(error) ?? t.errorGuardar })
    } finally {
      setOcupado(false)
    }
  }
  return { estado, setEstado, ocupado, guardar }
}

function Contrasena({ t, service, onCerrar }) {
  const id = useId()
  const [valores, setValores] = useState({ actual: '', nueva: '', repetir: '' })
  const [error, setError] = useState('')
  const { estado, ocupado, guardar } = useGuardar(t)

  const enviar = (evento) => {
    evento.preventDefault()
    if (valores.nueva.length < 8) return setError(t.contrasenaCorta)
    if (valores.nueva !== valores.repetir) return setError(t.contrasenaDistinta)
    setError('')
    guardar(
      () => service.changePassword({ current: valores.actual, next: valores.nueva }),
      t.contrasenaLista,
      (fallo) =>
        ['auth/wrong-password', 'auth/invalid-credential'].includes(fallo?.code)
          ? t.contrasenaIncorrecta
          : t.errorGuardar,
    )
  }

  const cambiar = (clave) => (evento) => setValores({ ...valores, [clave]: evento.target.value })
  // Cada contraseña tiene su propio ojo para ver lo que se escribió.
  const [visibles, setVisibles] = useState({})
  const alternar = (clave) => setVisibles((actual) => ({ ...actual, [clave]: !actual[clave] }))

  return (
    <form
      noValidate
      onSubmit={enviar}
      className="flex flex-col gap-3.5 rounded-xl border border-line2 bg-surface2 p-4"
      aria-label={t.cambiarContrasena}
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        {[
          ['actual', t.contrasenaActual, 'current-password'],
          ['nueva', t.contrasenaNueva, 'new-password'],
          ['repetir', t.contrasenaRepetir, 'new-password'],
        ].map(([clave, texto, autocompletar]) => (
          <div key={clave} className={campo}>
            <label htmlFor={`${id}-${clave}`}>{texto}</label>
            <div className="relative">
              <input
                id={`${id}-${clave}`}
                type={visibles[clave] ? 'text' : 'password'}
                autoComplete={autocompletar}
                required
                value={valores[clave]}
                onChange={cambiar(clave)}
                className={`${entrada} w-full pr-11`}
              />
              <BotonVerContrasena
                visible={Boolean(visibles[clave])}
                onCambiar={() => alternar(clave)}
                controla={`${id}-${clave}`}
              />
            </div>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-bad">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        <button type="submit" disabled={ocupado} className={botonPrincipal}>
          {ocupado ? t.guardando : t.actualizarContrasena}
        </button>
        <button type="button" onClick={onCerrar} className={botonNormal}>
          {t.cancelar}
        </button>
        <Mensaje estado={estado} />
      </div>
    </form>
  )
}

function Cuenta({ t, datos, service, bloqueado }) {
  const id = useId()
  const [valores, setValores] = useState({
    name: datos?.name ?? '',
    position: datos?.position ?? '',
  })
  const [verContrasena, setVerContrasena] = useState(false)
  const { indice, siguiente } = useAvatar(datos?.email)
  const { estado, setEstado, ocupado, guardar } = useGuardar(t)

  const enviar = (evento) => {
    evento.preventDefault()
    if (!valores.name.trim()) return setEstado({ tipo: 'error', texto: t.nombreRequerido })
    guardar(() =>
      service.saveAccount({ name: valores.name.trim(), position: valores.position.trim() }),
    )
  }

  return (
    <section className={`${tarjeta} flex flex-col gap-4.5`} aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className={subtitulo}>
        {t.pestanas.cuenta}
      </h2>
      <form noValidate onSubmit={enviar} className="flex flex-col gap-4.5">
        <fieldset disabled={bloqueado || ocupado} className="flex min-w-0 flex-col gap-4.5">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={siguiente}
              aria-label={t.cambiarAvatar}
              title={t.cambiarAvatar}
              className="group relative cursor-pointer rounded-full transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Avatar
                key={indice}
                nombre={valores.name}
                indice={indice}
                className="avatar-aparecer size-18 font-display"
                texto="text-2xl"
              />
              <span className="absolute -right-0.5 -bottom-0.5 grid size-6.5 place-items-center rounded-full border-2 border-surface bg-surface2 text-text2 transition-colors group-hover:text-text">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 12a8 8 0 01-13.7 5.6M4 12a8 8 0 0113.7-5.6" />
                  <path d="M17.5 2.5v4h-4M6.5 21.5v-4h4" />
                </svg>
              </span>
            </button>
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{t.avatar}</span>
              <span className="text-[13px] text-muted">{t.avatarTexto}</span>
            </span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
            <label htmlFor={`${id}-nombre`} className={campo}>
              {t.nombre}
              <input
                id={`${id}-nombre`}
                value={valores.name}
                onChange={(evento) => setValores({ ...valores, name: evento.target.value })}
                autoComplete="name"
                maxLength={80}
                className={entrada}
              />
            </label>
            <label htmlFor={`${id}-correo`} className={campo}>
              {t.correo}
              <input
                id={`${id}-correo`}
                type="email"
                value={datos?.email ?? ''}
                readOnly
                className={entrada}
              />
            </label>
            <label htmlFor={`${id}-cargo`} className={campo}>
              {t.cargo}
              <input
                id={`${id}-cargo`}
                value={valores.position}
                onChange={(evento) => setValores({ ...valores, position: evento.target.value })}
                maxLength={80}
                className={entrada}
              />
            </label>
            <label htmlFor={`${id}-rol`} className={campo}>
              {t.rol}
              <input
                id={`${id}-rol`}
                value={datos?.role ? t.roles[datos.role] : ''}
                readOnly
                className={entrada}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button type="submit" className={botonPrincipal}>
              {ocupado ? t.guardando : t.guardarCambios}
            </button>
            <button
              type="button"
              onClick={() => setVerContrasena((actual) => !actual)}
              aria-expanded={verContrasena}
              className={botonNormal}
            >
              {t.cambiarContrasena}
            </button>
            <Mensaje estado={estado} />
          </div>
        </fieldset>
      </form>
      {verContrasena && !bloqueado && (
        <Contrasena t={t} service={service} onCerrar={() => setVerContrasena(false)} />
      )}
    </section>
  )
}

function Organizacion({ t, datos, service, bloqueado }) {
  const id = useId()
  const [valores, setValores] = useState({
    name: datos?.name ?? '',
    program: datos?.program ?? '',
  })
  const { estado, setEstado, ocupado, guardar } = useGuardar(t)
  const soloLectura = Boolean(datos) && datos.canEdit === false

  const enviar = (evento) => {
    evento.preventDefault()
    if (valores.name.trim().length < 2)
      return setEstado({ tipo: 'error', texto: t.nombreRequerido })
    guardar(() =>
      service.saveOrganization({ name: valores.name.trim(), program: valores.program.trim() }),
    )
  }

  return (
    <section className={`${tarjeta} flex flex-col gap-4.5`} aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className={subtitulo}>
        {t.pestanas.organizacion}
      </h2>
      <form noValidate onSubmit={enviar}>
        <fieldset
          disabled={bloqueado || ocupado || soloLectura}
          className="flex min-w-0 flex-col gap-4.5"
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
            <label htmlFor={`${id}-nombre`} className={campo}>
              {t.nombreOrg}
              <input
                id={`${id}-nombre`}
                value={valores.name}
                maxLength={120}
                onChange={(evento) => setValores({ ...valores, name: evento.target.value })}
                className={entrada}
              />
            </label>
            <label htmlFor={`${id}-programa`} className={campo}>
              {t.programa}
              <input
                id={`${id}-programa`}
                value={valores.program}
                maxLength={120}
                onChange={(evento) => setValores({ ...valores, program: evento.target.value })}
                className={entrada}
              />
            </label>
          </div>
          {soloLectura ? (
            <p className="text-[13px] text-muted">{t.soloDueno}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5">
              <button type="submit" className={botonPrincipal}>
                {ocupado ? t.guardando : t.guardar}
              </button>
              <Mensaje estado={estado} />
            </div>
          )}
        </fieldset>
      </form>
    </section>
  )
}

function Equipo({ t, miembros, service, bloqueado, puedeInvitar = true }) {
  const id = useId()
  const [correo, setCorreo] = useState('')
  const [rol, setRol] = useState('coach')
  const [enlace, setEnlace] = useState('')
  const [copiado, setCopiado] = useState(false)
  const { estado, setEstado, ocupado, guardar } = useGuardar(t)
  const sinInvitaciones = !service?.inviteMember

  const enviar = async (evento) => {
    evento.preventDefault()
    const invitado = correo.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitado)) {
      return setEstado({ tipo: 'error', texto: t.correoInvalido })
    }
    // Antes de escribir: ¿ya está en el equipo o ya tiene invitación? (PCIT-40)
    const existente = miembros.find((miembro) => miembro.email?.toLowerCase() === invitado.toLowerCase())
    if (existente) {
      setEnlace('')
      return setEstado({ tipo: 'error', texto: existente.status === 'invitado' ? t.yaInvitado : t.yaEsMiembro })
    }
    setEnlace('')
    setCopiado(false)
    let creada = false
    await guardar(
      async () => {
        await service.inviteMember({ email: invitado, role: rol })
        creada = true
      },
      t.invitacionEnviada,
      (error) => (error?.code === 'permission-denied' ? t.invitacionExiste : undefined),
    )
    if (!creada) return
    setEnlace(enlaceInvitacion(window.location.origin, invitado))
    setCorreo('')
  }

  const puedeAnular = puedeInvitar && !bloqueado && Boolean(service?.cancelInvite)
  const anular = (email) => {
    setEnlace('')
    return guardar(() => service.cancelInvite({ email }), t.invitacionAnulada)
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace)
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <section className={`${tarjeta} flex flex-col gap-4.5`} aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className={subtitulo}>
        {t.pestanas.equipo}
      </h2>
      <form noValidate onSubmit={enviar}>
        <fieldset
          disabled={bloqueado || ocupado || sinInvitaciones || !puedeInvitar}
          className="flex min-w-0 flex-col gap-2"
        >
          <div className="flex flex-wrap items-end gap-2.5">
            <label htmlFor={`${id}-correo`} className={`${campo} flex-[1_1_260px]`}>
              {t.invitar}
              <input
                id={`${id}-correo`}
                type="email"
                value={correo}
                placeholder={t.invitarPlaceholder}
                onChange={(evento) => setCorreo(evento.target.value)}
                className={entrada}
              />
            </label>
            <label htmlFor={`${id}-rol`} className={`${campo} flex-[0_1_200px]`}>
              {t.rol}
              <select
                id={`${id}-rol`}
                value={rol}
                onChange={(evento) => setRol(evento.target.value)}
                className={`${entrada} configuracion-select appearance-none pr-10`}
              >
                <option value="coach">{t.roles.coach}</option>
                <option value="admin">{t.roles.admin}</option>
              </select>
            </label>
            <button type="submit" className={botonPrincipal}>
              {ocupado ? t.guardando : t.enviarInvitacion}
            </button>
          </div>
          {sinInvitaciones && !bloqueado ? (
            <p className="text-[13px] text-muted">{t.invitacionesPronto}</p>
          ) : !puedeInvitar && !bloqueado ? (
            <p className="text-[13px] text-muted">{t.soloInvitan}</p>
          ) : (
            <Mensaje estado={estado} />
          )}
          {enlace && (
            <div className="flex flex-col gap-1.5 text-[13px]">
              <span className="text-muted">{t.compartirEnlace}</span>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-chip px-2.5 py-1.5">{enlace}</code>
                <button type="button" onClick={copiar} className="rounded-md border border-line2 px-2.5 py-1.5 font-semibold">
                  {copiado ? t.enlaceCopiado : t.copiarEnlace}
                </button>
              </div>
            </div>
          )}
        </fieldset>
      </form>

      {miembros.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line2 px-6 py-8 text-center">
          <span className="grid size-12 place-items-center rounded-full border border-line2 bg-surface text-electric-ink">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5" />
              <path d="M16 4.6a3.5 3.5 0 010 6.8" />
              <path d="M21.5 20c0-2.6-1.4-4.3-3.5-5" />
            </svg>
          </span>
          <p className="font-semibold">{t.sinMiembros}</p>
          <p className="max-w-[40ch] text-[13px] text-muted">{t.sinMiembrosTexto}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-140 border-collapse text-left text-sm">
            <thead>
              <tr className="text-xs tracking-[0.06em] text-muted uppercase">
                <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">
                  {t.miembro}
                </th>
                <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">
                  {t.rol}
                </th>
                <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">
                  {t.jugadoresACargo}
                </th>
                <th scope="col" className="border-b border-line px-3 py-2.5 font-semibold">
                  {t.estado}
                </th>
              </tr>
            </thead>
            <tbody>
              {miembros.map((miembro) => (
                <tr key={miembro.id}>
                  <td className="border-b border-chip px-3 py-3">
                    <span className="flex items-center gap-2.5">
                      <span className="grid size-8.5 shrink-0 place-items-center rounded-full bg-line text-xs font-bold">
                        {iniciales(miembro.name)}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold">{miembro.name}</span>
                        <span className="truncate text-xs text-muted">{miembro.email}</span>
                      </span>
                    </span>
                  </td>
                  <td className="border-b border-chip px-3 py-3">{t.roles[miembro.role]}</td>
                  <td className="border-b border-chip px-3 py-3">{miembro.players ?? t.todos}</td>
                  <td className="border-b border-chip px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-chip px-2.5 py-0.5 text-xs font-semibold">
                      <span
                        className={`size-2 rounded-full ${miembro.status === 'activo' ? 'bg-good' : 'bg-electric'}`}
                      />
                      {t.estados[miembro.status] ?? miembro.status}
                    </span>
                    {miembro.status === 'invitado' && puedeAnular && (
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => anular(miembro.email)}
                        aria-label={t.anularInvitacion(miembro.email)}
                        className="ml-2 text-xs font-semibold text-muted underline-offset-2 hover:text-text hover:underline"
                      >
                        {t.anular}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[13px] text-muted">{t.notaRoles}</p>
    </section>
  )
}

function Preferencias({ t, datos, service, bloqueado }) {
  const id = useId()
  const unidadesActuales = useUnidades()
  const { idioma, cambiarIdioma } = useIdioma()
  const [valores, setValores] = useState({
    units: datos?.units ?? unidadesActuales,
    notifications: {
      analysis: false,
      application: false,
      alerts: false,
      weekly: false,
      ...datos?.notifications,
    },
  })
  const { estado, ocupado, guardar } = useGuardar(t)

  const enviar = (evento) => {
    evento.preventDefault()
    guardar(async () => {
      await service.savePreferences(valores)
      guardarUnidades(valores.units)
    })
  }

  return (
    <section className={`${tarjeta} flex flex-col gap-4.5`} aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className={subtitulo}>
        {t.pestanas.preferencias}
      </h2>
      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col gap-1.5">
          <span id={`${id}-unidades`} className="text-[13px] font-semibold text-text2">
            {t.unidades}
          </span>
          <div
            role="group"
            aria-labelledby={`${id}-unidades`}
            className="inline-flex gap-0.5 rounded-[10px] border border-line bg-bg p-0.75"
          >
            {[
              ['kmh', 'km/h'],
              ['mph', 'mph'],
            ].map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={valores.units === valor}
                disabled={bloqueado || ocupado}
                onClick={() => setValores({ ...valores, units: valor })}
                className="min-h-9.5 cursor-pointer rounded-lg px-3.5 text-[13px] font-semibold text-text2 transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:bg-line aria-pressed:text-text"
              >
                {texto}
              </button>
            ))}
          </div>
        </div>
        <label htmlFor={`${id}-idioma`} className={`${campo} min-w-55`}>
          {t.idioma}
          <select
            id={`${id}-idioma`}
            value={idioma}
            onChange={(evento) => evento.target.value !== idioma && cambiarIdioma()}
            className={`${entrada} configuracion-select appearance-none pr-10`}
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
      <form noValidate onSubmit={enviar} className="flex flex-col gap-4.5">
        <div>
          <p className={`${etiqueta} mb-1`}>{t.notificaciones}</p>
          <ul>
            {Object.keys(t.avisos).map((clave) => (
              <li key={clave} className={fila}>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px]">{t.avisos[clave][0]}</span>
                  <span className="text-[13px] text-muted">{t.avisos[clave][1]}</span>
                </span>
                <Interruptor
                  activo={valores.notifications[clave]}
                  etiqueta={t.avisos[clave][0]}
                  disabled={bloqueado || ocupado}
                  onChange={(activo) =>
                    setValores({
                      ...valores,
                      notifications: { ...valores.notifications, [clave]: activo },
                    })
                  }
                />
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="submit" disabled={bloqueado || ocupado} className={botonPrincipal}>
            {ocupado ? t.guardando : t.guardarPreferencias}
          </button>
          <Mensaje estado={estado} />
        </div>
      </form>
    </section>
  )
}

function Plan({ t, plan, locale, esOrganizacion }) {
  const id = useId()
  const actual = t.planes.find((opcion) => opcion.id === plan?.id)
  const porcentaje = plan?.limit ? Math.min(100, Math.round((plan.used / plan.limit) * 100)) : 0
  const tieneUso = typeof plan?.used === 'number'
  const renovacion =
    plan?.renewsAt &&
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(plan.renewsAt),
    )
  // PCIT-170: si la prueba ya venció, cuándo terminó.
  const terminoPrueba =
    plan?.trialEndedAt &&
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(plan.trialEndedAt),
    )
  // PCIT-158: periodo y renovación del plan contratado; en la prueba, cuándo termina.
  const facturacion = [
    !plan?.trial && plan?.cycle ? t.ciclos[plan.cycle] : null,
    renovacion ? (plan?.trial ? t.pruebaTermina(renovacion) : t.renueva(renovacion)) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className={`${tarjeta} flex flex-col gap-4.5`} aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className={subtitulo}>
        {t.pestanas.plan}
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line2 bg-surface2 p-4.5">
        <div>
          <p className={etiqueta}>{t.planActual}</p>
          <p className="mt-1 flex items-center gap-2.5 font-display text-[32px] leading-none font-bold">
            {actual ? actual.nombre : t.sinPlan}
            {plan?.trial && (
              <span className="rounded-full bg-electric/15 px-2.5 py-1 font-sans text-xs font-semibold text-electric-ink">
                {t.prueba}
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-muted">
            {actual ? actual.detalle : terminoPrueba ? t.pruebaTermino(terminoPrueba) : t.sinPlanTexto}
          </p>
          {facturacion && <p className="mt-1 text-xs text-muted">{facturacion}</p>}
        </div>
        {tieneUso && !plan.limit ? (
          <span className="text-sm">{t.usadosSinLimite(plan.used)}</span>
        ) : plan?.limit ? (
          <div className="flex min-w-55 flex-col gap-1.5">
            <span className="text-sm">{t.usados(plan.used, plan.limit)}</span>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={porcentaje}
              aria-label={t.usados(plan.used, plan.limit)}
              className="h-2 overflow-hidden rounded-full bg-line2"
            >
              <div
                className="h-full rounded-full bg-electric"
                style={{ width: `${porcentaje}%` }}
              />
            </div>
          </div>
        ) : (
          <Link to="/inicio" className={botonPrincipal}>
            {t.elegirPlan}
          </Link>
        )}
      </div>
      {!esOrganizacion && actual && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-electric/50 bg-electric/5 p-4.5">
          <span className="flex flex-col gap-1">
            <span className="font-semibold">{t.equipoTitulo}</span>
            <span className="max-w-[52ch] text-[13px] text-muted">{t.equipoTexto}</span>
          </span>
          <Link to="/checkout?plan=ultra" className={botonNormal}>
            {t.conocerUltra}
          </Link>
        </div>
      )}
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        {t.planes.map((opcion) => {
          const esActual = opcion.id === plan?.id
          return (
            <li
              key={opcion.id}
              className={`flex flex-col gap-2 rounded-xl border p-4 ${esActual ? 'border-accent-line' : 'border-line'}`}
            >
              <p className="font-display text-[22px] font-bold">{opcion.nombre}</p>
              <p className="text-[13px] leading-snug text-muted">{opcion.detalle}</p>
              {esActual ? (
                <span className="self-start rounded-full bg-chip px-2.5 py-0.5 text-xs font-semibold text-accent-ink">
                  {t.planActual}
                </span>
              ) : (
                <Link
                  to={`/checkout?plan=${opcion.id}`}
                  className="self-start text-sm font-semibold text-accent-ink hover:underline"
                >
                  {actual ? t.cambiarA : t.elegirPlan}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
      <div className="flex items-center justify-between gap-4 border-t border-chip pt-3.5">
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px]">{t.metodoPago}</span>
          <span className="text-[13px] text-muted">{t.sinMetodo}</span>
        </span>
        <Link to="/precios" className={botonNormal}>
          {t.actualizar}
        </Link>
      </div>
    </section>
  )
}

function Contenido({ seccion, t, datos, service, bloqueado, locale, esOrganizacion }) {
  if (seccion === 'cuenta')
    return <Cuenta t={t} datos={datos?.account} service={service} bloqueado={bloqueado} />
  if (seccion === 'organizacion')
    return (
      <Organizacion t={t} datos={datos?.organization} service={service} bloqueado={bloqueado} />
    )
  if (seccion === 'equipo')
    return (
      <Equipo
        t={t}
        miembros={datos?.team ?? []}
        service={service}
        bloqueado={bloqueado}
        puedeInvitar={datos?.organization?.canInvite ?? true}
      />
    )
  if (seccion === 'preferencias')
    return <Preferencias t={t} datos={datos?.preferences} service={service} bloqueado={bloqueado} />
  return <Plan t={t} plan={datos?.plan} locale={locale} esOrganizacion={esOrganizacion} />
}

export default function Configuracion({ service: inyectado, db, auth, session }) {
  const uid = session?.uid
  const orgId = session?.orgId
  const role = session?.role ?? 'coach'
  const service = useMemo(() => {
    if (inyectado) return inyectado
    if (!db || !auth || !uid || !orgId || !['coach', 'admin'].includes(role)) return undefined
    return createFirestoreConfiguracionService({ db, auth, uid, orgId, role })
  }, [inyectado, db, auth, uid, orgId, role])
  const { idioma } = useIdioma()
  const t = textos[idioma]
  const [parametros, setParametros] = useSearchParams()
  const { data, error, loading, retry } = useConfiguracion(service)
  const { planVista } = usePlanVista()
  const planActual = planVista ?? data?.plan?.id
  const esOrganizacion = planActual ? planActual === 'ultra' : Boolean(data?.isOrganization)
  const visibles = !service || esOrganizacion ? secciones : seccionesPersonales
  const datos =
    data && planVista
      ? {
          ...data,
          plan: { ...data.plan, id: planVista, trial: false, limit: PLANES[planVista].limite },
        }
      : data
  const pedida = parametros.get('seccion')
  const seccion = visibles.includes(pedida) ? pedida : 'cuenta'
  const locale = idioma === 'en' ? 'en-US' : 'es-PE'

  const elegir = (nueva) => {
    const siguientes = new URLSearchParams(parametros)
    siguientes.set('seccion', nueva)
    setParametros(siguientes, { replace: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-300 flex-col gap-5">
      <h1 className="font-display text-[40px] leading-none font-bold">{t.titulo}</h1>

      {!service && (
        <p
          role="status"
          className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-xl border border-dashed border-line3 px-4 py-3 text-[13px] text-muted"
        >
          <strong className="font-semibold text-electric-ink">{t.sinConexion}</strong>
          {t.sinConexionTexto}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <nav
          aria-label={t.menu}
          className={`${tarjeta} flex flex-[1_1_220px] flex-col gap-0.5 p-2 max-md:-mx-1 max-md:flex-row max-md:overflow-x-auto max-md:p-1.5 max-md:[scrollbar-width:none] lg:sticky lg:top-24`}
        >
          {visibles.map((clave) => (
            <button
              key={clave}
              type="button"
              aria-current={seccion === clave ? 'page' : undefined}
              onClick={() => elegir(clave)}
              className="flex min-h-11 w-full cursor-pointer items-center rounded-[10px] px-3.5 text-left text-[15px] font-semibold whitespace-nowrap text-text2 max-md:w-auto max-md:shrink-0 transition-colors hover:bg-surface2 hover:text-text aria-[current=page]:bg-line aria-[current=page]:text-text"
            >
              {t.pestanas[clave]}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-[999_1_520px]">
          {loading ? (
            <div className={tarjeta} aria-busy="true">
              <LoadingState title={t.cargando} />
            </div>
          ) : error ? (
            <div className={tarjeta}>
              <ErrorState
                title={t.errorTitulo}
                description={t.errorTexto}
                onRetry={retry}
                retryLabel={t.reintentar}
              />
            </div>
          ) : (
            <Contenido
              key={`${seccion}-${service?.scopeKey ?? 'sin-conexion'}`}
              seccion={seccion}
              t={t}
              datos={datos}
              service={service}
              bloqueado={!service}
              locale={locale}
              esOrganizacion={esOrganizacion}
            />
          )}
        </div>
      </div>
    </div>
  )
}
