"""Entrena el detector de botes de TA-22b con peloteos simulados y lo evalúa.

Uso (desde model/): python training/train_bounce_classifier.py

- Entrenamiento: peloteos simulados (tests/ball_sim.py) a 25, 30 y 50 fps, con ruido y pérdidas
  de pelota distintos; no usa el set de validación (TA-9).
- Etiqueta de cada fotograma: 1 si está a ±1 fotograma de un bote real.
- Evaluación: peloteos simulados que no se usaron para entrenar y los botes reales marcados a
  mano (tests/data: vídeo de ejemplo y h1), frente al detector de reglas (TA-22a).
- Guarda los pesos en models/bounce_classifier.json (texto, unos cientos de bytes).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path[:0] = [str(ROOT), str(ROOT / "tests")]

from ball_sim import BroadcastCamera, render_detections, simulate_rally  # noqa: E402

from court import COURT_KEYPOINTS_M, CourtHomography  # noqa: E402
from eval.metrics import match_events  # noqa: E402
from events import detect_bounce_events, detect_hits  # noqa: E402
from events.bounce_classifier import (  # noqa: E402
    DEFAULT_WEIGHTS,
    BounceClassifier,
    detect_bounces_trained,
    frame_features,
)
from trackers.ball_selection import fill_short_gaps, select_ball  # noqa: E402

CAMERA = BroadcastCamera()
TRAIN_SEEDS = range(100, 160)
TEST_SEEDS = range(0, 30)


def simulated(seed):
    rng = np.random.default_rng(seed)
    fps = float(rng.choice([25.0, 30.0, 30.0, 50.0]))
    noise = float(rng.uniform(1.0, 3.0))
    miss = float(rng.uniform(0.0, 0.08))
    keypoints = CAMERA.project(np.c_[COURT_KEYPOINTS_M, np.zeros(14)]) + rng.normal(0, 0.5, (14, 2))
    homography = CourtHomography.from_keypoints(keypoints.ravel())
    rally = simulate_rally(int(rng.integers(3, 10)), fps=fps, seed=seed, last_out=bool(seed % 3 == 0))
    ball, players = render_detections(rally, CAMERA, noise_px=noise, miss_rate=miss, seed=seed)
    return ball, players, homography, fps, [b["frame"] for b in rally.bounces]


def real_cases():
    data_dir = ROOT / "tests" / "data"
    for name in ("input_video", "h1"):
        data = json.loads((data_dir / f"{name}_detections.json").read_text())
        players = [{int(k): v for k, v in f.items()} for f in data["players"]]
        if "ball" in data:
            ball = [{int(k): v for k, v in f.items()} for f in data["ball"]]
        else:
            candidates = [dict(enumerate(frame)) for frame in data["ball_candidates"]]
            ball = fill_short_gaps(select_ball(candidates, scale=data["size"][1] / 1080, fps=data["fps"]), 5)
        homographies = [CourtHomography.from_keypoints(k) for k in data["court_keypoints"]]
        yield name, ball, players, homographies, data["fps"], data["bounces_labeled"]


def training_set():
    X, y = [], []
    for seed in TRAIN_SEEDS:
        ball, players, homography, fps, truth = simulated(seed)
        hits = detect_hits(ball, players, homography, fps)
        features = frame_features(ball, players, homography, fps, hits)
        for i, row in enumerate(features):
            if not np.isnan(row).any():
                X.append(row)
                y.append(int(any(abs(i - t) <= 1 for t in truth)))
    return np.array(X), np.array(y)


def f1_scores(classifier, cases):
    rules, trained = [], []
    for ball, players, homography, fps, truth in cases:
        hits = detect_hits(ball, players, homography, fps)
        a = [e["frame"] for e in detect_bounce_events(ball, players, homography, fps, hits=hits)]
        b = [e["frame"] for e in detect_bounces_trained(ball, players, homography, fps, classifier, hits=hits)]
        rules.append(match_events(a, truth, 2)[0])
        trained.append(match_events(b, truth, 2)[0])
    return rules, trained


def pooled_f1(results):
    tp = sum(r.true_positives for r in results)
    fp = sum(r.false_positives for r in results)
    fn = sum(r.false_negatives for r in results)
    return 2 * tp / max(2 * tp + fp + fn, 1)


def main():
    X, y = training_set()
    print(f"Entrenamiento: {len(y)} fotogramas, {int(y.sum())} junto a un bote")
    best = None
    for threshold in (0.5, 0.6, 0.7, 0.8, 0.9):
        classifier = BounceClassifier.train(X, y, threshold=threshold)
        _, trained = f1_scores(classifier, [simulated(s) for s in range(200, 215)])  # validación simulada
        score = pooled_f1(trained)
        print(f"  umbral {threshold}: F1 {score:.3f} (validación simulada)")
        if best is None or score > best[0]:
            best = (score, classifier)
    classifier = best[1]
    classifier.save(DEFAULT_WEIGHTS)
    print(f"Pesos guardados en {DEFAULT_WEIGHTS} (umbral {classifier.threshold})")

    rules, trained = f1_scores(classifier, [simulated(s) for s in TEST_SEEDS])
    print(f"Simulación de prueba: F1 reglas {pooled_f1(rules):.3f} | entrenado {pooled_f1(trained):.3f}")
    for name, ball, players, homographies, fps, truth in real_cases():
        r, t = f1_scores(classifier, [(ball, players, homographies, fps, truth)])
        print(f"Real {name} ({len(truth)} botes): F1 reglas {r[0].f1:.3f} | entrenado {t[0].f1:.3f}")


if __name__ == "__main__":
    main()
