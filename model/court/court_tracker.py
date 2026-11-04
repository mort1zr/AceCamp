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


def track_court(frames, predict, redetect_every=REDETECT_EVERY_FRAMES, smoothing=SMOOTHING,
                jump_threshold_px=JUMP_THRESHOLD_PX, cut_frames=()):
    """Devuelve (puntos clave por fotograma, homografía por fotograma).

    predict(frame) debe devolver los 14 puntos clave como [x0, y0, x1, y1, ...].
    Los fotogramas que comparten puntos clave comparten el mismo objeto homografía.
    """
    if not frames:
        return [], []
    cuts = set(cut_frames)
    keypoints_per_frame, homographies = [], []
    current, homography = None, None

    for i, frame in enumerate(frames):
        if current is None or i % redetect_every == 0 or i in cuts:
            detected = keypoints_to_array(predict(frame))
            if current is None or i in cuts:
                new = detected
            else:
                shift = np.median(np.linalg.norm(detected - current, axis=1))
                new = detected if shift > jump_threshold_px else (1 - smoothing) * current + smoothing * detected
            try:
                homography = CourtHomography.from_keypoints(new)
                current = new
            except ValueError:
                # Detección inválida (pista tapada, plano sin pista): se conserva la anterior.
                if homography is None:
                    raise
        keypoints_per_frame.append(current.ravel().copy())
        homographies.append(homography)
    return keypoints_per_frame, homographies
