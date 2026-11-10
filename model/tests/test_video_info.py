import cv2
import numpy as np
import pytest

from utils import get_video_info, read_video, save_video, speed_km_per_hour


def write_video(path, fps, num_frames, size=(64, 48)):
    width, height = size
    out = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), fps, (width, height))
    for i in range(num_frames):
        out.write(np.full((height, width, 3), i % 255, dtype=np.uint8))
    out.release()


@pytest.mark.parametrize("fps", [24, 30, 60])
def test_reads_fps_resolution_and_frame_count(tmp_path, fps):
    path = tmp_path / f"clip_{fps}.avi"
    write_video(path, fps=fps, num_frames=fps * 2)

    info = get_video_info(path)

    assert info.fps == pytest.approx(fps)
    assert info.fps_reported is True
    assert (info.width, info.height) == (64, 48)
    assert info.frame_count == fps * 2
    assert info.duration_seconds == pytest.approx(2.0)


def test_same_real_speed_at_any_fps():
    # Un golpe de 20 m que dura 0,8 s: 19,2 fotogramas a 24 fps, 24 a 30 fps, 48 a 60 fps.
    speeds = [speed_km_per_hour(20.0, 0.8 * fps, fps) for fps in (24, 30, 60)]

    assert speeds == pytest.approx([90.0, 90.0, 90.0], rel=0.05)


def test_saved_video_keeps_the_input_fps(tmp_path):
    source = tmp_path / "in.avi"
    write_video(source, fps=30, num_frames=10)
    frames = read_video(source)

    output = tmp_path / "out.avi"
    save_video(frames, output, fps=get_video_info(source).fps)

    assert get_video_info(output).fps == pytest.approx(30)


def test_unreadable_video_raises(tmp_path):
    with pytest.raises(ValueError):
        get_video_info(tmp_path / "no-existe.mp4")


def test_fallback_fps_is_marked_as_unreported(tmp_path, monkeypatch):
    class CaptureWithoutFps:
        def isOpened(self):
            return True

        def get(self, prop):
            return 0 if prop == cv2.CAP_PROP_FPS else 64

        def release(self):
            pass

    monkeypatch.setattr(cv2, "VideoCapture", lambda path: CaptureWithoutFps())

    with pytest.warns(UserWarning, match="no informa de sus fps"):
        info = get_video_info(tmp_path / "sin-fps.mp4")
    assert info.fps == 24
    assert info.fps_reported is False
