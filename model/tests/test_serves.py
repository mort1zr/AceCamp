"""Tests de TA-18: detector de saque (y su uso en la división en puntos)."""

import json
from pathlib import Path

from ball_sim import BroadcastCamera, render_detections, simulate_match, simulate_rally

from court import CourtHomography
from eval.metrics import DetectionScore, match_events
from events import detect_bounce_events, detect_hits, detect_points, detect_serves, locate_bounces
from trackers.ball_selection import fill_short_gaps, select_ball

CAMERA = BroadcastCamera()
HOMOGRAPHY = CAMERA.homography()


def analyze(ball, players, homography, fps):
    hits = detect_hits(ball, players, homography, fps)
    bounces = locate_bounces(detect_bounce_events(ball, players, homography, fps, hits=hits), ball, homography,
                             fps, hits=hits)
    serves = detect_serves(ball, players, homography, fps, hits=hits)
    return serves, detect_points(ball, players, hits, bounces, fps, serves=serves)


def simulated(seeds, fps=30):
    for seed in seeds:
        match = simulate_match(5, fps=fps, seed=seed)
        ball, players = render_detections(match, CAMERA, seed=seed)
        yield match, analyze(ball, players, HOMOGRAPHY, fps)


# ---------------------------------------------------------------- saques


def test_serves_on_simulated_matches_meet_the_target():
    """Criterio de TA-18: precisión y recall ≥ 90 % (aquí, con partidos simulados), y jugador y lado bien."""
    score, player_ok, side_ok = DetectionScore(0, 0, 0), [], []
    for match, (serves, _) in simulated(range(10)):
        result, matched = match_events([s["frame"] for s in serves], [s["frame"] for s in match.serves], 3)
        score += result
        player_ok += [serves[i]["player"] == match.serves[j]["player"] for i, j in matched]
        side_ok += [serves[i]["side"] == match.serves[j]["side"] for i, j in matched]

    assert score.precision >= 0.9 and score.recall >= 0.9
    assert all(player_ok) and all(side_ok)


def test_a_rally_without_serve_has_no_serves():
    rally = simulate_rally(8, seed=3)
    ball, players = render_detections(rally, CAMERA, seed=3)

    assert detect_serves(ball, players, HOMOGRAPHY, 30) == []


def h1():
    data = json.loads((Path(__file__).parent / "data" / "h1_detections.json").read_text())
    candidates = [dict(enumerate(frame)) for frame in data["ball_candidates"]]
    ball = fill_short_gaps(select_ball(candidates, scale=data["size"][1] / 1080, fps=data["fps"]), 5)
    players = [{int(k): v for k, v in frame.items()} for frame in data["players"]]
    homographies = [CourtHomography.from_keypoints(k) for k in data["court_keypoints"]]
    return data, ball, players, homographies


def test_the_serve_of_a_real_highlight():
    """h1: saca el jugador cercano desde la izquierda (40-30, quinto punto del juego).
    La pelota está lanzada sobre su cabeza de los fotogramas 2 a 12 y desaparece con el golpe."""
    data, ball, players, homographies = h1()

    serves, points = analyze(ball, players, homographies, data["fps"])

    assert len(serves) == 1
    assert serves[0]["player"] == 2 and serves[0]["side"] == "izquierda"
    assert 11 <= serves[0]["frame"] <= 15
    assert len(points) == 1 and points[0]["server"] == 2 and points[0]["start"] <= 3
