"""Prueba de humo: ejecuta main.main() de punta a punta sin modelos reales.

Los tres modelos (jugadores, pelota y puntos clave) se sustituyen por dobles
que devuelven detecciones sintéticas coherentes con una pista vista desde una
cámara de retransmisión. Así se comprueba que el pipeline completo funciona
sin PyTorch, sin Ultralytics y sin descargar pesos.
"""

import cv2
import numpy as np
import pytest

import main
from court import COURT_KEYPOINTS_M
from utils import get_video_info

WIDTH, HEIGHT, FPS, NUM_FRAMES = 1280, 720, 30, 120

COURT_TO_IMAGE = np.array([[40.0, -6.0, 420.0], [0.0, 10.5, 130.0], [0.0, -0.012, 1.0]])


def project(points_m):
    pts = np.c_[np.asarray(points_m, dtype=float), np.ones(len(points_m))] @ COURT_TO_IMAGE.T
    return pts[:, :2] / pts[:, 2:]


def player_box(feet_m):
    x, y = project([feet_m])[0]
    return [x - 20, y - 110, x + 20, y]


class FakePlayerTracker(main.PlayerTracker):
    def detect_frames(self, frames, **_):
        detections = []
        for i in range(len(frames)):
            shift = 0.02 * i  # se mueven despacio a lo ancho
            detections.append({1: player_box((4.0 + shift, -1.5)), 2: player_box((6.0 - shift, 25.0))})
        return detections


class FakeBallTracker(main.BallTracker):
    def detect_frames(self, frames, **_):
        detections = []
        for i in range(len(frames)):
            phase = i % 80
            t = phase / 40 if phase < 40 else (80 - phase) / 40  # va y vuelve entre los jugadores
            x, y = project([(5.0, -1.0 + 26.0 * t)])[0]
            detections.append({1: [x - 4, y - 4, x + 4, y + 4]})
        return detections


class FakeCourtLineDetector:
    def __init__(self, model_path, refine=True):
        self.model_path = model_path

    def predict(self, image):
        return project(COURT_KEYPOINTS_M).ravel()

    def draw_keypoints_on_video(self, frames, keypoints):
        return frames


def write_synthetic_video(path):
    out = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), FPS, (WIDTH, HEIGHT))
    for _ in range(NUM_FRAMES):
        out.write(np.full((HEIGHT, WIDTH, 3), 90, dtype=np.uint8))
    out.release()
    return path


@pytest.fixture
def synthetic_video(tmp_path):
    return write_synthetic_video(tmp_path / "partido.avi")


def test_pipeline_runs_end_to_end(monkeypatch, tmp_path, synthetic_video):
    monkeypatch.setattr(main, "PlayerTracker", FakePlayerTracker)
    monkeypatch.setattr(main, "BallTracker", FakeBallTracker)
    monkeypatch.setattr(main, "CourtLineDetector", FakeCourtLineDetector)
    output = tmp_path / "salida.avi"

    main.main(["--input", str(synthetic_video), "--output", str(output), "--cache-dir", str(tmp_path / "cache")])

    info = get_video_info(output)
    assert info.frame_count == NUM_FRAMES
    assert (info.width, info.height) == (WIDTH, HEIGHT)
    assert info.fps == pytest.approx(FPS)
