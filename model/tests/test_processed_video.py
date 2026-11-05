"""PCIT-161: resultado privado y fallo seguro antes de publicar Listo."""
import subprocess

import pytest
from test_worker import MemoryStorage, MemoryStore, model_stats, queued_match, write_video

from utils import get_video_info
from worker.processor import MESSAGE_VIDEO_OUTPUT, AnalysisResult, run_once
from worker.video import ProcessedVideoError, encode_browser_video


class OutputStore(MemoryStore):
    def mark_ready(self, match_id, statistics, processed_video_path=None):
        super().mark_ready(match_id, statistics)
        self.matches[match_id]["processedVideoPath"] = processed_video_path


class OutputStorage(MemoryStorage):
    fail = False

    def upload_processed(self, source, destination):
        if self.fail:
            raise OSError("storage unavailable")
        self.files[destination] = source.read_bytes()


def annotated(path):
    output = path.parent / "processed.mp4"
    output.write_bytes(b"annotated video")
    return AnalysisResult(model_stats(), output)


@pytest.mark.parametrize("fail", [False, True])
def test_upload_finishes_before_ready_and_failure_does_not_publish_statistics(tmp_path, fail):
    store = OutputStore({"m1": queued_match()})
    storage = OutputStorage({"orgs/org1/matches/m1/video.mp4": b"source"})
    storage.fail = fail
    assert run_once(store, storage, annotated, tmp_path, version="test") == ("m1", "error" if fail else "listo")
    match = store.matches["m1"]
    if fail:
        assert match["statistics"] is None
        assert match["errorMessage"] == MESSAGE_VIDEO_OUTPUT
        assert "orgs/org1/matches/m1/processed.mp4" not in storage.files
    else:
        assert storage.files[match["processedVideoPath"]] == b"annotated video"
        assert match["statistics"]["player"]["shots"]["count"] == 1
    assert list(tmp_path.iterdir()) == []


def test_video_cannot_be_published_into_another_organization(tmp_path):
    store = OutputStore({"m1": queued_match(orgId="other-org")})
    storage = OutputStorage({"orgs/org1/matches/m1/video.mp4": b"source"})
    assert run_once(store, storage, annotated, tmp_path) == ("m1", "error")
    assert store.matches["m1"]["errorMessage"] == MESSAGE_VIDEO_OUTPUT
    assert len(storage.files) == 1


def test_real_encoder_produces_h264_mp4_with_the_same_frames_and_fps(tmp_path):
    import imageio_ffmpeg

    source = write_video(tmp_path / "raw.avi", seconds=1, fps=30, size=(320, 180))
    output = encode_browser_video(source, tmp_path / "processed.mp4")
    assert output.read_bytes()[4:8] == b"ftyp"
    info = get_video_info(output)
    assert info.frame_count == 30
    assert info.fps == pytest.approx(30)
    probe = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-i", str(output)], capture_output=True)
    assert b"h264" in probe.stderr
    assert b"yuv420p" in probe.stderr


def test_failed_encoding_removes_incomplete_mp4(tmp_path):
    source = tmp_path / "invalid.avi"
    source.write_bytes(b"invalid")
    output = tmp_path / "processed.mp4"
    with pytest.raises(ProcessedVideoError):
        encode_browser_video(source, output)
    assert not output.exists()
