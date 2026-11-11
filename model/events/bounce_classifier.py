"""Detector de botes entrenado (TA-22b), alternativo al de reglas (TA-22a).

Un clasificador decide, fotograma a fotograma, si la pelota bota ahí, mirando una ventana de
± FIT_SECONDS de su trayectoria. Es una regresión logística (NumPy, sin dependencias nuevas)
sobre estas características de cada fotograma con pelota:

- el salto de la velocidad vertical (la medida del detector de reglas) y su valor absoluto;
- las pendientes vertical antes y después y el cambio de velocidad horizontal, en metros;
- la cercanía al golpe más cercano y a un jugador (un golpe también cambia la dirección);
- si la pelota proyectada cae dentro de la zona de juego y cuánta pelota se ve en la ventana.

Luego se eligen los máximos locales con probabilidad ≥ threshold, separados como mínimo
SUPPRESSION_SECONDS y lejos de los golpes, y se añaden los botes deducidos en los huecos sin
pelota (que el clasificador no puede ver) con la misma lógica que el detector de reglas.

Los pesos (models/bounce_classifier.json, unos cientos de bytes) se entrenan con
training/train_bounce_classifier.py sobre peloteos simulados, separados del set de validación
(TA-9) como pide el ticket. Se activa con bounces.detector: trained en config.yaml.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from court import COURT_LENGTH, DOUBLES_WIDTH, per_frame

from .bounces import (
    FIT_SECONDS,
    HIT_EXCLUSION_SECONDS,
    MIN_POINTS,
    OUT_MARGIN_BACK_M,
    OUT_MARGIN_SIDE_M,
    SUPPRESSION_SECONDS,
    _ball_centers,
    _frames,
    _near_player,
    _pixels_per_meter,
    _side,
    _slope,
    bounce_scores,
    gap_bounces,
)

FEATURES = ("kink", "abs_kink", "slope_before", "slope_after", "horizontal_change", "hit_proximity",
            "near_player", "in_play_area", "visible_fraction")
DEFAULT_WEIGHTS = Path(__file__).resolve().parent.parent / "models" / "bounce_classifier.json"
DEFAULT_THRESHOLD = 0.5


def frame_features(ball_detections, player_detections, homography, fps, hits=()):
    """Matriz (n_fotogramas, len(FEATURES)); filas NaN donde no se puede medir."""
    n = len(ball_detections)
    centers = _ball_centers(ball_detections)
    homographies = per_frame(homography, n)
    fit = _frames(FIT_SECONDS, fps)
    kink = bounce_scores(ball_detections, homography, fps, hits=hits)
    hits = sorted(hits)
    barriers = set(hits)
    features = np.full((n, len(FEATURES)), np.nan)
    for i in range(n):
        if np.isnan(kink[i]):
            continue
        h = homographies[i]
        left = _side(centers[:, 1], i, -1, fit, barriers)
        right = _side(centers[:, 1], i, 1, fit, barriers)
        scale = _pixels_per_meter(h, centers[i]) * 30.0 / fps  # px por (m por fotograma a 30 fps)
        slope_before = _slope(np.array(left) - i, centers[left, 1], 2) / scale
        slope_after = _slope(np.array(right) - i, centers[right, 1], 2) / scale
        vx_before = _slope(np.array(left) - i, centers[left, 0], 1) / scale
        vx_after = _slope(np.array(right) - i, centers[right, 0], 1) / scale
        nearest_hit = min((abs(i - hit) for hit in hits), default=10 * fit)
        x_m, y_m = h.image_to_court(centers[i])
        in_area = (-OUT_MARGIN_SIDE_M <= x_m <= DOUBLES_WIDTH + OUT_MARGIN_SIDE_M
                   and -OUT_MARGIN_BACK_M <= y_m <= COURT_LENGTH + OUT_MARGIN_BACK_M)
        window = centers[max(0, i - fit):i + fit + 1, 1]
        features[i] = (kink[i], abs(kink[i]), slope_before, slope_after, abs(vx_after - vx_before),
                       float(np.exp(-nearest_hit / fit)), float(_near_player(centers[i], player_detections[i], 1.0)),
                       float(in_area), float(np.mean(~np.isnan(window))))
    return features


class BounceClassifier:
    """Regresión logística con normalización (media y desviación de entrenamiento)."""

    def __init__(self, weights, bias, mean, std, threshold=DEFAULT_THRESHOLD):
        self.weights = np.asarray(weights, float)
        self.bias = float(bias)
        self.mean = np.asarray(mean, float)
        self.std = np.asarray(std, float)
        self.threshold = float(threshold)

    @classmethod
    def train(cls, X, y, l2=1e-2, epochs=3000, learning_rate=0.5, threshold=DEFAULT_THRESHOLD):
        """Entrena por descenso de gradiente, con las clases equilibradas (hay pocos botes)."""
        X, y = np.asarray(X, float), np.asarray(y, float)
        mean, std = X.mean(axis=0), X.std(axis=0) + 1e-9
        Z = (X - mean) / std
        pos = max(y.sum(), 1.0)
        sample_weight = np.where(y == 1, len(y) / (2 * pos), len(y) / (2 * max(len(y) - pos, 1.0)))
        w, b = np.zeros(Z.shape[1]), 0.0
        for _ in range(epochs):
            p = 1 / (1 + np.exp(-(Z @ w + b)))
            error = (p - y) * sample_weight
            w -= learning_rate * (Z.T @ error / len(y) + l2 * w)
            b -= learning_rate * error.mean()
        return cls(w, b, mean, std, threshold)

    def probabilities(self, X):
        X = np.asarray(X, float)
        p = np.full(len(X), np.nan)
        ok = ~np.isnan(X).any(axis=1)
        p[ok] = 1 / (1 + np.exp(-(((X[ok] - self.mean) / self.std) @ self.weights + self.bias)))
        return p

    def to_dict(self):
        return {"features": list(FEATURES), "weights": self.weights.round(6).tolist(), "bias": round(self.bias, 6),
                "mean": self.mean.round(6).tolist(), "std": self.std.round(6).tolist(), "threshold": self.threshold}

    def save(self, path):
        Path(path).write_text(json.dumps(self.to_dict(), indent=1) + "\n", encoding="utf-8")

    @classmethod
    def load(cls, path=DEFAULT_WEIGHTS):
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        if data["features"] != list(FEATURES):
            raise ValueError("los pesos del clasificador de botes son de otra versión de las características")
        return cls(data["weights"], data["bias"], data["mean"], data["std"], data.get("threshold", DEFAULT_THRESHOLD))


def detect_bounces_trained(ball_detections, player_detections, homography, fps, classifier, main_camera=None,
                           hits=()):
    """Botes como events.detect_bounce_events: [{"frame", "x_px", "y_px", "inferred"}]."""
    n = len(ball_detections)
    main = main_camera if main_camera is not None else [True] * n
    probabilities = classifier.probabilities(frame_features(ball_detections, player_detections, homography, fps,
                                                            hits))
    suppression = _frames(SUPPRESSION_SECONDS, fps)
    exclusion = _frames(HIT_EXCLUSION_SECONDS, fps)
    centers = _ball_centers(ball_detections)
    order = [i for i in np.argsort(-np.nan_to_num(probabilities, nan=-1.0))
             if not np.isnan(probabilities[i]) and probabilities[i] >= classifier.threshold]
    chosen = []
    for i in order:
        if not main[i] or any(abs(i - h) <= exclusion for h in hits):
            continue
        if all(abs(i - j) > suppression for j in chosen):
            chosen.append(int(i))
    events = [{"frame": i, "x_px": float(centers[i, 0]), "y_px": float(centers[i, 1]), "inferred": False}
              for i in chosen]
    # Los huecos sin pelota los cubre la misma deducción que el detector de reglas.
    for frame, _, point in gap_bounces(ball_detections, homography, fps, hits):
        if main[frame] and all(abs(frame - e["frame"]) > suppression for e in events):
            events.append({"frame": frame, "x_px": round(point[0], 1), "y_px": round(point[1], 1),
                           "inferred": True})
    return sorted(events, key=lambda e: e["frame"])


__all__ = ["BounceClassifier", "FEATURES", "MIN_POINTS", "detect_bounces_trained", "frame_features"]
