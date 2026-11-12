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
| `orgs` | La suya | En el registro, si todavía no tiene ficha en `users` | Nombre y programa, solo quien la creó. El plan solo lo cambia el dueño desde el checkout, junto con `billingCycle` y `planSince` (PCIT-158) | No |
| `orgs/{orgId}/usage/{YYYY-MM}` | Miembros de la organización | Solo junto con el alta de un partido nuevo, sumando 1 (PCIT-41) | Igual: +1 por partido nuevo | No |
| `players` | Admin: su organización; coach: propios | Con `orgId` de su organización, `createdBy` propio y consentimiento aceptado | Admin: su organización; coach: propios. Nunca `orgId`, `createdBy` ni `consent` | Admin: su organización; coach: propios |
| `matches` | Admin: su organización; coach: propios | En `'en cola'`, sin estadísticas, con un jugador accesible por rol y el video en `orgs/{orgId}/matches/{matchId}/video.mp4\|mov` | Datos del partido, o pasar de `error` a `en cola`, dentro del alcance por rol | Dentro del alcance por rol, salvo si está `procesando` |
| `matches/{matchId}/coachNotes/{uid}` | Nota propia por ID, en un partido Listo accesible | Nota propia con texto y fecha de servidor | Solo su propia nota | Solo su propia nota |
| `invites/{correo}` | Dueño o admin: las de su organización. Invitado: solo la suya | Dueño o admin, `pendiente`, para su organización (PCIT-40) | Solo la persona invitada la pasa a `aceptada`, junto con su ficha en `users` | Dueño o admin, mientras esté `pendiente` |
| `applications` | De su organización | Equipo de la organización o visitante con enlace de postulación activo | Estado y notas | De su organización |
| `orgs/{orgId}/applicationForms` | Consulta directa de un enlace activo. Solo dueño o admin puede listar | Dueño o admin | — | Dueño o admin |

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
invites/{correo}            Invitaciones a una organización        · orgId (PCIT-40)
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
| `plan` | string | sí | `'free'` (sin plan) al registrarse. `'prueba'`, `'basico'`, `'pro'` o `'ultra'` fijan los análisis por mes (PCIT-41, `docs/PCIT-41-limite-de-analisis.md`) |
| `billingCycle` | string | no | `'mensual'` o `'anual'`, el periodo elegido en el checkout (PCIT-158) |
| `planSince` | Timestamp | no | Inicio o renovación del plan, hora del servidor. Sin este campo, Básico entra como `'prueba'` (una sola vez). La prueba vence 30 días después de `planSince` y la organización vuelve a contar como sin plan (PCIT-170, PCIT-171) |
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
| `sourceApplicationId` | string | no | Postulación de origen cuando se crea la ficha desde Reclutamiento |

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
| `applicationId` | string opcional | web | Postulación de origen. En este caso `videoPath` apunta al archivo privado confirmado de la postulación. |
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
      firstServe:  { sampleCount: 1, sumSpeedKmh: 110, maxSpeedKmh: 110 },  // pendiente del modelo: velocidad del primer saque
      secondServe: { sampleCount: 0, sumSpeedKmh: 0 },                      // pendiente del modelo: velocidad del segundo saque
      doubleFaults: 0,
      faults: 1, aces: 0,                           // opcionales (PCIT-72)
    },
  },
  opponent: { /* mismas claves */ },
  rallies: { count: 1, sumShots: 18, longestShots: 18, short: 0, medium: 0, long: 1 },
  // Opcionales (PCIT-85/86): marcador que propone el modelo y puntos ganados.
  score:  { sets: [{ playerGames: 6, opponentGames: 4 }], games: [2, 1], points: ['30', '15'], winner: null },
  points: { count: 12, playerWon: 7, opponentWon: 5, lowConfidence: 2, toReview: 2 },
}
```

| Campo | Qué es | Cuándo falta |
| --- | --- | --- |
| `shots.count`, `shots.sumSpeedKmh`, `shots.maxSpeedKmh` | Golpes medidos y su velocidad (distancia entre los jugadores / tiempo hasta el golpe del rival) | `maxSpeedKmh` falta si no hay golpes |
| `movement.*` | Distancia recorrida y velocidad del jugador | Si no se pudo seguir al jugador |
| `movement.heatmap` (`columns`, `rows`, `cells`) | **Pendiente del modelo.** Mapa de calor del jugador: cuadrícula de su propia mitad de la cancha con `cells.length === columns × rows` (un número por celda: fotogramas o tiempo que pasó ahí, sin normalizar). Filas desde la red (primera fila) hasta la línea de fondo (última); columnas de izquierda a derecha **desde el punto de vista del jugador**, así que para el jugador del fondo lejano hay que invertir el eje de la imagen. Todos los partidos deben usar el mismo tamaño de cuadrícula: la web los suma | Hasta que el modelo la escriba |
| `serve.count`, `serve.fromRight`, `serve.fromLeft` | Saques detectados y desde qué lado (derecha o izquierda del sacador, mirando a la red) | Nunca: 0 si no sacó |
| `serve.sumSpeedKmh`, `serve.sampleCount`, `serve.maxSpeedKmh` | Velocidad media del saque **hasta el bote**, solo de los saques con bote visto. Es menor que la de un radar, que mide la salida de la raqueta | `maxSpeedKmh` falta si `sampleCount` es 0 |
| `serve.firstServe`, `serve.secondServe` (`sampleCount`, `sumSpeedKmh`, `maxSpeedKmh`) | **Pendiente del modelo.** Velocidad del primer y del segundo saque por separado, hasta el bote y solo de los saques con bote visto. El Dashboard ya las lee: muestra la media (`sumSpeedKmh / sampleCount`) y la máxima de cada uno | Hasta que el modelo las escriba; `maxSpeedKmh` falta si `sampleCount` es 0 |
| `serve.firstServeAttempts`, `serve.firstServeIn` | Primeros saques y cuántos entraron en el cuadro cruzado | Si de algún primer saque no se supo si entró |
| `serve.doubleFaults` | Dobles faltas | Si de algún segundo saque no se supo si entró |
| `serve.faults` | Saques fuera (primeros y segundos) | Si de algún saque no se supo si entró |
| `serve.aces` | Puntos ganados con el saque sin que el rival la devolviera (incluye saques que toca sin devolver: la cámara no los distingue de un ace) | En partidos analizados antes de PCIT-84 |
| `rallies.count`, `rallies.sumShots`, `rallies.longestShots` | Puntos (peloteos) del partido, golpes en total y el más largo | Nunca |
| `rallies.short`, `rallies.medium`, `rallies.long` | Peloteos de 0-4, 5-8 y 9 o más golpes | Nunca |
| `score.sets` | Sets terminados en orden, cada uno con `playerGames` y `opponentGames`. | Si el modelo no actualizó el marcador. La lista queda vacía si no hay sets completos. |
| `score.games`, `score.points` | Juegos del set en curso y puntos del juego, en orden `[player, opponent]`. | Si el modelo no actualizó el marcador. |
| `score.winner` | `'player'`, `'opponent'` o `null` si el partido no terminó en el vídeo | Igual que `score` |
| `points.count`, `points.playerWon`, `points.opponentWon` | Puntos del vídeo y cuántos ganó cada uno (un punto sin ganador no suma a ninguno) | Igual que `score` |
| `points.lowConfidence`, `points.toReview` | Puntos con confianza baja y cuántos conviene revisar a mano | Igual que `score` |

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

## `platformAdmins/{uid}`

La existencia del documento autoriza a la cuenta de Firebase Auth a entrar en `/admin` y consultar organizaciones, usuarios y uso mensual. El cliente solo puede leer su propia marca. Un operador del proyecto administra las marcas mediante la consola o el Admin SDK.

## `applications/{appId}`

Postulación que llega del formulario público (PCIT-54). Datos del jugador antes
de ser jugador del equipo.

| Campo | Tipo | Obligatorio | Notas |
| --- | --- | --- | --- |
| `orgId` | string | sí | Organización dueña del formulario |
| `formId` | string | en formulario público | ID del enlace de postulación activo al enviar |
| `status` | estado | sí | Al crearse: `'nueva'` |
| `fullName` | string | sí | |
| `birthDate` | string `YYYY-MM-DD` | sí | |
| `city` | string | sí | |
| `email` | string | sí | |
| `graduationYear` | number | sí | |
| `academy` | string | no | |
| `utr` | number \| null | no | Entre 0 y 20. El formulario público lo pide como opcional |
| `nationalRanking` | number \| null | no | Entero positivo. Opcional en el formulario público |
| `dominantHand` | `'diestro'` \| `'zurdo'` \| null | no | |
| `backhand` | `'dos manos'` \| `'una mano'` \| null | no | |
| `guardian` | `{ name, phone, email }` \| null | sí si es menor de 18 | |
| `videoLinks` | string[] | no | Links de YouTube, máximo 5. El formulario público los acepta solo con `https`, hasta 300 caracteres cada uno |
| `videoPaths` | string[] | no | Rutas privadas confirmadas por el servidor. La demo guarda un archivo opcional en `orgs/{orgId}/applications/{appId}/video.mp4` o `.mov`. |
| `source` | string | no | `google-forms` en postulaciones importadas de una hoja privada. Su consentimiento registra el UID de quien hizo la importación. |
| `videoUpload` | object | no | Reserva temporal de ruta y huella del archivo para reintentar sin sobrescribirlo. La escribe el servidor y la retira al confirmar `videoPaths`. |
| `message` | string | no | Hasta 1000 caracteres |
| `consent` | object | sí | Mismo formato que en `players`. El formulario usa `applications-v1` para datos y `applications-video-v1` al autorizar también un video. `method` es `'self'` o `'guardian'` y `recordedBy` es `'public-form'`. |
| `playerId` | string \| null | no | Ficha activa de la misma organización, creada o vinculada desde Reclutamiento (PCIT-56) |
| `internalNotes` | string | no | Notas del equipo; nunca visibles para el postulante |
| `reviewedBy` | string \| null | no | `uid` |
| `createdAt` | Timestamp | sí | |
| `updatedAt` | Timestamp | no | |

**Estados:** `nueva` → `en revisión` → `analizada` → `contactada` o `descartada`.
También se puede descartar una postulación contactada. Las reglas rechazan
saltos y retrocesos. La bandeja escribe el estado con una transacción y registra
quién lo cambió y cuándo en `reviewedBy` y `updatedAt`.

El alta desde la bandeja guarda la ficha y `playerId` en la misma transacción.
Firestore exige que la referencia apunte a un jugador activo que el usuario
puede gestionar. Si la postulación ya tiene jugador, se conserva ese vínculo.

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
| `coach2@acecam.test` | `acecam123` | Club Ejemplo (prueba de Básico vencida: panel bloqueado) |

El script **se niega a correr contra el proyecto real**: solo funciona con los
emuladores y el proyecto `demo-acecam`. Para ver los datos sin emuladores:
`npm run seed -- --dry-run`.

## `invites/{correo}` (PCIT-40)

Invitación para unirse a una organización. El ID es el correo invitado en
minúsculas, así quien se registra la encuentra sin listar las de otros.
Detalle del flujo: `docs/PCIT-40-invitar-miembros.md`.

| Campo | Tipo | Obligatorio | Notas |
| --- | --- | --- | --- |
| `email` | string | sí | Igual al ID |
| `orgId` | string | sí | Organización que invita |
| `role` | string | sí | `'coach'` o `'admin'`: el rol con el que entra |
| `status` | string | sí | `'pendiente'` o `'aceptada'` |
| `invitedBy` | string | sí | `uid` de quien invita (dueño o admin) |
| `createdAt` | Timestamp | sí | |
| `acceptedBy` | string | no | `uid` de la cuenta que la aceptó |
| `acceptedAt` | Timestamp | no | |
