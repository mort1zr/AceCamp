# DevSecOps: pipeline y seguridad continua

Qué revisa el pipeline en cada cambio, qué hay que configurar a mano en GitHub y
Firebase, y qué hacer cuando un control falla. Historias: PCIT-164 a PCIT-169,
PCIT-187 (optimización) y la unificación del pipeline en un solo workflow.

## 1. Pipeline

Todo vive en **un único workflow**, `.github/workflows/ci.yml` (antes repartido en
`model-ci.yml`, `web-ci.yml`, `security.yml`, `codeql.yml`, `scorecard.yml` y
`deploy-web.yml`): así cada PR o push aparece como **una sola entrada** en la pestaña
Actions, con todos los jobs debajo. Corre en cada PR, en cada push a `main`, cada
lunes (para detectar vulnerabilidades nuevas aunque nadie suba código) y a mano con
**Run workflow**.

Qué jobs disparan los cambios lo decide el job `cambios` (con `dorny/paths-filter`),
no el disparador: los de modelo solo corren si cambió `model/`, los de web solo si
cambió `web/` o `firebase/`. Los de seguridad, SAST y OWASP no dependen de la ruta:
corren siempre, igual que antes de unificar los workflows.

| Job | Cuándo corre | Qué hace | ¿Bloquea? |
|---|---|---|---|
| `cambios` | Siempre | Decide qué más corre según la ruta (no afecta a PRs: ver abajo) | — |
| `lint-workflow` | Siempre | `actionlint` sobre el propio `ci.yml`: valida su sintaxis antes de que falle en producción | Sí |
| `modelo-tests` | PR/push que tocan `model/`, o push/schedule | ruff y pytest, con 100 % de cobertura en `scoring` | Sí |
| `web-tests` | PR/push que tocan `web/`, o push/schedule | oxlint, vitest, build de Vite y chequeo de la CSP | Sí |
| `web-reglas` | Igual que `web-tests` | Pruebas de reglas de Firestore/Storage en emuladores | Sí |
| `secretos` | Siempre | gitleaks sobre todo el historial | Sí |
| `dependencias-python` | Siempre | pip-audit del entorno del worker | Sí |
| `dependencias-web` | Siempre | npm audit de producción | Sí |
| `revision-dependencias` | Solo PR | Dependency Review: bloquea dependencias nuevas con vulnerabilidades altas | Sí |
| `owasp-dependency-check` | push a main y schedule (no en cada PR: tarda por la base NVD) | **OWASP Dependency-Check** (SCA): cruza las dependencias con la base NVD, un catálogo distinto del que usan pip-audit/npm audit | Informa (sube a Code scanning) |
| `owasp-zap-baseline` | Solo tras un deploy exitoso a producción (push a main) | **OWASP ZAP Baseline** (DAST): análisis pasivo de la web ya publicada en vivo, no del código | No; informativo |
| `codeql` | Siempre | SAST de JavaScript, Python y los workflows | Los hallazgos aparecen en la PR |
| `scorecard` | push a main y schedule | OpenSSF Scorecard: puntúa las prácticas del repo | No; informa |
| `deploy` | push/PR que tocan la web (tras `web-tests` y `web-reglas`) | Vista previa (PR) o producción y reglas (main) en Firebase Hosting | Despliega solo si la CI pasa |
| Dependabot | Cada lunes | PRs para actualizar pip, npm y Actions | Pasan por el mismo pipeline |

**La capa OWASP (nueva)** complementa lo que ya había, sin duplicarlo: pip-audit y npm
audit miran OSV y la Advisory Database de GitHub; **Dependency-Check** usa la base NVD,
así que puede encontrar avisos que los otros no tienen. **ZAP Baseline** es la única
prueba que corre contra la aplicación real en ejecución (cabeceras, cookies, respuestas),
no contra el código fuente: por eso va después del despliegue, no antes.

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
- **Code scanning → CodeQL analysis**: elige **Advanced** o déjalo desactivado. No actives *Default setup*: GitHub rechaza los resultados del job `codeql` si las dos configuraciones están activas a la vez. A esa misma pestaña (Security → Code scanning) también suben sus resultados Scorecard y **OWASP Dependency-Check**: no hace falta activar nada aparte para ellos, solo que Code scanning esté habilitado.

### 2.2 Proteger main

En **Settings → Rules → Rulesets → New branch ruleset**:

- **Nombre:** `main protegida`. **Enforcement:** Active. **Target:** la rama por defecto (`main`).
- Marca **Restrict deletions** y **Block force pushes**.
- Marca **Require a pull request before merging**, con:
  - 1 aprobación;
  - **Dismiss stale approvals** al subir cambios nuevos;
  - **Require review from Code Owners** (`.github/CODEOWNERS`).
- Marca **Require status checks to pass**. Añade solo los checks que corren en **todas** las PRs (si vienes de la configuración anterior, con los 6 workflows separados, tienes que **volver a marcarlos**: el nombre de contexto cambia al unificarlos en `ci.yml`):
  - `Validar el workflow (actionlint)`
  - `Seguridad: secretos (gitleaks)`
  - `Seguridad: dependencias Python (pip-audit)`
  - `Seguridad: dependencias web (npm audit)`
  - `Seguridad: Dependency Review`
  - `SAST: CodeQL (javascript-typescript)`
  - `SAST: CodeQL (python)`
  - `SAST: CodeQL (actions)`

**Cuidado con los checks con filtro de ruta.** `Modelo: lint y tests` y los dos de `Web:` (`lint, tests, build y CSP` / `reglas de Firestore y Storage`) solo corren cuando la PR toca su carpeta (lo decide el job `cambios`). Si los marcas como obligatorios, una PR que no toca esa carpeta queda esperando para siempre. Cuando corren y fallan, aparecen en rojo en la PR: no la fusiones hasta que estén en verde. Los de la capa OWASP (`OWASP: Dependency-Check`, `OWASP: ZAP Baseline`) no corren en PRs por diseño (ver tabla arriba): no los marques como obligatorios, porque nunca aparecerían en una PR y la bloquearían para siempre.

**Si trabajas solo,** GitHub no deja que apruebes tu propia PR. Añade tu rol en **Bypass list** con la opción *For pull requests only*. Así puedes fusionar tus PRs, pero nadie puede hacer push directo a main.

### 2.3 Environments

**Settings → Environments** se crea solo en el primer deploy (`preview` y `production`). Si quieres aprobar cada despliegue a producción, en `production` activa **Required reviewers**.

## 3. Despliegue en Firebase Hosting

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
| `check:csp` | Copia el hash que muestra el error en `script-src` de `firebase.json` |
| OWASP Dependency-Check | No bloquea el pipeline (sube a Code scanning). Revisa el hallazgo ahí: puede ser una dependencia que pip-audit/npm audit todavía no marcan |
| OWASP ZAP Baseline | No bloquea el pipeline. Revisa el log del job: suele ser una cabecera de seguridad que falta (`firebase.json` → `hosting.headers`) o una cookie sin `Secure`/`HttpOnly` |
| `download_models.py`: `sha256 no coincide` | **No uses ese archivo.** Vuelve a descargarlo con `--force`. Si se repite, el origen cambió: avisa al equipo antes de registrar un hash nuevo |

## 5. Pendientes

**Registrar el sha256 de los pesos de Drive.**

- `yolo5_last.pt`, `keypoints_model.pth` y `tracknet.pt` todavía no tienen hash registrado en `model/scripts/download_models.py`.
- En el PC donde funcionan los modelos, desde `model/`, ejecuta:

  ```powershell
  python scripts/download_models.py --verify --no-video
  ```

- Copia los hashes que muestra en `EXPECTED_SHA256`. Desde ese momento, el worker puede usar `--strict`.

**NVD_API_KEY (opcional).** El job `OWASP: Dependency-Check` funciona sin ella, pero
tarda más la primera vez que descarga la base NVD (se cachea después). Para acelerarlo,
pide una clave gratis en https://nvd.nist.gov/developers/request-an-api-key y créala
como secreto de repositorio con ese nombre.

**PCIT-168: actualizar PyTorch a 2.10 o superior.**

- Cierra CVE-2025-32434 y CVE-2026-24747.
- Después hay que quitar torch y torchvision de `PENDIENTES` en `.github/scripts/pip_audit_gate.py` y de `ignore` en `.github/dependabot.yml`.
