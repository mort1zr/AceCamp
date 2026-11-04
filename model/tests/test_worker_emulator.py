"""Integración del worker con los emuladores de Firebase (PCIT-35).

Solo se ejecuta si los emuladores están en marcha y las variables definidas:

    firebase emulators:start --only firestore,storage --project demo-acecam   (desde la raíz del repo)

    FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 STORAGE_EMULATOR_HOST=http://127.0.0.1:9199 pytest tests/test_worker_emulator.py
"""

import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from worker.processor import MESSAGE_VIDEO_NOT_FOUND, run_once

pytestmark = pytest.mark.skipif(
    not (os.environ.get("FIRESTORE_EMULATOR_HOST") and os.environ.get("STORAGE_EMULATOR_HOST")),
    reason="necesita los emuladores de Firebase (FIRESTORE_EMULATOR_HOST y STORAGE_EMULATOR_HOST)",
)

PROJECT = "demo-acecam"
BUCKET = f"{PROJECT}.firebasestorage.app"


@pytest.fixture
def backend():
    global FieldFilter
    from google.cloud import storage
    from google.cloud.firestore_v1.base_query import FieldFilter

    from worker.firebase_backend import CloudStorageVideos, FirestoreMatchStore

    store = FirestoreMatchStore(PROJECT)
    client = storage.Client(project=PROJECT)  # en el emulador, el bucket existe sin crearlo
    # Cada test usa su propia organización para no ver partidos de otros tests.
    org = f"org-{uuid.uuid4().hex[:8]}"
    yield store, CloudStorageVideos(PROJECT, BUCKET), client.bucket(BUCKET), org
    for snapshot in store.db.collection("matches").where(filter=FieldFilter("orgId", "==", org)).stream():
        snapshot.reference.delete()


def add_match(store, org, match_id, video_path, minutes_ago=0, **fields):
    from google.cloud import firestore

    store.db.collection("matches").document(match_id).set({
        "orgId": org, "playerId": "p1", "playerPosition": "abajo", "videoPath": video_path,
        "status": "en cola", "createdAt": datetime.now(timezone.utc) - timedelta(minutes=minutes_ago),
        "statistics": None, "createdBy": "uid-coach", "updatedAt": firestore.SERVER_TIMESTAMP, **fields,
    })


def clear_queue(store):
    for snapshot in store.db.collection("matches").where(filter=FieldFilter("status", "==", "en cola")).stream():
        snapshot.reference.update({"status": "listo"})


@pytest.fixture
def synthetic_video(tmp_path):
    from tests.test_pipeline_smoke import write_synthetic_video

    return write_synthetic_video(tmp_path / "partido.avi")


def model_stats(path):
    from tests.test_worker import model_stats as fake

    return fake()


def test_queued_match_goes_to_ready_with_statistics(backend, tmp_path):
    store, videos, bucket, org = backend
    clear_queue(store)
    path = f"orgs/{org}/matches/m1/video.mp4"
    bucket.blob(path).upload_from_string(b"bytes del video")
    match_id = f"{org}-m1"
    add_match(store, org, match_id, path)

    assert run_once(store, videos, model_stats, tmp_path, version="acecam-model test") == (match_id, "listo")

    doc = store.db.collection("matches").document(match_id).get().to_dict()
    assert doc["status"] == "listo"
    assert doc["statistics"]["schemaVersion"] == "acecam.match-stats.v1"
    assert doc["statistics"]["player"]["shots"]["count"] == 1
    assert doc["workerVersion"] == "acecam-model test"
    assert doc["errorMessage"] is None
    assert doc["startedAt"] is not None and doc["finishedAt"] >= doc["startedAt"]


def test_oldest_first_and_a_match_is_claimed_only_once(backend):
    store, _, _, org = backend
    clear_queue(store)
    add_match(store, org, f"{org}-nuevo", "x.mp4", minutes_ago=1)
    add_match(store, org, f"{org}-viejo", "x.mp4", minutes_ago=10)

    first = store.claim_next("v")
    second = store.claim_next("v")
    third = store.claim_next("v")

    assert first[0] == f"{org}-viejo"
    assert second[0] == f"{org}-nuevo"
    assert third is None  # ninguno se reclama dos veces


def test_missing_video_ends_in_error(backend, tmp_path):
    store, videos, _, org = backend
    clear_queue(store)
    match_id = f"{org}-sin-video"
    add_match(store, org, match_id, f"orgs/{org}/matches/x/video.mp4")

    assert run_once(store, videos, model_stats, tmp_path, version="v") == (match_id, "error")

    doc = store.db.collection("matches").document(match_id).get().to_dict()
    assert doc["errorMessage"] == MESSAGE_VIDEO_NOT_FOUND
    assert doc["statistics"] is None


def test_a_match_changed_while_processing_is_not_overwritten(backend):
    store, _, _, org = backend
    clear_queue(store)
    match_id = f"{org}-cambiado"
    add_match(store, org, match_id, "x.mp4")
    store.claim_next("v")
    # Mientras se analiza, alguien lo devuelve a la cola (p. ej. Reintentar desde la web).
    store.db.collection("matches").document(match_id).update({"status": "en cola"})

    assert store.mark_ready(match_id, {"schemaVersion": "acecam.match-stats.v1"}) is False
    assert store.db.collection("matches").document(match_id).get().get("status") == "en cola"


def test_end_to_end_storage_pipeline_firestore(backend, tmp_path, monkeypatch, synthetic_video):
    """Video en Storage → pipeline real (modelos sustituidos) → estadísticas en Firestore."""
    import main
    from tests import test_pipeline_smoke as smoke
    from worker.__main__ import make_analyzer

    monkeypatch.setattr(main, "PlayerTracker", smoke.FakePlayerTracker)
    monkeypatch.setattr(main, "BallTracker", smoke.FakeBallTracker)
    monkeypatch.setattr(main, "CourtLineDetector", smoke.FakeCourtLineDetector)
    store, videos, bucket, org = backend
    clear_queue(store)
    path = f"orgs/{org}/matches/e2e/video.avi"
    bucket.blob(path).upload_from_filename(str(synthetic_video))
    match_id = f"{org}-e2e"
    add_match(store, org, match_id, path, playerPosition="abajo")

    assert run_once(store, videos, make_analyzer(), tmp_path / "work", version="v") == (match_id, "listo")

    statistics = store.db.collection("matches").document(match_id).get().get("statistics")
    assert statistics["schemaVersion"] == "acecam.match-stats.v1"
    assert statistics["durationSeconds"] == 4.0  # 120 fotogramas a 30 fps
    assert "shots" in statistics["player"] and "shots" in statistics["opponent"]
