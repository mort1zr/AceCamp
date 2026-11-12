// Matriz de acceso por rol y organización (PCIT-210, parte de PCIT-67).
//
// Cada fila es una operación sobre un recurso concreto. `permitido` lista los roles
// que deben poder hacerla; el resto de ROLES debe ser rechazado por las reglas.
// accessMatrix.rules.test.js (PCIT-211) prueba cada celda contra los emuladores, y
// docs/PCIT-67-seguridad-de-datos.md muestra esta misma tabla (scripts/accessMatrixTable.mjs).
//
// Datos de partida de todas las filas (ver accessMatrix.rules.test.js):
// - Club A (org-a): dueño y administrador `admin-a`, entrenadores `coach-a` y `coach2-a`.
// - Club B (org-b): administrador `admin-b` y entrenador `coach-b`.
// - Jugador p-a, partido m-a (Listo) y video de m-a: creados por `coach-a` en el club A.
// - Postulación app-a, enlace de postulación e integración de Google del club A.
// - Invitación pendiente del club A a nuevo@club-a.test.
// - `plataforma`: administrador de plataforma, sin ficha en users.
//
// El worker del modelo usa el Admin SDK y no pasa por estas reglas: es el único que
// escribe los estados procesando/listo/error, las estadísticas y processed.mp4.

export const ROLES = {
  visitante: 'Visitante sin sesión',
  sinOrganizacion: 'Usuario con sesión y sin organización',
  entrenador: 'Entrenador del club A que creó el jugador y el partido',
  otroEntrenador: 'Otro entrenador del club A',
  admin: 'Administrador y dueño del club A',
  entrenadorAjeno: 'Entrenador del club B',
  adminAjeno: 'Administrador del club B',
  plataforma: 'Administrador de plataforma (PCIT-188)',
}

const EQUIPO_A = ['entrenador', 'otroEntrenador', 'admin']
const CREADOR_Y_ADMIN = ['entrenador', 'admin']
const CON_SESION = Object.keys(ROLES).filter(role => role !== 'visitante')

export const MATRIX = [
  // ---------- platformAdmins ----------
  { id: 'platformAdmins.getPropia', recurso: 'platformAdmins/{uid propio}', operacion: 'leer',
    permitido: CON_SESION, motivo: 'Cada cuenta puede saber si ella misma es administradora de plataforma.' },
  { id: 'platformAdmins.getAjena', recurso: 'platformAdmins/plataforma', operacion: 'leer',
    permitido: ['plataforma'], motivo: 'Nadie más puede saber quién administra la plataforma.' },
  { id: 'platformAdmins.list', recurso: 'platformAdmins', operacion: 'listar',
    permitido: [], motivo: 'La lista de administradores no se consulta desde la web.' },
  { id: 'platformAdmins.create', recurso: 'platformAdmins/{uid propio}', operacion: 'crear',
    permitido: [], motivo: 'El permiso solo lo concede un operador desde la consola o el Admin SDK.' },

  // ---------- users ----------
  { id: 'users.getPropia', recurso: 'users/{uid propio}', operacion: 'leer',
    permitido: CON_SESION, motivo: 'Cada cuenta lee su propia ficha, exista o no.' },
  { id: 'users.get', recurso: 'users/coach-a', operacion: 'leer',
    permitido: [...EQUIPO_A, 'plataforma'], motivo: 'La ven su equipo y el administrador de plataforma.' },
  { id: 'users.list', recurso: 'users (orgId = org-a)', operacion: 'listar',
    permitido: [...EQUIPO_A, 'plataforma'], motivo: 'El equipo lista sus miembros; la plataforma, los de cualquier club.' },
  { id: 'users.registro', recurso: 'users/{uid propio} + orgs/{nueva}', operacion: 'crear',
    permitido: ['sinOrganizacion', 'plataforma'], motivo: 'Solo se registra quien todavía no tiene ficha, creando su propia organización.' },
  { id: 'users.update', recurso: 'users/coach-a', operacion: 'editar',
    permitido: ['entrenador'], motivo: 'Cada uno edita su nombre y cargo; nadie edita la ficha de otro.' },
  { id: 'users.delete', recurso: 'users/coach-a', operacion: 'borrar',
    permitido: [], motivo: 'Las fichas no se borran desde la web.' },

  // ---------- orgs ----------
  { id: 'orgs.get', recurso: 'orgs/org-a', operacion: 'leer',
    permitido: [...EQUIPO_A, 'plataforma'], motivo: 'La ven sus miembros y el administrador de plataforma.' },
  { id: 'orgs.list', recurso: 'orgs', operacion: 'listar',
    permitido: ['plataforma'], motivo: 'Solo la administración de plataforma recorre todas las organizaciones.' },
  { id: 'orgs.update', recurso: 'orgs/org-a', operacion: 'editar',
    permitido: ['admin'], motivo: 'Solo el dueño cambia el nombre y el programa.' },
  { id: 'orgs.delete', recurso: 'orgs/org-a', operacion: 'borrar',
    permitido: [], motivo: 'Las organizaciones no se borran desde la web.' },

  // ---------- orgs/{orgId}/usage ----------
  { id: 'usage.get', recurso: 'orgs/org-a/usage/{mes}', operacion: 'leer',
    permitido: [...EQUIPO_A, 'plataforma'], motivo: 'El contador lo ven el equipo y la plataforma.' },
  { id: 'usage.update', recurso: 'orgs/org-a/usage/{mes}', operacion: 'editar',
    permitido: [], motivo: 'Solo sube junto con el alta de un partido nuevo (PCIT-41); nunca suelto.' },
  { id: 'usage.delete', recurso: 'orgs/org-a/usage/{mes}', operacion: 'borrar',
    permitido: [], motivo: 'Borrar el contador devolvería análisis gastados.' },

  // ---------- invites ----------
  { id: 'invites.get', recurso: 'invites/nuevo@club-a.test', operacion: 'leer',
    permitido: ['admin'], motivo: 'La ven quien puede invitar en el club y la persona invitada.' },
  { id: 'invites.list', recurso: 'invites (orgId = org-a)', operacion: 'listar',
    permitido: ['admin'], motivo: 'Solo el dueño o un administrador listan las invitaciones de su club.' },
  { id: 'invites.create', recurso: 'invites/{correo nuevo}', operacion: 'crear',
    permitido: ['admin'], motivo: 'Invitan el dueño y los administradores (PCIT-40).' },
  { id: 'invites.accept', recurso: 'invites/nuevo@club-a.test', operacion: 'editar',
    permitido: [], motivo: 'Solo la persona invitada la acepta, al registrarse con ese correo.' },
  { id: 'invites.delete', recurso: 'invites/nuevo@club-a.test', operacion: 'borrar',
    permitido: ['admin'], motivo: 'El dueño o un administrador anulan una invitación pendiente.' },

  // ---------- players ----------
  { id: 'players.get', recurso: 'players/p-a', operacion: 'leer',
    permitido: CREADOR_Y_ADMIN, motivo: 'El entrenador ve sus jugadores; el administrador, todos los del club (PCIT-39).' },
  { id: 'players.list', recurso: 'players (org-a, creados por coach-a)', operacion: 'listar',
    permitido: CREADOR_Y_ADMIN, motivo: 'Igual que leer: otro entrenador no ve jugadores ajenos.' },
  { id: 'players.create', recurso: 'players/{nuevo} en org-a', operacion: 'crear',
    permitido: EQUIPO_A, motivo: 'Cualquier miembro registra jugadores en su club, con su UID y la autorización.' },
  { id: 'players.update', recurso: 'players/p-a', operacion: 'editar',
    permitido: CREADOR_Y_ADMIN, motivo: 'Edita quien lo gestiona; nunca el club, el autor ni la autorización.' },
  { id: 'players.delete', recurso: 'players/p-a', operacion: 'borrar',
    permitido: CREADOR_Y_ADMIN, motivo: 'Borra quien lo gestiona.' },

  // ---------- matches ----------
  { id: 'matches.get', recurso: 'matches/m-a', operacion: 'leer',
    permitido: CREADOR_Y_ADMIN, motivo: 'El entrenador ve sus partidos; el administrador, todos los del club.' },
  { id: 'matches.list', recurso: 'matches (org-a, creados por coach-a)', operacion: 'listar',
    permitido: CREADOR_Y_ADMIN, motivo: 'Igual que leer.' },
  { id: 'matches.create', recurso: 'matches/{nuevo} con el jugador p-a', operacion: 'crear',
    permitido: CREADOR_Y_ADMIN, motivo: 'Analiza quien gestiona al jugador, sumando un análisis al mes (PCIT-41).' },
  { id: 'matches.update', recurso: 'matches/m-a', operacion: 'editar',
    permitido: CREADOR_Y_ADMIN, motivo: 'Quien gestiona el partido corrige sus datos; las estadísticas, solo el worker.' },
  { id: 'matches.delete', recurso: 'matches/m-a', operacion: 'borrar',
    permitido: CREADOR_Y_ADMIN, motivo: 'Quien gestiona el partido lo borra, salvo mientras se procesa.' },

  // ---------- matches/{matchId}/coachNotes ----------
  { id: 'coachNotes.getPropia', recurso: 'matches/m-a/coachNotes/{uid propio}', operacion: 'leer',
    permitido: CREADOR_Y_ADMIN, motivo: 'Cada cuenta lee su nota en un partido Listo que gestiona (PCIT-44).' },
  { id: 'coachNotes.getAjena', recurso: 'matches/m-a/coachNotes/coach-a', operacion: 'leer',
    permitido: ['entrenador'], motivo: 'La nota es privada: ni el administrador lee la de otro.' },
  { id: 'coachNotes.list', recurso: 'matches/m-a/coachNotes', operacion: 'listar',
    permitido: [], motivo: 'Listar mostraría notas ajenas.' },
  { id: 'coachNotes.create', recurso: 'matches/m-a/coachNotes/{uid propio}', operacion: 'crear',
    permitido: CREADOR_Y_ADMIN, motivo: 'Escribe su nota quien gestiona el partido.' },
  { id: 'coachNotes.delete', recurso: 'matches/m-a/coachNotes/{uid propio}', operacion: 'borrar',
    permitido: CREADOR_Y_ADMIN, motivo: 'Borra su propia nota.' },

  // ---------- orgs/{orgId}/applicationForms ----------
  { id: 'applicationForms.get', recurso: 'orgs/org-a/applicationForms/{enlace activo}', operacion: 'leer',
    permitido: Object.keys(ROLES), motivo: 'El formulario público comprueba que el enlace existe, sin sesión (PCIT-54).' },
  { id: 'applicationForms.list', recurso: 'orgs/org-a/applicationForms', operacion: 'listar',
    permitido: ['admin'], motivo: 'Solo el dueño o un administrador ven todos los enlaces.' },
  { id: 'applicationForms.create', recurso: 'orgs/org-a/applicationForms/{nuevo}', operacion: 'crear',
    permitido: ['admin'], motivo: 'Crean enlaces el dueño y los administradores.' },
  { id: 'applicationForms.delete', recurso: 'orgs/org-a/applicationForms/{enlace activo}', operacion: 'borrar',
    permitido: ['admin'], motivo: 'Desactivan enlaces el dueño y los administradores.' },

  // ---------- orgs/{orgId}/recruitmentIntegrations ----------
  { id: 'recruitmentIntegrations.get', recurso: 'orgs/org-a/recruitmentIntegrations/googleForms', operacion: 'leer',
    permitido: ['admin'], motivo: 'La hoja de Google tiene datos personales: solo el dueño o un administrador (PCIT-69).' },
  { id: 'recruitmentIntegrations.update', recurso: 'orgs/org-a/recruitmentIntegrations/googleForms', operacion: 'editar',
    permitido: ['admin'], motivo: 'Solo el dueño o un administrador la configuran.' },
  { id: 'recruitmentIntegrations.delete', recurso: 'orgs/org-a/recruitmentIntegrations/googleForms', operacion: 'borrar',
    permitido: [], motivo: 'No hay regla de borrado: se reemplaza al configurarla de nuevo.' },

  // ---------- applications ----------
  { id: 'applications.get', recurso: 'applications/app-a', operacion: 'leer',
    permitido: EQUIPO_A, motivo: 'La bandeja de Reclutamiento es de todo el equipo del club.' },
  { id: 'applications.list', recurso: 'applications (orgId = org-a)', operacion: 'listar',
    permitido: EQUIPO_A, motivo: 'Igual que leer.' },
  { id: 'applications.createPublica', recurso: 'applications/{nueva} con enlace activo', operacion: 'crear',
    permitido: Object.keys(ROLES), motivo: 'Cualquiera con el enlace envía una postulación válida, con o sin sesión (PCIT-54).' },
  { id: 'applications.createEquipo', recurso: 'applications/{nueva} sin enlace', operacion: 'crear',
    permitido: EQUIPO_A, motivo: 'El equipo registra postulaciones a mano en su club.' },
  { id: 'applications.update', recurso: 'applications/app-a', operacion: 'editar',
    permitido: EQUIPO_A, motivo: 'El equipo avanza el estado en la bandeja (PCIT-177).' },
  { id: 'applications.delete', recurso: 'applications/app-a', operacion: 'borrar',
    permitido: EQUIPO_A, motivo: 'El equipo borra postulaciones de su club.' },

  // ---------- platformAudit ----------
  { id: 'platformAudit.get', recurso: 'platformAudit/audit-1', operacion: 'leer',
    permitido: ['plataforma'], motivo: 'La bitácora administrativa es solo de la plataforma (PCIT-203).' },
  { id: 'platformAudit.list', recurso: 'platformAudit', operacion: 'listar',
    permitido: ['plataforma'], motivo: 'Igual que leer.' },
  { id: 'platformAudit.create', recurso: 'platformAudit/{nueva} sin cambio asociado', operacion: 'crear',
    permitido: [], motivo: 'Una entrada solo se crea junto con el cambio que registra.' },
  { id: 'platformAudit.delete', recurso: 'platformAudit/audit-1', operacion: 'borrar',
    permitido: [], motivo: 'Nadie edita ni borra la bitácora.' },

  // ---------- Storage ----------
  { id: 'storage.videoRead', recurso: 'Storage orgs/org-a/matches/m-a/video.mp4', operacion: 'leer',
    permitido: CREADOR_Y_ADMIN, motivo: 'El video del partido lo ven quienes gestionan el partido (PCIT-24, PCIT-39).' },
  { id: 'storage.videoUpload', recurso: 'Storage orgs/org-a/matches/{nuevo}/video.mp4', operacion: 'crear',
    permitido: EQUIPO_A, motivo: 'Cualquier miembro sube el video de un partido nuevo de su club, a su nombre.' },
  { id: 'storage.videoDelete', recurso: 'Storage orgs/org-a/matches/m-a/video.mp4', operacion: 'borrar',
    permitido: CREADOR_Y_ADMIN, motivo: 'Borran quienes gestionan el partido.' },
  { id: 'storage.processedWrite', recurso: 'Storage orgs/org-a/matches/m-a/processed.mp4', operacion: 'crear',
    permitido: [], motivo: 'El video procesado solo lo escribe el worker (PCIT-161).' },
  { id: 'storage.applicationVideoRead', recurso: 'Storage orgs/org-a/applications/app-a/video.mp4', operacion: 'leer',
    permitido: [], motivo: 'Se sirve solo a través del servidor, que comprueba la sesión y el club (PCIT-182).' },
]

// Resultado esperado de una celda.
export const expected = (row, role) => row.permitido.includes(role)
