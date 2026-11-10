# Modelo de análisis de tenis

Analiza un vídeo de tenis grabado con **cámara fija detrás de la línea de fondo**:

1. Detecta y sigue a los jugadores, la pelota y la pista.
2. Encuentra golpes, saques, botes y puntos.
3. Decide dentro o fuera y quién gana cada punto.
4. Lleva el marcador y genera el vídeo anotado, un informe y mapas de calor.

El worker (`python -m worker`) usa el mismo análisis para la plataforma web.
La guía de instalación en Windows está en [docs/GUIA-ENCENDIDO-WINDOWS.md](../docs/GUIA-ENCENDIDO-WINDOWS.md).

## Uso

Desde `model/`, con el entorno de Python del worker:

```powershell
python scripts/download_models.py --no-video
python main.py --input input_videos/partido.mp4 --use-cache
```

| Opción | Para qué |
| --- | --- |
| `--use-cache` | Reutiliza las detecciones de una ejecución anterior del mismo vídeo (el análisis se repite en segundos) |
| `--match-config match.yaml` | Formato, sacador inicial y marcador inicial si el vídeo empieza a mitad de partido (ver `match.example.yaml`) |
| `--corrections corrections.json` | Ganador correcto de los puntos revisados a mano, p. ej. `{"3": 1}` (ver `corrections.example.json`). Rehace el marcador sin volver a procesar el vídeo |
| `--report-dir carpeta` | Dónde guardar el informe (por defecto `output_videos/informe`) |
| `--heatmap-set 2` | Mapas de calor solo de ese set (además del partido) |
| `--stats-json archivo.json` | Estadísticas en el formato del worker |
| `--no-video` | Sin vídeo anotado (más rápido) |

El resto de opciones están comentadas en `config.yaml`: márgenes de dentro y fuera, cortes de los peloteos, detector de botes, pose del saque y límites del worker.

## Qué genera

- **Vídeo anotado** (`output_videos/output_video.avi`):
  - jugadores, pelota y mini-pista;
  - botes en verde, rojo o amarillo, y un cartel *OUT* cuando la pelota cae fuera;
  - saques con su velocidad media hasta el bote;
  - quién gana cada punto y el marcador.
- **Informe** (`output_videos/informe/`):

| Archivo | Contenido |
| --- | --- |
| `report.json` | Todo el informe (esquema `acecam.match-report.v1`) |
| `points.csv` | Un punto por fila: sacador, golpes, botes, ganador, motivo, confianza, marcador y longitud del peloteo |
| `bounces.csv` | Un bote por fila: posición en metros, dentro/fuera/dudoso, distancia a la línea e incertidumbre |
| `positions.csv` | Posición de cada jugador en cada fotograma de juego, con punto, juego y set |
| `heatmap_J1.png`, `heatmap_set1_J1.png`… | Mapas de calor del partido y de cada set, con escala de color común |
| `informe.html` | Todo lo anterior en una página: jugadores, mapa de calor con selector de jugador y set, peloteos y puntos |

## Evaluación (TA-31)

La evaluación se genera con:

```powershell
python scripts/evaluate_model.py --seeds 20
```

Las cifras salen de dos fuentes:

- **Partidos simulados** (`tests/ball_sim.py`), donde se conoce la verdad exacta de cada evento. Cada partido incluye ganadores, faltas, golpes fuera, bolas a la red y dobles faltas. Las detecciones llevan ruido de 1,5 px y un 3 % de pelotas perdidas.
- **Botes marcados a mano** en vídeos reales: el vídeo de ejemplo y el highlight h1.

Las cifras de simulación son una **cota superior**: los vídeos reales tienen oclusiones, desenfoque y detecciones peores.

| Módulo | Métrica | Simulación (20 partidos, 160 puntos) | Criterio del ticket |
| --- | --- | --- | --- |
| Botes (TA-22a) | F1 ±2 fotogramas | 0,916 (P 0,89, R 0,95) | — |
| Posición del bote (TA-23) | Error medio / percentil 90 | 24 cm / 50 cm | < 30 cm ✔ |
| Dentro/fuera (TA-24) | Acierto a > 30 cm de la línea | 99,6 % (739 botes) | ≥ 95 % ✔ |
| Saques (TA-18) | F1 ±3 fotogramas | 0,995 | ≥ 0,90 ✔ |
| Velocidad del saque (TA-20) | Error medio | 2,6 % (199 de 200 saques < 15 %) | < 15 % ✔ |
| Puntos (TA-17) | Inicio y fin a < 1 s | 98,1 % | — |
| Ganador del punto (TA-28) | Acierto | 90,0 % (confianza alta 91 %, media 90 %, baja 90 %) | ≥ 85 % ✔ |
| Pelota en la red (TA-26) | Bolas a la red detectadas | 75 % (20). En los tests, 92 % (24) | ≥ 80 % ~ |
| Peloteos (TA-35) | Golpes del punto ±1 | 92,5 % | ≥ 90 % ✔ |

| Vídeo real | Botes marcados a mano | F1 de botes (reglas, TA-22a) | F1 de botes (entrenado, TA-22b) |
| --- | --- | --- | --- |
| Vídeo de ejemplo (1080p, 30 fps) | 5 | 0,800 | 0,727 |
| h1 (640×360, 25 fps, pista con marcas) | 9 | 0,762 | 0,762 |

Los demás criterios están cubiertos por los tests (`python -m pytest`):

- correcciones que rehacen el marcador (TA-29);
- informe igual al vídeo (TA-30);
- mapas por set que suman el del partido (TA-34);
- cifras de peloteos iguales a `points.csv` (TA-36);
- test de regresión de punta a punta en menos de 1 s (TA-16).

## Limitaciones conocidas

**Detección de la pelota y de los botes**
- Son el punto débil. En vídeos reales el F1 de botes es de 0,76 a 0,80, por debajo del 0,85 que pedía TA-22b.
- El detector entrenado (`bounces.detector: trained`) no mejora a las reglas: se entrenó solo con simulación. Para superarlo hacen falta unos 300 botes reales etiquetados.
- Mientras tanto, el marcador es **semiautomático**: el informe lista los puntos de confianza baja y se corrigen con `corrections.json`.

**Golpes no detectados**
- Son la causa principal de los errores restantes: peloteos con un golpe de menos y puntos asignados al jugador equivocado.
- Cuando los golpes y los botes no cuadran, la confianza del punto baja, pero no siempre se nota. La confianza "alta" acierta un 91 %, no el 100 %.

**Pelota en la red**
- Solo se detecta si la pelota bota en el campo de quien golpeó (75-92 %).
- El saque que toca la red (*let*) no se detecta.

**Aces**
- Incluyen los saques que el rival toca sin devolverlos: la cámara no los distingue.

**Velocidades**
- Son medias: la del saque, del golpe al bote; la del golpe, entre jugadores. Son menores que las de un radar, que mide la salida de la raqueta.

**Pose del saque (TA-19)**
- Implementada pero opcional (`serves.pose_model`). Su mejora de F1 no se ha medido: hay que ejecutar `scripts/compare_serve_pose.py` con saques etiquetados en un PC con los modelos.
- Sin pose, el sacador se corrige por coherencia dentro de cada juego.

**Requisitos del vídeo**
- Cámara fija de fondo con la pista completa, juego continuo, al menos 720p y de 25 a 60 fps (ver [videos-largos-y-fuentes.md](../docs/videos-largos-y-fuentes.md)).
- Los cortes de cámara y las repeticiones se descartan (TA-15), pero un vídeo muy editado pierde puntos.

**Evaluación**
- Las cifras con vídeos reales cubren solo botes (14 botes marcados).
- Para el resto de métricas reales hace falta etiquetar saques, puntos y ganadores con `python -m eval.review` y ampliar `scripts/evaluate_model.py`.
