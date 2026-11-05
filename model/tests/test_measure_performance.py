"""Tests del script de Colab que mide tiempo y memoria (TA-37)."""

import importlib.util
from pathlib import Path

import cv2
import numpy as np

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"


def load(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def write_video(path, frames=30, fps=30):
    out = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), fps, (64, 48))
    for i in range(frames):
        out.write(np.full((48, 64, 3), i, np.uint8))
    out.release()
    return path


def test_long_videos_repeat_the_source(tmp_path):
    performance = load("measure_performance")
    source = write_video(tmp_path / "corto.avi", frames=30, fps=30)

    long = performance.make_long_video(source, 0.05, tmp_path / "largo.mp4")  # 3 s = 90 fotogramas

    cap = cv2.VideoCapture(str(long))
    assert int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) == 90
