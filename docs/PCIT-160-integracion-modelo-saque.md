# PCIT-160 — Integración de modelo y estadísticas de saque

## Origen y alcance

Integración del 5 de noviembre de 2026 en `panel_web/conexiones`:

- `ModeloAI@9a9a94a`: seguimiento de jugadores, selección de pelota, homografía por
  fotograma, cámaras, golpes, botes, saques y peloteos, lectura progresiva del video
  y validaciones del worker. Conserva los commits originales de Aaron.
- `estadisticas-saque@5028dad`: contrato `matches.statistics` y adaptación al Dashboard
  de velocidad media de saque, porcentaje de primer saque y dobles faltas.
- Pruebas de regresión para fotogramas sin jugadores, tanto en la proyección como
  en el pipeline completo con detecciones sintéticas.

La mini cancha ahora usa `MiniCourt.court_positions`; ya no necesita `min()` sobre
los jugadores de cada fotograma ni calcular la escala mediante su altura. Un
fotograma sin jugadores conserva su lugar y no recibe coordenadas inventadas.
El ajuste local anterior de Fabián permanece respaldado en Git stash y en un
parche externo al repositorio. No se reaplica sobre la implementación nueva.

## Preparación y ejecución local

Desde `model/`, usando el Python del entorno local del worker:

```powershell
$pythonWorker = '..\..\acecam-worker-venv\Scripts\python.exe'
& $pythonWorker scripts/download_models.py --no-video
```

La configuración usa `models/yolov8m.pt` para jugadores y `models/yolo5_last.pt`
para pelota. TrackNet queda opcional, desactivado; sus pesos no se descargaron.
Los pesos se guardan localmente y no se suben a Git.

El worker admite hasta 60 segundos y exige un lado corto de al menos 720 píxeles.
Estas condiciones se comprueban antes de cargar el video para analizarlo.
La ausencia de una medición se mantiene como dato ausente en el Dashboard.

Para adoptar el código nuevo, detener el worker anterior con Ctrl+C en su terminal
y volver a iniciarlo desde `model/`:

```powershell
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:62810'
$env:STORAGE_EMULATOR_HOST = 'http://127.0.0.1:9199'
$env:YOLO_OFFLINE = 'true'
& $pythonWorker -u -m worker --project demo-acecam --bucket demo-acecam.appspot.com --device cpu
```

Estos puertos corresponden al ensayo local actual. Los cambios no actualizan un
proceso de Python que ya estaba abierto. Un partido que ya terminó en Error no
se vuelve a analizar automáticamente al reiniciar el worker.

## Verificación

- Suite final del modelo con las dos regresiones: 222 pruebas correctas;
  cobertura del motor de puntuación del 100 %, como exige la CI.
- Las cinco pruebas del worker con emuladores pasaron por separado en el proyecto
  aislado `demo-acecam-pcit160`, sin tocar la cola de `demo-acecam`.
- `ruff check .`: correcto.
- Web: 210 pruebas correctas, incluidas las cinco nuevas del adaptador de saques.
- Compilación y lint web correctos; permanecen avisos de tamaño del bundle y de
  exportaciones Fast Refresh en `idioma.jsx`.

Las pruebas sintéticas verifican integración y manejo de detecciones ausentes;
no certifican la precisión de las métricas sobre videos reales. La evaluación
comparativa de TrackNet continúa en PCIT-80 y no se modifica su estado aquí.

La prueba con el video real que había fallado terminó correctamente: 329
fotogramas, 1920 × 1080, 30 FPS, duración redondeada por el modelo de 11 segundos.
Se midió velocidad en un golpe y se produjeron desplazamientos para ambos
jugadores y un peloteo. No se detectaron saques en este clip; no valida la
precisión del detector de saque. Los golpes con velocidad medible y los golpes
de un peloteo son contadores distintos.

También se comprobó el paso de esa salida real por `to_match_statistics` y el
adaptador/normalizador del Dashboard para ambas posiciones del jugador: el
partido cuenta como analizado y las métricas de saque no observadas quedan
como «Sin datos».

Se trabajó sobre una copia descargada del emulador, sin sobrescribir el partido
original ni sus datos. El video y los resultados individuales permanecen fuera
del repositorio. La homografía informó 5,9 píxeles de error medio y 10/14 puntos
coherentes: completar el procesamiento no certifica la exactitud de sus medidas.
