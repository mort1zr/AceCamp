# PCIT-141 · API de importación y adaptador del navegador

Continuación de la base de PCIT-134 (`dcf9c68`). **En curso, sin despliegue ni
activación de enlaces reales.** API significa aquí un manejador de contrato
HTTP preparado: no hay todavía un servidor escuchando ni una función desplegada.

## Contrato HTTP

El alojamiento del equipo deberá montar `server/video-import/http.js` en una
ruta del mismo origen de la aplicación, por ejemplo `/api/video-import`.
Utiliza los estándares Web `Request` y `Response`, disponibles en Node 22+;
el adaptador del alojamiento debe conectar también la desconexión a la señal.

```http
POST /api/video-import
Authorization: Bearer <ID token Firebase>
Content-Type: application/json

{"url":"https://proveedor-admitido/partido.mp4","matchId":"intento-actual"}
```

Solo se aceptan `url` y `matchId`. Se rechazan campos adicionales como `orgId`,
`actorId` o `maxBytes`. Un token con sintaxis Bearer **no acredita identidad**:
el manejador lo pasa al núcleo, cuyo adaptador `authorize` debe verificarlo y
consultar la pertenencia a la organización en servidor.

```js
const securedImporter = createVideoImporter({
  authorize: async ({ bearerToken }) => {
    // Implementar con Firebase Admin y el esquema de Axel:
    // verificar token, resolver usuario/organización y rechazar acceso revocado.
    return verifyTokenAndOrganization(bearerToken)
  },
  store, download, probe, maxBytes,
})
const handle = createVideoImportHttpHandler({
  importVideo: securedImporter,
  origin: publicApplicationOrigin,
})
```

No montar un importador de demostración como `securedImporter`. El token nunca
se copia a los documentos de partido, a URL ni a respuestas. Se rechaza otro
origen, métodos distintos de POST, compresión y un cuerpo JSON superior a 8192
bytes, incluso sin Content-Length. Se cancelan cuerpos rechazados. El origen
permitido debe configurarse en servidor; HTTPS es obligatorio salvo localhost.
El adaptador del alojamiento debe reconstruir la URL pública de forma confiable.

Respuesta correcta: `200 {videoPath}` tras confirmación de persistencia. Los
errores llevan `{error:{code,message}}` con mensajes definidos, nunca excepciones
brutas del proveedor o del binario. Se usan 401/403 para sesión, 409 para conflicto,
413 para tamaño, 415 para formato, 422 para video no disponible, 429 para capacidad,
502 para fallos del servicio y 504 para timeout. El cuerpo JSON inválido produce
400 y un tipo de petición no admitido 415. Se deshabilita caché de las respuestas.

El límite HTTP total por defecto es 120 segundos y se propaga al núcleo. La
interrupción no deshace una persistencia ya confirmada: reintentar con el mismo
matchId debe recuperar su recibo. Las garantías duraderas siguen correspondiendo
al adaptador de Storage de PCIT-134; no se sustituyen con bloqueos en memoria.

## Conexión con Analizar

```js
const importVideo = createHttpVideoImporter({
  enabled: importApiVerified, // false hasta verificar el servicio real
  supportsYouTube: youtubeProviderVerified, // false hasta verificar también ese proveedor
  endpoint: '/api/video-import',
  origin: window.location.origin,
  getSession: readCurrentSessionWithIdToken,
})
const service = createFirestoreAnalysisService({
  db, orgId, actorId, uploadVideo, importVideo, maxBytes,
})
```

`readCurrentSessionWithIdToken({signal})` debe devolver
`{orgId, actorId, token}` a partir de la sesión actual. No proporciona credenciales
por constantes ni por parámetros del formulario. El adaptador comprueba que la
sesión siga coincidiendo con el servicio antes de enviar el token; el servidor
realiza sus propias comprobaciones de identidad y pertenencia.

El adaptador está deshabilitado por defecto y en ese caso devuelve `undefined`,
de modo que `supportsLinks` del servicio de análisis sigue siendo falso. Cuando
se habilite, solo admite una API del mismo origen, evita cookies y rechaza
redirecciones para no reenviar tokens a otro destino. Acota la respuesta JSON y
rechaza URL públicas o rutas inválidas como `videoPath`.

El soporte de YouTube requiere además la capacidad explícita `supportsYouTube`.
El proveedor preparado, sus formatos y límites se describen en
[YOUTUBE.md](../../../server/video-import/YOUTUBE.md). La comprobación sintáctica
del formulario nunca acredita disponibilidad pública ni descarga real.

Conserva el `matchId` del formulario para reintentos. Informa inicio (0) y
confirmación final (100), sin inventar porcentajes intermedios: todavía no hay
un canal de progreso en tiempo real. La cola existente espera a recibir la ruta
antes de crear `matches`. Los errores `import/*` ya tienen mensajes aptos para
el formulario de Analizar.

## Evidencia y pendientes

Pruebas de contrato sin red externa verifican cliente → manejador HTTP → cola
con SDK simulado: el partido no se crea antes de la respuesta válida, no se
guardan tokens/URL firmadas y los fallos de sesión o ruta impiden encolarlo.
También cubren cuerpos grandes, origen, sesión cambiada, cancelación y timeout.
No acreditan autenticación real, transferencia a Firebase ni ejecución del modelo.

Antes de Listo faltan: alojamiento/adaptación HTTP, verificación Firebase Admin,
cuotas por usuario/organización, Storage atómico, ffprobe real, verificación del
proveedor público de YouTube preparado y el recorrido con PCIT-35. Estas tareas siguen registradas en PCIT-141;
la demostración existente no se conecta a esta API ni descarga videos.

Referencias primarias: [Web Request](https://developer.mozilla.org/en-US/docs/Web/API/Request),
[señales combinadas](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static),
[política de redirecciones](https://developer.mozilla.org/en-US/docs/Web/API/Request/redirect).
