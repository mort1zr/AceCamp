# PCIT-161 — Video procesado y métricas del reporte

## Entrega

El worker ejecuta el render ya implementado por Aaron. Cada análisis tiene su
propio directorio temporal: genera un AVI anotado, lo convierte a MP4 H.264
(`yuv420p`, rango limitado, `faststart`, sin audio) y lo sube a:

```text
orgs/{orgId}/matches/{matchId}/processed.mp4
```

Después de terminar la subida, publica `statistics` y `processedVideoPath` en la
misma transacción que cambia el partido a `listo`. Si falla el render, conversión
o subida, deja un mensaje de error y no publica un resultado completo. Los
temporales se eliminan tanto al terminar como al fallar. La ruta se valida contra
el partido y la organización; el resultado está limitado a 500 MiB.

`AnalysisResult` mantiene juntos las estadísticas y el archivo. El procesador
conserva compatibilidad con analizadores anteriores que devuelven únicamente
estadísticas; la configuración habitual del worker ahora genera video.

## Acceso y reproductor

El campo `processedVideoPath` es opcional para los partidos históricos. Solo el
worker lo escribe mediante Admin SDK; la web no puede añadirlo ni modificarlo.
Las reglas permiten leer el archivo con sesión de la organización y rechazan
que el cliente escriba, reemplace o borre `processed.mp4`.

El reporte usa `getBlob` de Firebase Storage con autenticación y una URL de objeto
temporal. No usa `getDownloadURL`, enlaces públicos, ACL públicas ni tokens de
descarga permanentes. Al salir o cambiar de sesión se libera la URL. Incluye
estados de carga, error y reintento. En un despliegue real, el bucket debe permitir
las peticiones CORS del origen autorizado de la web para las lecturas por SDK.

El reporte también muestra las métricas disponibles de desplazamiento, saques y
peloteos. Un campo ausente conserva «Sin datos»; cero no se convierte en ausencia.
«Golpes medidos» cuenta golpes con velocidad medible y puede ser menor que el
total de golpes de un peloteo. La velocidad de saque es hasta el bote, no la de un
radar. Se conserva el selector de km/h y mph.

## Preparación local

Desde `model/`, instalar las dependencias del worker en su entorno:

```powershell
$pythonWorker = '..\..\acecam-worker-venv\Scripts\python.exe'
& $pythonWorker -m pip install -r requirements-worker.txt
```

`imageio-ffmpeg==0.6.0` incluye el ejecutable local de FFmpeg; no requiere un
servicio externo. `requirements-dev.txt` lo incluye para ejecutar las pruebas.
Reiniciar el worker después de actualizar el código. Para el ensayo actual:

```powershell
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:62810'
$env:STORAGE_EMULATOR_HOST = 'http://127.0.0.1:9199'
$env:YOLO_OFFLINE = 'true'
& $pythonWorker -u -m worker --project demo-acecam --bucket demo-acecam.appspot.com --device cpu
```

## Verificación y límites

Resultado final: 227 pruebas del modelo correctas y 100 % de cobertura de
`scoring`; cinco pruebas adicionales del worker con emuladores y ocho de Storage
correctas en proyectos aislados; 214 pruebas web correctas. Ruff, compilación y
lint web correctos, con los avisos existentes de Fast Refresh y tamaño del bundle.
El MP4 real se decodificó completo (329 fotogramas) y se inspeccionó un fotograma
con las cajas de jugadores, mini cancha e indicadores dibujados.

- Regresiones del procesador: subida antes de Listo, fallo de subida, limpieza y
  rechazo de rutas de otra organización.
- Conversión real de AVI a MP4: H.264, formato de píxel, número de fotogramas y FPS;
  conversión inválida elimina el archivo incompleto.
- UI: carga del blob privado, error, reintento, error de reproducción, liberación
  de URL e ignorar descargas que terminan después de salir.
- Storage: lectura permitida a su organización; rechazada sin sesión o desde otra
  organización; escritura y borrado del resultado rechazados al cliente.
- Worker con emuladores: pipeline con detecciones sintéticas, render real,
  conversión, subida y referencia final en Firestore.
- Video real previamente fallido: 329 fotogramas, 1920×1080 y 30 FPS; se generó y
  subió un MP4 de 3.277.283 bytes en un partido separado del emulador. No se
  alteraron los resultados anteriores ni se publicaron videos en GitHub.

El control de Edge se detuvo al no poder verificar la URL de su ventana. No se
afirma una revisión visual de reproducción en Edge; se verifican el archivo, el
pipeline y los estados del reproductor por pruebas automáticas. El usuario puede
abrir el reporte del ensayo «Prueba video procesado» en `/partidos` para comprobarlo.

Los partidos históricos sin archivo no se reprocesan automáticamente. La tabla por
set continúa pendiente en PCIT-44: el modelo no publica límites ni estadísticas
por set y esta entrega no los inventa. La exactitud del detector es independiente
de que la entrega del archivo termine correctamente.
