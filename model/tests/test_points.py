"""Tests de TA-17: dividir el vídeo en puntos."""

import numpy as np
from ball_sim import BroadcastCamera, render_detections, simulate_match

from events import detect_bounce_events, detect_hits, detect_points, locate_bounces
from events.points import point_boundaries_ok

CAMERA = BroadcastCamera()
HOMOGRAPHY = CAMERA.homography()


def analyze(ball, players, homography, fps):
    hits = detect_hits(ball, players, homography, fps)
    bounces = locate_bounces(detect_bounce_events(ball, players, homography, fps, hits=hits), ball, homography,
                             fps, hits=hits)
    return [], detect_points(ball, players, hits, bounces, fps)


def simulated(seeds, fps=30):
    for seed in seeds:
        match = simulate_match(5, fps=fps, seed=seed)
        ball, players = render_detections(match, CAMERA, seed=seed)
        yield match, analyze(ball, players, HOMOGRAPHY, fps)


# ---------------------------------------------------------------- TA-17


def test_points_on_simulated_matches_meet_the_target():
    """Criterio de TA-17: ≥ 90 % de los puntos con inicio y fin a menos de 1 s (aquí, partidos simulados)."""
    ok, server_ok = [], []
    for match, (_, points) in simulated(range(10)):
        ok.append(point_boundaries_ok(points, match.points, match.fps))
        for real in match.points:
            closest = min(points, key=lambda p: abs(p["start"] - real["start"]))
            server_ok.append(closest["server"] == real["server"])

    assert np.mean(ok) >= 0.9
    assert np.mean(server_ok) >= 0.95


def test_points_at_50_fps():
    ok = [point_boundaries_ok(points, match.points, 50) for match, (_, points) in simulated(range(4), fps=50)]

    assert np.mean(ok) >= 0.9


def visible_ball(frames):
    return [{1: [100.0 + i, 100.0, 106.0 + i, 106.0]} if i in frames else {} for i in range(max(frames) + 40)]


def test_a_first_serve_fault_and_the_second_serve_are_one_point():
    fps = 30
    first = set(range(0, 40))  # primer saque: lanzamiento, golpe en 20 y bote fuera del cuadro
    second = set(range(300, 420))  # segundo saque 9 s después, y peloteo
    ball = visible_ball(first | second)
    players = [{1: [500, 50, 530, 120], 2: [80, 80, 140, 260]}] * len(ball)
    serves = [{"frame": 20, "player": 2, "side": "derecha", "toss_start": 0},
              {"frame": 320, "player": 2, "side": "derecha", "toss_start": 300}]
    bounces = [{"frame": 30, "x_m": 5.0, "y_m": 2.0},  # detrás de la línea de saque: falta
               {"frame": 340, "x_m": 4.0, "y_m": 9.0}]
    hits = [360, 390]

    points = detect_points(ball, players, hits, bounces, fps, serves=serves)

    assert len(points) == 1
    assert points[0]["serve_frames"] == [20, 320]
    assert points[0]["start"] == 0


def test_an_ace_is_not_merged_with_the_next_point():
    fps = 30
    ball = visible_ball(set(range(0, 40)) | set(range(300, 420)))
    players = [{1: [500, 50, 530, 120], 2: [80, 80, 140, 260]}] * len(ball)
    serves = [{"frame": 20, "player": 2, "side": "derecha", "toss_start": 0},
              {"frame": 320, "player": 2, "side": "izquierda", "toss_start": 300}]
    bounces = [{"frame": 30, "x_m": 4.0, "y_m": 8.0},  # dentro del cuadro de saque
               {"frame": 340, "x_m": 7.0, "y_m": 9.0}]

    points = detect_points(ball, players, [360, 390], bounces, fps, serves=serves)

    assert [p["start"] for p in points] == [0, 300]
