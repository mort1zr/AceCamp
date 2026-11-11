"""Tests de TA-22b: detector de botes entrenado."""

import numpy as np
from ball_sim import BroadcastCamera, render_detections, simulate_rally
from test_regression import load_case

from config import DEFAULTS
from eval.metrics import match_events
from events import detect_hits
from events.bounce_classifier import FEATURES, BounceClassifier, detect_bounces_trained, frame_features
from pipeline_analysis import analyze_detections

CAMERA = BroadcastCamera()


def test_logistic_regression_learns_a_separable_problem_and_round_trips(tmp_path):
    rng = np.random.default_rng(0)
    X = rng.normal(size=(400, len(FEATURES)))
    y = (X[:, 0] + 0.5 * X[:, 3] > 0.8).astype(int)  # pocos positivos, como los botes
    model = BounceClassifier.train(X, y)
    accuracy = np.mean((model.probabilities(X) >= 0.5) == y)
    assert accuracy > 0.9
    model.save(tmp_path / "w.json")
    loaded = BounceClassifier.load(tmp_path / "w.json")
    np.testing.assert_allclose(loaded.probabilities(X), model.probabilities(X), atol=1e-4)
    assert np.isnan(model.probabilities(np.full((1, len(FEATURES)), np.nan))[0])


def test_features_are_nan_where_the_ball_is_not_seen():
    rally = simulate_rally(4, seed=1)
    ball, players = render_detections(rally, CAMERA, seed=1)
    homography = CAMERA.homography()
    features = frame_features(ball, players, homography, 30, detect_hits(ball, players, homography, 30))
    assert features.shape == (len(ball), len(FEATURES))
    missing = [i for i, b in enumerate(ball) if 1 not in b]
    assert all(np.isnan(features[i]).all() for i in missing)


def test_saved_weights_detect_simulated_bounces():
    """Con los pesos del repositorio, F1 ≥ 0,8 en peloteos simulados que no se usaron para entrenar."""
    classifier = BounceClassifier.load()
    total = None
    for seed in range(10):
        rally = simulate_rally(6, seed=seed)
        ball, players = render_detections(rally, CAMERA, seed=seed)
        homography = CAMERA.homography()
        hits = detect_hits(ball, players, homography, 30)
        found = [e["frame"] for e in detect_bounces_trained(ball, players, homography, 30, classifier, hits=hits)]
        score, _ = match_events(found, [b["frame"] for b in rally.bounces], 2)
        total = score if total is None else total + score
    assert total.f1 >= 0.8


def test_config_switches_to_the_trained_detector():
    data, ball, players, homographies = load_case("input_video")
    config = {**DEFAULTS, "bounces": {"detector": "trained", "classifier": "models/bounce_classifier.json"}}
    analysis = analyze_detections(ball, players, data["court_keypoints"], homographies, [True] * len(ball),
                                  data["fps"], config)
    assert analysis["bounces"] and all("call" in b for b in analysis["bounces"] if "x_m" in b)
