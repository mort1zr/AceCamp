"""Tests de TA-26: pelota que se queda en la red."""

import numpy as np
from ball_sim import BroadcastCamera, render_detections, simulate_match
from test_point_winner import FAR, FAR_SIDE, FPS, NEAR, NEAR_SIDE, bounce, point

from court import COURT_KEYPOINTS_M, CourtHomography
from events import (
    call_bounces,
    decide_winners,
    detect_bounce_events,
    detect_hits,
    detect_points,
    detect_serves,
    locate_bounces,
)
from events.point_winner import decide_point

CAMERA = BroadcastCamera()


def players_and_ball(n, striker_frame, striker):
    """Jugador 1 arriba (y 100 px) y 2 abajo (y 600 px); en striker_frame la pelota está junto al que golpea."""
    players = [{1: [600, 80, 640, 120], 2: [600, 580, 640, 620]} for _ in range(n)]
    ball = [{} for _ in range(n)]
    ball[striker_frame] = {1: [610, 100, 615, 105] if striker == FAR else [610, 590, 615, 595]}
    return ball, players


def test_ball_bouncing_on_the_strikers_side_is_a_net_ball():
    # El cercano (2) golpea en 60 y la pelota cae en su propio campo, cerca de la red.
    ball, players = players_and_ball(200, 60, NEAR)
    # 40: golpea el 1 → bota en el lado 2 (50) → 60: golpea el 2 → se queda en su lado (80).
    bounces = [bounce(30, FAR_SIDE), bounce(50, NEAR_SIDE), bounce(80, NEAR_SIDE - 2.5)]
    result = decide_point(point(), bounces, [10, 40, 60], FPS, ball, players)
    assert (result["winner"], result["win_reason"]) == (FAR, "red")
    assert result["confidence_level"] != "alta"


def test_no_net_ball_when_the_striker_is_unclear():
    """El jugador más cercano no cuadra con el lado del bote anterior: no se marca como red."""
    ball, players = players_and_ball(200, 60, FAR)  # parece el 1, pero el bote anterior fue del lado 2
    bounces = [bounce(50, NEAR_SIDE), bounce(80, NEAR_SIDE)]
    result = decide_point(point(), bounces, [10, 40, 60], FPS, ball, players)
    assert result["win_reason"] != "red"


def test_net_balls_on_simulated_matches_are_detected():
    """Criterio de TA-26: ≥ 80 % de las bolas a la red detectadas (y el punto, para el rival)."""
    found, total, right_winner = 0, 0, 0
    for seed in range(12):
        rng = np.random.default_rng(seed + 7)
        keypoints = CAMERA.project(np.c_[COURT_KEYPOINTS_M, np.zeros(14)]) + rng.normal(0, 0.5, (14, 2))
        homography = CourtHomography.from_keypoints(keypoints.ravel())
        match = simulate_match(num_points=6, seed=seed, net_points=(1, 4))
        ball, players = render_detections(match, CAMERA, seed=seed)
        hits = detect_hits(ball, players, homography, FPS)
        serves = detect_serves(ball, players, homography, FPS, hits=hits)
        all_hits = sorted(set(hits) | {s["frame"] for s in serves})
        bounces = detect_bounce_events(ball, players, homography, FPS, hits=all_hits)
        bounces = locate_bounces(bounces, ball, homography, FPS, hits=all_hits,
                                 court_keypoints=[keypoints.ravel()] * len(ball))
        points = detect_points(ball, players, hits, bounces, FPS, serves=serves)
        points = decide_winners(points, call_bounces(bounces, points), all_hits, FPS, ball, players)
        for real in (p for p in match.points if p["how"] == "red"):
            total += 1
            best = max(points, key=lambda p: min(p["end"], real["end"]) - max(p["start"], real["start"]))
            found += best["win_reason"] == "red"
            right_winner += best["winner"] == real["winner"]
    assert total >= 20
    assert found / total >= 0.80
    assert right_winner / total >= 0.85
