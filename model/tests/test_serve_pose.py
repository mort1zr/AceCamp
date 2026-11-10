"""Tests de TA-19: coherencia del sacador por juego y comprobación de la pose."""

import numpy as np

from events.serve_pose import crop_box, filter_serves_by_pose, fix_servers, wrist_above_head
from scoreboard import score_points


def points(servers, winners=None):
    winners = winners or [1] * len(servers)
    raw = [{"winner": w, "server": s, "start": 10 * k, "end": 10 * k + 5, "confidence_level": "alta",
            "serve_attempts": [{"frame": 10 * k, "player": s, "side": "derecha", "fault": False}]}
           for k, (s, w) in enumerate(zip(servers, winners))]
    return score_points(raw, {"first_server": 1})[0]


def test_an_outlier_server_inside_a_game_is_fixed():
    fixed = fix_servers(points([1, 1, 2, 1]))  # el 3.º punto, mal atribuido al 2
    assert [p["server"] for p in fixed] == [1, 1, 1, 1]
    assert fixed[2]["server_fixed"] and fixed[2]["serve_attempts"][0]["player"] == 1
    assert not fixed[0].get("server_fixed")


def test_next_game_keeps_its_own_server_and_ties_use_the_scoreboard():
    # Juego 1: los 4 puntos los gana el 1 (saca el 1). Juego 2 (saca el 2): 2 vistos por el 1 y 2 por el 2.
    fixed = fix_servers(points([1, 1, 1, 1, 1, 2, 1, 2]))
    assert [p["server"] for p in fixed[4:]] == [2, 2, 2, 2]  # empate → el sacador del marcador (2)


def test_tiebreak_points_are_not_touched():
    raw = [{"winner": 1, "server": s, "start": k, "end": k, "confidence_level": "alta", "serve_attempts": []}
           for k, s in enumerate([1, 2, 2, 1])]
    scored, _ = score_points(raw, {"initial_score": {"games": [6, 6], "points": [0, 0]}, "first_server": 1})
    assert [p["server"] for p in fix_servers(scored)] == [1, 2, 2, 1]


def keypoints(head_y, wrist_y, confidence=0.9):
    kp = np.zeros((17, 3))
    kp[0:5, 1], kp[0:5, 2] = head_y, confidence
    kp[9:11, 1], kp[9:11, 2] = wrist_y, confidence
    return kp


def test_wrist_above_head():
    assert wrist_above_head(keypoints(head_y=100, wrist_y=60)) is True
    assert wrist_above_head(keypoints(head_y=100, wrist_y=180)) is False
    assert wrist_above_head(keypoints(head_y=100, wrist_y=60, confidence=0.1)) is None


def test_crop_box_extends_upwards_and_stays_in_the_frame():
    x1, y1, x2, y2 = crop_box((100, 100, 140, 200), (720, 1280, 3))
    assert y1 < 100 and x1 < 100 and x2 > 140 and y1 >= 0
    assert crop_box((0, 0, 40, 100), (720, 1280, 3))[:2] == (0, 0)


class FakeVerifier:
    def __init__(self, verdicts):
        self.verdicts = verdicts

    def confirms(self, frames, boxes):
        return self.verdicts.pop(0)


def test_serves_contradicted_by_the_pose_are_dropped_and_unseen_ones_kept():
    serves = [{"frame": 10, "player": 1}, {"frame": 50, "player": 2}, {"frame": 90, "player": 1}]
    players = [{1: [0, 0, 10, 10], 2: [0, 0, 10, 10]} for _ in range(100)]
    frames = {i: np.zeros((20, 20, 3), np.uint8) for i in range(100)}
    kept = filter_serves_by_pose(serves, players, FakeVerifier([True, False, None]), frames)
    assert [s["frame"] for s in kept] == [10, 90]
    assert [s["pose_confirmed"] for s in kept] == [True, None]
