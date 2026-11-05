"""Tests del script de Colab que compara YOLO y TrackNet (TA-14b)."""

import importlib.util
import json
from pathlib import Path

import cv2
import numpy as np
import pytest

from utils import VideoInfo
from utils.detection_cache import file_sha256

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


def test_compare_ball_detectors_reports_coverage_bounces_and_f1(tmp_path, monkeypatch):
    compare = load("compare_ball_detectors")
    video = write_video(tmp_path / "h9.avi", frames=60)
    labels = {"videos": {"h9.avi": {"sha256": file_sha256(video), "bounces": [10, 30, 50]}}}

    def fake_analyze(path, detector, device, use_cache):
        found = [10, 31] if detector == "yolo" else [10, 30, 50, 55]
        ball = [{1: [0, 0, 1, 1]} if i % 2 == 0 else {} for i in range(60)]
        return {"video_info": VideoInfo(30.0, 64, 48, 60), "ball_detections": ball,
                "bounces": [{"frame": f} for f in found], "serves": [{}], "points": [{}, {}]}, 6.0

    monkeypatch.setattr(compare, "analyze", fake_analyze)
    output = tmp_path / "informe"

    compare.main(["--videos", str(video), "--labels", str(tmp_path / "labels.json"), "--output", str(output)])
    (tmp_path / "labels.json").write_text(json.dumps(labels))
    compare.main(["--videos", str(video), "--labels", str(tmp_path / "labels.json"), "--output", str(output)])

    rows = json.loads(output.with_suffix(".json").read_text())
    yolo, tracknet = rows
    assert yolo["ball_frames_pct"] == 50.0 and yolo["seconds_per_video_minute"] == 180.0  # 6 s para 2 s de vídeo
    assert yolo["bounce_recall"] == pytest.approx(2 / 3) and yolo["bounce_precision"] == 1.0
    assert tracknet["bounce_recall"] == 1.0 and tracknet["bounce_precision"] == 0.75
    assert "| h9.avi | tracknet |" in output.with_suffix(".md").read_text()


def test_reference_bounces_need_the_same_video(tmp_path):
    compare = load("compare_ball_detectors")
    video = write_video(tmp_path / "h9.avi")
    labels = {"videos": {"h9.avi": {"sha256": "otro", "bounces": [1]}}}

    assert compare.reference_bounces(video, labels) is None
