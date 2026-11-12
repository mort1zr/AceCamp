# PCIT-222 · Videos en Azure

Firebase Storage exige el plan Blaze, y el worker del modelo solo corre en el PC de
Fabián. Esta historia guarda y procesa los videos en **Azure for Students** (US$100,
sin tarjeta). Firebase se mantiene gratis para la web, el inicio de sesión, Firestore
y sus reglas.

```
Navegador ──► Firebase Hosting, Auth y Firestore                    (Spark, gratis)
    │
    └──► API de videos (Azure) ──► enlace temporal ──► Azure Blob Storage (videos)
            comprueba la sesión de Firebase                  ▲
            y el rol en Firestore                            │
                                                             │
         Worker (Azure Container Apps Job) ──────────────────┘
            toma los partidos "en cola" de Firestore, analiza y sube processed.mp4
```

## Infraestructura creada (región chilecentral)

| Recurso | Nombre | Notas |
| --- | --- | --- |
| Grupo de recursos | `acecam-rg` | Todo lo de AceCam en Azure |
| Almacenamiento | `acecamvideosfba600`, contenedor `videos` | Privado, solo HTTPS y TLS 1.2. CORS solo para la web y `localhost:5173`. Borrados recuperables 7 días |
| Entorno de contenedores | `acecam-env` | Para la API y el worker |
| Logs | `acecam-logs` | 30 días |
| Identidad de la API | `acecam-videos-api` (identidad administrada) | Storage Blob Data Contributor solo sobre `acecamvideosfba600`: firma los enlaces sin clave |
| API de videos | `https://acecam-videos-api.nicefield-b05d8187.chilecentral.azurecontainerapps.io` | Container App en `acecam-env`; ya permitida en la CSP de `firebase.json` |
| Identidad para GitHub | `acecam-github` (identidad administrada) | Sin contraseña (OIDC). Contributor solo en `acecam-rg`, y solo desde `main` o el entorno `production` |

La suscripción de estudiante solo permite las regiones `chilecentral`,
`brazilsouth`, `westus2`, `northcentralus` y `canadacentral`, y tiene **cuota 0 de
GPU** en las familias actuales (T4, A10): el modelo corre en CPU.

Variables del repositorio (no son secretas): `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
`AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_STORAGE_ACCOUNT`,
`AZURE_CONTAINERAPPS_ENV`.

## Prueba de concepto (PCIT-223)

### 1. Enlaces temporales para subir y ver videos

Código en `web/server/azure-videos/`:

| Archivo | Qué hace |
| --- | --- |
| `access.js` | Decide si una sesión puede subir o leer una ruta, con **las mismas condiciones que `firebase/storage.rules`** |
| `sas.js` | Firma enlaces temporales (SAS). En Azure, con la identidad de la app (*user delegation key*): **sin ninguna clave del almacenamiento**. En pruebas, con la cuenta pública de Azurite |
| `http.js` | `POST /api/videos/sign { path, operation }` con el token de Firebase. Responde el enlace (15 min para subir, 10 para leer) y los encabezados que debe enviar la subida |

Pruebas en `web/tests/azure/azureVideos.test.js`, contra **Azurite** (el emulador
oficial de Azure Storage) y los emuladores de Auth y Firestore. Corren dentro de
`npm run test:rules`:

| Caso | Resultado |
| --- | --- |
| El entrenador sube un video nuevo y lo vuelve a leer | ✅ |
| Antes de crear el partido, solo lo lee quien lo subió (o el admin) | ✅ |
| Partido creado: lo leen su entrenador y el admin; no otro entrenador ni otro club | ✅ |
| `processed.mp4` se lee, pero nadie lo sube desde la web | ✅ |
| Sin sesión o con token falso: 401 | ✅ |
| Rutas inventadas, campos extra, operaciones desconocidas y otros orígenes: rechazados | ✅ |
| Un enlace de lectura no sirve para escribir | ✅ |
| Un enlace caducado deja de funcionar | ✅ |

**Pendiente para PCIT-224:** un enlace SAS no limita el tamaño del archivo. La API
o el worker deben comprobar el tamaño (máximo 500 MB) y el tipo después de la subida.

### 2. El modelo en CPU

Medido con el video de ejemplo del modelo (`input_videos/input_video.mp4`: 7 s,
1080p, 30 fps, 214 fotogramas) y la configuración actual (`yolov8m` para los jugadores
y `yolo5_last` para la pelota), con PyTorch para CPU y el video anotado incluido. Los dos
análisis terminaron con estadísticas, informe y mapas de calor.

| CPU | Tiempo del video de 7 s | Por minuto de video | Un video de 60 s (límite actual del worker) |
| --- | --- | --- | --- |
| 4 vCPU | 156 s | 1312 s (~22 min) | ~22 min |
| 2 vCPU | 216 s | 1819 s (~30 min) | ~30 min |

`docs/videos-largos-y-fuentes.md` registraba ~12 min por minuto en un PC sin GPU. Esta
máquina es más lenta; en Azure Container Apps el resultado debería quedar entre ambas cifras.

**Costo estimado en Azure Container Apps** (consumo; precios de referencia, por confirmar
en la calculadora de Azure):

| Configuración | Por video de 60 s | Cuántos videos entran en la cuota gratis mensual (180 000 vCPU·s y 360 000 GiB·s) | Fuera de la cuota |
| --- | --- | --- | --- |
| 2 vCPU · 4 GiB | ~3 600 vCPU·s y ~7 300 GiB·s | **~49 videos al mes** | ~US$0,11 por video |
| 4 vCPU · 8 GiB | ~5 200 vCPU·s y ~10 500 GiB·s | ~34 videos al mes | ~US$0,16 por video |

### Conclusión

* **Viable con el límite actual de 60 s por video.** Cada análisis tarda unos 20–30 min en
  CPU y unos 50 videos al mes entran en la cuota gratis. Con el crédito de US$100 sobran
  cientos más.
* **Configuración recomendada para el worker:** Container Apps Job con **2 vCPU y 4 GiB**,
  que aprovecha mejor la cuota (4 vCPU es solo un 28 % más rápido y gasta más), un partido
  por ejecución (`--once`), cada 5 minutos, con un tiempo máximo de ejecución de 1 hora.
* **No es viable para partidos completos en CPU:** un partido de 1 h y media tardaría más
  de 30 horas. Para eso haría falta GPU, que la suscripción de estudiante no tiene, u
  optimizar el modelo para CPU (exportarlo a ONNX u OpenVINO, bajar la resolución,
  analizar uno de cada dos fotogramas). Sin medir todavía; queda como mejora futura.
* La web debe avisar que el análisis tarda unos 30 minutos.

## Puesta en marcha (PCIT-224, PCIT-225, PCIT-227)

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| API de videos | `web/server/azure-videos/` (`server.js`, `Dockerfile`) | Container App `acecam-videos-api` en `acecam-env`: 0,25 vCPU y 0,5 GiB, se apaga sin tráfico (0–2 réplicas). `GET /healthz` responde `ok` |
| Web | `web/src/panel/lib/azureVideos.js` | Con `VITE_VIDEO_API_URL`, sube y reproduce desde Azure. Sin ella, usa Firebase Storage (emuladores) |
| Despliegue | `.github/workflows/deploy-azure.yml` | En cada PR construye la imagen y comprueba que arranca. En `main` la publica en GitHub Packages (`ghcr.io/mort1zr/acecam-videos-api`), la despliega con la identidad `acecam-github` y comprueba la API en línea |

### Pasos de una sola vez

**1. Identidad de la API (Azure Cloud Shell, dueño de la suscripción).** Permite firmar
los enlaces sin ninguna clave del almacenamiento:

```bash
az identity create -g acecam-rg -n acecam-videos-api -o none
PID=$(az identity show -g acecam-rg -n acecam-videos-api --query principalId -o tsv)
SID=$(az storage account show -n acecamvideosfba600 -g acecam-rg --query id -o tsv)
az role assignment create --assignee-object-id $PID --assignee-principal-type ServicePrincipal --role "Storage Blob Data Contributor" --scope $SID -o none
az identity show -g acecam-rg -n acecam-videos-api --query "{id:id, clientId:clientId}" -o json
az containerapp env show -n acecam-env -g acecam-rg --query properties.defaultDomain -o tsv
```

**2. GitHub (mort1zr): Settings → Secrets and variables → Actions.**

| Tipo | Nombre | Valor |
| --- | --- | --- |
| Variables | `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_STORAGE_ACCOUNT`, `AZURE_CONTAINERAPPS_ENV` | Ver "Infraestructura creada" |
| Variable | `AZURE_VIDEOS_API_IDENTITY_ID` | El `id` del paso 1 |
| Variable | `AZURE_VIDEOS_API_IDENTITY_CLIENT_ID` | El `clientId` del paso 1 |
| **Secreto** | `FIREBASE_SERVICE_ACCOUNT_AZURE` | JSON de una cuenta de servicio de Firebase **nueva**, solo con el rol *Lector de Cloud Datastore* (`roles/datastore.viewer`): la API solo lee Firestore. El worker (PCIT-226) tendrá su propia cuenta, con escritura |
| Variable | `VITE_VIDEO_API_URL` | `https://acecam-videos-api.nicefield-b05d8187.chilecentral.azurecontainerapps.io`. **Se crea al final** (paso 4), cuando `/healthz` responda `ok` |

**3. Primer despliegue.** Al fusionar en `main`, `deploy-azure.yml` publica la imagen y
crea la API. La primera vez, el paquete `acecam-videos-api` de GitHub Packages queda
privado y Azure no puede descargarlo: en GitHub → Packages → `acecam-videos-api` →
Package settings, cambiarlo a **Public** (la imagen no contiene secretos) y volver a
ejecutar el workflow.

**4. Activar en la web.** La CSP de `firebase.json` ya permite la API y el almacenamiento.
Cuando `https://acecam-videos-api.nicefield-b05d8187.chilecentral.azurecontainerapps.io/healthz`
responda `ok`, crear la variable `VITE_VIDEO_API_URL` y volver a ejecutar "Deploy web".
El siguiente despliegue de la web sube los videos a Azure.

Si falta algo, `deploy-azure.yml` no despliega y deja un aviso, como `deploy-web.yml`.

## Worker del modelo en Azure (PCIT-226)

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| Almacenamiento | `model/worker/firebase_backend.py` (`AzureBlobVideos`) | Descarga el video y sube `processed.mp4` en Azure Blob con la identidad administrada, sin claves. Rechaza videos vacíos o de más de 500 MB antes de descargarlos |
| Arranque | `model/worker/__main__.py` | Con `AZURE_STORAGE_ACCOUNT` usa Azure; si no, Firebase Storage. **Solo carga el modelo si hay un partido**: con la cola vacía termina en segundos y casi no gasta crédito. Lee la cuenta de servicio de `FIREBASE_SERVICE_ACCOUNT` |
| Imagen | `model/Dockerfile` | Python 3.11 y PyTorch para CPU. Pesos del modelo **verificados con sha256 en modo estricto** (se registraron los de `yolo5_last.pt` y `keypoints_model.pth`). Usuario sin privilegios |
| Despliegue | `deploy-azure.yml` (`imagen-worker`, `desplegar-worker`) | Publica `ghcr.io/mort1zr/acecam-worker` y crea la tarea programada `acecam-worker`: **cada 5 minutos, 2 vCPU y 4 GiB, máximo 1 hora**, `--once` |

El worker usa la misma identidad que la API (`acecam-videos-api`), que ya tiene permiso
sobre los videos. Para Firestore necesita **escribir** (cambia el estado del partido y
guarda las estadísticas), así que usa una cuenta de servicio propia.

### Paso de una sola vez: cuenta de servicio del worker

En Google Cloud Shell (console.cloud.google.com → `>_`):

```bash
gcloud config set project acecam-e93a2
gcloud iam service-accounts create azure-worker --display-name="Worker del modelo en Azure (lee y escribe Firestore)"
gcloud projects add-iam-policy-binding acecam-e93a2 --member="serviceAccount:azure-worker@acecam-e93a2.iam.gserviceaccount.com" --role="roles/datastore.user" --condition=None -q > /dev/null && echo "Rol asignado"
gcloud iam service-accounts keys create clave.json --iam-account=azure-worker@acecam-e93a2.iam.gserviceaccount.com && echo "Clave creada"
```

Descargar `clave.json` (⋮ → Descargar), pegar **todo** su contenido en GitHub → Settings →
Secrets and variables → Actions → **Secrets** → `FIREBASE_SERVICE_ACCOUNT_WORKER`, y borrar la
clave (`rm clave.json`) de Cloud Shell y del equipo. Nunca pegarla en un chat.

Sin ese secreto, `deploy-azure.yml` publica la imagen pero no despliega el worker y deja un aviso.

### Costo

Con la cola vacía, cada ejecución dura unos segundos. Analizar un video de 60 s cuesta unos
30 min de 2 vCPU, y unos 49 videos al mes entran en la cuota gratuita (ver la medición de PCIT-223).
Si dos partidos llegan seguidos, cada ejecución toma uno distinto: el reclamo en Firestore es
una transacción.
