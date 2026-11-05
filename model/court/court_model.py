"""Modelo real de la pista de tenis en metros (medidas ITF).

Sistema de coordenadas: origen en la esquina de dobles del fondo lejano
(punto clave 0), eje x a lo ancho y eje y a lo largo, hacia la cámara.

El orden de los 14 puntos clave es el del dataset TennisCourtDetector, que
es el que predice el detector de puntos clave:

     0 ─4───────────────6─ 1      fondo lejano
       │                 │
       8────────12───────9        línea de saque lejana
       │         │       │
       ─ ─ ─ ─ ─ red ─ ─ ─ ─
       │         │       │
      10────────13──────11        línea de saque cercana
       │                 │
     2 ─5───────────────7─ 3      fondo cercano
"""

import numpy as np

COURT_LENGTH = 23.77  # de fondo a fondo
DOUBLES_WIDTH = 10.97
SINGLES_WIDTH = 8.23
ALLEY_WIDTH = (DOUBLES_WIDTH - SINGLES_WIDTH) / 2  # 1,37 m
SERVICE_LINE_FROM_NET = 6.40
NET_Y = COURT_LENGTH / 2
SERVICE_LINE_FROM_BASELINE = NET_Y - SERVICE_LINE_FROM_NET  # 5,485 m

_LEFT_SINGLES = ALLEY_WIDTH
_RIGHT_SINGLES = DOUBLES_WIDTH - ALLEY_WIDTH
_CENTER_X = DOUBLES_WIDTH / 2
_FAR_SERVICE = SERVICE_LINE_FROM_BASELINE
_NEAR_SERVICE = COURT_LENGTH - SERVICE_LINE_FROM_BASELINE

# (x, y) en metros de cada punto clave, en el orden del detector.
COURT_KEYPOINTS_M = np.array(
    [
        (0.0, 0.0),  # 0  esquina de dobles, fondo lejano, izquierda
        (DOUBLES_WIDTH, 0.0),  # 1  esquina de dobles, fondo lejano, derecha
        (0.0, COURT_LENGTH),  # 2  esquina de dobles, fondo cercano, izquierda
        (DOUBLES_WIDTH, COURT_LENGTH),  # 3  esquina de dobles, fondo cercano, derecha
        (_LEFT_SINGLES, 0.0),  # 4  individuales, fondo lejano, izquierda
        (_LEFT_SINGLES, COURT_LENGTH),  # 5  individuales, fondo cercano, izquierda
        (_RIGHT_SINGLES, 0.0),  # 6  individuales, fondo lejano, derecha
        (_RIGHT_SINGLES, COURT_LENGTH),  # 7  individuales, fondo cercano, derecha
        (_LEFT_SINGLES, _FAR_SERVICE),  # 8  línea de saque lejana, izquierda
        (_RIGHT_SINGLES, _FAR_SERVICE),  # 9  línea de saque lejana, derecha
        (_LEFT_SINGLES, _NEAR_SERVICE),  # 10 línea de saque cercana, izquierda
        (_RIGHT_SINGLES, _NEAR_SERVICE),  # 11 línea de saque cercana, derecha
        (_CENTER_X, _FAR_SERVICE),  # 12 T lejana
        (_CENTER_X, _NEAR_SERVICE),  # 13 T cercana
    ],
    dtype=np.float64,
)

NUM_KEYPOINTS = len(COURT_KEYPOINTS_M)

# Líneas de la pista como pares de puntos clave.
COURT_LINES = [
    (0, 1),  # fondo lejano
    (2, 3),  # fondo cercano
    (0, 2),  # banda de dobles izquierda
    (1, 3),  # banda de dobles derecha
    (4, 5),  # banda de individuales izquierda
    (6, 7),  # banda de individuales derecha
    (8, 9),  # línea de saque lejana
    (10, 11),  # línea de saque cercana
    (12, 13),  # línea central de saque (cruza la red)
]
