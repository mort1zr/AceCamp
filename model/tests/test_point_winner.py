"""Tests de TA-28: quién gana cada punto."""

import numpy as np
import pytest
from ball_sim import BroadcastCamera, render_detections, simulate_match

from court import COURT_KEYPOINTS_M, COURT_LENGTH, NET_Y, CourtHomography
from events import (
    call_bounces,
    decide_winners,
    detect_bounce_events,
    detect_hits,
    detect_points,
    detect_serves,
    locate_bounces,
)
from events.point_winner import confidence_level, decide_point

CAMERA = BroadcastCamera()
FPS = 30
FAR, NEAR = 1, 2


def bounce(frame, y_m, call="dentro", distance_cm=150, uncertainty_cm=20, x_m=5.0):
    return {"frame": frame, "x_m": x_m, "y_m": y_m, "call": call, "line_distance_cm": distance_cm,
            "uncertainty_cm": uncertainty_cm}


def point(start=0, end=200, server=NEAR, shots=3, attempts=None, end_reason="sin pelota"):
    if attempts is None:
        attempts = [{"player": server, "fault": False, "bounce_frame": None}]
    return {"start": start, "end": end, "server": server, "shots": shots, "serve_attempts": attempts,
            "end_reason": end_reason}


FAR_SIDE, NEAR_SIDE = NET_Y - 4, NET_Y + 4  # y de un bote en la mitad lejana y en la cercana


# --- Reglas -----------------------------------------------------------------------------------

def test_double_fault_goes_to_the_receiver():
    faults = [{"player": NEAR, "fault": True, "bounce_frame": 20}, {"player": NEAR, "fault": True,
                                                                     "bounce_frame": 120}]
    result = decide_point(point(server=NEAR, shots=2, attempts=faults), [], [10, 110], FPS)
    assert (result["winner"], result["win_reason"], result["confidence_level"]) == (FAR, "doble falta", "alta")


def test_ball_out_after_the_last_hit_goes_to_the_other_player():
    # El cercano (2) golpea en 60 hacia la mitad lejana y bota largo por el fondo lejano.
    bounces = [bounce(30, FAR_SIDE), bounce(50, NEAR_SIDE), bounce(80, -1.0, "fuera", -100)]
    result = decide_point(point(end_reason="fuera"), bounces, [10, 40, 60], FPS)
    assert (result["winner"], result["win_reason"]) == (FAR, "fuera")


def test_ball_in_that_is_not_returned_goes_to_the_hitter():
    bounces = [bounce(30, FAR_SIDE), bounce(50, NEAR_SIDE), bounce(80, FAR_SIDE)]
    result = decide_point(point(), bounces, [10, 40, 60], FPS)
    assert (result["winner"], result["win_reason"]) == (NEAR, "no devuelta")


def test_a_second_bounce_out_after_a_good_one_does_not_change_the_winner():
    """El ganador bota dentro y su segundo bote cae fuera: gana quien golpeó, no el rival."""
    bounces = [bounce(80, FAR_SIDE), bounce(100, -0.5, "fuera", -50)]
    result = decide_point(point(end_reason="doble bote"), bounces, [10, 60], FPS)
    assert (result["winner"], result["win_reason"], result["confidence_level"]) == (NEAR, "doble bote", "alta")


def test_unreturned_serve_goes_to_the_server():
    attempts = [{"player": FAR, "fault": False, "bounce_frame": 40}]
    result = decide_point(point(server=FAR, shots=1, attempts=attempts), [bounce(40, NEAR_SIDE)], [20], FPS)
    assert (result["winner"], result["win_reason"]) == (FAR, "saque no devuelto")


def test_no_bounce_after_the_last_hit_is_a_missed_shot_with_low_confidence():
    # Sin jugadores: el golpe en 60 lo da quien estaba en el lado del bote anterior (el lejano, 1),
    # así que gana el cercano.
    result = decide_point(point(), [bounce(30, FAR_SIDE)], [10, 60], FPS)
    assert (result["winner"], result["win_reason"], result["confidence_level"]) == (NEAR, "golpe fallado", "baja")


def test_doubtful_or_uncertain_calls_lower_the_confidence():
    clear = decide_point(point(end_reason="fuera"), [bounce(80, -1.0, "fuera", -100)], [60], FPS)
    doubtful = decide_point(point(), [bounce(80, 0.05, "dudoso", 5)], [60], FPS)
    uncertain = decide_point(point(end_reason="fuera"), [bounce(80, -0.3, "fuera", -30, uncertainty_cm=60)],
                             [60], FPS)
    assert clear["confidence"] > uncertain["confidence"] > doubtful["confidence"]
    assert doubtful["winner"] == NEAR  # dudoso = dentro: el lejano no la devolvió


def test_bounces_on_both_sides_after_the_last_hit_mean_a_missed_hit():
    """Se perdió el golpe del 1 en 70: cuenta el último lado y baja la confianza."""
    bounces = [bounce(50, FAR_SIDE), bounce(95, NEAR_SIDE)]
    result = decide_point(point(), bounces, [10, 40], FPS)
    assert result["winner"] == FAR
    assert not result["consistent"] and result["confidence_level"] != "alta"


def test_two_bounces_too_close_together_are_suspicious():
    """Dos "botes" a 0,3 s en el mismo lado: el segundo suele ser un golpe no detectado."""
    bounces = [bounce(80, FAR_SIDE), bounce(89, FAR_SIDE)]
    result = decide_point(point(end_reason="doble bote"), bounces, [60], FPS)
    assert not result["consistent"] and result["confidence_level"] != "alta"


@pytest.mark.parametrize("confidence, level", [(0.9, "alta"), (0.75, "alta"), (0.6, "media"), (0.3, "baja")])
def test_confidence_levels(confidence, level):
    assert confidence_level(confidence) == level


# --- Simulación de punta a punta ------------------------------------------------------------------

def winners_vs_truth(seeds):
    rows = []
    for seed in seeds:
        rng = np.random.default_rng(seed + 7)
        keypoints = CAMERA.project(np.c_[COURT_KEYPOINTS_M, np.zeros(14)]) + rng.normal(0, 0.5, (14, 2))
        homography = CourtHomography.from_keypoints(keypoints.ravel())
        match = simulate_match(num_points=8, seed=seed, fault_points=(1,), out_points=(2, 5),
                               double_fault_points=(6,))
        ball, players = render_detections(match, CAMERA, seed=seed)
        hits = detect_hits(ball, players, homography, FPS)
        serves = detect_serves(ball, players, homography, FPS, hits=hits)
        all_hits = sorted(set(hits) | {s["frame"] for s in serves})
        bounces = detect_bounce_events(ball, players, homography, FPS, hits=all_hits)
        bounces = locate_bounces(bounces, ball, homography, FPS, hits=all_hits,
                                 court_keypoints=[keypoints.ravel()] * len(ball))
        points = detect_points(ball, players, hits, bounces, FPS, serves=serves)
        points = decide_winners(points, call_bounces(bounces, points), all_hits, FPS, ball, players)
        for real in match.points:
            best = max(points, key=lambda p: min(p["end"], real["end"]) - max(p["start"], real["start"]))
            rows.append((real["winner"] == best["winner"], best["confidence_level"], real["how"]))
    return rows


def test_point_winners_on_simulated_matches():
    """Criterios de TA-28: ≥ 85 % de los puntos bien asignados, y los fallos se concentran en los
    de confianza baja o media. Partidos con ganadores, golpes fuera, faltas y dobles faltas."""
    rows = winners_vs_truth(range(12))
    assert {how for _, _, how in rows} == {"ganador", "fuera", "doble falta"}
    assert np.mean([ok for ok, _, _ in rows]) >= 0.85
    high = [ok for ok, level, _ in rows if level == "alta"]
    assert len(high) >= 20 and np.mean(high) >= 0.95
    errors = [level for ok, level, _ in rows if not ok]
    assert sum(level == "alta" for level in errors) <= len(errors) / 3


def test_no_points_no_winners():
    assert decide_winners([], [], [], FPS) == []
    assert COURT_LENGTH > NET_Y  # el lado se decide con la red: y < NET_Y es el lado lejano
