# Esquema de Firestore · PCIT-22

Contrato único entre la **web** (`web/`) y el **worker del modelo** (`model/`, PCIT-35).
Las constantes de este documento están en [`web/src/lib/schema.js`](../web/src/lib/schema.js).
Si cambias un campo, actualiza los dos archivos y avisa en Jira.

**Versión:** 1 · **Responsable:** Axel (PCIT-22) · **Reglas de acceso:** [`firestore.rules`](../firestore.rules) (PCIT-23)

## Qué permiten las reglas (PCIT-23)

| Colección | Leer | Crear | Modificar | Borrar |
| --- | --- | --- | --- | --- |
| `users` | La propia y las de su organización | Solo la propia, en el registro, con rol `coach` y en una organización que crea él mismo | Solo nombre y cargo | No |
| `orgs` | La suya | En el registro, si todavía no tiene ficha en `users` | Nombre y programa, solo quien la creó | No |
| `players` | De su organización | Con `orgId` de su organización, `createdBy` propio y consentimiento aceptado | Datos del jugador; nunca `orgId`, `createdBy` ni `consent` | De su organización |
| `matches` | De su organización | En `'en cola'`, sin estadísticas, con un jugador de su organización y el video en `orgs/{orgId}/matches/{matchId}/video.mp4\|mov` | Datos del partido, o pasar de `error` a `en cola` (Reintentar) | De su organización, salvo si está `procesando` |
| `applications` | De su organización | Por ahora solo con sesión (el formulario público llega en PCIT-54) | Estado y notas | De su organización |

El worker usa el Admin SDK, que no pasa por las reglas: es el único que escribe
`procesando`, `listo`, `error` y `statistics`. Las consultas de la web **siempre**
deben filtrar por `orgId`; sin ese filtro, Firestore las rechaza.

## Decisiones

- **Colecciones en la raíz con un campo `orgId`** (`players`, `matches`, `applications`),
  no subcolecciones. Así ya las consulta el código de Fabián
  (`where('orgId', '==', orgId)`) y las reglas de PCIT-23 filtran por ese campo.
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

### `matches.statistics` (propuesta v1, confirmar con Aaron)

Estadísticas **de ese partido**. El worker traduce `player_1` / `player_2` del modelo
a `player` (el jugador registrado) y `opponent` usando `playerPosition`.
Todas las métricas son opcionales: si el modelo todavía no la calcula, se omite.

```js
statistics: {
  schemaVersion: 'acecam.match-stats.v1',
  durationSeconds: 5520,
  player: {
    shots:    { count: 412, sumSpeedKmh: 41612, maxSpeedKmh: 124 },
    movement: { distanceMeters: 3400, maxSpeedKmh: 23, avgSpeedKmh: 7.2 },
    serve:    { sumSpeedKmh: 15200, sampleCount: 100, maxSpeedKmh: 171,
                firstServeIn: 58, firstServeAttempts: 100, doubleFaults: 5 },
    forehand: { count: 210, maxSpeedKmh: 124 },
    backhand: { count: 160, maxSpeedKmh: 112 },
  },
  opponent: { /* mismas claves, opcionales */ },
  rallies: { count: 96, avgShots: 4.9, longestShots: 21 },
}
```

- **Lo que el modelo ya calcula hoy** (`model/main.py`): golpes por jugador
  (`shots.count`, `shots.sumSpeedKmh`) y velocidad de desplazamiento (`movement`).
- **Lo demás** (saque, derecha/revés, peloteos) llega con las épicas TA-E2 a TA-E5.
  Hasta entonces esas claves no existen y el Dashboard las muestra como "sin dato".
- Promedios: se guardan **sumas y cantidades**, no promedios, para que el Dashboard
  pueda combinar partidos sin error (como pide PCIT-28).

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
