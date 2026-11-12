# PCIT-67 · Seguridad de los datos y pruebas de acceso

Revisión de cómo AceCam protege los datos personales que guarda, según la
Ley N.° 29733 de Protección de Datos Personales del Perú y su reglamento.

| Parte | Contenido | Tarea |
| --- | --- | --- |
| 1 | [Inventario de datos personales](#1-inventario-de-datos-personales) | PCIT-209 |
| 2 | [Matriz de acceso por rol y organización](#2-matriz-de-acceso-por-rol-y-organización) | PCIT-210 |

Fuentes revisadas: `firebase/firestore.rules`, `firebase/storage.rules`,
[`docs/firestore-schema.md`](firestore-schema.md), el servidor de videos
(`web/server/video-import/`), el worker (`model/worker/`) y la
[política de privacidad](../web/src/landing/pages/Privacidad.jsx).

## 1. Inventario de datos personales

### Clasificación

| Nivel | Qué incluye | Por qué |
| --- | --- | --- |
| **Sensible** | Datos de **menores** y de sus apoderados, videos donde aparecen personas, notas sobre un jugador | Un menor necesita la autorización de su apoderado. La imagen de una persona es un dato personal y su difusión causa más daño |
| **Personal** | Nombre, correo, teléfono, fecha de nacimiento y datos deportivos de un adulto | Identifican a una persona |
| **Interno** | Plan, contadores, enlaces y configuración | No identifican a nadie, pero no son públicos |

### Firestore

"Quién lee" resume las reglas actuales. Se comprueba celda por celda en la
matriz de acceso (PCIT-210).

| Colección | Datos personales | ¿Menores? | Nivel | Quién lee | Conservación |
| --- | --- | --- | --- | --- | --- |
| `platformAudit/{id}` (PCIT-203) | `actorId` (UID de quien hizo el cambio), `targetId` y los valores antes y después: nombre y plan de una organización, rol y suspensión de un usuario, organización y rol de una invitación | No | Personal (identifica a personas por su UID) | Solo el administrador de plataforma | ⚠️ **Sin plazo.** Nadie puede editar ni borrar, como corresponde a una bitácora, pero falta definir cuánto se guarda |
| `users/{uid}` | `email`, `displayName`, `jobTitle` | No | Personal | La propia persona, los miembros de su organización y el administrador de plataforma | ⚠️ **Sin plazo.** Las reglas no permiten borrar |
| `orgs/{orgId}` | `ownerId` (UID de quien la creó); el nombre es de una institución | No | Interno | Miembros de la organización y administrador de plataforma | ⚠️ **Sin plazo.** Las reglas no permiten borrar |
| `orgs/{orgId}/usage/{YYYY-MM}` | Ninguno: cantidad de análisis y último partido | No | Interno | Miembros de la organización y administrador de plataforma | Un documento por mes, sin plazo. No identifica a nadie |
| `invites/{correo}` | El **correo** de la persona invitada (es el ID), `invitedBy`, `acceptedBy` | No | Personal | La persona invitada (la suya) y el dueño o los administradores de la organización | Pendiente: se puede anular. ⚠️ Aceptada: **sin plazo** |
| `platformAdmins/{uid}` | Ninguno: solo marca que un UID es administrador | No | Interno | Solo la propia cuenta | Mientras dure el permiso. Lo gestiona un operador desde la consola |
| `players/{playerId}` | `fullName`, `birthDate`, `academy`, `nationality`, `coachName`, datos deportivos (`utr`, `nationalRanking`, `graduationYear`…), **`guardian`** (nombre, teléfono y correo del apoderado), `consent` | **Sí** | **Sensible** | Administradores de la organización y el entrenador que creó la ficha | ⚠️ **Sin plazo.** "Eliminar de la plantilla" solo marca `deletedAt` y conserva todo. Las reglas permiten borrar, pero la web no lo hace |
| `matches/{matchId}` | Jugador (`playerId`), **nombre del rival** (`opponent`, un tercero), torneo, fecha, resultado y `statistics` (rendimiento de una persona) | Indirecto: el jugador puede ser menor | Personal | Administradores de la organización y el entrenador que creó el partido | ⚠️ **Sin plazo.** Las reglas permiten borrar, pero la web no lo hace |
| `matches/{matchId}/coachNotes/{uid}` | Texto libre de un entrenador sobre el partido de un jugador | Indirecto | **Sensible** (opiniones sobre una persona) | Solo su autor | El autor la borra al guardar un texto vacío |
| `orgs/{orgId}/applicationForms/{formId}` | Ninguno: solo `createdAt` | No | Interno | Cualquiera con el ID del enlace (formulario público); solo el dueño o los administradores pueden listarlos | Hasta que se desactiva el enlace |
| `orgs/{orgId}/recruitmentIntegrations/googleForms` | Ninguno directo, pero apunta a una **hoja de Google con postulaciones** | Indirecto | Interno (confidencial) | Dueño o administradores de la organización | Mientras exista la integración |
| `applications/{appId}` | `fullName`, `birthDate`, `city`, `email`, `graduationYear`, `academy`, `message`, **`guardian`**, `videoLinks`, `videoPaths`, `consent`, `internalNotes`, `playerId` | **Sí** | **Sensible** | **Todos** los miembros de la organización (administradores y entrenadores) | ⚠️ **Sin plazo.** Las reglas permiten borrar, pero la web no lo hace |

### Storage

| Ruta | Contenido | ¿Menores? | Nivel | Quién lee | Conservación |
| --- | --- | --- | --- | --- | --- |
| `orgs/{orgId}/matches/{matchId}/video.{mp4,mov}` | Video original del partido | Puede haber | **Sensible** | Administradores de la organización y el entrenador del partido. Antes de crear el partido, solo quien lo subió | ⚠️ **Sin plazo.** No se borra al borrar el partido |
| `orgs/{orgId}/matches/{matchId}/processed.mp4` | Video anotado por el worker (PCIT-161) | Puede haber | **Sensible** | Igual que el original. Solo el worker escribe y borra | ⚠️ **Sin plazo** |
| `orgs/{orgId}/applications/{appId}/video.{mp4,mov}` | Video de una postulación | **Sí** | **Sensible** | Nadie desde la web: las reglas lo cierran. El equipo de la organización lo ve a través del servidor, que comprueba la sesión y la organización (`Cache-Control: private, no-store`) | ⚠️ **Sin plazo.** Se conserva aunque se desactive el enlace |
| Cualquier otra ruta | — | — | — | Nadie: todo lo demás está cerrado | — |

### Fuera de Firestore y Storage

| Lugar | Datos | Conservación |
| --- | --- | --- |
| Firebase Authentication | Correo y contraseña (Google guarda la contraseña cifrada) | ⚠️ **Sin plazo.** La web no permite borrar la cuenta |
| Archivos temporales del worker (`acecam-worker/match-…`) | Copia del video mientras se analiza | Se borran al terminar, con éxito o con error (`shutil.rmtree`) |
| Archivos temporales del servidor de videos (`acecam-application-video-…`) | Video recibido de una postulación | Se borran al terminar la subida |
| Hoja de Google de la organización (PCIT-197) | Respuestas del Google Form | Las gestiona la organización en su propia cuenta de Google |
| Datos de ejemplo (`npm run seed`) | Personas ficticias | Solo en los emuladores |

### Hallazgos del inventario

Pasan a la revisión de reglas (PCIT-217), que decide si cada uno se corrige o se
acepta con justificación.

1. **No hay borrado real.** La política de privacidad promete borrar los datos y
   videos en un máximo de 30 días si la organización cierra su cuenta o lo pide, y
   reconoce los derechos ARCO. Pero ni la web ni ningún script borran cuentas,
   organizaciones, jugadores, partidos, postulaciones ni videos.
2. **Retirar un jugador no borra nada.** "Eliminar de la plantilla" lo oculta,
   pero conserva sus datos, los de su apoderado, sus partidos y sus videos.
3. **Videos huérfanos.** Si se borra un partido o una postulación, su video sigue
   en Storage.
4. **Datos de terceros.** `matches.opponent` guarda el nombre del rival, que no
   ha dado ninguna autorización.
5. **Las postulaciones de menores las ve todo el equipo**, entrenadores incluidos,
   no solo los administradores.
6. **El administrador de plataforma** (PCIT-188) lee los correos y nombres de los
   usuarios de **todas** las organizaciones.
7. **La bitácora administrativa** (`platformAudit`, PCIT-203) no tiene un plazo de
   conservación definido.

## 2. Matriz de acceso por rol y organización

Qué puede hacer cada rol con cada recurso. La fuente es
[`web/tests/rules/accessMatrix.js`](../web/tests/rules/accessMatrix.js): las pruebas
de reglas la recorren celda por celda (PCIT-211) y esta tabla se genera a partir de
ella, así que no se edita a mano.

**Roles**

| Rol | Quién es |
| --- | --- |
| Visitante | Sin sesión |
| Sin club | Con sesión, sin ficha en `users` (por ejemplo, a mitad del registro) |
| Entrenador | Entrenador del club A que creó el jugador y el partido de prueba |
| Otro entrenador | Otro entrenador del mismo club A |
| Admin | Administrador y dueño del club A |
| Entrenador club B, Admin club B | Miembros de **otra** organización |
| Plataforma | Administrador de plataforma (PCIT-188), sin ficha en `users` |

El **worker** usa el Admin SDK y no pasa por las reglas. Es el único que escribe
los estados `procesando`, `listo` y `error`, las estadísticas y `processed.mp4`.

**Datos de partida:** club A con el jugador `p-a`, el partido Listo `m-a` y su
video (todos de `coach-a`), la postulación `app-a`, un enlace de postulación, la
integración de Google y una invitación pendiente; club B con sus dos miembros.

<!-- matriz:inicio (generada con node scripts/accessMatrixTable.mjs --write) -->

| Recurso | Operación | Visitante | Sin club | Entrenador | Otro entrenador | Admin | Entrenador club B | Admin club B | Plataforma | Motivo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `platformAdmins/{uid propio}` | leer | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Cada cuenta puede saber si ella misma es administradora de plataforma. |
| `platformAdmins/plataforma` | leer | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | Nadie más puede saber quién administra la plataforma. |
| `platformAdmins` | listar | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | La lista de administradores no se consulta desde la web. |
| `platformAdmins/{uid propio}` | crear | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | El permiso solo lo concede un operador desde la consola o el Admin SDK. |
| `users/{uid propio}` | leer | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Cada cuenta lee su propia ficha, exista o no. |
| `users/coach-a` | leer | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | La ven su equipo y el administrador de plataforma. |
| `users (orgId = org-a)` | listar | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | El equipo lista sus miembros; la plataforma, los de cualquier club. |
| `users/{uid propio} + orgs/{nueva}` | crear | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | Solo se registra quien todavía no tiene ficha, creando su propia organización. |
| `users/coach-a` | editar | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Cada uno edita su nombre y cargo; nadie edita la ficha de otro. |
| `users/coach-a` | borrar | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Las fichas no se borran desde la web. |
| `orgs/org-a` | leer | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | La ven sus miembros y el administrador de plataforma. |
| `orgs` | listar | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | Solo la administración de plataforma recorre todas las organizaciones. |
| `orgs/org-a` | editar | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | Solo el dueño cambia el nombre y el programa. |
| `orgs/org-a` | borrar | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Las organizaciones no se borran desde la web. |
| `orgs/org-a/usage/{mes}` | leer | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | El contador lo ven el equipo y la plataforma. |
| `orgs/org-a/usage/{mes}` | editar | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Solo sube junto con el alta de un partido nuevo (PCIT-41); nunca suelto. |
| `orgs/org-a/usage/{mes}` | borrar | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Borrar el contador devolvería análisis gastados. |
| `invites/nuevo@club-a.test` | leer | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | La ven quien puede invitar en el club y la persona invitada. |
| `invites (orgId = org-a)` | listar | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | Solo el dueño o un administrador listan las invitaciones de su club. |
| `invites/{correo nuevo}` | crear | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | Invitan el dueño y los administradores (PCIT-40). |
| `invites/nuevo@club-a.test` | editar | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Solo la persona invitada la acepta, al registrarse con ese correo. |
| `invites/nuevo@club-a.test` | borrar | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | El dueño o un administrador anulan una invitación pendiente. |
| `players/p-a` | leer | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | El entrenador ve sus jugadores; el administrador, todos los del club (PCIT-39). |
| `players (org-a, creados por coach-a)` | listar | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | Igual que leer: otro entrenador no ve jugadores ajenos. |
| `players/{nuevo} en org-a` | crear | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | Cualquier miembro registra jugadores en su club, con su UID y la autorización. |
| `players/p-a` | editar | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | Edita quien lo gestiona; nunca el club, el autor ni la autorización. |
| `players/p-a` | borrar | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | Borra quien lo gestiona. |
| `matches/m-a` | leer | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | El entrenador ve sus partidos; el administrador, todos los del club. |
| `matches (org-a, creados por coach-a)` | listar | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | Igual que leer. |
| `matches/{nuevo} con el jugador p-a` | crear | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | Analiza quien gestiona al jugador, sumando un análisis al mes (PCIT-41). |
| `matches/m-a` | editar | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | Quien gestiona el partido corrige sus datos; las estadísticas, solo el worker. |
| `matches/m-a` | borrar | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | Quien gestiona el partido lo borra, salvo mientras se procesa. |
| `matches/m-a/coachNotes/{uid propio}` | leer | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | Cada cuenta lee su nota en un partido Listo que gestiona (PCIT-44). |
| `matches/m-a/coachNotes/coach-a` | leer | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | La nota es privada: ni el administrador lee la de otro. |
| `matches/m-a/coachNotes` | listar | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Listar mostraría notas ajenas. |
| `matches/m-a/coachNotes/{uid propio}` | crear | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | Escribe su nota quien gestiona el partido. |
| `matches/m-a/coachNotes/{uid propio}` | borrar | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | Borra su propia nota. |
| `orgs/org-a/applicationForms/{enlace activo}` | leer | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | El formulario público comprueba que el enlace existe, sin sesión (PCIT-54). |
| `orgs/org-a/applicationForms` | listar | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | Solo el dueño o un administrador ven todos los enlaces. |
| `orgs/org-a/applicationForms/{nuevo}` | crear | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | Crean enlaces el dueño y los administradores. |
| `orgs/org-a/applicationForms/{enlace activo}` | borrar | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | Desactivan enlaces el dueño y los administradores. |
| `orgs/org-a/recruitmentIntegrations/googleForms` | leer | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | La hoja de Google tiene datos personales: solo el dueño o un administrador (PCIT-69). |
| `orgs/org-a/recruitmentIntegrations/googleForms` | editar | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | Solo el dueño o un administrador la configuran. |
| `orgs/org-a/recruitmentIntegrations/googleForms` | borrar | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | No hay regla de borrado: se reemplaza al configurarla de nuevo. |
| `applications/app-a` | leer | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | La bandeja de Reclutamiento es de todo el equipo del club. |
| `applications (orgId = org-a)` | listar | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | Igual que leer. |
| `applications/{nueva} con enlace activo` | crear | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Cualquiera con el enlace envía una postulación válida, con o sin sesión (PCIT-54). |
| `applications/{nueva} sin enlace` | crear | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | El equipo registra postulaciones a mano en su club. |
| `applications/app-a` | editar | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | El equipo avanza el estado en la bandeja (PCIT-177). |
| `applications/app-a` | borrar | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | El equipo borra postulaciones de su club. |
| `platformAudit/audit-1` | leer | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | La bitácora administrativa es solo de la plataforma (PCIT-203). |
| `platformAudit` | listar | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | Igual que leer. |
| `platformAudit/{nueva} sin cambio asociado` | crear | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Una entrada solo se crea junto con el cambio que registra. |
| `platformAudit/audit-1` | borrar | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Nadie edita ni borra la bitácora. |
| `Storage orgs/org-a/matches/m-a/video.mp4` | leer | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | El video del partido lo ven quienes gestionan el partido (PCIT-24, PCIT-39). |
| `Storage orgs/org-a/matches/{nuevo}/video.mp4` | crear | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | Cualquier miembro sube el video de un partido nuevo de su club, a su nombre. |
| `Storage orgs/org-a/matches/m-a/video.mp4` | borrar | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | Borran quienes gestionan el partido. |
| `Storage orgs/org-a/matches/m-a/processed.mp4` | crear | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | El video procesado solo lo escribe el worker (PCIT-161). |
| `Storage orgs/org-a/applications/app-a/video.mp4` | leer | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Se sirve solo a través del servidor, que comprueba la sesión y el club (PCIT-182). |

<!-- matriz:fin -->

**Pruebas (PCIT-211).** `npm run test:rules` comprueba cada celda contra los
emuladores: `tests/rules/accessMatrix.rules.test.js` (Firestore) y
`tests/storage/accessMatrix.storage.test.js` (Storage). Cada escritura parte de los
mismos datos. Si una regla cambia sin actualizar la matriz, falla la celda con su
rol y su operación, por ejemplo
`players.get · leer players/p-a > otroEntrenador → denegado`.

Para cambiar un permiso: edita la regla, actualiza su fila en `accessMatrix.js`,
ejecuta `node scripts/accessMatrixTable.mjs --write` desde `web/` y
`npm run test:rules`.
