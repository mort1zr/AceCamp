"""Refinamiento de los puntos clave con las líneas de la pista (TA-11).

La CNN predice cada punto clave con un error de varios píxeles, porque trabaja
sobre la imagen reducida a 224x224. Cada punto clave de la pista es el cruce
de dos líneas blancas, así que se busca ese cruce en un recorte alrededor de
la predicción:

1. se binarizan los píxeles claros (las líneas) del recorte;
2. se detectan segmentos con la transformada de Hough;
3. se agrupan en dos direcciones y se ajusta una recta por dirección;
4. el punto refinado es la intersección de las dos rectas.

Si algo no cuadra (no hay dos direcciones claras, o el cruce cae lejos de la
predicción), se conserva el punto original.
"""

from __future__ import annotations

import math

import cv2
import numpy as np

# Medio lado del recorte, como fracción del ancho del fotograma (~38 px en 1080p).
WINDOW_FRACTION = 0.02
MIN_ANGLE_BETWEEN_LINES_DEG = 20.0
# El cruce puede estar como mucho a esta fracción del medio lado del recorte.
MAX_SHIFT_FRACTION = 0.8
# Sin este contraste entre lo más claro y lo más oscuro del recorte, no hay líneas que buscar.
MIN_CONTRAST = 40
# Las líneas son finas: si más de esta fracción del recorte sale "clara", no son líneas.
MAX_BRIGHT_FRACTION = 0.4


def _segments(binary, half_window):
    lines = cv2.HoughLinesP(binary, rho=1, theta=np.pi / 180, threshold=max(8, half_window // 2),
                            minLineLength=max(6, half_window // 2), maxLineGap=4)
    return [] if lines is None else [tuple(map(float, line[0])) for line in lines]


def _angle(segment):
    x1, y1, x2, y2 = segment
    return math.degrees(math.atan2(y2 - y1, x2 - x1)) % 180.0


def _angle_diff(a, b):
    d = abs(a - b) % 180.0
    return min(d, 180.0 - d)


def _fit_line(segments):
    """Recta (punto, dirección) que mejor ajusta los extremos de los segmentos."""
    points = np.array([(s[0], s[1]) for s in segments] + [(s[2], s[3]) for s in segments], dtype=np.float32)
    vx, vy, x0, y0 = cv2.fitLine(points, cv2.DIST_L2, 0, 0.01, 0.01).ravel()
    return np.array([x0, y0]), np.array([vx, vy])


def _intersection(line_a, line_b):
    (p, r), (q, s) = line_a, line_b
    cross = r[0] * s[1] - r[1] * s[0]
    if abs(cross) < 1e-6:
        return None
    t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / cross
    return p + t * r


def refine_keypoint(gray, point, half_window):
    """Devuelve el cruce de líneas más cercano a point, o point si no se encuentra."""
    x, y = float(point[0]), float(point[1])
    h, w = gray.shape[:2]
    x0, y0 = int(round(x)) - half_window, int(round(y)) - half_window
    x1, y1 = x0 + 2 * half_window, y0 + 2 * half_window
    if x0 < 0 or y0 < 0 or x1 > w or y1 > h:
        return np.array([x, y])

    crop = gray[y0:y1, x0:x1]
    if int(crop.max()) - int(crop.min()) < MIN_CONTRAST:
        return np.array([x, y])
    _, binary = cv2.threshold(crop, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if np.count_nonzero(binary) > MAX_BRIGHT_FRACTION * binary.size:
        return np.array([x, y])
    segments = _segments(binary, half_window)
    if len(segments) < 2:
        return np.array([x, y])

    # Dos grupos por dirección: el del segmento más largo y el de los que forman ángulo con él.
    segments.sort(key=lambda s: -math.hypot(s[2] - s[0], s[3] - s[1]))
    reference = _angle(segments[0])
    group_a = [s for s in segments if _angle_diff(_angle(s), reference) < MIN_ANGLE_BETWEEN_LINES_DEG / 2]
    group_b = [s for s in segments if _angle_diff(_angle(s), reference) >= MIN_ANGLE_BETWEEN_LINES_DEG]
    if not group_a or not group_b:
        return np.array([x, y])

    crossing = _intersection(_fit_line(group_a), _fit_line(group_b))
    if crossing is None:
        return np.array([x, y])
    crossing = crossing + (x0, y0)
    if math.dist(crossing, (x, y)) > MAX_SHIFT_FRACTION * half_window:
        return np.array([x, y])
    return crossing


def refine_keypoints(image, keypoints, window_fraction=WINDOW_FRACTION):
    """Refina los 14 puntos clave ([x0, y0, x1, y1, ...]) sobre un fotograma BGR o en grises."""
    gray = image if image.ndim == 2 else cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    half_window = max(8, int(round(gray.shape[1] * window_fraction)))
    points = np.asarray(keypoints, dtype=np.float64).reshape(-1, 2)
    refined = np.array([refine_keypoint(gray, p, half_window) for p in points])
    return refined.ravel()
