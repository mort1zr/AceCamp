import json
from pathlib import Path

import pytest

from eval.__main__ import main as eval_main
from eval.labels import FORMAT, LabelError, load, validate
from eval.metrics import DetectionScore, ball_detection, evaluate, keypoints_error, match_events

EXAMPLE = Path(__file__).resolve().parent.parent / "eval" / "labels" / "ejemplo.json.example"


def labels(**fields):
    return {"format": FORMAT, "video": {"file": "clip.mp4"}, **fields}


# ---------------------------------------------------------------- formato


def test_the_documented_example_is_valid():
    data = load(EXAMPLE)

    assert data["ball"][2] is None
    assert len(data["court_keypoints"][0]) == 14


@pytest.mark.parametrize(
    "bad",
    [
        {"format": "otro", "video": {"file": "x"}},
        {"format": FORMAT},
        labels(court_keypoints={"0": [[1, 2]] * 13}),
        labels(ball={"3": [1, 2, 3]}),
        labels(shots=[{"player": 1}]),
        labels(shots=[{"frame": "12"}]),
        labels(points=[{"start": 1, "end": 2}]),
        labels(cuts=["12"]),
    ],
)
def test_invalid_labels_are_rejected(bad):
    with pytest.raises(LabelError):
        validate(bad)


def test_invalid_json_file_names_the_file(tmp_path):
    path = tmp_path / "roto.json"
    path.write_text("{no es json")

    with pytest.raises(LabelError, match="roto.json"):
        load(path)


# ---------------------------------------------------------------- métricas


def test_events_within_tolerance_match_once():
    score, matched = match_events(predicted=[100, 101, 200, 305], actual=[100, 202, 400], tolerance=2)

    assert matched == [(0, 0), (2, 1)]
    assert score == DetectionScore(true_positives=2, false_positives=2, false_negatives=1)
    assert score.precision == 0.5
    assert score.recall == pytest.approx(2 / 3)
    assert score.f1 == pytest.approx(4 / 7)


def test_scores_without_data_are_unknown_not_zero():
    empty = DetectionScore(0, 0, 0)

    assert empty.precision is None and empty.recall is None and empty.f1 is None


def test_ball_detection_counts_far_guesses_as_wrong():
    actual = {0: (100.0, 100.0), 1: (110.0, 100.0), 2: None, 3: (130.0, 100.0)}
    predicted = {0: (103.0, 104.0), 1: (300.0, 100.0), 2: (50.0, 50.0)}

    score = ball_detection(predicted, actual, radius_px=10)

    assert score == DetectionScore(true_positives=1, false_positives=2, false_negatives=2)


def test_keypoints_error_only_on_frames_labeled_in_both():
    actual = {0: [(0.0, 0.0)] * 14, 50: [(0.0, 0.0)] * 14}
    predicted = {0: [(3.0, 4.0)] * 14, 99: [(9.0, 9.0)] * 14}

    assert keypoints_error(predicted, actual) == 5.0
    assert keypoints_error({}, actual) is None


def test_evaluate_reports_only_what_both_have():
    actual = labels(
        shots=[{"frame": 10}, {"frame": 50}],
        bounces=[{"frame": 30, "x_m": 1.0, "y_m": 2.0}],
        points=[{"start": 0, "end": 60, "winner": 1}],
        cuts=[70],
    )
    predicted = labels(
        shots=[{"frame": 11}],
        bounces=[{"frame": 31, "x_m": 1.3, "y_m": 2.4}],
        points=[{"start": 5, "end": 60, "winner": 1}],
    )

    results = evaluate(validate(predicted), validate(actual))

    assert results["shots"].recall == 0.5
    assert results["bounce_position_error_m"] == pytest.approx(0.5)
    assert results["point_winner_accuracy"] == 1.0
    assert "cuts" not in results and "ball" not in results


# -------------------------------------------------------------- comando


def test_command_line_compares_folders_and_writes_json(tmp_path, capsys):
    (tmp_path / "labels").mkdir()
    (tmp_path / "pred").mkdir()
    (tmp_path / "labels" / "clip_01.json").write_text(json.dumps(labels(shots=[{"frame": 10}, {"frame": 90}])))
    (tmp_path / "pred" / "clip_01.json").write_text(json.dumps(labels(shots=[{"frame": 11}])))
    (tmp_path / "labels" / "clip_02.json").write_text(json.dumps(labels(shots=[{"frame": 5}])))  # sin predicción
    out = tmp_path / "resultados.json"

    assert eval_main(["--labels", str(tmp_path / "labels"), "--predictions", str(tmp_path / "pred"),
                      "--json", str(out)]) == 0

    printed = capsys.readouterr()
    assert "TOTAL (1 clips)" in printed.out
    assert "clip_02.json: sin predicciones" in printed.err
    saved = json.loads(out.read_text())
    assert saved["total"]["shots"]["recall"] == 0.5


def test_command_line_fails_clearly_without_labels(tmp_path):
    with pytest.raises(SystemExit, match="No hay etiquetas"):
        eval_main(["--labels", str(tmp_path), "--predictions", str(tmp_path)])
