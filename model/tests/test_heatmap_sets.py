"""Tests de TA-34: mapas de calor por partido y por set, e informe HTML."""

import numpy as np
import pytest
from test_heatmap import FPS, stay
from test_match_report import sample_analysis

from report import build_report
from report.heatmap import accumulate, heatmaps, write_heatmaps
from report.html_report import build_html
from report.positions import position_rows
from scoreboard import score_points


def test_set_maps_add_up_exactly_to_the_match_map():
    """Criterio de TA-34: los mapas por set suman exactamente el del partido."""
    rows = stay(1, 2.0, -1.0, 50, 1) + stay(1, 8.0, -2.0, 70, 2) + stay(1, 5.0, 0.5, 30, 3)
    match = heatmaps(rows, FPS)[1]
    by_set = sum(heatmaps(rows, FPS, set_number=s)[1] for s in (1, 2, 3))
    np.testing.assert_allclose(by_set, match, atol=1e-12)
    raw = sum(accumulate(rows, 1, FPS, set_number=s) for s in (1, 2, 3))
    np.testing.assert_array_equal(raw, accumulate(rows, 1, FPS))


def test_correcting_a_point_moves_the_set_boundary():
    """Criterio de TA-34: corregir un punto en corrections.json actualiza los límites de set."""
    # 24 puntos para el 1: un set de 6-0. Con el punto 24 corregido a favor del 2, el set no se cierra.
    raw = [{"winner": 1, "server": 1, "start": 10 * k, "end": 10 * k + 5, "confidence_level": "alta"}
           for k in range(25)]
    positions = [{1: (5.0, -1.0), 2: (5.0, 25.0)} for _ in range(260)]
    before = position_rows(positions, score_points(raw)[0], FPS)
    after = position_rows(positions, score_points(raw, corrections={24: 2})[0], FPS)
    last_point = 25
    assert {r["set"] for r in before if r["point"] == last_point} == {2}
    assert {r["set"] for r in after if r["point"] == last_point} == {1}


def test_heatmap_set_files_and_common_scale(tmp_path):
    rows = stay(1, 2.0, -1.0, 50, 1) + stay(2, 5.0, 25.0, 40, 2)
    written = write_heatmaps(rows, FPS, tmp_path, sets=[1, 2])
    assert set(written) == {"heatmap_J1.png", "heatmap_J2.png", "heatmap_set1_J1.png", "heatmap_set1_J2.png",
                            "heatmap_set2_J1.png", "heatmap_set2_J2.png"}
    only_two = write_heatmaps(rows, FPS, tmp_path / "solo", sets=[2])
    assert "heatmap_set2_J1.png" in only_two and "heatmap_set1_J1.png" not in only_two


def test_html_report_has_player_and_set_selectors(tmp_path):
    data, analysis = sample_analysis()
    report = build_report(analysis, data["fps"], video="input_video.mp4")
    maps = write_heatmaps(analysis["positions"], data["fps"], tmp_path, sets=[1])
    page = build_html(report, maps)
    assert page.startswith("<!doctype html>")
    assert 'id="player"' in page and 'id="scope"' in page
    assert '<option value="set1">Set 1</option>' in page and "Partido completo" in page
    assert page.count("data:image/png;base64,") == 4  # J1 y J2 del partido y del set 1
    assert "<td>1</td>" in page  # tabla de puntos


@pytest.mark.parametrize("argv, expected", [([], None), (["--heatmap-set", "2"], 2)])
def test_heatmap_set_cli(argv, expected):
    from config import config_from_args

    assert config_from_args(argv).get("heatmap_set") == expected
