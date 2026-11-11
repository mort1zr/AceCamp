"""Tests de TA-32: posiciones de los jugadores durante los puntos."""

import csv
import math

from test_match_report import sample_analysis

from report import build_report, write_report
from report.positions import POSITION_COLUMNS, position_rows
from scoreboard import score_points


def scored(*spans):
    points, _ = score_points([{"winner": 1, "server": 1, "start": a, "end": b, "confidence_level": "alta"}
                              for a, b in spans])
    return points


def test_only_frames_of_the_main_camera_inside_points_are_kept():
    positions = [{1: (5.0, 1.0), 2: (5.0, 22.0)} for _ in range(30)]
    positions[3] = {1: (math.nan, math.nan), 2: (5.0, 22.0)}  # jugador 1 sin posición
    main = [True] * 30
    main[12] = False  # repetición: fuera de la cámara principal
    rows = position_rows(positions, scored((2, 5), (10, 14)), 30, main)
    frames = sorted({r["frame"] for r in rows})
    assert frames == [2, 3, 4, 5, 10, 11, 13, 14]  # sin la pausa 6-9 ni el 12
    assert sum(r["frame"] == 3 for r in rows) == 1  # el jugador sin posición no se guarda
    assert {r["point"] for r in rows} == {1, 2}
    assert all(r["set"] == 1 and r["game"] == 1 for r in rows)
    assert rows[0] == {"frame": 2, "time_s": 0.067, "player": 1, "x_m": 5.0, "y_m": 1.0, "point": 1, "game": 1,
                       "set": 1}


def test_positions_csv_has_frame_player_x_y_point_game_and_set(tmp_path):
    """Criterio de TA-32: positions.csv con fotograma, jugador, x, y, punto, juego y set."""
    data, analysis = sample_analysis()
    write_report(build_report(analysis, data["fps"]), tmp_path, positions=analysis["positions"])
    rows = list(csv.DictReader((tmp_path / "positions.csv").open(encoding="utf-8")))
    assert list(rows[0]) == list(POSITION_COLUMNS)
    assert {"frame", "player", "x_m", "y_m", "point", "game", "set"} <= set(rows[0])
    assert len(rows) > 300 and {r["player"] for r in rows} == {"1", "2"}
