from utils.detection_cache import cache_path_for, file_sha256, load_detections, save_detections

DETECTIONS = [{1: [10.0, 20.0, 30.0, 40.0], 2: [1.5, 2.5, 3.5, 4.5]}, {}, {7: [0, 0, 5, 5]}]


def test_round_trip_keeps_int_track_ids(tmp_path):
    path = tmp_path / "players.json"
    save_detections(path, DETECTIONS, video_hash="abc")

    loaded = load_detections(path, video_hash="abc")

    assert loaded == [{1: [10.0, 20.0, 30.0, 40.0], 2: [1.5, 2.5, 3.5, 4.5]}, {}, {7: [0.0, 0.0, 5.0, 5.0]}]
    assert all(isinstance(k, int) for frame in loaded for k in frame)


def test_cache_of_another_video_is_ignored(tmp_path):
    path = tmp_path / "players.json"
    save_detections(path, DETECTIONS, video_hash="video-a")

    assert load_detections(path, video_hash="video-b") is None


def test_missing_cache_returns_none(tmp_path):
    assert load_detections(tmp_path / "no-existe.json", video_hash="abc") is None


def test_different_videos_get_different_cache_files(tmp_path):
    video_a = tmp_path / "a.mp4"
    video_b = tmp_path / "b.mp4"
    video_a.write_bytes(b"partido 1")
    video_b.write_bytes(b"partido 2")

    path_a = cache_path_for(tmp_path, file_sha256(video_a), "ball", "models/yolo5_last.pt", conf=0.15)
    path_b = cache_path_for(tmp_path, file_sha256(video_b), "ball", "models/yolo5_last.pt", conf=0.15)

    assert path_a != path_b


def test_model_and_params_are_part_of_the_cache_key(tmp_path):
    base = cache_path_for(tmp_path, "h" * 64, "ball", "models/yolo5_last.pt", conf=0.15)

    assert base != cache_path_for(tmp_path, "h" * 64, "ball", "models/otro.pt", conf=0.15)
    assert base != cache_path_for(tmp_path, "h" * 64, "ball", "models/yolo5_last.pt", conf=0.3)


def test_tracker_uses_cache_without_loading_the_model(tmp_path):
    from trackers.ball_tracker import BallTracker

    path = tmp_path / "ball.json"
    save_detections(path, [{1: [0, 0, 1, 1]}, {1: [1, 1, 2, 2]}], video_hash="abc")
    tracker = BallTracker(model_path="no-existe.pt")

    result = tracker.detect_frames([object(), object()], cache_path=path, video_hash="abc", use_cache=True)

    assert result == [{1: [0.0, 0.0, 1.0, 1.0]}, {1: [1.0, 1.0, 2.0, 2.0]}]
    assert tracker._model is None
