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

<!-- resultados de la medición -->
