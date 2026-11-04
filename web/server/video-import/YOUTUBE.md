# PCIT-141 · proveedor de videos públicos de YouTube

Implementación preparada y probada con fixtures. **Sin instalación del extractor,
descarga de videos reales ni activación en producción.** Sigue pendiente verificar
el proveedor en el alojamiento acordado con Axel, junto con Auth, Storage y ffprobe.

## Entrada y disponibilidad

`src/panel/lib/videoSources.js` extrae un único ID de 11 caracteres desde enlaces HTTPS
watch, youtu.be, shorts, embed o live de los hosts exactos admitidos. Quita parámetros
de seguimiento, tiempo y lista al construir la URL canónica para consultar metadatos.
Un enlace watch con lista se limita al video indicado; una playlist sin video,
canal, host parecido, ID ambiguo o URL con credenciales se rechaza. Reconocer la
sintaxis no demuestra que el video exista, sea público o pueda descargarse.

`createYtDlpResolver` en `youtube.js` prepara la consulta mediante un ejecutable
yt-dlp oficial previamente instalado y configurado por ruta absoluta, con Node 22+
y EJS compatibles. Obtiene JSON en modo simulación; el extractor **no descarga
el archivo de video**. No carga configuración, plugins, cookies de archivo o
navegador ni componentes remotos. El entorno del proceso se reduce a rutas de
las herramientas y variables básicas del sistema, sin credenciales Firebase ni
proxies heredados. Usa argumentos separados, sin shell; nunca construye un comando
desde el texto introducido por el usuario.

La consulta tiene un máximo de 30 segundos y 2 MiB de salida. Solo acepta el ID
esperado del extractor Youtube, disponibilidad explícita `public`, video ya
terminado y un único MP4 HTTPS con pista de video. Los no listados, restringidos,
miembros, privados y disponibilidad desconocida quedan excluidos en esta versión.
También se rechazan transmisiones activas/programadas, DRM, audio solo y formatos
que requieren combinar varios archivos o descargar fragmentos. Un MP4 de solo
video es válido para el análisis; no se promete conservar audio ni una resolución.

Se reduce la información a ID, URL efímera del archivo, duración y tamaño conocido.
No se guardan títulos, cookies, cabeceras ni el JSON completo. Un tamaño aproximado
no acredita el tamaño real: la descarga siempre cuenta los bytes recibidos.

## Descarga e integración

```js
const directDownload = createPublicVideoDownloader({ allowedHosts: directHosts })
const resolveYouTube = createYtDlpResolver({ executable: absoluteYtDlpPath })
const download = createVideoSourceDownloader({ directDownload, resolveYouTube })
const importVideo = createVideoImporter({
  authorize, store, probe, maxBytes, download,
})
```

El núcleo autoriza la sesión antes de resolver o descargar. El selector de origen
mantiene los enlaces directos y dirige YouTube al resolver canónico. La URL de
medios solo se admite en subdominios HTTPS de `googlevideo.com`; la descarga usa
los controles comunes, incluyendo DNS público comprobado, IP fijada, verificación
TLS, límites reales y validación de cada redirección. Una redirección fuera del
dominio autorizado se rechaza. No se reenvían las cabeceras de yt-dlp al CDN.

Los enlaces del CDN no necesitan extensión MP4 en su ruta. Solo este transporte
interno elimina ese requisito sintáctico; el formato real se comprueba luego
mediante ffprobe y se usa el mismo almacenamiento atómico que en PCIT-134.
La URL firmada del CDN nunca se devuelve al navegador ni se guarda en matches.
El límite total del selector de YouTube es 90 segundos, además del límite HTTP.

**La política DNS/IP del descargador protege la transferencia de medios.** Las
consultas de metadatos hechas por el proceso yt-dlp tienen su propia red: antes
de desplegar, ejecutar ese proceso sin privilegios, con acceso saliente limitado
a los destinos necesarios de YouTube y sin acceso a redes internas. Los tests
actuales no acreditan esa política de alojamiento ni el runtime EJS real.
El alojamiento debe limitar también recursos y duración de los procesos hijos
del runtime; cancelar el proceso padre no sustituye esa supervisión.

## Activación de interfaz y errores

`createHttpVideoImporter` sigue deshabilitado por defecto. Para anunciar YouTube
requiere además `supportsYouTube: true` en la configuración verificada del cliente.
`createFirestoreAnalysisService` propaga esa capacidad; sin ella, la validación
rechaza enlaces YouTube incluso cuando el servicio acepta MP4/MOV por enlace.

La demostración de `/analizar.html` acepta enlaces ficticios de YouTube para
revisar el formulario y la cola en memoria. Su aviso indica que no se descarga
ni procesa el video; la aplicación de producción no utiliza ese servicio.

La API y el formulario distinguen `import/youtube-unavailable`,
`import/youtube-live`, `import/youtube-format` y `import/youtube-service`.
Un extractor ausente o un fallo de servicio no se presenta como video privado.
La clasificación de stderr se limita a mensajes reconocidos y nunca expone su
contenido. Los cambios de mensajes del proveedor pueden requerir actualizar
esa clasificación; los códigos desconocidos muestran un fallo de servicio.

## Verificación

Pruebas locales de parser, proveedor, DNS/HTTPS simulado, capacidades y formulario:
enlaces normalizados y ambiguos, privacidad/disponibilidad, directos, formatos,
límites, cancelación, timeout, identidad, metadatos reducidos, DNS privado y
redirección externa. Archivos y streams temporales reales con ejecución de yt-dlp
simulada. También se comprueba que el partido no guarde la URL del proveedor.

Revisión visual: escritorio 1280 × 900 y móvil 390 × 844, oscuro/claro, enlace
YouTube enviado a una sola fila En cola de demostración, sin descarga ni resultados
simulados del modelo. Evidencia local en revision-visual-PCIT-141.

Antes de Listo: instalar/configurar una versión verificada de yt-dlp/EJS, comprobar
un video público real y errores reales de disponibilidad, aplicar la política de
red del proceso, configurar ffprobe, Auth/Storage y comprobar el recorrido completo.
El entorno revisado no tiene yt-dlp ni ffprobe instalados. PCIT-141 sigue En curso.

Referencias primarias: [opciones de yt-dlp](https://github.com/yt-dlp/yt-dlp#usage-and-options)
y [configuración de EJS](https://github.com/yt-dlp/yt-dlp/wiki/EJS).
