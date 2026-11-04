import pandas as pd

from trackers.ball_tracker import BallTracker


def triangle_trajectory(num_frames, half_period):
    """Pelota que baja durante half_period fotogramas y luego sube, y así sucesivamente."""
    detections = []
    for i in range(num_frames):
        phase = i % (2 * half_period)
        y = phase if phase < half_period else 2 * half_period - phase
        y_center = 100 + 10 * y
        detections.append({1: [500.0, y_center - 5, 510.0, y_center + 5]})
    return detections


def test_detects_each_change_of_direction_as_a_shot():
    # Cambios de dirección en los fotogramas 40, 80, 120 y 160.
    detections = triangle_trajectory(num_frames=200, half_period=40)

    shots = BallTracker(model_path="no-se-carga.pt").get_ball_shot_frames(detections)

    assert len(shots) == 4
    for shot, expected in zip(shots, [40, 80, 120, 160]):
        assert abs(shot - expected) <= 3


def test_no_shots_when_the_ball_does_not_change_direction():
    detections = [{1: [500.0, 100.0 + i, 510.0, 110.0 + i]} for i in range(100)]

    assert BallTracker(model_path="no-se-carga.pt").get_ball_shot_frames(detections) == []


def test_runs_with_the_installed_pandas_version():
    # El fallo original solo aparecía con pandas >= 3 (copy-on-write).
    assert int(pd.__version__.split(".")[0]) >= 3
