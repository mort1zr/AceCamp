"""Selección de la pelota entre las detecciones de cada fotograma (TA-14a).

El detector puede devolver varias cajas por fotograma (la pelota y falsos
positivos: zapatillas, logotipos, pelotas de los recogepelotas). El código
original se quedaba con la última caja. Aquí:

1. Un filtro de Kalman de velocidad constante predice dónde debería estar la
   pelota en el fotograma siguiente.
2. Se elige la detección más cercana a esa predicción, siempre que esté dentro
   de un radio que crece con los fotogramas sin ver la pelota. Si no hay
   ninguna, el fotograma queda sin pelota.
3. Sin seguimiento activo (al principio o tras perderla), se elige la de mayor
   confianza.

Antes se descartan las detecciones quietas: una marca blanca en la pista, un logo
o una pelota parada en el suelo aparecen siempre en el mismo sitio, y el
seguimiento se enganchaba a ellas cuando perdía la pelota real (la pelota se
quedaba "congelada"). La pelota en juego nunca está quieta más de una fracción de
segundo.

Las cajas pueden traer la confianza como quinto valor: [x1, y1, x2, y2, conf].
"""

from __future__ import annotations

import math

import numpy as np

# Radio de búsqueda alrededor de la predicción, en píxeles de un vídeo 1080p
# (a 200 km/h la pelota avanza unos 100 px por fotograma a 30 fps).
GATE_RADIUS_PX = 150.0
GATE_GROWTH_PX = 50.0  # cuánto crece el radio por cada fotograma sin pelota
MAX_MISSED_FRAMES = 10  # sin pelota durante más fotogramas: se reinicia el seguimiento
MAX_INTERPOLATION_GAP = 5  # huecos más largos no se rellenan (se borrarían botes)
# Detecciones quietas. Dos reglas (radios en píxeles de un vídeo 1080p):
# - largo plazo: en ±STATIC_WINDOW_SECONDS hay una detección a menos de STATIC_RADIUS_PX en más de
#   STATIC_FRACTION de los fotogramas (una marca que se ve casi siempre);
# - ráfaga: en ±STILL_WINDOW_SECONDS hay una detección a menos de STILL_RADIUS_PX en al menos
#   STILL_FRACTION de los fotogramas (una marca que se ve a ratos, pero sin moverse nada). La pelota
#   en juego, incluso lenta, se desplaza varios píxeles por fotograma.
STATIC_WINDOW_SECONDS = 1.0
STATIC_RADIUS_PX = 8.0
STATIC_FRACTION = 0.5
STILL_WINDOW_SECONDS = 0.1
STILL_RADIUS_PX = 4.0
STILL_FRACTION = 0.8
# - recurrente: en ±RECURRING_WINDOW_SECONDS hay detecciones a menos de STILL_RADIUS_PX durante más
#   de RECURRING_SECONDS en total (una marca que el detector ve salteada, fotograma sí, fotograma no).
#   En los highlights reales, las marcas sumaban 22-294 fotogramas en el mismo punto y la pelota, 8 como mucho.
RECURRING_WINDOW_SECONDS = 10.0
RECURRING_SECONDS = 0.6


def box_center(box):
    return (box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0


def box_confidence(box):
    return box[4] if len(box) > 4 else 1.0


class ConstantVelocityKalman:
    """Kalman 2D con estado (x, y, vx, vy) y medida (x, y)."""

    def __init__(self, x, y, process_noise=30.0, measurement_noise=5.0):
        self.state = np.array([x, y, 0.0, 0.0])
        self.cov = np.diag([measurement_noise**2, measurement_noise**2, 1e4, 1e4])
        self.F = np.array([[1, 0, 1, 0], [0, 1, 0, 1], [0, 0, 1, 0], [0, 0, 0, 1]], dtype=float)
        self.H = np.array([[1, 0, 0, 0], [0, 1, 0, 0]], dtype=float)
        self.Q = np.eye(4) * process_noise
        self.R = np.eye(2) * measurement_noise**2

    def predict(self):
        self.state = self.F @ self.state
        self.cov = self.F @ self.cov @ self.F.T + self.Q
        return self.state[:2].copy()

    def update(self, x, y):
        innovation = np.array([x, y]) - self.H @ self.state
        s = self.H @ self.cov @ self.H.T + self.R
        gain = self.cov @ self.H.T @ np.linalg.inv(s)
        self.state = self.state + gain @ innovation
        self.cov = (np.eye(4) - gain @ self.H) @ self.cov


class _Grid:
    """Fotogramas con alguna detección en cada celda de una rejilla de lado radius."""

    def __init__(self, candidates_per_frame, radius):
        self.radius = radius
        self.cells = {}
        for i, frame in enumerate(candidates_per_frame):
            for box in frame.values():
                frames = self.cells.setdefault(self._cell(box_center(box)), [])
                if not frames or frames[-1] != i:
                    frames.append(i)

    def _cell(self, point):
        return int(point[0] // self.radius), int(point[1] // self.radius)

    def frames_near(self, point, first, last):
        from bisect import bisect_left, bisect_right

        cx, cy = self._cell(point)
        found = set()
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                frames = self.cells.get((cx + dx, cy + dy), [])
                found.update(frames[bisect_left(frames, first):bisect_right(frames, last)])
        return found


def remove_static_candidates(candidates_per_frame, scale=1.0, fps=30.0):
    """Quita las detecciones que se repiten en el mismo punto (marcas de la pista, logos, pelotas paradas)."""
    n = len(candidates_per_frame)
    still_grid = _Grid(candidates_per_frame, max(1.5, STILL_RADIUS_PX * scale))
    rules = [(_Grid(candidates_per_frame, max(3.0, STATIC_RADIUS_PX * scale)),
              max(1, round(STATIC_WINDOW_SECONDS * fps)), STATIC_FRACTION, False),
             (still_grid, max(2, round(STILL_WINDOW_SECONDS * fps)), STILL_FRACTION, True)]
    recurring_window = max(1, round(RECURRING_WINDOW_SECONDS * fps))
    recurring_frames = max(3, round(RECURRING_SECONDS * fps))
    result = []
    for i, frame in enumerate(candidates_per_frame):
        kept = {}
        for key, box in frame.items():
            static = False
            for grid, window, fraction, inclusive in rules:
                first, last = max(i - window, 0), min(i + window, n - 1)
                nearby = grid.frames_near(box_center(box), first, last)
                if not inclusive:
                    nearby.discard(i)
                span = last - first + (1 if inclusive else 0)
                if span > 0 and len(nearby) / span >= fraction and len(nearby) > 1:
                    static = True
                    break
            if not static:
                first, last = max(i - recurring_window, 0), min(i + recurring_window, n - 1)
                static = len(still_grid.frames_near(box_center(box), first, last)) > recurring_frames
            if not static:
                kept[key] = box
        result.append(kept)
    return result


def select_ball(candidates_per_frame, scale=1.0, fps=30.0, gate_radius_px=GATE_RADIUS_PX,
                gate_growth_px=GATE_GROWTH_PX, max_missed_frames=MAX_MISSED_FRAMES):
    """Devuelve, por fotograma, {1: [x1, y1, x2, y2]} con la pelota elegida, o {} si no hay.

    scale ajusta los radios a la resolución del vídeo (1.0 = 1080p).
    """
    candidates_per_frame = remove_static_candidates(candidates_per_frame, scale, fps)
    selected = []
    kalman, missed = None, 0
    for frame in candidates_per_frame:
        boxes = list(frame.values())
        prediction = kalman.predict() if kalman is not None else None

        chosen = None
        if prediction is None:
            if boxes:
                chosen = max(boxes, key=box_confidence)
        elif boxes:
            radius = (gate_radius_px + gate_growth_px * missed) * scale
            distance, best = min(
                ((math.dist(box_center(b), prediction), i) for i, b in enumerate(boxes)), key=lambda t: t[0]
            )
            if distance <= radius:
                chosen = boxes[best]

        if chosen is None:
            selected.append({})
            missed += 1
            if kalman is not None and missed > max_missed_frames:
                kalman, missed = None, 0
            continue

        cx, cy = box_center(chosen)
        if kalman is None:
            kalman = ConstantVelocityKalman(cx, cy)
        else:
            kalman.update(cx, cy)
        missed = 0
        selected.append({1: [float(v) for v in chosen[:4]]})
    return selected


def fill_short_gaps(ball_positions, max_gap=MAX_INTERPOLATION_GAP):
    """Interpola linealmente solo los huecos de hasta max_gap fotogramas con pelota a ambos lados.

    Los huecos largos y los extremos del vídeo se dejan sin pelota: rellenarlos
    inventaría trayectorias rectas que borran botes y golpes.
    """
    boxes = [frame.get(1) for frame in ball_positions]
    filled = [dict(frame) for frame in ball_positions]
    i = 0
    while i < len(boxes):
        if boxes[i] is not None:
            i += 1
            continue
        start = i
        while i < len(boxes) and boxes[i] is None:
            i += 1
        gap = i - start
        if start == 0 or i == len(boxes) or gap > max_gap:
            continue
        before, after = boxes[start - 1], boxes[i]
        for k in range(gap):
            t = (k + 1) / (gap + 1)
            filled[start + k] = {1: [a + (b - a) * t for a, b in zip(before, after)]}
    return filled
