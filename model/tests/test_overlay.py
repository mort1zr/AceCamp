"""Tests de TA-13: estadísticas por fotograma, medición de golpes y overlay a escala."""

import math

import numpy as np
import pytest

from mini_court import MiniCourt
from stats import FrameState, PlayerFrameStats, build_frame_states, measure_shots
from utils.player_stats_drawer_utils import MISSING, StatsBox, format_speed, frame_scale

# ------------------------------------------------- estadísticas por fotograma


def shot(frame, player, speed, opponent_speed):
    return {"frame": frame, "player": player, "speedKmh": speed, "opponentSpeedKmh": opponent_speed}


def test_before_the_first_shot_nothing_is_measured_yet():
    states = build_frame_states([shot(10, 1, 100.0, 5.0)], num_frames=20)

    assert states[0].players[1] == PlayerFrameStats()
    assert states[9].players[2].avg_speed_kmh is None  # antes daba nan (0 / 0)


def test_states_accumulate_shots_and_opponent_speed():
    states = build_frame_states(
        [shot(10, 1, 100.0, 6.0), shot(40, 2, 80.0, 4.0), shot(70, 1, 120.0, 8.0)], num_frames=100)

    p1, p2 = states[99].players[1], states[99].players[2]
    assert (p1.shots, p1.last_shot_kmh, p1.avg_shot_kmh) == (2, 120.0, 110.0)
    assert (p2.shots, p2.last_shot_kmh, p2.avg_shot_kmh) == (1, 80.0, 80.0)
    # El jugador 2 se mide en cada golpe del 1; el jugador 1, en el golpe del 2.
    assert (p2.last_speed_kmh, p2.avg_speed_kmh) == (8.0, 7.0)
    assert (p1.last_speed_kmh, p1.avg_speed_kmh) == (4.0, 4.0)
    # Entre golpes el estado no cambia y se comparte el mismo objeto.
    assert states[40] is states[69]
    assert states[39].players[2].shots == 0


def test_one_state_per_frame_even_without_shots():
    states = build_frame_states([], num_frames=5)

    assert len(states) == 5
    assert all(isinstance(s, FrameState) for s in states)


# ---------------------------------------------------------- golpes


def box_at(x, y, w=40, h=100):
    return [x - w / 2, y - h, x + w / 2, y]  # caja con los pies en (x, y)


def test_measure_shots_attributes_each_shot_and_measures_speeds():
    fps = 30
    ball = [{} for _ in range(61)]
    ball[0] = {1: [495, 95, 505, 105]}  # junto al jugador 1 (pies en 500, 100)
    ball[30] = {1: [495, 795, 505, 805]}  # junto al jugador 2 (pies en 500, 800)
    players = [{1: box_at(500, 100), 2: box_at(500, 800)} for _ in range(61)]
    positions = [{1: (5.0, -1.0), 2: (5.0, 25.0)} for _ in range(61)]
    positions[30] = {1: (5.0, -1.0), 2: (8.0, 25.0)}  # el 2 se desplaza 3 m mientras llega la pelota

    shots = measure_shots([0, 30, 60], ball, players, positions, fps)

    assert [s["player"] for s in shots] == [1, 2]
    assert shots[0]["speedKmh"] == pytest.approx(math.hypot(3.0, 26.0) / 1.0 * 3.6)  # 26,2 m en 1 s
    assert shots[0]["opponentSpeedKmh"] == pytest.approx(3.0 * 3.6)
    assert shots[1]["endFrame"] == 60


def test_a_shot_without_the_ball_in_its_frame_is_skipped():
    players = [{1: box_at(500, 100), 2: box_at(500, 800)}] * 31
    positions = [{1: (5.0, -1.0), 2: (5.0, 25.0)}] * 31

    assert measure_shots([0, 30], [{}] * 31, players, positions, fps=30) == []


# ------------------------------------------------------------ overlay


def test_missing_values_are_shown_as_a_dash_never_nan():
    assert format_speed(None) == MISSING
    assert format_speed(float("nan")) == MISSING
    assert format_speed(81.66) == "81.7 km/h"


@pytest.mark.parametrize("size", [(1920, 1080), (1280, 720), (854, 480), (1080, 1920)],
                         ids=["1080p", "720p", "480p", "vertical"])
def test_mini_court_and_stats_box_fit_in_the_frame_without_overlapping(size):
    width, height = size
    frame = np.zeros((height, width, 3), np.uint8)

    mini = MiniCourt(frame)
    box = StatsBox(frame.shape, right=mini.end_x, top=mini.end_y)

    for x0, y0, x1, y1 in [(mini.start_x, mini.start_y, mini.end_x, mini.end_y),
                           (box.start_x, box.start_y, box.end_x, box.end_y)]:
        assert 0 <= x0 < x1 <= width and 0 <= y0 < y1 <= height
    assert box.start_y > mini.end_y
    assert box.end_y - box.start_y == box.height  # la caja no se recorta por abajo


def test_the_overlay_shrinks_with_the_frame():
    assert frame_scale((1080, 1920)) == 1.0
    assert frame_scale((720, 1280)) == pytest.approx(2 / 3)

    small = MiniCourt(np.zeros((720, 1280, 3), np.uint8))
    large = MiniCourt(np.zeros((1080, 1920, 3), np.uint8))
    assert small.drawing_rectangle_height == pytest.approx(large.drawing_rectangle_height * 2 / 3, abs=1)


def test_drawing_the_stats_box_before_any_shot_works():
    frame = np.zeros((720, 1280, 3), np.uint8)
    mini = MiniCourt(frame)
    box = StatsBox(frame.shape, right=mini.end_x, top=mini.end_y)

    box.draw(frame, build_frame_states([], 1)[0])

    region = frame[box.start_y:box.end_y, box.start_x:box.end_x]
    assert region.any()  # se dibujaron los textos
    assert not frame[:, :box.start_x - 1].any()  # nada fuera de la caja


def test_impossible_speeds_and_shots_without_the_opponent_returning_are_not_measured():
    """Con el contador original, a 50 fps salían golpes falsos muy seguidos y velocidades de ~975 km/h."""
    fps = 50
    players = [{1: box_at(500, 100), 2: box_at(500, 800)} for _ in range(200)]
    positions = [{1: (5.0, -1.0), 2: (5.0, 25.0)} for _ in range(200)]
    ball = [{1: [495, 95, 505, 105]} if i < 100 else {1: [495, 795, 505, 805]} for i in range(200)]

    too_fast = measure_shots([0, 3], ball, players, positions, fps, hitters={0: 1, 3: 2})  # 26 m en 0,06 s
    same_player = measure_shots([0, 50], ball, players, positions, fps, hitters={0: 1, 50: 1})
    fine = measure_shots([0, 50], ball, players, positions, fps, hitters={0: 1, 50: 2})

    assert too_fast == [] and same_player == []
    assert fine[0]["speedKmh"] == pytest.approx(math.hypot(0, 26.0) / 1.0 * 3.6)
