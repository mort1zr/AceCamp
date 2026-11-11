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


def frame_index(frame):
    """Número de fotograma, escrito en la esquina superior izquierda por write_synthetic_video."""
    return int(round(frame[:16, :16].mean()))


class FakePlayerTracker(main.PlayerTracker):
    calls = 0

    def detect_frame(self, frame):
        FakePlayerTracker.calls += 1
        shift = 0.02 * frame_index(frame)  # se mueven despacio a lo ancho
        return {1: player_box((4.0 + shift, -1.5)), 2: player_box((6.0 - shift, 25.0))}


class FakeBallTracker(main.BallTracker):
    def detect_frame(self, frame):
        phase = frame_index(frame) % 80
        t = phase / 40 if phase < 40 else (80 - phase) / 40  # va y vuelve entre los jugadores
        x, y = project([(5.0, -1.0 + 26.0 * t)])[0]
        return {0: [x - 4, y - 4, x + 4, y + 4, 0.9]}


class FakeCourtLineDetector:
    def __init__(self, model_path, refine=True):
        self.model_path = model_path

    def predict(self, image):
        return project(COURT_KEYPOINTS_M).ravel()

    def draw_keypoints(self, frame, keypoints):
        return frame


def write_synthetic_video(path, num_frames=NUM_FRAMES, width=WIDTH, height=HEIGHT):
    out = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), FPS, (width, height))
    for i in range(num_frames):
        frame = np.full((height, width, 3), 90, dtype=np.uint8)
        frame[:16, :16] = i % 256
        out.write(frame)
    out.release()
    return path


@pytest.fixture
def synthetic_video(tmp_path):
    return write_synthetic_video(tmp_path / "partido.avi")


@pytest.fixture
def fake_models(monkeypatch):
    monkeypatch.setattr(main, "PlayerTracker", FakePlayerTracker)
    monkeypatch.setattr(main, "BallTracker", FakeBallTracker)
    monkeypatch.setattr(main, "CourtLineDetector", FakeCourtLineDetector)
    FakePlayerTracker.calls = 0


def test_pipeline_runs_end_to_end(fake_models, tmp_path, synthetic_video):
    output = tmp_path / "salida.avi"

    main.main(["--input", str(synthetic_video), "--output", str(output), "--cache-dir", str(tmp_path / "cache"),
               "--report-dir", str(tmp_path / "informe")])
    # El informe del partido se escribe en cada ejecución (TA-30).
    assert (tmp_path / "informe" / "report.json").exists() and (tmp_path / "informe" / "points.csv").exists()

    info = get_video_info(output)
    assert info.frame_count == NUM_FRAMES
    assert (info.width, info.height) == (WIDTH, HEIGHT)
    assert info.fps == pytest.approx(FPS)


def run(video, tmp_path, *extra):
    return main.main(["--input", str(video), "--output", str(tmp_path / "salida.avi"),
                      "--report-dir", str(tmp_path / "informe"),
                      "--cache-dir", str(tmp_path / "cache"), *extra])


def test_detections_are_cached_and_reused(fake_models, tmp_path, synthetic_video):
    first = run(synthetic_video, tmp_path, "--no-video")
    assert FakePlayerTracker.calls == NUM_FRAMES

    FakePlayerTracker.calls = 0
    second = run(synthetic_video, tmp_path, "--no-video", "--use-cache")

    assert FakePlayerTracker.calls == 0
    assert second["model_statistics"] == first["model_statistics"]


def test_pipeline_survives_frames_without_players(fake_models, monkeypatch, tmp_path, synthetic_video):
    """PCIT-160: regresión del min() sobre jugadores vacíos observado en un vídeo real."""
    original = FakePlayerTracker.detect_frame

    def detect_with_gap(self, frame):
        if 20 <= frame_index(frame) <= 35:
            return {}
        return original(self, frame)

    monkeypatch.setattr(FakePlayerTracker, "detect_frame", detect_with_gap)
    result = run(synthetic_video, tmp_path, "--no-video")

    assert len(result["player_detections"]) == NUM_FRAMES
    assert "players" in result["model_statistics"]


def test_detecting_players_every_other_frame_keeps_the_statistics(fake_models, tmp_path, synthetic_video):
    every_frame = run(synthetic_video, tmp_path, "--no-video")
    config = tmp_path / "config.yaml"
    config.write_text("detection:\n  player_every_n_frames: 2\n")

    FakePlayerTracker.calls = 0
    every_other = run(synthetic_video, tmp_path, "--no-video", "--config", str(config))

    assert FakePlayerTracker.calls == NUM_FRAMES // 2
    assert len(every_other["player_detections"]) == NUM_FRAMES
    assert all(set(frame) == {1, 2} for frame in every_other["player_detections"])  # interpolados
    assert every_other["model_statistics"]["players"] == every_frame["model_statistics"]["players"]


def peak_memory_mb(video, tmp_path):
    import tracemalloc

    tracemalloc.start()
    try:
        run(video, tmp_path)
        return tracemalloc.get_traced_memory()[1] / 1e6
    finally:
        tracemalloc.stop()


def test_memory_does_not_grow_with_the_length_of_the_video(fake_models, tmp_path):
    """Criterio de PCIT-146: se lee y se dibuja fotograma a fotograma, sin guardar el vídeo en memoria."""
    short = write_synthetic_video(tmp_path / "corto.avi", num_frames=20)
    long = write_synthetic_video(tmp_path / "largo.avi", num_frames=200)
    frame_mb = WIDTH * HEIGHT * 3 / 1e6

    short_peak = peak_memory_mb(short, tmp_path)
    long_peak = peak_memory_mb(long, tmp_path)

    # Con el vídeo entero en memoria, 180 fotogramas más serían ~500 MB más.
    assert long_peak - short_peak < 10 * frame_mb
