# Analizar video v1 · PCIT-27

## Estado y dependencias

Interfaz, validación, cola, adaptador de Firestore y demostración implementados
en `interfaces_Fabian`. La conexión real depende de PCIT-20/21/22/23/24 de Axel
y del worker PCIT-35 de Aaron. No se han sustituido sus implementaciones ni
fusionado la rama Landing_Rolando. La ruta final `/analizar` ya está prevista
por PCIT-96; la página de esta rama es `src/pages/Analizar.jsx`.

PCIT-134 es una tarea independiente relacionada con PCIT-27 para el importador de enlaces:
el servicio de archivos de PCIT-24 no cubre descargar un video externo,
comprobar sus bytes reales y guardarlo en Storage. Su núcleo de servidor y sus
pruebas locales están en [server/video-import](../../../server/video-import/README.md).
Quedan pendientes API, Auth/Storage reales y el proveedor de YouTube; todavía
no habilitar enlaces en producción.

## Demostración

Con `npm run dev`, abrir `/analizar.html`. No sube archivos, no descarga enlaces,
no ejecuta el modelo y no escribe en Firebase ni en localStorage. La selección
del archivo solo valida sus metadatos; no lee ni transmite su contenido.
Los 500 MB son un límite ilustrativo de esta demostración, no un acuerdo de
producción. La cola permanece En cola hasta recargar; no se inventan estadísticas
ni se simula un análisis real completado. El alta de jugador comparte el servicio
en memoria de la pantalla, y su selección se actualiza sin perder el partido.

La entrada normal de producción no importa las vistas de demostración.

## Servicios de la aplicación

La página recibe `service` y `playersService`. Deben tener el mismo `scopeKey`
(proyecto, organización, UID) y una instancia estable por sesión. La ausencia
o diferencia de scopes muestra indisponibilidad y no permite cargar videos.
El servicio de jugadores es el de PCIT-26. Crear el de análisis así:

```js
const service = createFirestoreAnalysisService({
  db, orgId, actorId: user.uid,
  uploadVideo,    // Adaptación de la función de Axel, PCIT-24
  importVideo,    // Opcional, backend de PCIT-134; sin él, enlace deshabilitado
  maxBytes,      // Obligatorio: límite acordado con Axel
})
```

El adaptador de cada transferencia recibe un objeto:

```js
{ file /* o url */, orgId, actorId, matchId, maxBytes, signal, onProgress }
```

Debe devolver una ruta de Storage como string, implementar cancelación mediante
`signal` y llamar a `onProgress(percent)` con números de 0 a 100. La firma real de
uploadVideo() todavía debe acordarse con Axel; envolverla si utiliza otros argumentos.
No habilitar enlace en producción hasta implementar y probar importVideo.
El importador debe verificar sesión y organización en servidor, destinos públicos,
redirecciones, tipo real y tamaño real de descarga, antes de devolver videoPath.

## Datos propuestos para acordar con PCIT-22/35

Colección `matches`:

| Campo | Uso |
| --- | --- |
| playerId | ID real de players; se verifica su orgId antes de transferir |
| playerPosition | arriba / abajo al inicio del video |
| opponent | Rival, 2–120 caracteres |
| tournament | Texto opcional, hasta 120 caracteres |
| matchDate | Fecha calendario YYYY-MM-DD, no futura |
| result | Texto opcional, hasta 120 caracteres |
| videoPath | Ruta devuelta por el servicio de transferencia |
| orgId / createdBy | Identidad de la sesión, nunca tomada del formulario |
| createdAt | serverTimestamp |
| status | en cola; el worker actualizará a procesando, listo o error |
| inputFingerprint | SHA-256 de los datos de entrada para reconocer reintentos |

No se guarda el objeto File ni la URL de origen ni sus parámetros firmados dentro
del documento. La huella sirve para identificar el mismo intento de formulario;
no certifica el contenido del video ni sustituye validación del servidor.

## Flujo y reintentos

1. Validar archivo (MP4/MOV, MIME informado, tamaño mayor que cero y dentro del
   límite) o formato de enlace HTTPS directo. Los proveedores de páginas como
   YouTube no están admitidos por este contrato inicial. PCIT-134 deberá añadir
   ese proveedor antes de cerrar el alcance confirmado por PRODUCT.md.
2. Reservar un ID de documento sin escribir aún el partido; verificar el jugador
   de la organización. La autorización efectiva depende de PCIT-23/24.
3. Transferir o importar el video con el mismo matchId. El servicio de transferencia
   debe validar bytes reales, rutas por organización y reintentos de ese matchId.
4. Al recibir videoPath, crear el documento en una transacción de Firestore.
   El worker nunca ve un partido En cola cuyo video todavía se esté transfiriendo.
5. Si el documento ya existe con la misma identidad y huella, devolverlo sin
   sobrescribir su estado (puede estar procesando o listo). Rechazar otras huellas.
6. Conservar en memoria la ruta subida si falla el guardado, para no volver a subir
   el mismo archivo al reintentar sin cambiar el formulario. La UI conserva el ID
   del intento; cualquier cambio de datos genera otro ID.
7. Suscribirse a matches por orgId; actualizar la tabla con el estado real del worker.

Cancelar antes de la creación evita encolar. Durante la transacción final la UI
deshabilita la cancelación: una escritura confirmada no se presenta como cancelada.
Los adaptadores deben detener transferencias incompletas; una carga completa que
se abandone sin encolar puede necesitar limpieza de archivos huérfanos en el servicio
de Storage. La caché de reintentos es de sesión y no persiste al recargar.

## Verificación y pendientes para Listo

Las pruebas locales cubren validación, formulario, alta de jugador sin perder
contexto, doble envío, cancelación, errores conservando campos, reintentos,
identidad del documento, filtro por orgId y estados avanzados. El SDK de Firestore
y las transferencias están simulados en estas pruebas: no acreditan reglas ni
conexión real. No hay credenciales configuradas ni se accedió a datos de producción.

Para cerrar PCIT-27 faltan: confirmar el contrato de datos, integrar Auth/ruta,
probar uploadVideo y límites/reglas reales, completar importVideo (PCIT-134) y
verificar con PCIT-35 que un video termina con estadísticas reales. Mantener la
historia En curso hasta entonces. No publicar pull requests sin autorización.
