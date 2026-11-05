"""Detección de cortes de cámara (TA-15).

Una retransmisión cambia de plano: repeticiones, primeros planos, público. En
un corte el contenido de la imagen cambia de golpe, así que se compara el
histograma de color (tono y saturación) de cada fotograma con el del anterior.
Se trabaja sobre una copia reducida del fotograma: es barato y no le afecta el
ruido de compresión.

Los fundidos lentos no siempre se detectan como corte. No es grave: la pista se
vuelve a detectar cada N fotogramas (TA-11) y el tramo se valida igual
(camera/main_camera.py).
"""

from __future__ import annotations

import cv2

# Distancia de Bhattacharyya entre histogramas (0 = iguales, 1 = sin nada en común)
# a partir de la cual hay corte. En un mismo plano, aunque la cámara se mueva y los
# jugadores corran, se queda por debajo de ~0,2.
CUT_THRESHOLD = 0.45
# Tras un corte, no se busca otro durante estos fotogramas (los fundidos y los
# destellos dan varios saltos seguidos).
MIN_FRAMES_BETWEEN_CUTS = 5
SMALL_SIZE = (128, 72)
HIST_BINS = (30, 32)  # tono, saturación


def color_histogram(frame):
    small = cv2.resize(frame, SMALL_SIZE, interpolation=cv2.INTER_AREA)
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1], None, list(HIST_BINS), [0, 180, 0, 256])
    return cv2.normalize(hist, hist).flatten()


class CutDetector:
    """Recibe los fotogramas en orden; update(frame) devuelve True si en ese fotograma hay un corte."""

    def __init__(self, threshold=CUT_THRESHOLD, min_gap=MIN_FRAMES_BETWEEN_CUTS):
        self.threshold = threshold
        self.min_gap = min_gap
        self.index = -1
        self.previous = None
        self.last_cut = None
        self.cuts = []

    def update(self, frame) -> bool:
        self.index += 1
        hist = color_histogram(frame)
        previous, self.previous = self.previous, hist
        if previous is None:
            return False
        distance = cv2.compareHist(previous, hist, cv2.HISTCMP_BHATTACHARYYA)
        if distance < self.threshold:
            return False
        if self.last_cut is not None and self.index - self.last_cut < self.min_gap:
            return False
        self.last_cut = self.index
        self.cuts.append(self.index)
        return True
