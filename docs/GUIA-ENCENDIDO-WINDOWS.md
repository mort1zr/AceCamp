# Encender y apagar AceCam en Windows — PCIT-163

Esta guía corresponde a la versión integrada de `panel_web/conexiones`. Para
analizar un archivo de video local no hace falta desplegar servicios, habilitar
facturación ni encender la API de importación de enlaces.

## 1. Qué necesita estar encendido

```text
Edge → Web → Emuladores: Auth + Firestore + Storage
                          ↕
                     Worker Python → Modelo → MP4 anotado y estadísticas
```

La web permite iniciar sesión y subir el archivo. Los emuladores guardan los
usuarios, jugadores, partidos y videos. El worker busca partidos en cola,
ejecuta el modelo, guarda el MP4 anotado y finaliza el partido como Listo o Error.
Encender solo la web no ejecuta el modelo.

Usaremos tres terminales de PowerShell, que deben permanecer abiertas. Un
proceso que sigue mostrando mensajes está funcionando; no necesita devolver
el cursor para que puedas usar la página.

## 2. Elegir la configuración correcta

| Componente | PC actual de Fabián | Configuración estándar del repositorio |
| --- | --- | --- |
| Web | 5176 | 5176 en esta guía |
| Auth | 9099 | 9099 |
| Firestore | **62810** | **8080** |
| Storage | 9199 | 9199 |
| Proyecto | `demo-acecam` | `demo-acecam` |

En el PC de Fabián se usa 62810 porque 8080 no estaba disponible. No mezcles
ambas columnas: web y worker deben apuntar al mismo Firestore.

Si la página y el worker ya están funcionando, no abras otro juego de procesos
en los mismos puertos. Puedes usar directamente la sección **Probar un video**.

## 3. Encendido cotidiano en el PC de Fabián

Las dependencias, el entorno Python y los pesos ya están preparados en este PC.
Los dos archivos auxiliares que se usan abajo existen en la carpeta de trabajo,
fuera del repositorio. Son particulares de este equipo; otro compañero debe
seguir la sección de configuración estándar.

### Terminal 1 — Emuladores

Abre PowerShell y ejecuta:

```powershell
$base = 'C:\Users\fabma\OneDrive\Documentos\ChatGPT\Proyecto de Carrera III'
Set-Location "$base\Proyecto_Carrera_III_Tenis\web"
$datos = Join-Path $base 'acecam-datos-local'
$argumentos = @(
  '.\node_modules\firebase-tools\lib\bin\firebase.js',
  'emulators:start',
  '--config', "$base\acecam-ensayo-88bd3f12.json",
  '--project', 'demo-acecam',
  "--export-on-exit=$datos"
)
if (Test-Path "$datos\firebase-export-metadata.json") {
  $argumentos += "--import=$datos"
}
node @argumentos
```

Espera a ver **All emulators ready** y confirma los puertos de la columna del PC
de Fabián. Deja esta terminal abierta.

`--import` recupera una exportación anterior si existe. `--export-on-exit` guarda
los datos cuando apagas correctamente los emuladores. La primera ejecución sin
exportación empieza vacía; no contiene automáticamente las cuentas del ensayo.

### Terminal 2 — Página web

Abre otra terminal:

```powershell
$base = 'C:\Users\fabma\OneDrive\Documentos\ChatGPT\Proyecto de Carrera III'
Set-Location "$base\Proyecto_Carrera_III_Tenis\web"
node "$base\acecam-ensayo-web.mjs"
```

Este auxiliar enciende Vite y conecta la web a Firestore 62810. No inicia la API
de enlaces. Abre en Edge **http://localhost:5176/login**.

### Terminal 3 — Worker del modelo

Abre otra terminal:

```powershell
$base = 'C:\Users\fabma\OneDrive\Documentos\ChatGPT\Proyecto de Carrera III'
Set-Location "$base\Proyecto_Carrera_III_Tenis\model"
$pythonWorker = "$base\acecam-worker-venv\Scripts\python.exe"
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:62810'
$env:STORAGE_EMULATOR_HOST = 'http://127.0.0.1:9199'
$env:YOLO_OFFLINE = 'true'
& $pythonWorker -u -m worker --project demo-acecam --bucket demo-acecam.appspot.com --device cpu
```

Debe aparecer **worker listo: proyecto demo-acecam**. No hace falta activar el
entorno con `Activate.ps1`: se está usando directamente su ejecutable Python.
Con la cola vacía puede permanecer sin mensajes nuevos; eso es normal.

Si se actualiza el código del modelo con Git, reinicia este proceso para que
cargue los cambios. La recarga de la web no reinicia Python.

## 4. Conservar el ensayo que ya está encendido

Los procesos que encendió el asistente pueden estar en segundo plano, sin una
terminal visible. No abras duplicados ni uses números de proceso de mensajes
antiguos para cerrarlos. Para pasarlos a un arranque manual puedes pedir que se
cierren los procesos de AceCam identificados antes de seguir el apartado 3.

**Antes de apagar por primera vez el ensayo actual**, exporta sus datos. Desde
una terminal adicional:

```powershell
$base = 'C:\Users\fabma\OneDrive\Documentos\ChatGPT\Proyecto de Carrera III'
Set-Location "$base\Proyecto_Carrera_III_Tenis\web"
node .\node_modules\firebase-tools\lib\bin\firebase.js emulators:export "$base\acecam-datos-local" --config "$base\acecam-ensayo-88bd3f12.json" --project demo-acecam
```

Espera la confirmación de exportación. Si el destino ya existe, revisa la
pregunta de sobrescritura: conservar una copia anterior en otra carpeta permite
volver a ella. No subas esta carpeta a Git: puede incluir cuentas y videos.
Las próximas veces, el comando del apartado 3 importará esta misma carpeta y
guardará al salir. Cerrar una instancia que no exporta puede perder los datos
que solo estaban en memoria, aunque el código siga en GitHub.

## 5. Probar un video

1. Inicia sesión. En el ensayo existente se usa la cuenta ficticia
   `coach@acecam.test`, contraseña `acecam123`. Solo funciona si los datos de esa
   cuenta están cargados o fueron importados.
2. Entra a **Jugadores** y elige uno de tus jugadores, o crea uno ficticio.
3. Abre **Analizar video**, selecciona **archivo local** y completa los campos.
4. Para la primera prueba usa un MP4 corto de 10–20 segundos, 1920×1080 a 30 FPS,
   con cámara fija detrás del fondo, cancha completa y juego continuo.
5. Indica dónde está el jugador al inicio: Arriba es el lado lejano a la cámara;
   Abajo es el cercano. Esto determina a quién se asignan las estadísticas.
6. Envía el formulario una sola vez y revisa el nuevo partido en la cola.
7. Espera **En cola → Procesando → Listo**. En CPU puede tardar varios minutos.
8. En **Partidos → Ver reporte**, revisa los indicadores y reproduce el video
   procesado. En el Dashboard selecciona el mismo jugador y el periodo correcto.

El worker comprueba hasta 60 segundos, al menos 1280 píxeles en el lado largo y
720 en el corto, y entre 25 y 60 FPS inclusive. Si rechaza el video, la cola de
**Analizar video** muestra el motivo. Para el ensayo usa 1080p/30 FPS. La subida
local admite MP4/MOV hasta 500 MiB. Para empezar conviene un clip pequeño.
Un archivo aceptado no garantiza buenas
detecciones si tiene primeros planos, cortes o no se ve toda la cancha.

El video anotado se genera y guarda antes de Listo. Un golpe sin velocidad
medible no se suma a «Golpes medidos»; cero no significa necesariamente que no
haya golpeado la pelota. Las métricas no calculadas se muestran Sin datos. Los
registros antiguos sin MP4 no obtienen un video automáticamente al reiniciar.

## 6. Apagar sin perder el avance

Espera a que termine cualquier análisis real en curso. Después:

1. En la terminal del worker: **Ctrl+C**.
2. En la terminal de la web: **Ctrl+C**.
3. En la terminal de emuladores: **Ctrl+C**, y espera que termine la exportación
   y el cierre. No cierres la ventana mientras está exportando.

Detener el worker a mitad de un análisis puede dejar el registro en Procesando;
reiniciarlo no implica que reclame automáticamente ese registro otra vez.
Las cuentas, videos y resultados del emulador son distintos del código: un
commit de Git no los guarda.

## 7. Otro PC: preparación y puertos estándar

Esta sección no necesita los auxiliares personales de Fabián. Usa Firestore
**8080** en todos los componentes. Si ese puerto no está disponible, no combines
estos comandos con el worker configurado a 62810: utiliza una configuración
coordinada de emuladores y web como la del apartado 3.

Preparación única:

- Node.js, npm, Java y Python compatibles con el proyecto. En el PC verificado:
  Node 24, npm 11 y Python 3.12; los emuladores se ejecutan con el Java instalado.
- Desde la carpeta del repositorio, cambia a conexiones y actualiza con el árbol
  limpio: `git switch panel_web/conexiones` y `git pull --ff-only origin panel_web/conexiones`.
- En `web`, ejecuta `npm ci`.
- Desde la raíz del repositorio, crea el entorno fuera de Git:

```powershell
py -3.12 -m venv ..\acecam-worker-venv
$pythonWorker = (Resolve-Path '..\acecam-worker-venv\Scripts\python.exe').Path
Set-Location model
& $pythonWorker -m pip install -r requirements-worker.txt
& $pythonWorker scripts/download_models.py --no-video
```

La instalación desde cero puede tardar y descargar varios cientos de MB. El
entorno ya verificado de Fabián usa `lap==0.5.14`; el archivo de requisitos fija
`0.5.13`. Si aparece un conflicto o falta una distribución compatible, revísalo
con el equipo antes de cambiar los requisitos. No reinstales el entorno de
Fabián para encenderlo: ya funciona. Esta guía no repitió una instalación limpia
en otro PC.

Para los arranques siguientes, desde `web` en terminales distintas:

```powershell
# Terminal 1: emuladores estándar.
$datos = Join-Path (Resolve-Path '..').Path 'firebase-export-local'
$argumentos = @('run', 'emulators', '--', "--export-on-exit=$datos")
if (Test-Path "$datos\firebase-export-metadata.json") {
  $argumentos += "--import=$datos"
}
npm @argumentos
```

```powershell
# Terminal 2: web para subir archivos locales, sin API de enlaces.
$env:VITE_USE_FIREBASE_EMULATORS = 'true'
npm run dev -- --host 127.0.0.1 --port 5176 --strictPort
```

En la terminal 3, desde `model`:

```powershell
$pythonWorker = '..\..\acecam-worker-venv\Scripts\python.exe'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
$env:STORAGE_EMULATOR_HOST = 'http://127.0.0.1:9199'
$env:YOLO_OFFLINE = 'true'
& $pythonWorker -u -m worker --project demo-acecam --bucket demo-acecam.appspot.com --device cpu
```

El comando de emuladores estándar también guarda y restaura una exportación
local. La carpeta `firebase-export-local` se excluye de Git por `.gitignore`.

### Datos iniciales y plan ficticio

En una instancia estándar nueva y vacía, `npm run seed` desde `web` crea las
cuentas ficticias. **Ese script borra usuarios y documentos de su emulador antes
de cargar ejemplos**: no lo ejecutes sobre un ensayo que quieras conservar. El
script actual usa Firestore 8080; no sirve para el ensayo de Fabián en 62810.

Otin ahora bloquea el panel a las cuentas sin plan. El seed crea organizaciones
`free`; el checkout simulado no las convierte en un plan real. Para pruebas
locales se puede asignar un plan ficticio Pro a `org-demo`. Desde `web`, elige
el puerto correcto y ejecuta únicamente contra el emulador:

```powershell
# Para el equipo estándar usa 8080; en el ensayo de Fabián sería 62810.
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
@'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
const allowed = ['127.0.0.1:8080', '127.0.0.1:62810']
if (!allowed.includes(process.env.FIRESTORE_EMULATOR_HOST)) throw new Error('Se exige el emulador local')
delete process.env.GOOGLE_APPLICATION_CREDENTIALS
const app = initializeApp({ projectId: 'demo-acecam' })
await getFirestore(app).doc('orgs/org-demo').update({ plan: 'pro' })
console.log('Plan ficticio del emulador actualizado; no hay cobro')
'@ | node --input-type=module -
```

Este cambio es solo un dato del emulador; no crea facturación ni una suscripción.
No es necesario repetirlo si ya tienes el plan ficticio y restauras tus datos.

La versión integrada incluye PCIT-41: el plan guardado en Firestore controla el
límite mensual real de la organización. `free` permite 0 análisis, `prueba` 15,
`basico` 30 y `pro` 150; `ultra` no tiene tope. Cambiar el «plan de vista» de la
interfaz no modifica ese límite. Si Analizar muestra que se llegó al límite,
revisa Configuración → Plan; no es un fallo del worker. Los reintentos de un
partido con Error no consumen otro análisis y borrar uno no devuelve la cuota.
Consulta [PCIT-41](PCIT-41-limite-de-analisis.md) para el detalle del contador.

## 8. Problemas frecuentes

| Qué ves | Qué comprobar |
| --- | --- |
| La página no abre | Terminal 2 encendida y dirección/puerto que imprimió Vite. |
| Puerto ocupado | Puede seguir encendida la instancia anterior. No abras duplicados ni cambies un solo componente de puerto. |
| La sesión no entra | Auth encendido, misma columna de puertos, cuenta cargada/importada. |
| Cuenta sin plan | Usa el plan ficticio local explicado arriba; el checkout no activa planes persistentes. |
| Límite mensual alcanzado | Revisa el plan real y contador en Configuración; el plan de vista no amplía la cuota. |
| Partido En cola | Terminal 3 encendida y apuntando al mismo Firestore/Storage que la web. |
| Procesando sin cambios visibles | Revisa el progreso en la terminal Python; la barra en la web aún es un pendiente de PCIT-159. |
| No existe el video | Un dato de ejemplo puede apuntar a un archivo que nunca se subió. Prueba una carga nueva. |
| Falta un `.pt` o `.pth` | Ejecuta `scripts/download_models.py --no-video` con el Python del worker. |
| `sha256 ... no coincide` | El archivo no es el original: no lo uses. Vuelve a descargarlo con `scripts/download_models.py --no-video --force`; si se repite, avisa al equipo (PCIT-166). |
| Error de FFmpeg | Comprueba que instalaste `requirements-worker.txt` en ese mismo entorno; incluye `imageio-ffmpeg`. |
| Ya hice pull pero usa el modelo anterior | Detén y vuelve a iniciar el worker. |
| npm run demo falla pidiendo ffprobe/yt-dlp | Ese comando enciende la API opcional de enlaces. Para archivos locales usa el arranque de esta guía. |
| Hay cero golpes o Sin datos | El análisis puede terminar sin medir todas las acciones; consulta las limitaciones del modelo. |

## 9. Qué se guarda en GitHub

Código, requisitos y esta guía están en Git. Entorno Python, pesos, videos,
archivos auxiliares personales, exportaciones y credenciales no lo están.
Cada integrante debe preparar su PC. Usa `panel_web/conexiones`; el PR de
integración se dirige a `panel_web/base`, según el acuerdo del equipo.
