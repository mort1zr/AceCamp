"""Estadísticas de saque y de peloteos para matches.statistics (TA-17, TA-18)."""

import numpy as np
from ball_sim import BroadcastCamera, render_detections, simulate_match

from events import detect_bounce_events, detect_hits, detect_points, detect_serves, locate_bounces
from stats import (
    MATCH_STATS_VERSION,
    add_serve_and_rally_stats,
    build_model_statistics,
    rally_stats,
    serve_stats,
    to_match_statistics,
)


def attempt(player=2, side="derecha", fault=False, speed=None):
    return {"frame": 0, "player": player, "side": side, "fault": fault, "speedKmh": speed}


def point(*attempts, shots=1):
    return {"serve_attempts": list(attempts), "shots": shots}


def test_serve_stats_count_sides_speeds_first_serves_and_double_faults():
    points = [
        point(attempt(speed=150.0), shots=6),  # primer saque dentro
        point(attempt(side="izquierda", fault=True), attempt(side="izquierda", speed=120.0), shots=4),
        point(attempt(fault=True), attempt(fault=True), shots=2),  # doble falta
        point(attempt(player=1, speed=140.0), shots=3),  # saca el rival
    ]

    stats = serve_stats(points, player=2)

    assert stats == {"count": 5, "fromRight": 3, "fromLeft": 2, "sumSpeedKmh": 270.0, "sampleCount": 2,
                     "maxSpeedKmh": 150.0, "firstServeAttempts": 3, "firstServeIn": 1, "doubleFaults": 1}


def test_unknown_results_are_omitted_never_zero():
    unknown_first = serve_stats([point(attempt(fault=None))], player=2)
    unknown_second = serve_stats([point(attempt(fault=True))], player=2)  # no se vio el segundo saque

    assert "firstServeIn" not in unknown_first and "doubleFaults" not in unknown_first
    assert unknown_second["firstServeIn"] == 0 and "doubleFaults" not in unknown_second
    assert "maxSpeedKmh" not in unknown_first and unknown_first["sampleCount"] == 0


def test_a_player_who_did_not_serve_has_count_zero():
    assert serve_stats([point(attempt(player=1))], player=2) == {
        "count": 0, "fromRight": 0, "fromLeft": 0, "sumSpeedKmh": 0.0, "sampleCount": 0}


def test_rally_lengths_short_medium_long():
    points = [point(attempt(), shots=3), point(attempt(), shots=5), point(attempt(), shots=8),
              point(attempt(), shots=12), point(attempt(fault=True), attempt(), shots=5)]  # 5 con la falta: 4

    assert rally_stats(points) == {"count": 5, "sumShots": 32, "longestShots": 12, "short": 2, "medium": 2,
                                   "long": 1}


def test_serve_and_rallies_reach_match_statistics_for_the_registered_player():
    positions = [{1: (5.0, -1.0), 2: (5.0, 25.0)}] * 60
    model = build_model_statistics([], positions, fps=30, num_frames=60)
    add_serve_and_rally_stats(model, [point(attempt(player=1, speed=130.0), shots=7)])

    statistics = to_match_statistics(model, "arriba")  # el jugador registrado es el del fondo (1)

    assert statistics["schemaVersion"] == MATCH_STATS_VERSION
    assert statistics["player"]["serve"]["count"] == 1 and statistics["player"]["serve"]["sumSpeedKmh"] == 130.0
    assert statistics["opponent"]["serve"]["count"] == 0
    assert statistics["rallies"]["medium"] == 1


def test_simulated_match_serve_statistics_match_the_truth():
    camera = BroadcastCamera()
    homography = camera.homography()
    match = simulate_match(6, seed=2, fault_points=(1, 4))
    ball, players = render_detections(match, camera, seed=2)
    hits = detect_hits(ball, players, homography, 30)
    serves = detect_serves(ball, players, homography, 30, hits=hits)
    all_hits = sorted(set(hits) | {s["frame"] for s in serves})
    bounces = locate_bounces(detect_bounce_events(ball, players, homography, 30, hits=all_hits), ball, homography,
                             30, hits=all_hits)
    points = detect_points(ball, players, hits, bounces, 30, serves=serves)

    measured = 0
    for player in (1, 2):
        stats = serve_stats(points, player)
        measured += stats["sampleCount"]
        real = [s for s in match.serves if s["player"] == player]
        firsts = [s for s, prev in zip(match.serves, [None] + match.serves[:-1])
                  if s["player"] == player and not (prev and prev["fault"])]
        assert stats["count"] == len(real)
        assert stats["firstServeAttempts"] == len(firsts)
        assert stats["firstServeIn"] == sum(not s["fault"] for s in firsts)
        assert stats["doubleFaults"] == 0
    assert measured >= 0.8 * len(match.serves)  # velocidad medida en la mayoría de los saques

    # Cada velocidad de saque medida, frente a la real del mismo saque (media hasta el bote).
    errors = []
    for measured in (a for p in points for a in p["serve_attempts"] if a["speedKmh"] is not None):
        real = min(match.serves, key=lambda s: abs(s["frame"] - measured["frame"]))
        errors.append(measured["speedKmh"] / real["speedKmh"] - 1)
    assert np.mean(np.abs(errors)) < 0.05
