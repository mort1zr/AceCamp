"""Tests de TA-23: posición de cada bote en la pista, en metros, con su incertidumbre."""

import numpy as np
import pytest
from ball_sim import BroadcastCamera, render_detections, simulate_rally
from test_bounces import real_video

from court import COURT_KEYPOINTS_M, COURT_LENGTH, DOUBLES_WIDTH, CourtHomography
from eval.metrics import match_events
from events import detect_bounce_events, detect_hits, locate_bounces

CAMERA = BroadcastCamera()


def located_errors(seeds, noise_px=1.5, keypoint_noise_px=0.0):
    errors, uncertainties = [], []
    for seed in seeds:
        rng = np.random.default_rng(seed + 50)
        keypoints = CAMERA.project(np.c_[COURT_KEYPOINTS_M, np.zeros(14)]) + rng.normal(0, keypoint_noise_px, (14, 2))
        homography = CourtHomography.from_keypoints(keypoints.ravel())
        rally = simulate_rally(8, seed=seed)
        ball, players = render_detections(rally, CAMERA, noise_px=noise_px, seed=seed)
        hits = detect_hits(ball, players, homography, 30)
        events = detect_bounce_events(ball, players, homography, 30, hits=hits)
        located = locate_bounces(events, ball, homography, 30, hits=hits,
                                 court_keypoints=[keypoints.ravel()] * len(ball))
        _, matched = match_events([e["frame"] for e in located], [b["frame"] for b in rally.bounces], 2)
        for i, j in matched:
            truth = (rally.bounces[j]["x_m"], rally.bounces[j]["y_m"])
            errors.append(np.hypot(located[i]["x_m"] - truth[0], located[i]["y_m"] - truth[1]))
            uncertainties.append(located[i]["uncertainty_cm"] / 100)
    return np.array(errors), np.array(uncertainties)


def test_mean_position_error_is_below_30_cm():
    """Criterio de TA-23: error medio < 30 cm (aquí, frente a la posición real de los peloteos simulados)."""
    errors, _ = located_errors(range(20))

    assert errors.mean() < 0.30


def test_an_imprecise_court_detection_still_meets_the_target():
    errors, _ = located_errors(range(20), keypoint_noise_px=3.0)

    assert errors.mean() < 0.30


def test_the_uncertainty_covers_most_errors():
    errors, uncertainties = located_errors(range(20))

    assert np.mean(errors <= 2 * uncertainties) >= 0.9


def test_bounces_of_the_sample_video_fall_on_the_court_and_inferred_ones_are_less_certain():
    data, ball, players, homographies = real_video()
    hits = detect_hits(ball, players, homographies, data["fps"])
    events = detect_bounce_events(ball, players, homographies, data["fps"], hits=hits)

    located = locate_bounces(events, ball, homographies, data["fps"], hits=hits,
                             court_keypoints=data["court_keypoints"])

    assert len(located) == len(events) == 5
    for bounce in located:
        assert -0.5 <= bounce["x_m"] <= DOUBLES_WIDTH + 0.5
        assert -0.5 <= bounce["y_m"] <= COURT_LENGTH + 0.5
    seen = [b["uncertainty_cm"] for b in located if not b["inferred"]]
    inferred = [b["uncertainty_cm"] for b in located if b["inferred"]]
    assert seen and inferred and max(seen) < min(inferred)
    assert max(seen) <= 30


def test_a_bounce_without_court_is_skipped():
    events = [{"frame": 0, "x_px": 10.0, "y_px": 10.0, "inferred": True}]

    assert locate_bounces(events, [{}], [None], 30) == []


@pytest.mark.parametrize("inferred", [False, True])
def test_locating_keeps_the_event_fields(inferred):
    homography = CAMERA.homography()
    point = CAMERA.project([[5.0, 20.0, 0.0]])[0]
    events = [{"frame": 0, "x_px": float(point[0]), "y_px": float(point[1]), "inferred": inferred}]

    located = locate_bounces(events, [{1: [point[0] - 5, point[1] - 5, point[0] + 5, point[1] + 5]}], homography, 30)

    assert located[0]["inferred"] is inferred
    assert located[0]["x_m"] == pytest.approx(5.0, abs=0.01)
    assert located[0]["y_m"] == pytest.approx(20.0, abs=0.01)
