# PCIT-67 · Seguridad de los datos y pruebas de acceso

Revisión de cómo AceCam protege los datos personales que guarda, según la
Ley N.° 29733 de Protección de Datos Personales del Perú y su reglamento.

| Parte | Contenido | Tarea |
| --- | --- | --- |
| 1 | [Inventario de datos personales](#1-inventario-de-datos-personales) | PCIT-209 |

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
