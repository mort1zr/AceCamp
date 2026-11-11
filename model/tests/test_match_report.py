"""Tests de TA-30: informe del partido y marcador en el vídeo."""

import csv
import json

import numpy as np
from test_regression import load_case

from config import DEFAULTS
from pipeline_analysis import analyze_detections
from report import POINT_COLUMNS, build_report, draw_scoreboard, scoreboard_states, serve_states, write_report
from report.scoreboard_drawer import score_cells
from scoreboard import score_points
from stats import to_match_statistics


def sample_analysis():
    data, ball, players, homographies = load_case("input_video")
    analysis = analyze_detections(ball, players, data["court_keypoints"], homographies, [True] * len(ball),
                                  data["fps"], DEFAULTS)
    return data, analysis


def test_report_has_one_row_per_point_and_matches_the_csv(tmp_path):
    data, analysis = sample_analysis()
    report = build_report(analysis, data["fps"], video="input_video.mp4")
    write_report(report, tmp_path)
    saved = json.loads((tmp_path / "report.json").read_text())
    rows = list(csv.DictReader((tmp_path / "points.csv").open(encoding="utf-8")))
    assert saved["schemaVersion"] == "acecam.match-report.v1"
    assert len(rows) == len(saved["points"]) == len(analysis["points"])
    assert list(rows[0]) == list(POINT_COLUMNS)
    for row, point in zip(rows, saved["points"]):
        assert int(row["number"]) == point["number"] and row["score_after"] == point["score_after"]
    assert set(saved["players"]) == {"1", "2"}
    assert sum(p["pointsWon"] for p in saved["players"].values()) == sum(1 for p in analysis["points"]
                                                                       if p["counted"])


def test_the_video_scoreboard_ends_with_the_report_score():
    """Criterio de TA-30: lo que muestra el vídeo coincide con el informe."""
    data, analysis = sample_analysis()
    report = build_report(analysis, data["fps"])
    states = scoreboard_states(analysis["points"], len(analysis["ball_court_positions"]) + 30)
    final = states[-1]
    assert final["points"] == report["score"]["points"] and final["games"] == report["score"]["games"]


def test_scoreboard_shows_the_score_before_the_point_while_it_is_played():
    points, _ = score_points([{"winner": 1, "server": 1, "start": 10, "end": 20, "confidence_level": "alta"},
                              {"winner": 2, "server": 1, "start": 40, "end": 50, "confidence_level": "alta"}])
    states = scoreboard_states(points, 60)
    assert states[5]["points"] == ["0", "0"] and states[15]["points"] == ["0", "0"]
    assert states[21]["points"] == ["15", "0"] and states[45]["points"] == ["15", "0"]
    assert states[55]["points"] == ["15", "15"]
    assert scoreboard_states([], 3) == [None, None, None]


def test_scoreboard_drawing():
    score = {"sets": [[6, 4]], "games": [2, 1], "points": ["30", "15"], "server": 1, "winner": None}
    assert score_cells(score) == {1: ["6", "2", "30"], 2: ["4", "1", "15"]}
    finished = {"sets": [[6, 4], [6, 3]], "games": [0, 0], "points": ["0", "0"], "server": None, "winner": 1}
    assert score_cells(finished) == {1: ["6", "6"], 2: ["4", "3"]}
    frame = np.zeros((720, 1280, 3), np.uint8)
    drawn = draw_scoreboard(frame.copy(), score)
    assert drawn[600:, :400].any() and not drawn[:300].any()  # abajo a la izquierda
    assert (draw_scoreboard(frame.copy(), None) == frame).all()


def test_worker_statistics_get_the_score_from_the_player_side():
    data, analysis = sample_analysis()
    stats = analysis["model_statistics"]
    stats["score"] = {"sets": [[6, 4]], "games": [2, 1], "points": ["30", "15"], "winner": None}
    stats["points"] = {"count": 3, "won": {"1": 2, "2": 1}, "lowConfidence": 1, "toReview": [3]}
    near = to_match_statistics(stats, "abajo")  # el jugador registrado es el 2 (cerca)
    assert near["score"] == {"sets": [[4, 6]], "games": [1, 2], "points": ["15", "30"], "winner": None}
    assert near["points"] == {"count": 3, "playerWon": 1, "opponentWon": 2, "lowConfidence": 1, "toReview": 1}
    far = to_match_statistics({**stats, "score": {**stats["score"], "winner": 1}}, "arriba")
    assert far["score"]["sets"] == [[6, 4]] and far["score"]["winner"] == "player"


def test_serve_summary_and_overlay_counts():
    """TA-21: % de primeros saques, velocidad media, quién sacó más y saques acumulados por fotograma."""
    from report.match_report import _most_serves, _serve_summary

    summary = _serve_summary({"count": 4, "sumSpeedKmh": 300.0, "sampleCount": 3, "firstServeAttempts": 4,
                              "firstServeIn": 3})
    assert summary["avgSpeedKmh"] == 100.0 and summary["firstServePct"] == 75.0
    assert "firstServePct" not in _serve_summary({"count": 0})
    stats = {"players": {"1": {"serve": {"count": 2}}, "2": {"serve": {"count": 5}}}}
    assert _most_serves(stats) == 2
    assert _most_serves({"players": {"1": {}, "2": {}}}) is None

    points = [{"serve_attempts": [{"frame": 10, "player": 2, "fault": True},
                                  {"frame": 40, "player": 2, "fault": False}]},
              {"serve_attempts": [{"frame": 90, "player": 2, "fault": False}]}]
    states = serve_states(points, 100)
    assert states[5][2] == {"count": 0, "firstPct": None}
    assert states[50][2] == {"count": 2, "firstPct": 0}
    assert states[95][2] == {"count": 3, "firstPct": 50} and states[95][1]["count"] == 0


def test_bounce_list_in_the_report(tmp_path):
    """TA-25: la lista de botes del informe, con su cantada y el punto en que ocurrió."""
    data, analysis = sample_analysis()
    report = build_report(analysis, data["fps"])
    write_report(report, tmp_path)
    rows = list(csv.DictReader((tmp_path / "bounces.csv").open(encoding="utf-8")))
    located = [b for b in analysis["bounces"] if "x_m" in b]
    assert len(rows) == len(report["bounces"]) == len(located) == 5
    assert {r["call"] for r in rows} <= {"dentro", "fuera", "dudoso"}
    assert all(r["point"] == "1" for r in rows)


def test_mini_court_bounces_take_the_color_of_their_call():
    from main import CALL_COLORS, draw_out_banner
    from mini_court import MiniCourt

    frame = np.zeros((720, 1280, 3), np.uint8)
    mini = MiniCourt(frame)
    mini.draw_bounces(frame, [(2.0, 3.0), (8.0, 20.0)], colors=[CALL_COLORS["dentro"], CALL_COLORS["fuera"]])
    for (x_m, y_m), color in (((2.0, 3.0), CALL_COLORS["dentro"]), ((8.0, 20.0), CALL_COLORS["fuera"])):
        x, y = mini.meters_to_mini((x_m, y_m))
        assert (frame[y, x] == color).all()
    banner = draw_out_banner(np.zeros((720, 1280, 3), np.uint8), 2 / 3)
    assert banner[:120, 560:720].any() and not banner[300:].any()  # arriba en el centro
