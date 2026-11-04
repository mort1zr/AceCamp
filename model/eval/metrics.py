"""Métricas para comparar las predicciones del modelo con las etiquetas (TA-9)."""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass

# Tolerancias por defecto
EVENT_TOLERANCE_FRAMES = 2  # golpes, botes y saques: ± 2 fotogramas (criterios de TA-18 y TA-22)
CUT_TOLERANCE_FRAMES = 1
BALL_RADIUS_PX = 10.0  # una pelota detectada a menos de 10 px del centro real cuenta como acierto


@dataclass(frozen=True)
class DetectionScore:
    true_positives: int
    false_positives: int
    false_negatives: int

    @property
    def precision(self) -> float | None:
        found = self.true_positives + self.false_positives
        return self.true_positives / found if found else None

    @property
    def recall(self) -> float | None:
        real = self.true_positives + self.false_negatives
        return self.true_positives / real if real else None

    @property
    def f1(self) -> float | None:
        p, r = self.precision, self.recall
        if p is None or r is None or p + r == 0:
            return None
        return 2 * p * r / (p + r)

    def to_dict(self) -> dict:
        return {**asdict(self), "precision": self.precision, "recall": self.recall, "f1": self.f1}

    def __add__(self, other: DetectionScore) -> DetectionScore:
        return DetectionScore(self.true_positives + other.true_positives,
                              self.false_positives + other.false_positives,
                              self.false_negatives + other.false_negatives)


def match_events(predicted, actual, tolerance=EVENT_TOLERANCE_FRAMES):
    """Empareja eventos por fotograma (cada real con como mucho un predicho).

    Devuelve (DetectionScore, pares emparejados [(índice_predicho, índice_real)]).
    Se empareja de forma voraz, empezando por los pares más cercanos.
    """
    pairs = sorted(
        (abs(p - a), i, j)
        for i, p in enumerate(predicted)
        for j, a in enumerate(actual)
        if abs(p - a) <= tolerance
    )
    used_p, used_a, matched = set(), set(), []
    for _, i, j in pairs:
        if i not in used_p and j not in used_a:
            used_p.add(i)
            used_a.add(j)
            matched.append((i, j))
    score = DetectionScore(len(matched), len(predicted) - len(matched), len(actual) - len(matched))
    return score, sorted(matched)


def ball_detection(predicted, actual, radius_px=BALL_RADIUS_PX):
    """Detección de la pelota en los fotogramas etiquetados.

    predicted y actual: {fotograma: (x, y) o None}. Solo cuentan los fotogramas de actual.
    Una predicción lejos de la pelota real cuenta como falso positivo y como fallo.
    """
    tp = fp = fn = 0
    for frame, truth in actual.items():
        guess = predicted.get(frame)
        if truth is None:
            fp += guess is not None
        elif guess is None:
            fn += 1
        elif math.dist(guess, truth) <= radius_px:
            tp += 1
        else:
            fp += 1
            fn += 1
    return DetectionScore(tp, fp, fn)


def keypoints_error(predicted, actual):
    """Error medio en píxeles de los puntos clave en los fotogramas etiquetados en ambos."""
    distances = [
        math.dist(p, a)
        for frame in actual.keys() & predicted.keys()
        for p, a in zip(predicted[frame], actual[frame])
    ]
    return sum(distances) / len(distances) if distances else None


def bounce_position_error(predicted, actual, tolerance=EVENT_TOLERANCE_FRAMES):
    """Error medio en metros de la posición de los botes emparejados que tienen posición."""
    _, matched = match_events([b["frame"] for b in predicted], [b["frame"] for b in actual], tolerance)
    errors = [
        math.dist((predicted[i]["x_m"], predicted[i]["y_m"]), (actual[j]["x_m"], actual[j]["y_m"]))
        for i, j in matched
        if {"x_m", "y_m"} <= predicted[i].keys() and {"x_m", "y_m"} <= actual[j].keys()
    ]
    return sum(errors) / len(errors) if errors else None


def point_winner_accuracy(predicted, actual, tolerance_frames=30):
    """Fracción de puntos reales cuyo ganador acierta el modelo (emparejando por inicio del punto)."""
    if not actual:
        return None
    _, matched = match_events([p["start"] for p in predicted], [a["start"] for a in actual], tolerance_frames)
    correct = sum(predicted[i]["winner"] == actual[j]["winner"] for i, j in matched)
    return correct / len(actual)


def evaluate(predicted: dict, actual: dict) -> dict:
    """Todas las métricas aplicables a un clip. Solo se evalúa lo que está en ambos."""
    result = {}
    if "ball" in actual and "ball" in predicted:
        result["ball"] = ball_detection(predicted["ball"], actual["ball"])
    if "court_keypoints" in actual and "court_keypoints" in predicted:
        result["court_keypoints_error_px"] = keypoints_error(predicted["court_keypoints"], actual["court_keypoints"])
    for key in ("shots", "bounces", "serves"):
        if key in actual and key in predicted:
            result[key], _ = match_events([e["frame"] for e in predicted[key]], [e["frame"] for e in actual[key]])
    if "cuts" in actual and "cuts" in predicted:
        result["cuts"], _ = match_events(predicted["cuts"], actual["cuts"], CUT_TOLERANCE_FRAMES)
    if "bounces" in actual and "bounces" in predicted:
        result["bounce_position_error_m"] = bounce_position_error(predicted["bounces"], actual["bounces"])
    if "points" in actual and "points" in predicted:
        result["point_winner_accuracy"] = point_winner_accuracy(predicted["points"], actual["points"])
    return result
