"""Tests de TA-15: cortes de cámara, cámara principal y repeticiones."""

import cv2
import numpy as np
import pytest
from test_court_tracking import true_keypoints
from test_pipeline_smoke import (
    FPS,
    HEIGHT,
    WIDTH,
    FakeBallTracker,
    FakeCourtLineDetector,
    FakePlayerTracker,
    frame_index,
)

import main
from camera import CutDetector, main_camera_frames, segments
from court import CourtTracker
from stats import movement_stats

rng = np.random.default_rng(0)


def court_scene(shift_x=0, player_x=600):
    """Plano de la cámara principal: pista azul con líneas blancas y un jugador que se mueve."""
    frame = np.full((HEIGHT, WIDTH, 3), (40, 110, 60), np.uint8)  # fondo verde
    cv2.rectangle(frame, (300 + shift_x, 120), (980 + shift_x, 640), (150, 90, 40), -1)  # pista azul
    cv2.rectangle(frame, (300 + shift_x, 120), (980 + shift_x, 640), (240, 240, 240), 4)
    cv2.rectangle(frame, (player_x, 500), (player_x + 40, 610), (30, 30, 200), -1)  # jugador de rojo
    noise = rng.integers(-6, 7, frame.shape)  # ruido de compresión
    return np.clip(frame.astype(int) + noise, 0, 255).astype(np.uint8)


def closeup_scene():
    """Primer plano: casi todo piel y ropa, sin pista."""
    frame = np.full((HEIGHT, WIDTH, 3), (120, 160, 210), np.uint8)
    cv2.circle(frame, (640, 300), 200, (90, 120, 180), -1)
    cv2.rectangle(frame, (300, 450), (980, 720), (20, 20, 20), -1)
    return frame


# ------------------------------------------------------------- cortes


def test_a_cut_to_a_closeup_and_back_is_detected_at_the_right_frames():
    frames = [court_scene(player_x=500 + 5 * i) for i in range(30)]
    frames += [closeup_scene() for _ in range(20)]
    frames += [court_scene(player_x=700 + 5 * i) for i in range(30)]
    detector = CutDetector()

    flags = [detector.update(f) for f in frames]

    assert detector.cuts == [30, 50]
    assert sum(flags) == 2


def test_players_running_and_a_small_camera_pan_are_not_cuts():
    detector = CutDetector()
    for i in range(90):
        detector.update(court_scene(shift_x=i // 3, player_x=400 + 8 * i))

    assert detector.cuts == []


def test_consecutive_jumps_of_a_flash_count_as_one_cut():
    frames = [court_scene()] * 10 + [closeup_scene()] + [court_scene()] * 10  # destello de 1 fotograma
    detector = CutDetector()
    for f in frames:
        detector.update(f)

    assert detector.cuts == [10]


# ------------------------------------------------------ cámara principal


def keypoints_at(dx=0.0):
    return (true_keypoints() + [dx, 0.0]).ravel()


def test_frames_far_from_the_usual_court_position_are_not_main_camera():
    keypoints = [keypoints_at()] * 60 + [keypoints_at(dx=400)] * 20 + [keypoints_at(dx=10)] * 20
    visible = [True] * 100

    main_camera = main_camera_frames(keypoints, visible, frame_width=1920)

    assert segments(main_camera) == [(0, 59), (80, 99)]


def test_frames_without_a_valid_court_are_not_main_camera():
    keypoints = [None] * 10 + [keypoints_at()] * 30
    visible = [False] * 10 + [True] * 20 + [False] * 10

    assert segments(main_camera_frames(keypoints, visible, frame_width=1920)) == [(10, 29)]


def test_no_court_at_all():
    assert main_camera_frames([None] * 5, [False] * 5, frame_width=1920) == [False] * 5


def test_segments():
    assert segments([True, True, False, True]) == [(0, 1), (3, 3)]
    assert segments([]) == []


# -------------------------------------------------- pista tras un corte


class Detector:
    def __init__(self, keypoints_for):
        self.keypoints_for, self.calls = keypoints_for, []

    def __call__(self, frame):
        self.calls.append(frame)
        return self.keypoints_for(frame)


INVALID = np.full(28, 50.0)  # todos los puntos en el mismo sitio: sin homografía


def test_after_a_cut_without_court_it_retries_until_the_court_is_back():
    detector = Detector(lambda i: INVALID if 30 <= i < 55 else keypoints_at())
    tracker = CourtTracker(detector, redetect_every=30, retry_every=10)

    visible = [tracker.update(i, cut=(i == 30))[0] is not None and tracker.court_visible for i in range(70)]

    assert detector.calls == [0, 30, 40, 50, 60]
    assert visible[:30] == [True] * 30
    assert visible[30:60] == [False] * 30
    assert visible[60:] == [True] * 10


def test_a_video_that_starts_with_a_closeup_finds_the_court_later():
    detector = Detector(lambda i: INVALID if i < 25 else keypoints_at())
    tracker = CourtTracker(detector, retry_every=10)

    results = [tracker.update(i) for i in range(40)]

    assert results[0] == (None, None)
    assert results[29] == (None, None)  # intentos en 0, 10 y 20, sin pista
    assert results[30][0] is not None and tracker.court_visible
    assert detector.calls == [0, 10, 20, 30]


# ------------------------------------------------- desplazamiento por tramos


def test_movement_is_not_counted_across_a_gap():
    run_a = [(1.0 + 0.01 * i, 25.0) for i in range(60)]
    run_b = [(9.0 + 0.01 * i, 25.0) for i in range(60)]  # tras la repetición está 7 m más allá

    with_gap = movement_stats(run_a + [None] * 30 + run_b, fps=30)
    single = movement_stats(run_a, fps=30)

    assert with_gap["distanceMeters"] == pytest.approx(2 * single["distanceMeters"], abs=0.1)
    assert with_gap["maxSpeedKmh"] < 5


# ----------------------------------------------------- de punta a punta

REPLAY = range(60, 90)


class ReplayCourtDetector(FakeCourtLineDetector):
    def predict(self, image):
        if image[100:, :, 2].mean() > 200:  # fotograma rojo: repetición, sin pista
            return INVALID
        return super().predict(image)


class ReplayBallTracker(FakeBallTracker):
    def detect_frame(self, frame):
        if frame_index(frame) in REPLAY:
            return {0: [100, 100, 108, 108, 0.9]}  # en la repetición la "pelota" está en otro sitio
        return super().detect_frame(frame)


def write_video_with_replay(path, num_frames=150):
    out = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), FPS, (WIDTH, HEIGHT))
    for i in range(num_frames):
        frame = np.full((HEIGHT, WIDTH, 3), (0, 0, 255) if i in REPLAY else (90, 90, 90), np.uint8)
        frame[:16, :16] = i % 256
        out.write(frame)
    out.release()
    return path


def test_a_replay_in_the_middle_is_detected_and_not_analyzed(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "PlayerTracker", FakePlayerTracker)
    monkeypatch.setattr(main, "BallTracker", ReplayBallTracker)
    monkeypatch.setattr(main, "CourtLineDetector", ReplayCourtDetector)
    video = write_video_with_replay(tmp_path / "con_repeticion.avi")

    result = main.main(["--input", str(video), "--output", str(tmp_path / "salida.avi"),
                        "--cache-dir", str(tmp_path / "cache")])

    assert result["cuts"] == [60, 90]
    assert result["main_camera_segments"] == [(0, 59), (90, 149)]
    assert all(result["ball_detections"][i] == {} for i in REPLAY)
    assert all(result["player_detections"][i] == {} for i in REPLAY)
    for shot in result["shots"]:
        assert not (shot["frame"] <= 60 and shot["endFrame"] >= 60)  # ningún golpe cruza la repetición
