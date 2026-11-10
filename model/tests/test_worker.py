"""Tests del worker (PCIT-35) con dobles en memoria de Firestore y Storage."""

from datetime import datetime, timedelta, timezone

import pytest

from stats import (
    MATCH_STATS_VERSION,
    MODEL_STATS_VERSION,
    build_model_statistics,
    renumber_far_near,
    to_match_statistics,
)
from worker import processor
from worker.processor import (
    MESSAGE_BAD_MATCH_DATA,
    MESSAGE_INTERNAL,
    MESSAGE_NOT_RECOGNIZED,
    MESSAGE_VIDEO_NOT_FOUND,
    VideoNotFoundError,
    run_forever,
    run_once,
)

T0 = datetime(2026, 11, 4, 12, 0, tzinfo=timezone.utc)


class MemoryStore:
    """Imita las transiciones de estado de matches en Firestore."""

    def __init__(self, matches):
        self.matches = matches

    def claim_next(self, worker_version):
        queued = [(m.get("createdAt", T0), mid) for mid, m in self.matches.items() if m["status"] == "en cola"]
        if not queued:
            return None
        _, match_id = min(queued)
        match = self.matches[match_id]
        match.update(status="procesando", workerVersion=worker_version, statistics=None, errorMessage=None)
        return match_id, dict(match)

    def mark_ready(self, match_id, statistics):
        self.matches[match_id].update(status="listo", statistics=statistics, errorMessage=None, finishedAt=T0)

    def mark_error(self, match_id, error_message):
        self.matches[match_id].update(status="error", statistics=None, errorMessage=error_message, finishedAt=T0)


class MemoryStorage:
    def __init__(self, files):
        self.files = files
        self.downloaded = []

    def download(self, video_path, destination):
        if video_path not in self.files:
            raise VideoNotFoundError(video_path)
        destination.write_bytes(self.files[video_path])
        self.downloaded.append(destination)


def model_stats():
    shots = [{"frame": 10, "player": 1, "speedKmh": 80.0}, {"frame": 50, "player": 2, "speedKmh": 62.5},
             {"frame": 90, "player": 1, "speedKmh": 95.0}]
    positions = [{1: (5.0, -1.0), 2: (5.0 + 0.05 * i, 25.0)} for i in range(120)]
    return build_model_statistics(shots, positions, fps=30, num_frames=120)


def queued_match(**fields):
    return {"status": "en cola", "orgId": "org1", "playerId": "p1", "playerPosition": "abajo",
            "videoPath": "orgs/org1/matches/m1/video.mp4", "createdAt": T0, **fields}


def test_a_queued_match_ends_ready_with_statistics(tmp_path):
    store = MemoryStore({"m1": queued_match()})
    storage = MemoryStorage({"orgs/org1/matches/m1/video.mp4": b"video"})

    result = run_once(store, storage, lambda path: model_stats(), tmp_path, version="acecam-model test")

    assert result == ("m1", "listo")
    match = store.matches["m1"]
    assert match["status"] == "listo"
    assert match["workerVersion"] == "acecam-model test"
    assert match["errorMessage"] is None
    statistics = match["statistics"]
    assert statistics["schemaVersion"] == MATCH_STATS_VERSION
    assert statistics["player"]["shots"] == {"count": 1, "sumSpeedKmh": 62.5, "maxSpeedKmh": 62.5}  # 'abajo' = 2
    assert statistics["opponent"]["shots"]["count"] == 2


def test_the_downloaded_video_is_analyzed_and_then_deleted(tmp_path):
    store = MemoryStore({"m1": queued_match()})
    storage = MemoryStorage({"orgs/org1/matches/m1/video.mp4": b"bytes del video"})
    seen = []

    def analyze(path):
        seen.append(path.read_bytes())
        return model_stats()

    run_once(store, storage, analyze, tmp_path, version="v")

    assert seen == [b"bytes del video"]
    assert not storage.downloaded[0].exists()
    assert list(tmp_path.iterdir()) == []


def test_oldest_queued_match_goes_first_and_others_are_untouched(tmp_path):
    store = MemoryStore({
        "nuevo": queued_match(createdAt=T0 + timedelta(minutes=5)),
        "viejo": queued_match(createdAt=T0),
        "listo": queued_match(status="listo"),
    })
    storage = MemoryStorage({"orgs/org1/matches/m1/video.mp4": b"v"})

    assert run_once(store, storage, lambda p: model_stats(), tmp_path, version="v") == ("viejo", "listo")
    assert store.matches["nuevo"]["status"] == "en cola"


def test_empty_queue(tmp_path):
    assert run_once(MemoryStore({}), MemoryStorage({}), lambda p: model_stats(), tmp_path, version="v") is None


@pytest.mark.parametrize(
    ("files", "analyze", "match_fields", "message"),
    [
        ({}, lambda p: model_stats(), {}, MESSAGE_VIDEO_NOT_FOUND),
        ({"orgs/org1/matches/m1/video.mp4": b"v"}, None, {}, MESSAGE_NOT_RECOGNIZED),
        ({"orgs/org1/matches/m1/video.mp4": b"v"}, "boom", {}, MESSAGE_INTERNAL),
        ({"orgs/org1/matches/m1/video.mp4": b"v"}, lambda p: model_stats(), {"playerPosition": None},
         MESSAGE_BAD_MATCH_DATA),
        ({"orgs/org1/matches/m1/video.mp4": b"v"}, lambda p: model_stats(), {"videoPath": ""},
         MESSAGE_BAD_MATCH_DATA),
    ],
    ids=["video-no-existe", "pista-no-reconocida", "error-inesperado", "sin-posicion", "sin-video"],
)
def test_failures_end_in_error_with_a_message_for_the_user(tmp_path, files, analyze, match_fields, message):
    def not_recognized(path):
        raise ValueError("no se encontró ningún jugador en el lado cercano de la pista")

    def boom(path):
        raise RuntimeError("CUDA out of memory")

    analyze = {None: not_recognized, "boom": boom}.get(analyze, analyze)
    store = MemoryStore({"m1": queued_match(**match_fields)})

    assert run_once(store, MemoryStorage(files), analyze, tmp_path, version="v") == ("m1", "error")
    match = store.matches["m1"]
    assert match["errorMessage"] == message
    assert match["statistics"] is None
    assert "CUDA" not in match["errorMessage"]  # nunca detalles técnicos al usuario
    assert list(tmp_path.iterdir()) == []


def test_run_forever_keeps_going_after_a_queue_error(tmp_path, monkeypatch):
    monkeypatch.setattr(processor.time, "sleep", lambda s: None)
    calls = []

    class FlakyStore(MemoryStore):
        def claim_next(self, worker_version):
            calls.append(1)
            if len(calls) == 1:
                raise ConnectionError("sin red")
            return super().claim_next(worker_version)

    store = FlakyStore({"m1": queued_match()})
    storage = MemoryStorage({"orgs/org1/matches/m1/video.mp4": b"v"})

    run_forever(store, storage, lambda p: model_stats(), tmp_path, poll_seconds=0, max_iterations=3)

    assert store.matches["m1"]["status"] == "listo"
    assert len(calls) == 3


def test_worker_version_names_the_model():
    assert processor.worker_version().startswith("acecam-model ")


# ------------------------------------------------------------- estadísticas


def test_model_statistics_follow_the_schema_rules():
    stats = model_stats()

    assert stats["schemaVersion"] == MODEL_STATS_VERSION
    assert stats["durationSeconds"] == 4.0
    far = stats["players"]["1"]
    assert far["shots"] == {"count": 2, "sumSpeedKmh": 175.0, "maxSpeedKmh": 95.0}  # sumas, no promedios
    assert far["movement"]["distanceMeters"] == 0.0  # quieto: se midió y dio cero
    near = stats["players"]["2"]
    assert near["movement"]["avgSpeedKmh"] == pytest.approx(5.4, abs=0.2)  # 0,05 m por fotograma a 30 fps


def test_a_player_without_shots_has_count_zero_and_no_max():
    stats = build_model_statistics([], [{1: (0.0, 0.0), 2: (1.0, 1.0)}] * 10, fps=30, num_frames=10)

    assert stats["players"]["1"]["shots"] == {"count": 0, "sumSpeedKmh": 0.0}


def test_movement_is_omitted_when_it_cannot_be_measured():
    stats = build_model_statistics([], [{1: (0.0, 0.0)}], fps=30, num_frames=1)

    assert "movement" not in stats["players"]["2"]


def test_detector_jitter_does_not_add_meters():
    import numpy as np

    rng = np.random.default_rng(0)
    still_with_jitter = [{1: tuple(rng.normal(0, 0.05, 2)), 2: (0.0, 0.0)} for _ in range(300)]

    stats = build_model_statistics([], still_with_jitter, fps=30, num_frames=300)

    # Sin suavizar sumaría unos 20 m en 10 s; con suavizado se queda en pocos metros.
    assert stats["players"]["1"]["movement"]["distanceMeters"] < 5.0


@pytest.mark.parametrize(("position", "player_key"), [("arriba", "1"), ("abajo", "2")])
def test_player_position_picks_the_registered_player(position, player_key):
    stats = model_stats()

    match_stats = to_match_statistics(stats, position)

    assert match_stats["player"] == stats["players"][player_key]
    assert match_stats["opponent"] == stats["players"]["2" if player_key == "1" else "1"]


def test_invalid_inputs_for_match_statistics():
    with pytest.raises(ValueError):
        to_match_statistics(model_stats(), "izquierda")
    with pytest.raises(ValueError):
        to_match_statistics({"schemaVersion": "otra"}, "arriba")


def test_players_are_renumbered_by_side_whatever_their_tracker_id():
    positions = [{7: (5.0, 24.0), 3: (5.0, -1.0)} for _ in range(5)]  # 7 = cercano, 3 = lejano
    shots = [{"frame": 1, "player": 7, "speedKmh": 60.0}, {"frame": 3, "player": 3, "speedKmh": 80.0}]

    new_shots, new_positions = renumber_far_near(shots, positions)

    assert new_positions[0] == {1: (5.0, -1.0), 2: (5.0, 24.0)}
    assert [s["player"] for s in new_shots] == [2, 1]


def test_renumbering_keeps_players_already_numbered_by_side():
    positions = [{1: (5.0, -1.0), 2: (5.0, 24.0)}] * 3
    shots = [{"frame": 1, "player": 1, "speedKmh": 60.0}]

    assert renumber_far_near(shots, positions) == (shots, positions)


# ------------------------------------------------- duración máxima (PCIT-147)


def test_a_video_that_is_too_long_ends_in_error_with_the_limit(tmp_path):
    def too_long(path):
        raise processor.VideoTooLongError(95.0, 60)

    store = MemoryStore({"m1": queued_match()})
    storage = MemoryStorage({"orgs/org1/matches/m1/video.mp4": b"v"})

    assert run_once(store, storage, too_long, tmp_path, version="v") == ("m1", "error")
    assert store.matches["m1"]["errorMessage"] == (
        "Por ahora el análisis admite videos de hasta 1 minuto. Recorta el video y vuelve a subirlo.")
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize(("seconds", "text"), [(45, "45 segundos"), (60, "1 minuto"), (600, "10 minutos"),
                                               (90, "1 min 30 s")])
def test_the_limit_is_written_for_people(seconds, text):
    assert text in processor.message_too_long(seconds)


def write_video(path, seconds, fps=30, size=(64, 48)):
    import cv2
    import numpy as np

    out = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), fps, size)
    for _ in range(int(seconds * fps)):
        out.write(np.zeros((size[1], size[0], 3), np.uint8))
    out.release()
    return path


def test_the_analyzer_rejects_long_videos_before_running_the_model(tmp_path, monkeypatch):
    import main
    from worker.__main__ import make_analyzer

    config = tmp_path / "config.yaml"
    config.write_text("worker:\n  max_duration_seconds: 2\n  min_resolution: 0\n")
    ran = []
    monkeypatch.setattr(main, "run_pipeline", lambda config, render: ran.append(1) or {"model_statistics": {}})
    analyze = make_analyzer(config, render_video=False)

    with pytest.raises(processor.VideoTooLongError) as error:
        analyze(write_video(tmp_path / "largo.avi", seconds=3))
    assert error.value.duration_seconds == pytest.approx(3)
    assert ran == []

    analyze(write_video(tmp_path / "corto.avi", seconds=1))
    assert ran == [1]



# ---------------------------------------------- resolución mínima


def test_a_low_resolution_video_ends_in_error_with_the_requirement(tmp_path):
    def low_resolution(path):
        raise processor.VideoResolutionError(640, 360, 720)

    store = MemoryStore({"m1": queued_match()})

    assert run_once(store, MemoryStorage({"orgs/org1/matches/m1/video.mp4": b"v"}), low_resolution, tmp_path,
                    version="v") == ("m1", "error")
    assert store.matches["m1"]["errorMessage"] == (
        "El video debe tener al menos 720p (1280x720). Grábalo o expórtalo en 720p o 1080p y vuelve a subirlo.")


@pytest.mark.parametrize(("size", "accepted"), [((640, 360), False), ((1280, 720), True), ((720, 1280), True),
                                                 ((1920, 1080), True)],
                         ids=["360p", "720p", "720p-vertical", "1080p"])
def test_the_analyzer_checks_the_resolution_before_running_the_model(tmp_path, monkeypatch, size, accepted):
    import main
    from worker.__main__ import make_analyzer

    ran = []
    monkeypatch.setattr(main, "run_pipeline", lambda config, render: ran.append(1) or {"model_statistics": {}})
    analyze = make_analyzer(render_video=False)
    video = write_video(tmp_path / "v.avi", seconds=0.3, size=size)

    if accepted:
        analyze(video)
        assert ran == [1]
    else:
        with pytest.raises(processor.VideoResolutionError):
            analyze(video)
        assert ran == []


@pytest.mark.parametrize(("fps", "status"), [(24, "error"), (25, "listo"), (30, "listo"),
                                            (60, "listo"), (61, "error")])
def test_worker_checks_fps_before_running_the_model(tmp_path, monkeypatch, fps, status):
    import main
    from worker.__main__ import make_analyzer

    config = tmp_path / "config.yaml"
    config.write_text("worker:\n  min_resolution: 0\n")
    ran = []
    monkeypatch.setattr(main, "run_pipeline", lambda config, render: ran.append(1) or {"model_statistics": model_stats()})
    video = write_video(tmp_path / "clip.avi", seconds=0.2, fps=fps)
    path = "orgs/org1/matches/m1/video.avi"
    store = MemoryStore({"m1": queued_match(videoPath=path)})
    storage = MemoryStorage({path: video.read_bytes()})

    result = run_once(store, storage, make_analyzer(config, render_video=False), tmp_path / "work", version="v")

    assert result == ("m1", status)
    if status == "error":
        assert ran == []
        assert store.matches["m1"]["errorMessage"] == (
            "El video debe tener entre 25 y 60 FPS. Grábalo o expórtalo dentro de ese rango.")
    else:
        assert ran == [1]
        assert store.matches["m1"]["errorMessage"] is None
    assert list((tmp_path / "work").iterdir()) == []


def test_worker_rejects_unreported_fps_without_using_the_fallback(tmp_path, monkeypatch):
    import main
    import utils
    from worker.__main__ import make_analyzer

    monkeypatch.setattr(utils, "get_video_info", lambda path: utils.VideoInfo(24, 1280, 720, 2400, fps_reported=False))
    monkeypatch.setattr(main, "run_pipeline", lambda *args, **kwargs: pytest.fail("El modelo no debe ejecutarse"))
    store = MemoryStore({"m1": queued_match()})
    storage = MemoryStorage({"orgs/org1/matches/m1/video.mp4": b"v"})

    assert run_once(store, storage, make_analyzer(render_video=False), tmp_path, version="v") == ("m1", "error")
    assert store.matches["m1"]["errorMessage"] == (
        "No se pudieron verificar los FPS del video. Expórtalo entre 25 y 60 FPS.")
