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
                     "maxSpeedKmh": 150.0, "faults": 3, "firstServeAttempts": 3, "firstServeIn": 1,
                     "doubleFaults": 1}


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


def test_every_serve_speed_is_within_15_percent():
    """Criterio de TA-20: < 15 % de diferencia en al menos 10 saques, cada uno por separado,
    frente a la velocidad media real hasta el bote (la de la retransmisión convertida a media)."""
    camera = BroadcastCamera()
    homography = camera.homography()
    errors = []
    for seed in range(3):
        match = simulate_match(8, seed=seed + 10, fault_points=(3,))
        ball, players = render_detections(match, camera, seed=seed + 10)
        hits = detect_hits(ball, players, homography, 30)
        serves = detect_serves(ball, players, homography, 30, hits=hits)
        all_hits = sorted(set(hits) | {s["frame"] for s in serves})
        bounces = locate_bounces(detect_bounce_events(ball, players, homography, 30, hits=all_hits), ball,
                                 homography, 30, hits=all_hits)
        points = detect_points(ball, players, hits, bounces, 30, serves=serves)
        for measured in (a for p in points for a in p["serve_attempts"] if a["speedKmh"] is not None):
            real = min(match.serves, key=lambda s: abs(s["frame"] - measured["frame"]))
            errors.append(abs(measured["speedKmh"] / real["speedKmh"] - 1))
    assert len(errors) >= 10
    assert max(errors) < 0.15, sorted(errors)[-3:]


def test_aces_and_faults():
    """TA-21: aces = puntos ganados con el saque sin resto (TA-28) y faltas = saques fuera."""
    points = [
        {**point(attempt(), shots=1), "winner": 2, "win_reason": "saque no devuelto"},
        {**point(attempt(fault=True), attempt(), shots=2), "winner": 2, "win_reason": "saque no devuelto"},
        {**point(attempt(), shots=5), "winner": 1, "win_reason": "no devuelta"},
    ]
    stats = serve_stats(points, player=2)
    assert stats["aces"] == 2 and stats["faults"] == 1
    without_winners = serve_stats([point(attempt())], player=2)
    assert "aces" not in without_winners  # sin TA-28 no se sabe: se omite, nunca 0
    assert "faults" not in serve_stats([point(attempt(fault=None))], player=2)


def test_rally_shot_counts_are_right_within_one_in_90_percent_of_points():
    """Criterio de TA-35: el número de golpes de cada punto, ±1, en ≥ 90 % de los puntos.

    Verdad: golpes simulados del punto, saque incluido; un primer saque que fue falta no cuenta.
    """
    from stats import rally_length

    camera = BroadcastCamera()
    homography = camera.homography()
    diffs = []
    for seed in range(12):
        match = simulate_match(8, seed=seed, fault_points=(1,), out_points=(2, 5), double_fault_points=(6,),
                               max_shots=12)
        ball, players = render_detections(match, camera, seed=seed)
        hits = detect_hits(ball, players, homography, 30)
        serves = detect_serves(ball, players, homography, 30, hits=hits)
        all_hits = sorted(set(hits) | {s["frame"] for s in serves})
        bounces = locate_bounces(detect_bounce_events(ball, players, homography, 30, hits=all_hits), ball,
                                 homography, 30, hits=all_hits)
        points = detect_points(ball, players, hits, bounces, 30, serves=serves)
        for real in match.points:
            if real["how"] == "doble falta":
                truth = 1
            else:
                faults = sum(1 for s in match.serves if real["start"] <= s["frame"] <= real["end"] and s["fault"])
                truth = sum(1 for s in match.shots if real["start"] <= s["frame"] <= real["end"]) - min(faults, 1)
            best = max(points, key=lambda p: min(p["end"], real["end"]) - max(p["start"], real["start"]))
            diffs.append(rally_length(best) - truth)
    assert np.mean(np.abs(diffs) <= 1) >= 0.90


def test_rally_categories_use_the_configured_cuts():
    from stats import rally_category

    assert [rally_category(n) for n in (0, 4, 5, 8, 9)] == ["short", "short", "medium", "medium", "long"]
    assert [rally_category(n, 2, 5) for n in (2, 3, 5, 6)] == ["short", "medium", "medium", "long"]
    points = [{"shots": n, "serve_attempts": []} for n in (2, 3, 6)]
    assert rally_stats(points, 2, 5) == {"count": 3, "sumShots": 11, "longestShots": 6, "short": 1, "medium": 1,
                                         "long": 1}
