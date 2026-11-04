"""Puntos clave y homografía a lo largo del vídeo (TA-11).

El código original detectaba la pista solo en el primer fotograma. Aquí se
vuelve a detectar cada N fotogramas y en los cortes de cámara, y se suaviza
para que la homografía no salte entre fotogramas consecutivos:

- si la nueva detección está cerca de la actual (la cámara no se movió), se
  mezcla con ella (media móvil exponencial): reduce el temblor de la CNN;
- si está lejos (la cámara se movió o cambió de plano), se adopta tal cual;
- entre detecciones se mantienen los últimos puntos.

Los fotogramas de corte vendrán del detector de cortes de cámara (TA-15).
"""

from __future__ import annotations

import numpy as np

from .homography import CourtHomography, keypoints_to_array

REDETECT_EVERY_FRAMES = 30
SMOOTHING = 0.3  # peso de la nueva detección en la media móvil
JUMP_THRESHOLD_PX = 25.0  # desplazamiento mediano a partir del cual se reinicia


class CourtTracker:
    """Sigue la pista fotograma a fotograma, sin guardar los fotogramas (PCIT-146).

    update(frame) recibe los fotogramas en orden y devuelve (puntos clave, homografía)
    del fotograma actual. Así se puede leer el vídeo por bloques y descartar cada imagen
    en cuanto se ha usado.
    """

    def __init__(self, predict, redetect_every=REDETECT_EVERY_FRAMES, smoothing=SMOOTHING,
                 jump_threshold_px=JUMP_THRESHOLD_PX, cut_frames=()):
        self.predict = predict
        self.redetect_every = redetect_every
        self.smoothing = smoothing
        self.jump_threshold_px = jump_threshold_px
        self.cuts = set(cut_frames)
        self.index = 0
        self.current = None
        self.homography = None

    def update(self, frame, cut=False):
        i = self.index
        self.index += 1
        cut = cut or i in self.cuts
        if self.current is None or i % self.redetect_every == 0 or cut:
            detected = keypoints_to_array(self.predict(frame))
            if self.current is None or cut:
                new = detected
            else:
                shift = np.median(np.linalg.norm(detected - self.current, axis=1))
                new = (detected if shift > self.jump_threshold_px
                       else (1 - self.smoothing) * self.current + self.smoothing * detected)
            try:
                self.homography = CourtHomography.from_keypoints(new)
                self.current = new
            except ValueError:
                # Detección inválida (pista tapada, plano sin pista): se conserva la anterior.
                if self.homography is None:
                    raise
        return self.current.ravel().copy(), self.homography


def track_court(frames, predict, redetect_every=REDETECT_EVERY_FRAMES, smoothing=SMOOTHING,
                jump_threshold_px=JUMP_THRESHOLD_PX, cut_frames=()):
    """Devuelve (puntos clave por fotograma, homografía por fotograma).

    predict(frame) debe devolver los 14 puntos clave como [x0, y0, x1, y1, ...].
    Los fotogramas que comparten puntos clave comparten el mismo objeto homografía.
    """
    tracker = CourtTracker(predict, redetect_every, smoothing, jump_threshold_px, cut_frames)
    keypoints_per_frame, homographies = [], []
    for frame in frames:
        keypoints, homography = tracker.update(frame)
        keypoints_per_frame.append(keypoints)
        homographies.append(homography)
    return keypoints_per_frame, homographies
