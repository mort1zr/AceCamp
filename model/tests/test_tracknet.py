"""Tests de TA-14b: detector de pelota TrackNet (sin pesos: arquitectura y postproceso)."""

import numpy as np
import pytest

from trackers.tracknet_tracker import INPUT_HEIGHT, INPUT_WIDTH, TrackNetBallTracker, build_model, heatmap_peak


def test_the_network_has_the_tracknet_layers_and_output():
    torch = pytest.importorskip("torch")
    model = build_model().eval()

    state = model.state_dict()
    convs = sorted({k.split(".")[0] for k in state}, key=lambda name: int(name[4:]))
    assert convs == [f"conv{i}" for i in range(1, 19)]
    assert state["conv1.block.0.weight"].shape == (64, 9, 3, 3)  # 3 fotogramas RGB
    assert state["conv18.block.0.weight"].shape == (256, 64, 3, 3)  # 256 niveles por píxel
    with torch.no_grad():
        out = model(torch.rand(1, 9, 48, 80))
    assert tuple(out.shape) == (1, 256, 48 * 80)


def test_heatmap_peak_returns_the_centre_of_the_ball_blob():
    levels = np.zeros((INPUT_HEIGHT, INPUT_WIDTH))
    levels[100:105, 200:205] = 200  # mancha de la pelota
    levels[300, 600] = 130  # ruido que también supera el umbral

    x, y, level = heatmap_peak(levels)

    assert (x, y, level) == (pytest.approx(202.0), pytest.approx(102.0), 200)


def test_heatmap_below_threshold_means_no_ball():
    assert heatmap_peak(np.full((INPUT_HEIGHT, INPUT_WIDTH), 100)) is None


class FakeNetwork:
    """Devuelve un mapa con la pelota en (320, 180) de la entrada 640x360."""

    def __call__(self, tensor):
        import torch

        assert tuple(tensor.shape) == (1, 9, INPUT_HEIGHT, INPUT_WIDTH)
        levels = torch.zeros(1, 256, INPUT_HEIGHT * INPUT_WIDTH)
        levels[0, 0] = 1.0  # nivel 0 en todo el mapa...
        idx = 180 * INPUT_WIDTH + 320
        levels[0, 0, idx], levels[0, 220, idx] = 0.0, 1.0  # ...salvo la pelota, nivel 220
        return levels


def test_detect_frame_uses_three_frames_and_scales_to_the_video():
    torch = pytest.importorskip("torch")
    tracker = TrackNetBallTracker("sin-pesos.pt")
    tracker._model, tracker._torch, tracker._device = FakeNetwork(), torch, "cpu"
    frame = np.zeros((720, 1280, 3), np.uint8)

    first, second, third = (tracker.detect_frame(frame) for _ in range(3))

    assert first == {} and second == {}  # hacen falta 3 fotogramas
    x1, y1, x2, y2, confidence = third[0]
    assert ((x1 + x2) / 2, (y1 + y2) / 2) == (pytest.approx(640.0), pytest.approx(360.0))
    assert confidence == pytest.approx(220 / 255)
