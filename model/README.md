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

- **Partidos simulados** (`tests/ball_sim.py`), donde se conoce la verdad exacta de cada evento. Cada partido incluye ganadores, faltas, golpes fuera, bolas a la red y dobles faltas. Las detecciones llevan ruido de 1,5 px y un 3 % de pelotas perdidas; la pelota fuera del encuadre no se detecta.
- **Botes marcados a mano** en vídeos reales: el vídeo de ejemplo (1080p), h4 (720p) y h1 (360p).

Las cifras de simulación son una **cota superior**: los vídeos reales tienen desenfoque y detecciones peores.

| Módulo | Métrica | Simulación (20 partidos, 160 puntos) | Criterio del ticket |
| --- | --- | --- | --- |
| Golpes | F1 ±3 fotogramas | 0,99 | — |
| Botes (TA-22a) | F1 ±2 fotogramas | 0,970 (P 0,99, R 0,95) | — |
| Posición del bote (TA-23) | Error medio / percentil 90 | 23 cm / 46 cm | < 30 cm ✔ |
| Dentro/fuera (TA-24) | Acierto a > 30 cm de la línea | 99,7 % (749 botes) | ≥ 95 % ✔ |
| Saques (TA-18) | F1 ±3 fotogramas | 0,995 | ≥ 0,90 ✔ |
| Velocidad del saque (TA-20) | Error medio | 2,5 % (199 de 200 saques < 15 %) | < 15 % ✔ |
| Puntos (TA-17) | Inicio y fin a < 1 s | 100 % | — |
| Ganador del punto (TA-28) | Acierto | 98,1 % (confianza alta 100 %, media 99 %, baja 86 %) | ≥ 85 % ✔ |
| Pelota en la red (TA-26) | Bolas a la red detectadas | 85 % (20) | ≥ 80 % ✔ |
| Peloteos (TA-35) | Golpes del punto ±1 | 100 % | ≥ 90 % ✔ |

| Vídeo real | Botes marcados a mano | F1 de botes |
| --- | --- | --- |
| Vídeo de ejemplo (1080p, 30 fps) | 5 | 0,800 |
| h4 (720p, 50 fps) | 6 | 0,769 |
| h1 (640×360, 25 fps; por debajo del mínimo admitido) | 9 | 0,842 |

### Optimización de la precisión (PCIT-187)

El modelo está optimizado para **720p y 1080p**, de 25 a 60 fps. Se midió en 8 condiciones (resolución, fps, ruido, pelotas perdidas y pelota tapada por el jugador) con 896 puntos simulados que no se usaron para ajustar:

| Métrica | Antes | Después |
| --- | --- | --- |
| Golpes (F1) | 0,910 | 0,992 |
| Botes (F1) | 0,905 | 0,966 |
| Puntos bien delimitados | 94,4 % | 98,9 % |
| Ganador del punto | 91,6 % | 97,5 % |
| Ganador con confianza alta | 90 % | 99 % |
| Pelota en la red detectada | 56 % | 74 % |
| Peloteos (golpes ±1) | 89,1 % | 99,2 % |

Qué cambió:

- **Golpes tapados:** el golpe se deduce cuando la pelota desaparece junto a un jugador y vuelve en sentido contrario. En vídeo real el detector pierde la pelota justo en el golpe.
- **Lanzamiento del saque:** ya no cuenta como golpe.
- **Tiempo de vuelo:** un cambio de dirección en los 0,3 s siguientes a un golpe no es un bote.
- **Bote del último golpe:** si tras el último golpe de una jugada no se ve ningún bote, se acepta el mayor salto con un umbral menor.
- Los umbrales de bote que ya había (0,45 m por fotograma, 4 puntos por lado) se barrieron y estaban en su óptimo: no se tocaron.

Los demás criterios están cubiertos por los tests (`python -m pytest`):

- correcciones que rehacen el marcador (TA-29);
- informe igual al vídeo (TA-30);
- mapas por set que suman el del partido (TA-34);
- cifras de peloteos iguales a `points.csv` (TA-36);
- test de regresión de punta a punta en menos de 1 s (TA-16).

## Limitaciones conocidas

**Detección de la pelota y de los botes**
- Sigue siendo el punto débil en vídeo real: el F1 de botes es de 0,77 a 0,80 en 720p y 1080p, por debajo del 0,85 que pedía TA-22b. Lo limita el detector de pelota (pelotas perdidas y falsas), no las reglas de botes.
- El detector entrenado (`bounces.detector: trained`) no mejora a las reglas: se entrenó solo con simulación.
- El marcador es **semiautomático**: el informe lista los puntos de confianza baja y se corrigen con `corrections.json`.

**Resolución**
- Mínimo 720p. Por debajo, el worker rechaza el vídeo y `main.py` avisa: la pelota mide 2-3 px y el modelo no está ajustado para eso.

**Errores que quedan en el ganador del punto**
- El primer bote del golpe ganador no se ve y se toma el segundo (que puede caer fuera).
- La pelota se va larga y sale del encuadre sin botar a la vista.

**Pelota en la red**
- Solo se detecta si la pelota bota en el campo de quien golpeó (74-85 %).
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
