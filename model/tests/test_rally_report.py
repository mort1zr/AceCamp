"""Tests de TA-36: estadísticas de peloteo en el informe, por partido y por set."""

import csv

from test_match_report import sample_analysis

from report import build_report, write_report
from report.html_report import build_html
from report.match_report import point_row, rally_breakdown
from scoreboard import score_points


def rows_for(lengths_and_winners, sets_of=None):
    raw = [{"winner": w, "server": 1, "start": 10 * k, "end": 10 * k + 5, "confidence_level": "alta",
            "shots": n, "serve_attempts": []} for k, (n, w) in enumerate(lengths_and_winners)]
    points, _ = score_points(raw)
    rows = [point_row(p, [], 30) for p in points]
    for row, set_number in zip(rows, sets_of or []):
        row["set"] = set_number
    return rows


def test_rally_breakdown_counts_percentages_and_winners_per_category():
    rows = rows_for([(2, 1), (3, 2), (6, 1), (12, 2)], sets_of=[1, 1, 2, 2])
    breakdown = rally_breakdown(rows)
    match = breakdown["partido"]
    assert match["count"] == 4
    assert match["short"] == {"count": 2, "pct": 50.0, "won": {"1": 1, "2": 1}}
    assert match["medium"] == {"count": 1, "pct": 25.0, "won": {"1": 1, "2": 0}}
    assert match["long"] == {"count": 1, "pct": 25.0, "won": {"1": 0, "2": 1}}
    assert breakdown["set1"]["short"]["count"] == 2 and breakdown["set2"]["short"]["count"] == 0
    assert breakdown["cuts"] == {"shortMax": 4, "mediumMax": 8}


def test_configured_cuts_change_the_categories():
    rows = [point_row(p, [], 30, (2, 5)) for p in score_points(
        [{"winner": 1, "server": 1, "start": 0, "end": 5, "confidence_level": "alta", "shots": 3,
          "serve_attempts": []}])[0]]
    assert rows[0]["rally_category"] == "medium"
    assert rally_breakdown(rows, (2, 5))["cuts"] == {"shortMax": 2, "mediumMax": 5}


def test_report_figures_match_the_points_csv(tmp_path):
    """Criterio de TA-36: las cifras del informe coinciden con el CSV por punto de TA-30."""
    data, analysis = sample_analysis()
    report = build_report(analysis, data["fps"])
    write_report(report, tmp_path)
    rows = list(csv.DictReader((tmp_path / "points.csv").open(encoding="utf-8")))
    for scope, summary in report["rallies"].items():
        if scope == "cuts":
            continue
        selected = rows if scope == "partido" else [r for r in rows if r["set"] == scope.removeprefix("set")]
        assert summary["count"] == len(selected)
        for category in ("short", "medium", "long"):
            in_category = [r for r in selected if r["rally_category"] == category]
            assert summary[category]["count"] == len(in_category)
            for player in ("1", "2"):
                assert summary[category]["won"][player] == sum(r["winner"] == player for r in in_category)


def test_html_has_one_rally_table_per_period():
    data, analysis = sample_analysis()
    page = build_html(build_report(analysis, data["fps"]), {})
    assert page.count('class="rallies"') == 2  # partido y set 1
    assert 'data-scope="partido"' in page and 'data-scope="set1"' in page
