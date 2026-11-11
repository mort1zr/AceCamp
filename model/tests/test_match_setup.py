"""Tests de TA-29: configuración del partido, correcciones y marcador punto a punto."""

import json

import pytest

from config import config_from_args
from scoreboard import load_corrections, review_list, score_points


def points(winners, server=1, level="alta"):
    return [{"winner": w, "server": server, "confidence_level": level} for w in winners]


def test_score_follows_the_model_winners():
    scored, match = score_points(points([1, 1, 1, 1, 2]))
    assert [p["score_text"] for p in scored] == ["0-0 15-0", "0-0 30-0", "0-0 40-0", "1-0 0-0", "1-0 0-15"]
    assert [p["game_number"] for p in scored] == [1, 1, 1, 1, 2]
    assert match.games == {1: 1, 2: 0}


def test_correcting_a_point_updates_the_rest_of_the_match_without_reprocessing():
    """Criterio de TA-29: cambiar el ganador de un punto rehace el marcador de los siguientes."""
    model = points([1, 1, 1, 2, 2, 2, 2])
    before, _ = score_points(model)
    after, match = score_points(model, corrections={4: 1})
    assert before[3]["score_text"] == "0-0 40-15" and after[3]["score_text"] == "1-0 0-0"
    assert after[3]["corrected"] and after[3]["model_winner"] == 2 and after[3]["winner"] == 1
    assert [p["score_text"] for p in after[4:]] == ["1-0 0-15", "1-0 0-30", "1-0 0-40"]
    assert match.games == {1: 1, 2: 0}


def test_a_null_correction_cancels_the_point():
    scored, match = score_points(points([1, 1]), corrections={1: None})
    assert not scored[0]["counted"] and scored[1]["score_text"] == "0-0 15-0"


def test_points_without_winner_do_not_count_and_go_to_review():
    scored, _ = score_points(points([1, None, 2]) + points([1], level="baja"))
    assert [p["counted"] for p in scored] == [True, False, True, True]
    assert review_list(scored) == [2, 4]
    corrected, _ = score_points(points([1, None, 2]) + points([1], level="baja"), corrections={2: 2})
    assert review_list(corrected) == [4]


def test_initial_score_and_format():
    settings = {"best_of": 3, "no_ad": True, "initial_score": {"sets": [[6, 4]], "games": [5, 4],
                                                               "points": ["40", "30"], "server": 2}}
    scored, match = score_points(points([1, 1], server=2), settings)
    assert scored[0]["score_before"]["sets"] == [[6, 4]]
    assert scored[0]["expected_server"] == 2 and scored[0]["set_number"] == 2 and scored[0]["game_number"] == 10
    assert match.winner == 1 and match.score_text() == "6-4 6-4"
    assert not scored[1]["counted"]  # el partido ya había terminado


def test_tiebreak_initial_score_and_advantage_points():
    settings = {"initial_score": {"games": [6, 6], "points": [5, 6]}}
    scored, match = score_points(points([1, 1, 1]), settings)
    assert scored[0]["score_before"]["in_tiebreak"]
    assert match.completed_sets == [(7, 6)]
    deuce = {"initial_score": {"points": ["AD", "40"], "server": 1}}
    scored, match = score_points(points([1]), deuce)
    assert match.games == {1: 1, 2: 0}


def test_first_server_auto_uses_the_detected_server_and_flags_mismatches():
    scored, _ = score_points(points([1, 1, 1, 1], server=2) + points([2], server=2))
    assert scored[0]["expected_server"] == 2
    # Tras el primer juego saca el 1; el modelo vio sacar al 2: posible saque mal detectado.
    assert scored[4]["expected_server"] == 1 and scored[4]["server_mismatch"]
    fixed, _ = score_points(points([1], server=2), {"first_server": 1})
    assert fixed[0]["expected_server"] == 1 and fixed[0]["server_mismatch"]


def test_corrections_file_and_cli(tmp_path):
    corrections = tmp_path / "corrections.json"
    corrections.write_text(json.dumps({"3": 1, "5": None}))
    assert load_corrections(corrections) == {3: 1, 5: None}
    assert load_corrections(None) == {}
    corrections.write_text(json.dumps({"3": 7}))
    with pytest.raises(ValueError):
        load_corrections(corrections)

    match_yaml = tmp_path / "match.yaml"
    match_yaml.write_text("match:\n  first_server: 2\n  best_of: 5\n")
    config = config_from_args(["--match-config", str(match_yaml), "--corrections", str(tmp_path / "c.json")])
    assert config["match"]["first_server"] == 2 and config["match"]["best_of"] == 5
    assert config["match"]["games_per_set"] == 6  # lo no indicado queda por defecto
    assert config["paths"]["corrections"].endswith("c.json")
