"""Pre-etiquetado y revisión de etiquetas del set de validación (TA-9)."""

import json
from types import SimpleNamespace

import cv2
import numpy as np
import pytest

from court import COURT_KEYPOINTS_M
from eval.__main__ import main as eval_main
from eval.labels import FORMAT, validate
from eval.prelabel import build_prelabels
from eval.review import ViewState, draw, handle_key, handle_mouse
from eval.review_session import ReviewSession

COURT_TO_IMAGE = np.array([[62.0, -9.0, 610.0], [0.0, 16.0, 260.0], [0.0, -0.012, 1.0]])


def court_px(points_m):
    pts = np.c_[np.asarray(points_m, float), np.ones(len(points_m))] @ COURT_TO_IMAGE.T
    return pts[:, :2] / pts[:, 2:]


def fake_result(num_frames=12):
    keypoints = court_px(COURT_KEYPOINTS_M).ravel()
    return {
        "video_info": SimpleNamespace(fps=30.0),
        "video_hash": "abc123",
        "ball_detections": [{1: [100.0 + i, 50.0, 110.0 + i, 60.0]} if i != 5 else {} for i in range(num_frames)],
        "court_keypoints": [keypoints] * num_frames,
        "shots": [{"frame": 4, "endFrame": 9, "player": 2, "speedKmh": 70.0}],
    }


# ----------------------------------------------------------- pre-etiquetado


def test_prelabels_are_valid_labels_marked_as_not_reviewed():
    labels = build_prelabels(fake_result(), "clips/clip_01.mp4", ball_every=5, keypoints_every=10)

    validate(labels)
    assert labels["format"] == FORMAT
    assert labels["reviewed"] is False
    assert labels["video"] == {"file": "clip_01.mp4", "sha256": "abc123", "fps": 30.0, "frames": 12}
    assert labels["ball"] == {"0": [105.0, 55.0], "5": None, "10": [115.0, 55.0]}
    assert list(labels["court_keypoints"]) == ["0", "10"]
    assert len(labels["court_keypoints"]["0"]) == 14
    assert labels["shots"] == [{"frame": 4, "player": 2}]
    assert labels["bounces"] == labels["serves"] == labels["cuts"] == labels["points"] == []


def test_the_evaluator_skips_clips_that_nobody_reviewed(tmp_path, capsys):
    labels = build_prelabels(fake_result(), "clip.mp4")
    (tmp_path / "labels").mkdir()
    (tmp_path / "pred").mkdir()
    (tmp_path / "labels" / "clip.json").write_text(json.dumps(labels))
    (tmp_path / "pred" / "clip.json").write_text(json.dumps(labels))

    eval_main(["--labels", str(tmp_path / "labels"), "--predictions", str(tmp_path / "pred")])

    output = capsys.readouterr()
    assert "sin revisar" in output.err
    assert "TOTAL (0 clips)" in output.out


# ------------------------------------------------------------- revisión


@pytest.fixture
def session(tmp_path):
    path = tmp_path / "clip.json"
    path.write_text(json.dumps(build_prelabels(fake_result(num_frames=60), "clip.mp4", ball_every=5,
                                               keypoints_every=30)))
    return ReviewSession.load(path)


def press(session, view, keys):
    for key in keys:
        handle_key(session, view, key)


def test_navigation_steps_and_limits(session):
    view = ViewState()
    press(session, view, "d")
    assert view.frame == 1
    press(session, view, "l")
    assert view.frame == 5  # siguiente fotograma de pelota (cada 5)
    press(session, view, "j")
    assert view.frame == 0
    press(session, view, "a")
    assert view.frame == 0  # no baja de 0
    press(session, view, "LL")
    assert view.frame == 59  # no pasa del último


def test_ball_click_and_not_visible(session):
    view = ViewState(frame=7)
    handle_mouse(session, view, cv2.EVENT_LBUTTONDOWN, 300, 200)
    assert session.ball_at(7) == (True, [300.0, 200.0])

    press(session, view, "x")
    assert session.ball_at(7) == (True, None)
    assert session.ball_at(8) == (False, None)  # sin etiquetar no es lo mismo que no visible


def test_shots_and_serves_need_the_player(session):
    view = ViewState(frame=20)
    press(session, view, "g2v1")
    assert {"frame": 20, "player": 2} in session.data["shots"]
    assert session.data["serves"] == [{"frame": 20, "player": 1}]

    press(session, view, "gx")  # sin 1 ni 2: se cancela
    assert "Cancelado" in view.message
    assert len([s for s in session.data["shots"] if s["frame"] == 20]) == 1


def test_bounce_is_stored_in_pixels_and_meters(session):
    view = ViewState(frame=10)
    x, y = court_px([(3.0, 20.0)])[0]
    handle_mouse(session, view, cv2.EVENT_LBUTTONDOWN, x, y)
    press(session, view, "b")

    bounce = session.data["bounces"][0]
    assert bounce["frame"] == 10
    assert (bounce["x_m"], bounce["y_m"]) == pytest.approx((3.0, 20.0), abs=0.05)


def test_bounce_needs_the_ball_first(session):
    view = ViewState(frame=11)
    press(session, view, "b")

    assert session.data["bounces"] == []
    assert "primero" in view.message


def test_points_need_a_start_and_a_winner(session):
    view = ViewState(frame=30)
    press(session, view, "o1")
    assert session.data["points"] == []  # sin inicio

    view.frame = 10
    press(session, view, "i")
    view.frame = 40
    press(session, view, "o2")
    assert session.data["points"] == [{"start": 10, "end": 40, "winner": 2}]


def test_cuts_toggle_and_remove_events(session):
    view = ViewState(frame=4)
    press(session, view, "c")
    assert session.data["cuts"] == [4]
    press(session, view, "r")  # borra el corte y el golpe pre-etiquetado en el fotograma 4
    assert session.data["cuts"] == []
    assert session.data["shots"] == []


def test_drag_a_keypoint_with_the_right_button(session):
    view = ViewState(frame=35)  # usa los puntos clave del fotograma 30
    x, y = session.keypoints_at(35)[12]
    handle_mouse(session, view, cv2.EVENT_RBUTTONDOWN, x + 5, y + 5)
    handle_mouse(session, view, cv2.EVENT_RBUTTONUP, x + 40, y)

    assert session.data["court_keypoints"]["30"][12] == [round(x + 40, 1), round(y, 1)]
    assert session.data["court_keypoints"]["0"][12] == [round(x, 1), round(y, 1)]


def test_review_mark_and_save(session):
    view = ViewState()
    press(session, view, "y")
    press(session, view, "q")

    saved = json.loads(session.path.read_text())
    assert view.quit
    assert saved["reviewed"] is True
    validate(saved)


def test_draw_overlays_without_a_window(session):
    view = ViewState(frame=5, show_help=True)
    image = np.zeros((1080, 1920, 3), np.uint8)

    canvas = draw(image, session, view)

    assert canvas.shape == image.shape and canvas.any()
    assert not image.any()  # no modifica el fotograma original


def test_prelabel_command_end_to_end(monkeypatch, tmp_path):
    import test_pipeline_smoke as smoke

    import main
    from eval.prelabel import main as prelabel_main

    monkeypatch.setattr(main, "PlayerTracker", smoke.FakePlayerTracker)
    monkeypatch.setattr(main, "BallTracker", smoke.FakeBallTracker)
    monkeypatch.setattr(main, "CourtLineDetector", smoke.FakeCourtLineDetector)
    video = smoke.write_synthetic_video(tmp_path / "clip.avi")
    output = tmp_path / "labels" / "clip.json"

    assert prelabel_main(["--input", str(video), "--output", str(output)]) == 0

    labels = validate(json.loads(output.read_text()))
    assert labels["video"]["frames"] == smoke.NUM_FRAMES
    assert labels["reviewed"] is False
    assert len(labels["ball"]) == smoke.NUM_FRAMES // 5
    assert labels["shots"]  # el golpe del jugador cercano del vídeo sintético
    with pytest.raises(SystemExit, match="ya existe"):
        prelabel_main(["--input", str(video), "--output", str(output)])  # no pisa correcciones
