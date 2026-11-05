# Esquema de Firestore · PCIT-22

Contrato único entre la **web** (`web/`) y el **worker del modelo** (`model/`, PCIT-35).
Las constantes de este documento están en [`web/src/panel/lib/schema.js`](../web/src/panel/lib/schema.js).
Si cambias un campo, actualiza los dos archivos y avisa en Jira.

**Versión:** 1 · **Responsable:** Axel (PCIT-22) · **Reglas de acceso:** [`firestore.rules`](../firebase/firestore.rules) (PCIT-23)

## Qué permiten las reglas (PCIT-23)

PCIT-39 añade el alcance por rol: en `players` y `matches`, un `admin` puede
consultar y gestionar los documentos de su organización; un `coach`, solo los
que tengan `createdBy` igual a su UID. Las consultas del entrenador incluyen
`where('createdBy', '==', uid)` además de `orgId`. Firestore aplica esta regla
también a lecturas directas, actualizaciones y borrados. La cola solo admite
jugadores propios del entrenador, o de la organización para administradores.
Los roles se leen del perfil de servidor y la web no puede modificar `role`.

Las referencias de videos originales y procesados respetan el mismo propietario
del partido en Storage. Antes de crear el partido, el video original solo se
lee por quien lo subió o por un administrador de la organización. El resultado
procesado sigue siendo de escritura exclusiva del worker. Ver
`docs/PCIT-39-permisos-por-rol.md`.

| Colección | Leer | Crear | Modificar | Borrar |
| --- | --- | --- | --- | --- |
| `users` | La propia y las de su organización | Solo la propia, en el registro, con rol `coach` y en una organización que crea él mismo | Solo nombre y cargo | No |
| `orgs` | La suya | En el registro, si todavía no tiene ficha en `users` | Nombre y programa, solo quien la creó | No |
| `orgs/{orgId}/usage/{YYYY-MM}` | Miembros de la organización | Solo junto con el alta de un partido nuevo, sumando 1 (PCIT-41) | Igual: +1 por partido nuevo | No |
| `players` | Admin: su organización; coach: propios | Con `orgId` de su organización, `createdBy` propio y consentimiento aceptado | Admin: su organización; coach: propios. Nunca `orgId`, `createdBy` ni `consent` | Admin: su organización; coach: propios |
| `matches` | Admin: su organización; coach: propios | En `'en cola'`, sin estadísticas, con un jugador accesible por rol y el video en `orgs/{orgId}/matches/{matchId}/video.mp4\|mov` | Datos del partido, o pasar de `error` a `en cola`, dentro del alcance por rol | Dentro del alcance por rol, salvo si está `procesando` |
| `matches/{matchId}/coachNotes/{uid}` | Nota propia por ID, en un partido Listo accesible | Nota propia con texto y fecha de servidor | Solo su propia nota | Solo su propia nota |
| `applications` | De su organización | Por ahora solo con sesión (el formulario público llega en PCIT-54) | Estado y notas | De su organización |

El worker usa el Admin SDK, que no pasa por las reglas: es el único que escribe
`procesando`, `listo`, `error` y `statistics`. Las consultas de la web **siempre**
deben filtrar por `orgId`; sin ese filtro, Firestore las rechaza.

## Decisiones

- **Colecciones principales en la raíz con un campo `orgId`** (`players`, `matches`, `applications`).
  La web las consulta con `where('orgId', '==', orgId)`. Las notas privadas usan una subcolección
  de cada partido para separar sus permisos de los del reporte.
- **Nombres de campos en inglés, en camelCase. Valores que ve el usuario en español.**
  Los estados coinciden con `StatusBadge` (PCIT-25).
- **Se usa `applications` y el estado de procesamiento vive dentro de `matches`**,
  como dice PCIT-22. No hay colecciones `recruitment` ni `queue`.
- **Fechas sin hora** (`birthDate`, `matchDate`) como texto `YYYY-MM-DD`, para que
  no cambien por la zona horaria. **Momentos** (`createdAt`, `updatedAt`, …) como
  `Timestamp` de Firestore, escritos con `serverTimestamp()`.
- **Un dato desconocido es `null` o no existe; nunca `0`.** Un cero significa que
  se midió y dio cero.
- Los campos `orgId`, `createdBy` y `consent.recordedBy` **salen de la sesión**,
  nunca de un formulario.

## Mapa

```
users/{uid}                 Perfil de cada persona que inicia sesión
orgs/{orgId}                Universidad, club o academia
  usage/{YYYY-MM}           Análisis usados en el mes (PCIT-41)
players/{playerId}          Jugadores de una organización          · orgId
matches/{matchId}           Partidos subidos y sus estadísticas    · orgId, playerId
applications/{appId}        Postulaciones de reclutamiento         · orgId
```

Ruta del video en Storage (PCIT-24): `orgs/{orgId}/matches/{matchId}/video.{mp4|mov}`.

---

## `users/{uid}`

El ID del documento es el `uid` de Firebase Auth. Se crea en el registro (PCIT-21).

| Campo | Tipo | Obligatorio | Notas |
| --- | --- | --- | --- |
| `email` | string | sí | Igual al de Auth |
| `displayName` | string | sí | 2–120 caracteres |
| `orgId` | string | sí | Organización a la que pertenece |
| `role` | `'coach'` \| `'admin'` | sí | En el registro: `coach`. Los permisos por rol llegan en PCIT-39 |
| `jobTitle` | string \| null | no | Cargo, por ejemplo "Entrenador principal" |
| `createdAt` | Timestamp | sí | `serverTimestamp()` |
| `updatedAt` | Timestamp | no | |

## `orgs/{orgId}`

Se crea en el registro, junto con el usuario (PCIT-21).

| Campo | Tipo | Obligatorio | Notas |
| --- | --- | --- | --- |
| `name` | string | sí | "Universidad …", 2–120 caracteres |
| `ownerId` | string | sí | `uid` de quien la creó. PCIT-23 lo usa para validar el alta |
| `program` | string \| null | no | Ej. "Tenis varones" |
| `plan` | string | sí | `'free'` por ahora. PCIT-41 agrega límites por plan |
| `createdAt` | Timestamp | sí | |
| `updatedAt` | Timestamp | no | |

### `orgs/{orgId}/usage/{YYYY-MM}` (PCIT-41)

Contador de análisis de la organización en un mes. El ID es el mes en **UTC**
(`2026-11`), el mismo que calcula la regla con `request.time`; en Lima el mes
nuevo empieza a las 19:00 del último día. Cada mes arranca un documento nuevo,
así que no hay que reiniciar nada.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `analyses` | number | Partidos creados en el mes. Solo sube de uno en uno |
| `lastMatchId` | string | Partido que sumó la última unidad |
| `updatedAt` | Timestamp | `serverTimestamp()` |

La web lo escribe en la misma transacción que crea el partido
(`firestoreAnalysisService` → `usage.js`). Las reglas exigen las dos escrituras
juntas: no se crea un partido sin contarlo, ni se suma sin un partido nuevo.
Reintentar un partido con `error` no suma; borrar un partido no resta.

## `players/{playerId}`

ID automático. Campos mínimos: los que ya crea Jugadores v1 (PCIT-26).
El resto los completa la gestión completa (PCIT-42).

| Campo | Tipo | Obligatorio | Notas |
| --- | --- | --- | --- |
| `orgId` | string | sí | De la sesión |
| `fullName` | string | sí | 2–120 caracteres, espacios normalizados |
| `birthDate` | string `YYYY-MM-DD` | sí | No se guarda la edad, se calcula |
| `academy` | string | no | Hasta 120 caracteres; `''` si no hay |
| `category` | `'Sub-14'` \| `'Sub-16'` \| `'Sub-18'` \| `'Adulto'` \| null | no | |
| `dominantHand` | `'diestro'` \| `'zurdo'` \| null | no | |
| `backhand` | `'dos manos'` \| `'una mano'` \| null | no | |
| `utr` | number \| null | no | Ej. `10.4` |
| `nationalRanking` | number \| null | no | Entero positivo |
| `nationality` | string \| null | no | |
| `graduationYear` | number \| null | no | Año en que termina el colegio |
| `coachName` | string \| null | no | Entrenador del jugador en su academia |
| `guardian` | object \| null | sí si es menor de 18 | `{ name, phone, email }` del padre, madre o apoderado |
| `consent` | object | sí | Ver abajo |
| `createdBy` | string | sí | `uid` del entrenador |
| `createdAt` | Timestamp | sí | |
| `updatedAt` | Timestamp | no | |
| `deletedAt` | Timestamp | no | Fecha de retirada de la plantilla (PCIT-42) |

PCIT-42 añade la acción **Eliminar de la plantilla**: guarda `deletedAt` y
`updatedAt`, oculta el jugador en Jugadores, Dashboard y nuevos análisis, y
conserva su registro y partidos. El historial de Partidos incluye los jugadores
retirados para conservar sus nombres. El alta de un partido nuevo para un
jugador retirado se rechaza en las reglas.

La edición valida datos personales, deportivos y el objeto completo del
apoderado para menores, preserva `orgId`, `createdBy`, `createdAt` y `consent`, y
usa `updatedAt` para detectar ediciones concurrentes. No hay una operación de
restauración en esta entrega. Ver `docs/PCIT-42-gestion-completa-jugadores.md`.

**`consent`** (Ley N.° 29733, datos personales y videos):

| Campo | Tipo | Notas |
| --- | --- | --- |
| `accepted` | `true` | Sin autorización no se crea el jugador |
| `version` | string | Texto aceptado: `'players-v1'` |
| `method` | `'coach-attestation'` \| `'self'` \| `'guardian'` | `coach-attestation`: el entrenador declara tener la autorización. `self` / `guardian`: la dio el jugador o su apoderado en el formulario |
| `recordedBy` | string | `uid` de quien la registró, o `'public-form'` |
| `recordedAt` | Timestamp | |

## `matches/{matchId}`

Un partido subido para analizar. Lo crea la web en `'en cola'` **solo después de
que el video terminó de subir** (PCIT-27). El worker (PCIT-35) lo procesa.

| Campo | Tipo | Quién lo escribe | Notas |
| --- | --- | --- | --- |
| `orgId` | string | web | De la sesión |
| `playerId` | string | web | Jugador de la misma organización |
| `playerPosition` | `'arriba'` \| `'abajo'` | web | Dónde está el jugador en el primer cuadro del video |
| `opponent` | string | web | Rival, 2–120 caracteres |
| `tournament` | string | web | Opcional, `''` si no hay |
| `matchDate` | string `YYYY-MM-DD` | web | No futura |
| `result` | string | web | Opcional, ej. `'6-4 3-6 7-5'` |
| `surface` | `'arcilla'` \| `'dura'` \| `'césped'` \| `'otra'` \| null | web | Opcional |
| `videoPath` | string | web | Ruta en Storage que devuelve `uploadVideo()` |
| `inputFingerprint` | string | web | SHA-256 del formulario, para reintentos (PCIT-27) |
| `createdBy` | string | web | `uid` |
| `createdAt` | Timestamp | web | |
| `status` | estado | web → worker | Ver ciclo abajo |
| `startedAt` | Timestamp \| null | worker | Al pasar a `procesando` |
| `finishedAt` | Timestamp \| null | worker | Al pasar a `listo` o `error` |
| `errorMessage` | string \| null | worker | Mensaje apto para el usuario, sin detalles técnicos |
| `workerVersion` | string \| null | worker | Versión del modelo que lo procesó |
| `statistics` | object \| null | worker | `null` hasta que esté `listo`. Ver abajo |

**Ciclo de estados:**

```
en cola ──▶ procesando ──▶ listo
                 │
                 └──────▶ error ──(Reintentar)──▶ en cola
```

El worker toma un partido `'en cola'` y lo marca `'procesando'` dentro de una
transacción, para que dos workers no tomen el mismo.

### Video procesado (PCIT-161)

`matches.processedVideoPath` es un campo opcional escrito solo por el worker:
`orgs/{orgId}/matches/{matchId}/processed.mp4`. El archivo MP4 H.264 se sube antes
de guardar la referencia y las estadísticas en la transacción final a `listo`.
Al reclamar un reintento o al terminar en error se borra la referencia del
documento. Los partidos históricos pueden no tenerla.

El cliente lee por SDK autenticado y reglas de Storage de la misma organización;
no guarda URLs públicas ni tokens permanentes. Solo Admin SDK puede escribir o
borrar el resultado. Ver `docs/PCIT-161-video-procesado.md`.

### `matches.statistics` (v1)

Estadísticas **de ese partido**, escritas por el worker (`model/stats/match_stats.py`).
El worker traduce `player_1` / `player_2` del modelo a `player` (el jugador registrado) y
`opponent` usando `playerPosition`.

```js
statistics: {
  schemaVersion: 'acecam.match-stats.v1',
  durationSeconds: 24,
  player: {
    shots:    { count: 6, sumSpeedKmh: 630, maxSpeedKmh: 171 },
    movement: { distanceMeters: 25, avgSpeedKmh: 11.4, maxSpeedKmh: 22.7 },
    serve: {
      count: 2, fromRight: 1, fromLeft: 1,          // saques (intentos, también los segundos)
      sumSpeedKmh: 110, sampleCount: 1, maxSpeedKmh: 110,  // velocidad media hasta el bote
      firstServeAttempts: 1, firstServeIn: 0,       // primeros saques y cuántos entraron
      doubleFaults: 0,
    },
  },
  opponent: { /* mismas claves */ },
  rallies: { count: 1, sumShots: 18, longestShots: 18, short: 0, medium: 0, long: 1 },
}
```

| Campo | Qué es | Cuándo falta |
| --- | --- | --- |
| `shots.count`, `shots.sumSpeedKmh`, `shots.maxSpeedKmh` | Golpes medidos y su velocidad (distancia entre los jugadores / tiempo hasta el golpe del rival) | `maxSpeedKmh` falta si no hay golpes |
| `movement.*` | Distancia recorrida y velocidad del jugador | Si no se pudo seguir al jugador |
| `serve.count`, `serve.fromRight`, `serve.fromLeft` | Saques detectados y desde qué lado (derecha o izquierda del sacador, mirando a la red) | Nunca: 0 si no sacó |
| `serve.sumSpeedKmh`, `serve.sampleCount`, `serve.maxSpeedKmh` | Velocidad media del saque **hasta el bote**, solo de los saques con bote visto. Es menor que la de un radar, que mide la salida de la raqueta | `maxSpeedKmh` falta si `sampleCount` es 0 |
| `serve.firstServeAttempts`, `serve.firstServeIn` | Primeros saques y cuántos entraron en el cuadro cruzado | Si de algún primer saque no se supo si entró |
| `serve.doubleFaults` | Dobles faltas | Si de algún segundo saque no se supo si entró |
| `rallies.count`, `rallies.sumShots`, `rallies.longestShots` | Puntos (peloteos) del partido, golpes en total y el más largo | Nunca |
| `rallies.short`, `rallies.medium`, `rallies.long` | Peloteos de 0-4, 5-8 y 9 o más golpes | Nunca |

- **Un dato que el modelo no pudo saber se omite; nunca es 0** (por ejemplo, el primer
  saque dentro si en un punto no se vio el bote ni hubo resto). Un 0 significa que se midió
  y dio cero.
- Promedios: se guardan **sumas y cantidades**, no promedios, para que el Dashboard pueda
  combinar partidos sin error (como pide PCIT-28). La velocidad media de saque es
  `sumSpeedKmh / sampleCount` sumando todos los partidos; el % de primer saque,
  `firstServeIn / firstServeAttempts`.
- Todavía no se miden: derecha/revés (descartado del alcance) y dentro/fuera de cada golpe.
- El Dashboard lo lee con `web/src/panel/lib/workerDashboardStatistics.js`.

### `matches/{matchId}/coachNotes/{uid}` (PCIT-44)

Cada cuenta puede guardar una nota privada por partido Listo. El entrenador
puede anotarla en los partidos que registró. El administrador puede escribir su
propia nota en cualquier partido Listo de su organización. Las reglas permiten
leer la nota por su ID cuando el UID de sesión coincide con el autor. Las
consultas de la subcolección se rechazan.

| Campo | Tipo | Requisito |
| --- | --- | --- |
| `text` | string | De 1 a 2000 caracteres |
| `updatedAt` | Timestamp | `serverTimestamp()` de la escritura |

Al guardar, la app compara en una transacción el texto actual con el que la
sesión abrió. Si otro dispositivo guardó cambios, se conserva el borrador y se
avisa del conflicto. Guardar un texto vacío borra la nota.

Desde `web/`, ejecuta `npm run test:rules` para verificar la persistencia,
el conflicto de escritura y los rechazos de acceso en Firebase Emulator Suite.
En el emulador, abre **Partidos → Ver reporte → Tu nota** con una cuenta de
prueba y un partido Listo accesible.

## `applications/{appId}`

Postulación que llega del formulario público (PCIT-54). Datos del jugador antes
de ser jugador del equipo.

| Campo | Tipo | Obligatorio | Notas |
| --- | --- | --- | --- |
| `orgId` | string | sí | Organización dueña del formulario |
| `status` | estado | sí | Al crearse: `'nueva'` |
| `fullName` | string | sí | |
| `birthDate` | string `YYYY-MM-DD` | sí | |
| `city` | string | sí | |
| `email` | string | sí | |
| `graduationYear` | number | sí | |
| `academy` | string | no | |
| `utr` | number \| null | no | |
| `nationalRanking` | number \| null | no | |
| `dominantHand` | `'diestro'` \| `'zurdo'` \| null | no | |
| `backhand` | `'dos manos'` \| `'una mano'` \| null | no | |
| `guardian` | `{ name, phone, email }` \| null | sí si es menor de 18 | |
| `videoLinks` | string[] | no | Links de YouTube, máximo 5 |
| `videoPaths` | string[] | no | Archivos subidos a Storage |
| `message` | string | no | Hasta 1000 caracteres |
| `consent` | object | sí | Mismo formato que en `players`, con `method` `'self'` o `'guardian'` y `recordedBy: 'public-form'` |
| `playerId` | string \| null | no | Se llena al usar "Crear jugador" (PCIT-56) |
| `internalNotes` | string | no | Notas del equipo; nunca visibles para el postulante |
| `reviewedBy` | string \| null | no | `uid` |
| `createdAt` | Timestamp | sí | |
| `updatedAt` | Timestamp | no | |

**Estados:** `nueva` → `en revisión` → `analizada` → `contactada` o `descartada`.

---

## Datos de ejemplo

`web/scripts/seed.mjs` carga en los **emuladores** dos organizaciones con usuarios,
jugadores, partidos en todos los estados y postulaciones. Todo es ficticio.
La segunda organización sirve para probar en PCIT-23 que nadie ve datos ajenos.

```bash
# Terminal 1
cd web && npm run emulators
# Terminal 2
cd web && npm run seed
```

| Usuario | Contraseña | Organización |
| --- | --- | --- |
| `coach@acecam.test` | `acecam123` | Universidad Demo |
| `coach2@acecam.test` | `acecam123` | Club Ejemplo |

El script **se niega a correr contra el proyecto real**: solo funciona con los
emuladores y el proyecto `demo-acecam`. Para ver los datos sin emuladores:
`npm run seed -- --dry-run`.
