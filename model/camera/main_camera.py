"""Qué fotogramas son de la cámara principal (TA-15).

El modelo solo funciona con la cámara de detrás del fondo, que ve toda la pista.
Un fotograma es de la cámara principal si:

1. la pista se reconoció en la última detección (homografía válida y coherente),
   que se repite en cada corte de cámara y cada N fotogramas; y
2. la pista está donde suele estar en el vídeo: sus puntos clave están cerca de la
   posición de referencia (la mediana de todos los fotogramas con pista). Así se
   descartan otras cámaras que también ven la pista, como un plano lateral o una
   repetición desde otro ángulo.

Limitación: una repetición a cámara lenta desde el mismo ángulo que la cámara
principal no se distingue por la imagen. Suele ir entre dos cortes (cortinilla), lo
que ayudará a dividir el vídeo en puntos (TA-17).
"""

from __future__ import annotations

import numpy as np

# Desplazamiento mediano máximo de los puntos clave respecto a la referencia, como
# fracción del ancho del fotograma. La cámara principal puede girar un poco.
MAX_SHIFT_FRACTION = 0.08


def main_camera_frames(keypoints_per_frame, court_visible, frame_width, max_shift_fraction=MAX_SHIFT_FRACTION):
    """Lista de bool, una por fotograma: True si es de la cámara principal.

    keypoints_per_frame: puntos clave por fotograma ([x0, y0, ...] o None si no hay pista).
    court_visible: por fotograma, si la última detección de la pista fue válida.
    """
    visible = [i for i, ok in enumerate(court_visible) if ok and keypoints_per_frame[i] is not None]
    if not visible:
        return [False] * len(court_visible)
    sample = visible[:: max(1, len(visible) // 500)]  # la mediana no necesita todos los fotogramas
    reference = np.median([np.asarray(keypoints_per_frame[i]).reshape(-1, 2) for i in sample], axis=0)
    max_shift = max_shift_fraction * frame_width
    main = [False] * len(court_visible)
    for i in visible:
        shift = np.median(np.linalg.norm(np.asarray(keypoints_per_frame[i]).reshape(-1, 2) - reference, axis=1))
        main[i] = bool(shift <= max_shift)
    return main


def segments(flags):
    """Tramos seguidos con flag True como lista de (inicio, fin) inclusive."""
    result, start = [], None
    for i, flag in enumerate(flags):
        if flag and start is None:
            start = i
        elif not flag and start is not None:
            result.append((start, i - 1))
            start = None
    if start is not None:
        result.append((start, len(flags) - 1))
    return result
