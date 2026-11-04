# Vídeos largos y nuevas fuentes de vídeo · plan de cambios

**Para quién:** todo el equipo y sus agentes de código. Léelo antes de tocar
**Analizar video**, el **formulario de postulación**, `web/server/video-import/`,
las **reglas de Storage o Firestore**, el **esquema** o el **worker** (`model/worker/`).

**Responsable del documento:** Aaron · **Relacionado:** PCIT-146 (vídeos largos), PCIT-147
(requisitos y límite de duración), PCIT-27, PCIT-54, PCIT-134, PCIT-141, PCIT-22, PCIT-24,
PCIT-125, PCIT-130.

## Objetivo

La plataforma debe aceptar **vídeos cortos, largos y partidos completos**, desde varias
fuentes: un archivo, **varios archivos a la vez**, un enlace directo, un enlace de **YouTube**
y un **archivo o carpeta de Google Drive**.

## Instrucciones para agentes

1. **No cambies los contratos de la sección "Lo que no cambia"** sin actualizar a la vez
   `docs/firestore-schema.md`, `web/src/panel/lib/schema.js` y avisar en Jira a Axel (esquema)
   y a Aaron (worker).
2. **Cada cambio de esta guía tiene un responsable.** Si tu tarea no es de tu área, deja la
   parte ajena como pendiente en tu PR; no la implementes por tu cuenta.
3. **Los límites (duración y tamaño) se definen en un solo sitio por capa** y deben coincidir
   entre web, reglas de Storage y worker (ver cambio A). No escribas números sueltos en el código.
4. **Nunca guardes ni registres** URL firmadas, tokens, claves de API ni la URL de origen dentro
   de `matches` (ya lo exigen PCIT-134 y PCIT-141).
5. Antes de abrir la PR, ejecuta los tests de tu carpeta (`web`: `npm test` y
   `npm run test:rules`; `model`: `python -m pytest -q` y `ruff check .`).

---

## Estado actual (noviembre 2026)

| Pieza | Estado |
| --- | --- |
| **Memoria del modelo** | Desde PCIT-146 el vídeo se procesa fotograma a fotograma: la memoria **no depende de la duración**. Antes, un vídeo de más de ~1 min a 1080p agotaba la RAM. |
| **Velocidad del modelo** | Medida en un PC sin GPU con el detector por defecto, `yolov8m`: **~12 min de proceso por cada minuto de vídeo**. Con `yolov8x` eran ~19 min. Con GPU (T4) se estima ~1–1,5 h por hora de partido (por confirmar en Colab). |
| **Límite de duración en el worker** | `worker.max_duration_seconds` en `model/config.yaml` (hoy **60 s**). Si un vídeo lo supera, el partido pasa a `error` con un mensaje para el usuario, antes de analizarlo. |
| **Límite de tamaño** | **500 MB** en `MAX_VIDEO_BYTES` (`web/src/panel/lib/videoUpload.js`) y en `firebase/storage.rules`. |
| **Subida de archivos** | Un archivo por partido (PCIT-27). |
| **Importación por enlace** | Núcleo de servidor preparado y probado (`web/server/video-import/`, PCIT-134 y PCIT-141): enlaces directos MP4/MOV y proveedor de YouTube con `yt-dlp`. **Desactivado**, a falta de alojamiento, Auth, Storage, `ffprobe` y `yt-dlp` reales. |
| **Tipo de vídeo que entiende el modelo** | Cámara fija detrás de la línea de fondo, con la pista completa a la vista. Los cortes de cámara y repeticiones de TV llegan con PCIT-59, y la división en puntos con PCIT-60. |

## Decisiones tomadas

1. **El vídeo siempre se guarda primero en Storage** (`orgs/{orgId}/matches/{matchId}/video.{mp4|mov}`)
   y solo después se crea el partido `en cola`. Esto vale para todas las fuentes, YouTube y Drive incluidos.
   **No se analiza en streaming desde YouTube ni desde Drive**, por cuatro motivos:
   - los enlaces de YouTube caducan en unas horas, y un partido largo tarda más;
   - si el análisis falla, se puede reintentar sin volver a descargar;
   - el worker no cambia, porque sigue leyendo `videoPath`;
   - la caché de detecciones necesita el archivo.
2. **Un vídeo = un partido** (`matches/{matchId}`). Varios archivos o una carpeta generan varios
   partidos, cada uno con su propio `matchId`, estado y reintento.
3. **YouTube:** `PRODUCT.md` lo da como confirmado y el proveedor ya está preparado (PCIT-141).
   Sigue sin activarse en producción hasta verificarlo. **Riesgo conocido:** las condiciones de YouTube
   no permiten descargar vídeos fuera de su servicio, y YouTube suele bloquear las descargas desde
   servidores en la nube. Hay que validarlo con el docente antes de anunciarlo en la landing.
4. **OneDrive queda fuera por ahora.** Microsoft exige cada vez más una cuenta para leer carpetas
   compartidas. Se puede revisar después de Drive.
5. **`playerPosition` sigue significando "dónde está el jugador en el primer cuadro del vídeo".**
   El cambio de lado durante un partido completo lo resuelve el modelo (cambio F). La web no cambia.

---

## Cambios

### A. Límite de duración y tamaño unificados (Fabian, Axel, Aaron)

**Problema:** hoy el worker corta en 60 s, la web no comprueba la duración y el tamaño máximo es
de 500 MB. A 1080p, un móvil graba unos **60–100 MB por minuto**, así que 500 MB son unos
**5–8 minutos**. Con eso no entra un partido completo.

**Cambio:**

| Dónde | Qué | Responsable |
| --- | --- | --- |
| `web/src/panel/lib/schema.js` | Nueva constante `MAX_VIDEO_SECONDS`, única fuente para la web | Axel |
| `web/src/panel/lib/videoUpload.js` y `firebase/storage.rules` | Subir `MAX_VIDEO_BYTES` al valor acordado, **en los dos a la vez**, con sus tests de reglas | Axel |
| Analizar (PCIT-27) y Postulación (PCIT-54) | Leer la duración en el navegador (`<video>` + `loadedmetadata`) y rechazar los que superen `MAX_VIDEO_SECONDS`, con el mensaje de PCIT-147 | Fabian (Analizar) y Axel (Postulación) |
| `web/server/video-import/` | Tras `ffprobe`, rechazar por duración con el mismo límite (nuevo código `import/too-long`) | Fabian |
| `model/config.yaml` | `worker.max_duration_seconds` con el mismo valor | Aaron |

**Valores propuestos (pendientes de acordar):**

| Fase | Duración máxima | Tamaño máximo | Cuándo |
| --- | --- | --- | --- |
| 1. Worker en CPU o Colab | 15 min | 1,5 GB | Al terminar PCIT-146 |
| 2. Worker con GPU (cambio G) | 3 h | 15 GB | Cuando el worker corra en una máquina con GPU |

**Texto de requisitos (sustituye al de PCIT-147):**

- cámara fija detrás de la línea de fondo, con la pista completa a la vista;
- sin montaje ni música; si es una transmisión de TV, las repeticiones se descartan solas
  (cuando esté PCIT-59);
- hasta **{MAX_VIDEO_SECONDS en texto}** y **{MAX_VIDEO_BYTES en texto}**;
- MP4 o MOV, 720p o 1080p (un vídeo largo a 720p ocupa la mitad y se sube antes).

**Criterios de aceptación:**

- web, servidor de importación y worker rechazan un vídeo de duración máxima + 1 s, cada uno con
  un mensaje apto para el usuario;
- cambiar el límite exige tocar **un solo valor por capa**.

### B. Subir varios vídeos a la vez (Fabian)

**Dónde:** `web/src/panel/pages/Analizar.jsx`, `web/src/panel/lib/services/firestoreAnalysisService.js`
y `videoUpload.js`.

**Cómo funciona:**

1. El selector de archivos acepta varios archivos (`<input type="file" multiple accept="video/mp4,video/quicktime">`),
   hasta **10 por envío**.
2. Se muestra una tabla con **una fila por archivo**:
   - nombre, duración leída en el navegador y tamaño;
   - jugador, `playerPosition`, rival, fecha y torneo.
   La primera fila se copia a las demás con un botón "Usar los mismos datos para todos", y cada
   fila se puede editar.
3. Antes de subir, cada fila se valida con las mismas reglas que hoy (incluido el cambio A).
   Los archivos inválidos se marcan y no bloquean a los demás.
4. Cada fila tiene **su propio `matchId` e `inputFingerprint`**. Sube por separado (como máximo
   2 subidas en paralelo), crea su `matches/{matchId}` en `en cola` al terminar y se puede
   reintentar sola.
5. La cola de la pantalla muestra cada vídeo como una fila independiente.

**Criterios de aceptación:**

- 3 archivos válidos y 1 inválido crean 3 partidos `en cola` y muestran el error del cuarto;
- cancelar o fallar una subida no afecta a las otras;
- recargar a mitad de un envío no deja partidos sin vídeo, porque la regla actual (primero el
  vídeo, después el partido) se mantiene.

### C. Vídeo o carpeta de Google Drive por enlace (Fabian, Axel)

Es un **nuevo proveedor** dentro de `web/server/video-import/`, igual que `youtube.js`. Reutiliza
la descarga, la validación con `ffprobe`, el almacenamiento atómico y la API de PCIT-134 y PCIT-141.
No crea un camino paralelo.

**Enlaces admitidos:**

- un archivo: `https://drive.google.com/file/d/{fileId}/...`;
- una carpeta: `https://drive.google.com/drive/folders/{folderId}`.

En ambos casos, el elemento debe estar compartido como **"Cualquier persona con el enlace"**.

**Cómo funciona:**

1. **Archivo:** el servidor extrae `fileId` y descarga con la API de Drive v3
   (`GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media&key=…`).
   Después sigue el flujo normal de importación: `ffprobe`, Storage y `videoPath`.
2. **Carpeta**, en dos pasos:
   1. **Listar:** nuevo endpoint `POST /api/video-import/list` con `{ url }`.
      - El servidor llama a `files.list` con
        `q="'{folderId}' in parents and trashed=false and (mimeType='video/mp4' or mimeType='video/quicktime')"`
        y `fields=files(id,name,mimeType,size,videoMediaMetadata(durationMillis,width,height))`.
      - Devuelve como máximo **20 vídeos**: `[{ fileId, name, sizeBytes, durationSeconds }]`.
      - Ignora subcarpetas y archivos que no son vídeo.
   2. **Elegir:** la web muestra la lista con la misma tabla del cambio B. El usuario quita los
      que no quiere y completa los datos de cada uno.
   3. **Importar:** cada vídeo elegido se importa como un archivo de Drive, con su propio
      `matchId`, usando la API de importación de siempre. Al terminar cada uno, se crea su
      partido `en cola`.

**Requisitos de servidor:**

- **Clave de API de Google** solo en el servidor (variable de entorno), restringida a la API de
  Drive. Nunca en el navegador ni en el repositorio.
- **Hosts permitidos:** `www.googleapis.com`. Verificar si la descarga redirige a
  `*.googleusercontent.com` y, si es así, añadirlo con la misma política de sufijo que
  `googlevideo.com`.
- **Por verificar con archivos reales:**
  - archivos antiguos compartidos por enlace que exigen la cabecera `X-Goog-Drive-Resource-Keys`;
  - archivos grandes;
  - errores de cuota de la API.
- **Errores nuevos con mensaje para el usuario:**
  - `import/drive-private`: la carpeta o el archivo no está compartido con "Cualquier persona con
    el enlace";
  - `import/drive-empty`: no hay vídeos MP4 o MOV;
  - `import/drive-too-many`: hay más de 20 vídeos.

**Esquema (Axel):** sin campos nuevos en `matches`. No se guarda el enlace de Drive, igual que
no se guarda el de YouTube.

**Criterios de aceptación:**

- una carpeta pública con 3 vídeos y 1 PDF lista solo los 3 vídeos;
- importar 2 de ellos crea 2 partidos `en cola`, con su vídeo en la ruta de Storage de siempre;
- una carpeta privada muestra el mensaje de `import/drive-private`.

### D. YouTube: activar lo ya preparado (Fabian, Axel)

No hay código nuevo del modelo. Para activarlo:

1. Completar los pendientes de `web/server/video-import/YOUTUBE.md`: alojamiento, `yt-dlp` y
   `ffprobe` instalados, Auth y Storage reales.
2. Aplicar el límite de duración del cambio A: el proveedor ya obtiene la duración antes de
   descargar, así que debe rechazar el vídeo ahí.
3. Validar con el docente el riesgo de las condiciones de uso (decisión 3) antes de anunciarlo.
4. Mientras YouTube bloquee las descargas desde el alojamiento, mostrar el error
   `import/youtube-service` y sugerir subir el archivo o usar Drive.

### E. Progreso del análisis (Aaron, Axel, Rolando)

Un partido largo tarda horas. Sin un progreso visible, el usuario cree que se colgó.

**Esquema (Axel):** nuevo campo en `matches`, que **solo escribe el worker** (las reglas deben
impedir que la web lo modifique):

| Campo | Tipo | Notas |
| --- | --- | --- |
| `progress` | object \| null | `null` mientras está `en cola` |
| `progress.stage` | `'descargando'` \| `'analizando'` \| `'calculando'` | Paso actual |
| `progress.percent` | number 0–100 | Entero |
| `progress.updatedAt` | Timestamp | |

**Worker (Aaron):**

- actualiza `progress` como mucho **cada 30 s o cada 5 %** (para no gastar escrituras de Firestore);
- lo deja en 100 al pasar a `listo`;
- lo borra (`null`) al pasar a `error` o volver a `en cola`.

**Web (Rolando, PCIT-125):** la cola de Inicio muestra la barra y el paso. Si `updatedAt` tiene
más de 10 minutos, muestra "Sin novedades del análisis".

### F. Partidos completos: cambio de lado de los jugadores (Aaron)

Solo afecta al modelo; la web no cambia.

- **Problema:** en un partido completo, los jugadores cambian de lado tras cada juego impar. Hoy
  el modelo numera a los jugadores por lado ("lejano" y "cercano"), así que en un partido
  completo las estadísticas de los dos se mezclarían.
- **Cambio en el modelo:**
  - detectar los cambios de lado, que ocurren en las pausas entre juegos y con PCIT-60;
  - mantener quién es quién con el color de la ropa (histograma de la caja del jugador);
  - `playerPosition` (primer cuadro) sigue indicando quién es el jugador registrado.
- **Hasta que esté hecho:** los vídeos de más de unos 15 minutos pueden mezclar a los jugadores.
  El texto de requisitos lo indicará.

### G. Worker en una máquina con GPU (Aaron, Axel)

- **Por qué hace falta:** Colab no sirve para tenerlo siempre encendido, y en CPU un partido de
  1 h tarda unas 19 h.
- **Qué hace falta:** una máquina con GPU (por ejemplo, una VM de Google Cloud con una T4) que
  ejecute `python -m worker` como servicio.
- **Configuración:**
  - credenciales de una cuenta de servicio, nunca en el repositorio;
  - variables `FIREBASE_PROJECT_ID` y `FIREBASE_STORAGE_BUCKET`;
  - `--device cuda:0`;
  - disco suficiente para el vídeo más grande (cambio A).
- **Velocidad:** `model/config.yaml` ya usa `yolov8m`. Para partidos completos se puede añadir
  `detection.player_every_n_frames: 2` (un 8 % más rápido en CPU, con la distancia recorrida
  algo más baja).
- Al tenerla, pasar a la **fase 2** de límites (cambio A).

### H. Privacidad (Rolando, PCIT-130)

Los Términos y la Política de privacidad (Ley 29733) deben indicar:

- que los vídeos se pueden importar desde **YouTube y Google Drive**;
- que se **descargan y guardan** en AceCam para analizarlos;
- quién puede verlos;
- cómo se borran.

Muchos vídeos serán de menores: el consentimiento de `players.consent` se sigue exigiendo para
cualquier fuente.

---

## Lo que no cambia

- Ruta del vídeo: `orgs/{orgId}/matches/{matchId}/video.{mp4|mov}`.
- **El partido se crea solo cuando el vídeo ya está en Storage.**
- Ciclo de estados `en cola → procesando → listo | error`. Solo el worker escribe `procesando`,
  `listo`, `error`, `statistics` (y `progress`, cambio E).
- `matches.statistics` sigue con `schemaVersion: 'acecam.match-stats.v1'`. Los datos nuevos del
  modelo (saques, botes, puntos) se acordarán aparte con Axel.
- No se guardan en Firestore URL de origen, URL firmadas ni tokens.

## Orden recomendado

| # | Cambio | Depende de |
| --- | --- | --- |
| 1 | A. Límites (fase 1) | PCIT-146 (hecho en local, pendiente de subir) |
| 2 | B. Varios archivos | A |
| 3 | E. Progreso | Esquema de Axel |
| 4 | C. Drive | Alojamiento de la API de importación (PCIT-141) |
| 5 | D. YouTube | Lo mismo que C, más la validación del docente |
| 6 | G. Worker con GPU y fase 2 de límites | Máquina con GPU |
| 7 | F. Cambio de lado | PCIT-60 (dividir en puntos) |

## Decisiones pendientes

- [ ] Valores finales de duración y tamaño de las fases 1 y 2 (cambio A).
- [ ] Si los vídeos de un mismo partido divididos en varios archivos deben agruparse en el
      Dashboard. Hoy cuentan como partidos distintos.
- [ ] Visto bueno del docente sobre YouTube (decisión 3).
- [ ] Dónde se aloja la API de importación y el worker con GPU, y su coste.
