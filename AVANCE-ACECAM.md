# AceCam · Avance de Axel (Autenticación y datos)

> Documento de traspaso para continuar en Claude Code.
> Actualizado: martes 3 de noviembre de 2026, 23:30 (hora de Lima).
> Si lo usas como contexto de Claude Code, cópialo a la raíz del repo como `CLAUDE.md`
> o pégalo al empezar la sesión.

---

## 1. Contexto del proyecto

**AceCam** es una plataforma que analiza con IA videos de partidos de tenis y muestra
estadísticas por jugador a entrenadores y reclutadores universitarios.
Mockup de referencia: `AceCam-demo.zip` (9 pantallas `.dc.html`). Datos ficticios.

| Persona | Rol en el equipo | Rama |
| --- | --- | --- |
| **Axel (yo)** · GitHub `alextheco256` · Jira "Axel CG" | Firebase: Auth, Firestore, Storage, reglas | `FireBaseComienzo` |
| Fabián Alonso Mansilla | Pantallas: Jugadores, Analizar, Dashboard, Reclutamiento | `interfaces_Fabian` |
| Rolando Roller | Base visual, layout, Inicio, Landing | `Landing_Rolando` |
| Aaron Ortiz | Modelo IA y worker (PCIT-35) | `ModeloAI` |

- **Repositorio:** https://github.com/mort1zr/Proyecto_Carrera_III_Tenis
- **Copia local (Windows):** `C:\Users\theco\source\repos\Proyecto_Carrera_III_Tenis`
- **Jira:** https://aaronov23-1790528115295.atlassian.net · proyecto **PCIT** · tablero 39
  · cloudId `7ce67f4a-12f4-4dfa-92a8-24ddb57a76c3`
- **Sprint 1** (id 53): termina el **jueves 5 de noviembre**. Meta: *login → jugador → video → estadísticas en el Dashboard*. Demo ese día.
- **Stack web:** React 19 · Vite 8 · React Router 8 · Tailwind v4 · Firebase 13 · Vitest · oxlint.
- **Modelo:** Python en `model/` (YOLO, worker que lee `matches` en cola con el Admin SDK).

---

## 2. Reglas de trabajo acordadas

- **Commits solo a nombre de `alextheco256`** (`axel27136@gmail.com`). **Sin** `Co-Authored-By` ni líneas de sesión.
- Formato de mensaje: `PCIT-XX feat: descripción en español` (o `fix:`).
- Trabajar en la rama **`FireBaseComienzo`** (sale de `ModeloAI`, que ya incluye lo de Rolando).
- **Nunca subir `web/.env`** (está en `.gitignore`). Solo se sube `web/.env.example`.
- Proyecto en **plan Spark (costo 0)**. No activar Blaze. Storage funciona solo en el emulador.
- Se desarrolla y prueba con **emuladores** (proyecto `demo-acecam`), sin tocar datos reales.
- Paleta oficial de AceCam (tema oscuro / claro) ya está en el repo como tokens (PCIT-90, Rolando).

---

## 3. Estado de mis historias (épica PCIT-2)

| Historia | Estado en Jira | Commit | Qué falta |
| --- | --- | --- | --- |
| **PCIT-20** Firebase y `.env` | ✅ Listo | `ca5bff0` | Confirmar en la consola que Auth tiene activado **Correo/contraseña** |
| **PCIT-22** Esquema y datos de ejemplo | 🟡 En revisión | `bc4a50b`, `74572b6` | Pasar a **Listo**: Aaron (worker) y Fabián ya lo adoptaron |
| **PCIT-23** Reglas por organización | 🟡 En curso | `feb13dd` | **Correr `npm run test:rules`** (26 pruebas, aún no ejecutadas), publicar las reglas y cerrar |
| **PCIT-21** Login y registro | ⬜ Por hacer | — | **Lo más urgente para la demo** (ver §7) |
| **PCIT-24** Storage y `uploadVideo()` | ⬜ Por hacer | — | Ver §8 |

Sprint 2 (mío): PCIT-39 roles, PCIT-40 invitar miembros, PCIT-41 contador de análisis.
Sprint 3: PCIT-54 formulario público, PCIT-55 Hosting + GitHub Actions. Sprint 4: PCIT-67 revisión de seguridad.

**Transiciones de Jira** (ids): `11` Por hacer · `21` En curso · `31` En revisión · `41` Listo.

---

## 4. Lo que ya está en `FireBaseComienzo`

```
firebase.json            Emuladores: Auth 9099 · Firestore 8080 · Storage 9199 · UI 4000
.firebaserc              Proyecto real: acecam-e93a2
firestore.rules          Reglas por organización (PCIT-23)
storage.rules            Todo cerrado (se abre en PCIT-24)
firestore.indexes.json   Vacío
docs/firestore-schema.md Esquema completo + tabla de qué permiten las reglas
web/.env.example         Variables VITE_FIREBASE_* y VITE_USE_FIREBASE_EMULATORS
web/src/lib/firebase.js        Inicializa una sola vez y exporta { app, auth, db, storage, usingEmulators }
web/src/lib/firebaseConfig.js  Valida el .env; en modo emulador usa el proyecto demo-acecam
web/src/lib/schema.js          COLLECTIONS, MATCH_STATUS, APPLICATION_STATUS, ROLES, valores permitidos
web/scripts/seed.mjs           Carga datos ficticios en los emuladores (se niega a tocar el proyecto real)
web/scripts/seedData.mjs       Los datos (2 orgs, 2 coaches, 5 jugadores, 11 partidos, 5 postulaciones)
web/tests/rules/               Pruebas de reglas con @firebase/rules-unit-testing
web/vitest.rules.config.js     Config de Vitest para las pruebas de reglas
```

### Comandos (desde `web/`)

| Comando | Qué hace |
| --- | --- |
| `npm run emulators` | Enciende Auth, Firestore y Storage (UI en http://127.0.0.1:4000) |
| `npm run seed` | Con los emuladores encendidos: vacía y carga datos de ejemplo |
| `npm run test:rules` | Enciende el emulador, corre las pruebas de reglas y lo apaga (cerrar antes `npm run emulators`) |
| `npm test` | Pruebas normales (19, pasan) |
| `npm run lint` / `npm run build` | Pasan |

**Usuarios de ejemplo** (tras `npm run seed`): `coach@acecam.test` / `acecam123` (org `org-demo`,
Universidad Demo) y `coach2@acecam.test` / `acecam123` (org `org-club`, Club Ejemplo).

### Firebase real (`acecam-e93a2`)
- Plan **Spark**. Firestore `(default)` creada en modo producción (todo bloqueado hasta publicar reglas).
- Storage **no** creado (requiere Blaze).
- Para usar la nube: `web/.env` con los valores `VITE_FIREBASE_*` y `VITE_USE_FIREBASE_EMULATORS=false`.
- Publicar reglas: `npx firebase login` y luego `npx firebase deploy --only firestore:rules`.

---

## 5. Esquema de Firestore (resumen de `docs/firestore-schema.md`)

- Colecciones **en la raíz** con campo `orgId`: `users/{uid}`, `orgs/{orgId}`, `players`, `matches`, `applications`.
- Campos en inglés (camelCase); valores visibles en español. Fechas sin hora `YYYY-MM-DD`; momentos con `serverTimestamp()`.
- Desconocido = `null` o ausente, nunca `0`. `orgId`, `createdBy` y `consent.recordedBy` salen de la sesión.

| Colección | Campos clave |
| --- | --- |
| `users/{uid}` | `email`, `displayName`, `orgId`, `role` (`coach`\|`admin`), `jobTitle`, `createdAt` |
| `orgs/{orgId}` | `name`, `ownerId`, `program`, `plan: 'free'`, `createdAt` |
| `players` | `orgId`, `fullName`, `birthDate`, `academy`, `category`, `dominantHand`, `backhand`, `utr`, `nationalRanking`, `guardian {name, phone, email}`, `consent {accepted, version: 'players-v1', method, recordedBy, recordedAt}`, `createdBy`, `createdAt` |
| `matches` | `orgId`, `playerId`, `playerPosition` (`arriba`\|`abajo`), `opponent`, `tournament`, `matchDate`, `result`, `videoPath`, `inputFingerprint`, `status`, `startedAt`, `finishedAt`, `errorMessage`, `workerVersion`, `statistics` |
| `applications` | `orgId`, `status`, datos del postulante, `guardian`, `videoLinks`, `videoPaths`, `consent`, `playerId`, `internalNotes` |

- **Estados de `matches`:** `en cola` → `procesando` → `listo` | `error` (Reintentar: `error` → `en cola`).
- **Estados de `applications`:** `nueva`, `en revisión`, `analizada`, `contactada`, `descartada`.
- **`matches.statistics`** v1 (`schemaVersion: 'acecam.match-stats.v1'`): `player`, `opponent`, `rallies`; guarda **sumas y cantidades**, no promedios. Aaron ya lo implementa en `model/stats/match_stats.py` (`to_match_statistics`).
- **Ruta del video:** `orgs/{orgId}/matches/{matchId}/video.mp4|mov` (la valida Fabián y la regla de matches).

---

## 6. Reglas de Firestore (PCIT-23, resumen)

- Solo usuarios con sesión; todo lo no listado se niega.
- El `orgId` del usuario se lee de `users/{uid}`; sin esa ficha no ve nada.
- **Registro:** `orgs/{orgId}` y `users/{uid}` se crean **en el mismo batch**; el usuario debe ser `ownerId` de la org, con `role: 'coach'` y su mismo email. Nadie se une a una org ajena.
- `players`: crear con `orgId` propio, `createdBy` propio y consentimiento aceptado; no se cambian `orgId`, `createdBy`, `consent`.
- `matches`: la web crea solo `en cola`, sin `statistics`, con jugador de su org y `videoPath` correcto; puede corregir datos o reintentar un `error`; no borra si está `procesando`. El worker (Admin SDK) no pasa por reglas.
- `applications`: lectura/edición dentro de la org; alta pública queda para PCIT-54.
- Las consultas de la web **deben filtrar por `orgId`**.
- `get` de un documento inexistente está permitido (lo necesita el flujo de Fabián en PCIT-27).

---

## 7. Siguiente: PCIT-21 · Login y registro con Firebase Auth

**Criterios de aceptación (Jira):**
- El registro crea el usuario en Auth y su documento en `users` con rol `coach` y su organización.
- Inicio y cierre de sesión funcionando.
- Errores visibles: credenciales inválidas, usuario no encontrado, correo en uso, contraseñas que no coinciden.
- `AuthContext` con `onAuthStateChanged`; las rutas protegidas redirigen al login.
- Pantallas con la identidad de AceCam; tras el login se redirige al Inicio.

**Plan propuesto:**
- `web/src/lib/auth.js`: `registerCoach({ name, email, password, orgName })` → `createUserWithEmailAndPassword`, `updateProfile`, y **un `writeBatch`** con `orgs/{nuevoId}` (`ownerId`, `plan: 'free'`, `createdAt: serverTimestamp()`) y `users/{uid}` (`role: 'coach'`, `orgId`). Debe cumplir exactamente las reglas de §6. Si el batch falla, borrar el usuario de Auth o reintentar.
- `login`, `logout`, y traducción de errores (`auth/invalid-credential`, `auth/user-not-found`, `auth/email-already-in-use`, `auth/weak-password`, `auth/too-many-requests`).
- `web/src/context/AuthContext.jsx`: `{ user, profile, loading }`, donde `profile` es `users/{uid}` (con `orgId`). Es lo que esperan los servicios de Fabián: `createFirestorePlayersService({ db, orgId: profile.orgId, actorId: user.uid })`.
- `RequireAuth` envolviendo las rutas de `AppLayout` en `web/src/App.jsx` (rutas de Rolando: `/inicio`, `/dashboard`, `/jugadores`, `/analizar`, …); `/login` y `/registro` públicas.
- Reemplazar los placeholders `web/src/pages/Login.jsx` y `Registro.jsx` (usar tokens de Tailwind de Rolando y componentes `Button`, `Logo`).
- Pruebas: unitarias de validación y errores; y probar el registro contra el emulador (las reglas de §6 deben aceptarlo).

---

## 8. Después: PCIT-24 · Storage para videos

**Criterios:** `storage.rules` solo para usuarios autenticados de la organización; límite de tamaño y formatos `.mp4` / `.mov`; `uploadVideo()` que devuelve la ruta para guardarla en `matches`.

**Firma que ya espera Fabián** (`web/src/lib/services/firestoreAnalysisService.js` en `interfaces_Fabian`):

```js
uploadVideo({ file, orgId, actorId, matchId, maxBytes, signal, onProgress }) // → Promise<string>
// Devuelve exactamente `orgs/${orgId}/matches/${matchId}/video.mp4` o `.mov`
// onProgress(percent 0–100); cancelar con signal (AbortSignal) → uploadTask.cancel()
```

- Usar `uploadBytesResumable`. `storage.rules` puede leer Firestore con `firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.orgId`.
- Acordar `maxBytes` con Fabián (el mockup dice 4 GB; su demo usa 500 MB).
- Probar con el emulador de Storage (si falla por Java 25, instalar Java 21).

---

## 9. Riesgos y pendientes del equipo

- **Nadie ha unido ramas:** `main` solo tiene PCIT-25. Antes del jueves hay que juntar `FireBaseComienzo` + `interfaces_Fabian` + `Landing_Rolando` + `ModeloAI` en una rama de integración y probar el recorrido completo con emuladores.
- La rama de Fabián **aún no incluye** `firebase.js` ni `schema.js`; sus servicios reciben `db`, `user` y `profile` desde fuera (del `AuthContext` de PCIT-21).
- Fabián depende de mí en PCIT-135 (Auth + reglas), PCIT-136 y PCIT-137 (`uploadVideo`).
- Rolando necesita el usuario de la sesión para la barra superior (PCIT-95).
- Para la demo: todo con emuladores en una sola máquina (web + Firebase + worker de Aaron).
- Más adelante, el worker en la nube necesitará una **cuenta de servicio** (credencial secreta, nunca en el repo).

---

## 10. Notas de mi computadora (Windows)

- Node 24.20 ✔ · Java 25 ✔ (muestra un aviso `sun.misc.Unsafe` que no es error) · **Git no instalado** (`winget install --id Git.Git -e`).
- Si `npm` falla por la política de scripts: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- Usar PowerShell normal (no administrador) dentro de la carpeta `web`.
- `npm run emulators` ocupa los puertos 8080/9099/9199/4000: ciérralo con Ctrl + C antes de `npm run test:rules`.
- Los datos de los emuladores se borran al apagarlos; `npm run seed` los vuelve a cargar.

---

## 11. Historial de commits en `FireBaseComienzo`

| Commit | Mensaje |
| --- | --- |
| `ca5bff0` | PCIT-20 feat: proyecto Firebase y configuración en la web (.env) |
| `bc4a50b` | PCIT-22 feat: esquema de colecciones de Firestore y datos de ejemplo |
| `74572b6` | PCIT-22 fix: mostrar el avance del script de datos de ejemplo y cortar si se cuelga |
| `feb13dd` | PCIT-23 feat: reglas de seguridad de Firestore por organización |

## 12. Próximos pasos, en orden

1. Correr `npm run test:rules`; si pasan, comentar y mover **PCIT-23** a Listo; publicar reglas.
2. Mover **PCIT-22** a Listo.
3. **PCIT-21** login y registro (§7).
4. **PCIT-24** Storage y `uploadVideo()` (§8).
5. Coordinar la rama de integración y ensayar la demo del jueves.
