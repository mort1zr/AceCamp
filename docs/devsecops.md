# DevSecOps: pipeline y seguridad continua

Qué revisa el pipeline en cada cambio, qué hay que configurar a mano en GitHub y
Firebase, y qué hacer cuando un control falla. Historias: PCIT-164 a PCIT-169.

## 1. Pipeline

Un solo workflow, `.github/workflows/ci.yml` (antes repartido en `model-ci`, `web-ci`,
`security`, `codeql`, `scorecard`, `deploy-web` y `deploy-azure`): queda como una sola
entrada en la pestaña Actions por cada PR o push. El job `cambios` (`dorny/paths-filter`)
decide qué jobs de modelo/web/Azure corren según la carpeta que tocó el cambio; los de
seguridad, SAST y OWASP corren siempre, sin importar la ruta.

| Job | Cuándo corre | Qué hace | ¿Bloquea? |
|---|---|---|---|
| `cambios` | Siempre | Detecta qué carpetas cambiaron, para los jobs con filtro de ruta | No |
| `lint-workflow` | Siempre | `actionlint` valida el propio `ci.yml` | Sí |
| `modelo-tests` | PR y push a main que tocan `model/` | ruff y pytest, con 100 % de cobertura en `scoring` | Sí |
| `web-tests` | PR y push a main que tocan `web/`, `firebase/` o `firebase.json` | oxlint, vitest, build de Vite y chequeo de la CSP | Sí |
| `web-reglas` | Igual que `web-tests` | Pruebas de reglas de Firestore/Storage contra emuladores, con informe de cobertura | Sí |
| `secretos` | Siempre | gitleaks sobre el historial completo | Sí |
| `dependencias-python` | Siempre | pip-audit sobre `model/requirements*.txt` | Sí |
| `dependencias-web` | Siempre | npm audit de producción | Sí |
| `revision-dependencias` | Solo PR | Dependency Review: bloquea dependencias nuevas vulnerables | Sí |
| `owasp-dependency-check` | push a main y cada lunes | SCA contra la base NVD/CVE (ver más abajo) | No; sube a Code scanning |
| `owasp-zap-baseline` | Solo tras desplegar en main | DAST (ZAP) contra la web ya publicada | No; informa |
| `codeql` | Siempre | SAST de JavaScript, Python y los workflows | Los hallazgos aparecen en la PR |
| `scorecard` | push a main y cada lunes | OpenSSF Scorecard: puntúa las prácticas del repo | No; informa |
| `deploy` | Tras pasar `web-tests`/`web-reglas` | Firebase Hosting: vista previa (PR) o producción y reglas (main) | Despliega solo si la CI pasa |
| `imagen` / `desplegar` | PR y push que tocan `web/server/azure-videos/` o `model/` | Construye y (en main) despliega la API de videos en Azure Container Apps | Despliega solo si la imagen pasa |
| `imagen-worker` / `desplegar-worker` | Igual que `imagen`/`desplegar` | Construye y (en main) despliega el worker del modelo como tarea programada en Azure | Igual |
| Dependabot | Cada lunes | PRs para actualizar pip, npm y Actions | Pasan por el mismo pipeline |

Configuración específica de Azure (variables `AZURE_*` y secretos
`FIREBASE_SERVICE_ACCOUNT_AZURE`/`_WORKER`): ver
[PCIT-222 · Videos en Azure](PCIT-222-videos-en-azure.md).

**La capa OWASP no es redundante con lo anterior.** `owasp-dependency-check` usa la base
de datos NVD/CVE, distinta de OSV/GHSA (lo que usan pip-audit, npm audit y Dependency
Review): detecta vulnerabilidades que una fuente reporta y la otra todavía no.
`owasp-zap-baseline` es el único análisis **dinámico** (DAST) del pipeline: en vez de leer
el código fuente, ataca la web ya publicada en producción, como lo haría un usuario real.

**`cancel-in-progress` solo aplica en pull_request:** una PR con pushes seguidos cancela
las corridas viejas, pero un push a `main` (que puede estar desplegando en Firebase o en
Azure) nunca se cancela a medio camino.

**Otras medidas**

- Todas las Actions están fijadas a un commit (SHA), con el número de versión en un comentario. Dependabot las actualiza.
- Cada job tiene permisos mínimos (`contents: read` salvo que necesite más) y `persist-credentials: false`.
- **Localmente**, `pre-commit` bloquea antes del commit:
  - archivos de más de 1 MB;
  - llaves privadas;
  - conflictos de merge sin resolver;
  - errores de ruff;
  - secretos (gitleaks).

  Se instala una vez:

  ```powershell
  pip install pre-commit
  pre-commit install
  ```

## 2. Configuración manual en GitHub (una sola vez)

Hazlo con la cuenta dueña del repositorio (mort1zr). Todo es gratis porque el repositorio es público.

### 2.1 Code security

En **Settings → Advanced Security** (en algunas cuentas se llama *Code security*), activa:

- **Dependency graph**: lo necesita Dependency Review.
- **Dependabot alerts** y **Dependabot security updates**.
- **Secret Protection**: el escaneo de secretos, con **Push protection** activada. GitHub rechaza un push que contenga una clave conocida.
- **Private vulnerability reporting**: es el canal que indica `SECURITY.md`.
- **Code scanning → CodeQL analysis**: elige **Advanced** o déjalo desactivado. No actives *Default setup*: GitHub rechaza los resultados del job `codeql` si las dos configuraciones están activas a la vez. `scorecard` y `owasp-dependency-check` también suben sus resultados a Code scanning.

### 2.2 Proteger main

En **Settings → Rules → Rulesets → New branch ruleset**:

- **Nombre:** `main protegida`. **Enforcement:** Active. **Target:** la rama por defecto (`main`).
- Marca **Restrict deletions** y **Block force pushes**.
- Marca **Require a pull request before merging**, con:
  - 1 aprobación;
  - **Dismiss stale approvals** al subir cambios nuevos;
  - **Require review from Code Owners** (`.github/CODEOWNERS`).
- Marca **Require status checks to pass**. Añade solo los checks que corren en todas las PRs (son el `name:` de cada job en `ci.yml`, no el id):
  - `Validar el workflow (actionlint)`
  - `Seguridad: secretos (gitleaks)`
  - `Seguridad: dependencias Python (pip-audit)`
  - `Seguridad: dependencias web (npm audit)`
  - `Seguridad: Dependency Review`
  - `SAST: CodeQL (javascript-typescript)`
  - `SAST: CodeQL (python)`
  - `SAST: CodeQL (actions)`

  GitHub solo deja elegir un check desde el buscador de "Add checks" si ya corrió al menos
  una vez con ese nombre exacto en el repo; si lo escribes a mano antes de eso, queda sin
  validar ("Any source") hasta que el pipeline corra una vez.

**Cuidado con los checks con filtro de ruta.** `modelo-tests`, `web-tests`, `web-reglas`, `imagen`, `desplegar`, `imagen-worker` y `desplegar-worker` solo corren cuando el cambio toca su carpeta. Si los marcas como obligatorios, una PR que no toca esa carpeta queda esperando para siempre. Por la misma razón, nunca marques `OWASP: Dependency-Check` ni `OWASP: ZAP Baseline` como obligatorios: no corren en pull_request (solo en push a main y los lunes), así que bloquearían cualquier PR para siempre. Cuando los demás corren y fallan, aparecen en rojo en la PR: no la fusiones hasta que estén en verde.

**Si trabajas solo,** GitHub no deja que apruebes tu propia PR. Añade tu rol en **Bypass list** con la opción *For pull requests only*. Así puedes fusionar tus PRs, pero nadie puede hacer push directo a main.

### 2.3 Environments

**Settings → Environments** se crea solo en el primer deploy (`preview` y `production`). Si quieres aprobar cada despliegue a producción, en `production` activa **Required reviewers**.

## 3. Despliegue en Firebase Hosting

Flujo completo, cómo ver la versión publicada y qué hacer si falla cada paso: [PCIT-55 · Publicación en Firebase Hosting](PCIT-55-publicacion-en-hosting.md).

**Costo:**

- Hosting entra en la cuota gratuita: 10 GB guardados y 360 MB por día de transferencia.
- Desde el 3 de febrero de 2026, Cloud Storage for Firebase exige el plan Blaze, que pide una tarjeta. La cuota gratuita se mantiene.
- Crea una alerta de presupuesto en **Google Cloud Console → Billing → Budgets & alerts**, por ejemplo de 5 USD, con avisos al 50 %, 90 % y 100 %.

### 3.1 Cuenta de servicio de despliegue

1. **Google Cloud Console → IAM y administración → Cuentas de servicio** del proyecto `acecam-e93a2`. Pulsa **Crear cuenta de servicio** con el nombre `github-deploy`.
2. Dale solo estos roles:
   - Administrador de Firebase Hosting
   - Administrador de Firebase Rules
   - Administrador de índices de Cloud Datastore
   - Administrador de Firebase Authentication: autoriza los dominios de las vistas previas.
   - Lector de claves de API
   - Consumidor de Service Usage
3. Entra en la cuenta → **Claves → Agregar clave → JSON**. Se descarga un archivo.
4. **GitHub → Settings → Secrets and variables → Actions → New repository secret**:
   - Nombre: `FIREBASE_SERVICE_ACCOUNT_ACECAM`.
   - Valor: el contenido completo del JSON.
5. **Borra el JSON de tu PC.** Nunca lo subas al repositorio ni lo pegues en un chat. Si se filtra, elimina esa clave en la consola y crea otra.

**No uses `firebase init hosting:github`:** sobrescribe los workflows del repositorio.

### 3.2 Variables de la web

En **GitHub → Settings → Secrets and variables → Actions → pestaña Variables**, crea:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Los valores están en **Firebase Console → Configuración del proyecto → Tus apps → Web**. Son públicos por diseño: van dentro del JavaScript que descarga el navegador. La seguridad depende de las reglas, que se prueban en cada PR.

**Recomendado:** en Google Cloud Console → APIs y servicios → Credenciales, restringe esa API key a los dominios `acecam-e93a2.web.app`, `acecam-e93a2.firebaseapp.com` y `localhost`.

### 3.3 Qué pasa en cada despliegue

| Evento | Resultado |
|---|---|
| PR desde una rama del repositorio | Pasa la CI de la web, y luego una URL de vista previa (`acecam-e93a2--pr…web.app`) que dura 7 días, comentada en la PR |
| PR desde un fork | Solo CI. Los forks no reciben secretos |
| Merge a `main` | Pasa la CI de la web, y luego publica producción en `https://acecam-e93a2.web.app` y las reglas e índices de Firestore. Las reglas de Storage, solo con `DEPLOY_STORAGE_RULES` (ver abajo) |
| Falta el secreto | La CI corre y el deploy se omite con un aviso |

**Reglas de Storage y plan Blaze.** El proyecto está en plan Spark, sin Cloud Storage, y publicar
`storage.rules` falla con *Permissions denied enabling firebasestorage.googleapis.com*. Por eso el
deploy publica solo las reglas de Firestore y deja un aviso. Cuando el proyecto pase a Blaze y
Storage esté creado, crea en **GitHub → Settings → Secrets and variables → Actions → Variables**
la variable `DEPLOY_STORAGE_RULES` con valor `true` para publicar también `storage.rules`.

### 3.4 Content-Security-Policy

`firebase.json` limita de dónde puede cargar la web scripts, estilos, imágenes, videos y conexiones: solo el propio dominio y los servicios de Firebase.

- **Si cambias el `<script>` en línea de `web/index.html`,** su hash cambia. `npm run check:csp` falla en la CI y muestra el hash nuevo para `script-src`.
- **Si la web empieza a usar otro servicio,** por ejemplo un iframe de YouTube o una API propia, añade su dominio a la directiva que corresponda (`frame-src`, `connect-src`…). Si no, el navegador lo bloquea y el error aparece en la consola.

## 4. Qué hacer cuando un control falla

| Falla | Qué hacer |
|---|---|
| gitleaks | **Revoca el secreto primero** (consola de Firebase, Roboflow…): borrarlo del commit no basta, porque sigue en el historial. Después quítalo del código y usa una variable de entorno o un secreto de GitHub. Si es un falso positivo, añade una regla en `.gitleaks.toml` |
| pip-audit | Sube la versión al valor de "Corregido en" en `model/requirements*.txt`. Las vulnerabilidades de torch y torchvision se informan sin bloquear hasta PCIT-168 |
| npm audit | `npm audit fix` en `web/`. Si exige una versión mayor, revisa el changelog antes |
| Dependency Review | La PR añade una dependencia vulnerable: elige otra versión |
| CodeQL | Abre el hallazgo en **Security → Code scanning**: explica el flujo de datos. Corrígelo o descártalo con justificación |
| OWASP Dependency-Check | Abre el hallazgo en **Security → Code scanning**. Si el CVE es de una versión que ya no se usa (`--enableRetired`), puede ser ruido; si no, actualiza la dependencia |
| OWASP ZAP Baseline | No bloquea: revisa el resumen del job en Actions. Los falsos positivos comunes (cabeceras informativas, cookies de terceros) se documentan en el propio resumen |
| `check:csp` | Copia el hash que muestra el error en `script-src` de `firebase.json` |
| `download_models.py`: `sha256 no coincide` | **No uses ese archivo.** Vuelve a descargarlo con `--force`. Si se repite, el origen cambió: avisa al equipo antes de registrar un hash nuevo |

**`NVD_API_KEY` (opcional).** `owasp-dependency-check` descarga la base NVD en cada corrida;
sin clave, el límite de peticiones hace que tarde más (la caché de GitHub Actions ayuda,
pero expira). Pide una clave gratis en https://nvd.nist.gov/developers/request-an-api-key
y guárdala en **GitHub → Settings → Secrets and variables → Actions → New repository
secret** con el nombre `NVD_API_KEY`.

## 5. Pendientes

**Registrar el sha256 de los pesos de Drive.**

- `yolo5_last.pt`, `keypoints_model.pth` y `tracknet.pt` todavía no tienen hash registrado en `model/scripts/download_models.py`.
- En el PC donde funcionan los modelos, desde `model/`, ejecuta:

  ```powershell
  python scripts/download_models.py --verify --no-video
  ```

- Copia los hashes que muestra en `EXPECTED_SHA256`. Desde ese momento, el worker puede usar `--strict`.

**PCIT-168: actualizar PyTorch a 2.10 o superior.**

- Cierra CVE-2025-32434 y CVE-2026-24747.
- Después hay que quitar torch y torchvision de `PENDIENTES` en `.github/scripts/pip_audit_gate.py` y de `ignore` en `.github/dependabot.yml`.
