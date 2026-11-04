# PCIT-134 · núcleo de importación por enlace

Código exclusivo de **servidor Node.js**. No se importa desde React, no abre un
puerto y no está habilitado en producción. Permite avanzar la descarga y
validación sin sustituir Firebase/Auth/Storage de Axel ni el worker de Aaron.

La continuación PCIT-141 agrega `http.js`, manejador Web Request → Response,
y el adaptador de navegador. Su contrato, activación y pendientes se describen
en [VIDEO_IMPORT_HTTP.md](../../src/lib/services/VIDEO_IMPORT_HTTP.md).
Todavía no se monta ni despliega una API real.
El proveedor de YouTube preparado en la misma tarea se detalla en
[YOUTUBE.md](YOUTUBE.md), con sus requisitos de ejecución y verificación pendiente.

## Alcance disponible

- `download.js`: descarga en streaming de HTTPS directo a MP4/MOV, con lista
  explícita de hosts del servidor. Cada redirección comprueba de nuevo
  host, protocolo, puerto y DNS. Rechaza direcciones no públicas, incluso respuestas
  DNS mixtas y direcciones IPv4 privadas dentro de IPv6. Conecta a una IP ya
  validada, sin otra resolución ni reutilización de sockets; mantiene la validación
  TLS normal del hostname original.
- Rechaza credenciales, fragmentos, IP literales, compresión HTTP, páginas HTML,
  estados distintos de 200 y demasiadas redirecciones. No reenvía cookies ni
  cabeceras de autorización del usuario al proveedor.
- Cuenta bytes reales y calcula SHA-256 en streaming. El límite lo configura el
  servidor, nunca el formulario. Comprueba Content-Length si está presente, pero
  no confía solo en él. Acota el tiempo de DNS, conexión y cuerpo; permite cancelar.
- `probe.js`: adaptador a un **ffprobe instalado por el equipo**, mediante ruta
  absoluta y sin shell. Solo admite archivos locales y el demuxer MOV; desactiva
  referencias a pistas externas y rutas absolutas dentro del contenedor. Verifica
  marca de MP4/MOV, duración positiva y una pista de video con dimensiones; un
  audio con carátula no sirve. No constituye una decodificación completa del video.
- `importer.js`: exige autorización de servidor, limita concurrencia, comprueba
  el tamaño local, llama al probe y solo devuelve una ruta tras recibir un recibo
  persistido. Elimina sus temporales en éxito, error o cancelación. Verifica el
  destino absoluto antes de la limpieza. No escribe `matches` ni encola archivos
  incompletos.

Se aceptan marcas de contenedor `isom`, `iso2`…`iso9`, `avc1`, `mp41`, `mp42`,
`M4V`, `MSNV`, `dash` y `qt`. Contenedores sin marca o de otra familia, como 3GP,
quedan rechazados. Esta lista debe contrastarse con los videos reales del equipo.

## Contrato de integración propuesto (aún por acordar)

```js
import { createPublicVideoDownloader } from './download.js'
import { createLocalVideoProbe } from './probe.js'
import { createVideoImporter } from './importer.js'

const importVideo = createVideoImporter({
  // Datos de configuración de servidor, NO procedentes del cuerpo de una petición:
  authorize, store, maxBytes,
  download: createPublicVideoDownloader({ allowedHosts }),
  probe: createLocalVideoProbe({ executable: absoluteFfprobePath }),
})

const videoPath = await importVideo({
  url, matchId, requestContext, signal,
  onProgress: ({ bytes, totalBytes }) => {},
})
```

Usar Node 22 o posterior; pruebas locales ejecutadas en Node 24.16.0. No hay
hosts de producción ni tamaño máximo predeterminados. La configuración no
admite comodines en hosts exactos. Para las URL efímeras del proveedor YouTube,
su transporte interno admite únicamente subdominios de googlevideo.com mediante
una política de sufijo con límite de etiqueta, además de comprobar DNS/IP en cada
conexión. La entrada directa mantiene hosts exactos y exige extensión MP4/MOV.

`authorize(requestContext)` debe verificar el token de Firebase y la pertenencia
actual a una organización en servidor y devolver `{orgId, actorId}`. No basta con
leer esos campos del JSON del navegador ni con decodificar un JWT sin verificarlo.
Se ejecuta también al reintentar una importación ya completada.

El adaptador `store` es obligatorio y todavía **no está implementado contra
Firebase**:

- `find({orgId, actorId, matchId})`: devuelve un recibo completo o null. La clave
  de unicidad es organización + partido, sin permitir sobrescrituras por otro UID.
- `putIfAbsent({orgId, actorId, matchId, sourceHash, localPath, bytes, sha256,
  metadata, signal})`: verifica la ruta de la organización, transfiere el archivo
  y confirma la persistencia antes de devolver el recibo. `metadata` contiene
  duración, dimensiones, extensión y MIME verificados. Debe resolver carreras
  **entre procesos** con precondiciones/transacciones, impedir sobrescrituras,
  verificar el checksum y aplicar un tiempo máximo a la transferencia. Ante un
  fallo debe limpiar cargas parciales; un error al confirmar debe ser recuperable
  mediante `find`. Los tests actuales no prueban estas garantías de Firebase.
- Recibo: `{orgId, actorId, matchId, sourceHash, videoPath}`. Solo se devuelve la
  ruta cuando coinciden identidad, partido y huella. `videoPath` es una ruta de
  Storage, no una URL pública. No debe contener la URL de origen ni sus tokens.

La huella de origen usa SHA-256 de la URL recortada; se usa para identificar un
reintento y **no reemplaza** el checksum del archivo. Cambiar una URL firmada exige
un intento nuevo. El bloqueo en memoria solo evita trabajo concurrente dentro
del proceso: la garantía duradera corresponde al adaptador atómico de Storage.

La capa HTTP preparada en PCIT-141 extrae el token al contexto de servidor,
propaga cancelación y mapea errores `import/*`. El alojamiento pendiente debe
conectar la desconexión y limitar peticiones por usuario y organización. Nunca
registrar URL firmadas, tokens o errores brutos de red/ffprobe. El adaptador del
navegador sigue deshabilitado hasta verificar la integración; no importa módulos
de `server/`.

## Pruebas y límites

Desde `web`: `npm test -- server/video-import`. Las pruebas utilizan streams y
archivos temporales reales, con DNS/HTTPS, autorización, Storage y ejecución de
ffprobe simulados. Verifican límites, destinos, redirecciones, cancelación,
limpieza, reintentos, identidades y parsing de los resultados multimedia.

No descargan videos externos, no prueban TLS contra un proveedor real y no
acreditan permisos de Firebase, persistencia atómica en la nube ni ejecución real
del binario multimedia. ffprobe no está instalado en el entorno revisado; esta
entrega no lo descarga ni ejecuta binarios de terceros.

## Pendiente antes de Listo

1. Acordar con Axel el alojamiento, Auth, adaptador atómico de Storage, rutas,
   límites, hosts, cuotas y configuración de ffprobe (PCIT-20/21/22/23/24).
2. Montar y verificar API + adaptador de navegador preparados por PCIT-141,
   errores y progreso. Mantener enlaces deshabilitados en producción hasta
   verificar ese recorrido.
3. Instalar/configurar y verificar el proveedor de **YouTube** preparado por
   PCIT-141, incluyendo errores de disponibilidad y límites reales. El transporte
   directo rechaza páginas YouTube; el selector de origen usa el resolver dedicado.
   No se presenta una prueba con metadatos simulados como una importación real.
4. Verificar con un MP4 y un MOV reales, Firebase/emulador y el worker de PCIT-35,
   hasta `matches` y Dashboard. Los ejemplos de `/analizar.html` siguen sin
   transferir archivos ni enlaces.

PCIT-134 permanece **En curso** mientras no se compruebe el alcance completo.
Por acuerdo con Fabián, la base probada se publica en el único commit de PCIT-134
y su completación se registra como otra Tarea del Sprint 1 en Jira. Esa tarea
reutilizará esta base y tendrá su propio commit; no se reescribirá el historial
publicado. Publicar este avance no habilita la importación en producción.

Referencias técnicas primarias:
[HTTPS de Node](https://nodejs.org/api/https.html),
[DNS de Node](https://nodejs.org/api/dns.html),
[streams de Node](https://nodejs.org/api/stream.html),
[ipaddr.js](https://github.com/whitequark/ipaddr.js),
[ffprobe](https://ffmpeg.org/ffprobe.html) y
[demuxer MOV](https://ffmpeg.org/ffmpeg-formats.html#mov_002fmp4_002f3gp).
