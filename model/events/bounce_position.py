"""Posición de cada bote en la pista, en metros, con su incertidumbre (TA-23).

El bote ocurre en el suelo, así que la homografía lo pasa a metros sin el error
que tiene una pelota en el aire. Lo que sí hay que cuidar es el instante: a 30 fps
la pelota avanza 0,5-1 m entre dos fotogramas, y el contacto cae entre ellos. Por
eso se ajusta una curva a la trayectoria de antes del bote y otra a la de después,
y el punto de contacto es donde se cruzan (con precisión de fracción de fotograma).

La incertidumbre (en cm) combina:
- el error de la homografía en ese punto (error de reproyección de los puntos clave);
- el ruido de la detección de la pelota (residuo de los ajustes);
- el instante del contacto: media décima de fotograma si la pelota se ve al botar, y
  bastante más si el bote se dedujo dentro de un hueco sin pelota (TA-22a).
"""

from __future__ import annotations

import numpy as np

from court import per_frame

from .bounces import FIT_SECONDS, _ball_centers, _frames, _side

TIME_UNCERTAINTY_FRAMES = 0.5  # bote visto: el contacto cae entre dos fotogramas
TIME_UNCERTAINTY_INFERRED_FRAMES = 1.5  # bote deducido dentro de un hueco


def _fit(indices, values, degree):
    degree = min(degree, len(indices) - 1)
    coefs = np.polyfit(indices, values, degree)
    residual = values - np.polyval(coefs, indices)
    return coefs, float(np.sqrt(np.mean(residual ** 2))) if len(indices) > degree + 1 else 0.0


def contact_point(centers, frame, hits=(), fit_frames=8):
    """(x, y) en la imagen y residuo en px del contacto alrededor de frame, o None si no hay datos."""
    y = centers[:, 1]
    barriers = set(hits)
    left = _side(y, frame, -1, fit_frames, barriers) if not np.isnan(y[frame]) else []
    right = _side(y, frame, 1, fit_frames, barriers) if not np.isnan(y[frame]) else []
    if len(left) < 3 or len(right) < 3:
        return None
    left, right = np.array(sorted(left)), np.array(sorted(right))
    fits = {}
    residuals = []
    for name, idx in (("left", left), ("right", right)):
        fx, rx = _fit(idx, centers[idx, 0], 1)
        fy, ry = _fit(idx, centers[idx, 1], 2)
        fits[name] = (fx, fy)
        residuals += [rx, ry]
    times = np.linspace(frame - 1, frame + 1, 81)
    curves = {k: np.c_[np.polyval(fx, times), np.polyval(fy, times)] for k, (fx, fy) in fits.items()}
    gap = np.linalg.norm(curves["left"] - curves["right"], axis=1)
    k = int(np.argmin(gap))
    point = (curves["left"][k] + curves["right"][k]) / 2
    return (float(point[0]), float(point[1])), float(np.mean(residuals)), float(times[k])


def _meters_per_pixel(homography, point):
    p = np.asarray(point, float)
    base = homography.image_to_court(p)
    dx = np.linalg.norm(homography.image_to_court(p + [1.0, 0.0]) - base)
    dy = np.linalg.norm(homography.image_to_court(p + [0.0, 1.0]) - base)
    return max(dx, dy)


def homography_error_px(homography, keypoints):
    """Error típico de la homografía: mediana del error de reproyección de los puntos clave coherentes."""
    if keypoints is None:
        return 0.0
    errors = homography.reprojection_errors(keypoints)
    inliers = errors[homography.inliers] if homography.inliers.any() else errors
    return float(np.median(inliers))


def locate_bounces(bounce_events, ball_detections, homography, fps, hits=(), court_keypoints=None):
    """Añade a cada bote x_m, y_m (posición en la pista) e uncertainty_cm. Devuelve una lista nueva.

    bounce_events: los de events.detect_bounce_events(). Si en un bote visto se puede
    afinar el contacto con las curvas, x_px e y_px pasan a ser ese punto.
    """
    centers = _ball_centers(ball_detections)
    homographies = per_frame(homography, len(ball_detections))
    keypoints = court_keypoints if court_keypoints is not None else [None] * len(ball_detections)
    fit_frames = _frames(FIT_SECONDS, fps)
    located = []
    for event in bounce_events:
        frame = event["frame"]
        h = homographies[frame]
        if h is None:
            continue
        point = (event["x_px"], event["y_px"])
        residual_px, time_frames = 1.0, TIME_UNCERTAINTY_INFERRED_FRAMES
        if not event.get("inferred"):
            refined = contact_point(centers, frame, hits, fit_frames)
            if refined is not None:
                point, residual_px, _ = refined
            time_frames = TIME_UNCERTAINTY_FRAMES
        x_m, y_m = h.image_to_court(point)

        # Velocidad de la pelota por el suelo alrededor del bote, para el error por el instante.
        near = [j for j in range(max(0, frame - 3), min(len(centers), frame + 4)) if not np.isnan(centers[j, 0])]
        speed_m = 0.0
        if len(near) >= 2:
            ground = h.image_to_court(centers[near])
            speed_m = float(np.median(np.linalg.norm(np.diff(ground, axis=0), axis=1) / np.diff(near)))
        m_per_px = _meters_per_pixel(h, point)
        spatial = m_per_px * np.hypot(residual_px, homography_error_px(h, keypoints[frame]))
        temporal = speed_m * time_frames * 0.5  # el error medio es la mitad del intervalo
        located.append({**event, "x_px": round(float(point[0]), 1), "y_px": round(float(point[1]), 1),
                        "x_m": round(float(x_m), 2), "y_m": round(float(y_m), 2),
                        "uncertainty_cm": round(100 * float(np.hypot(spatial, temporal)), 0)})
    return located
