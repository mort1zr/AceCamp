"""Worker en Azure (PCIT-226): videos en Azure Blob, arranque barato y credenciales del entorno."""

import os
import stat

import pytest
from azure.core.exceptions import ResourceNotFoundError

from worker import processor
from worker.__main__ import lazy_analyzer, make_storage, use_service_account_from_env
from worker.firebase_backend import AzureBlobVideos


class FakeBlob:
    def __init__(self, container, name):
        self.container, self.name = container, name

    def get_blob_properties(self):
        if self.name not in self.container.files:
            raise ResourceNotFoundError("no existe")
        return type("Properties", (), {"size": len(self.container.files[self.name])})()

    def download_blob(self):
        data = self.container.files[self.name]
        return type("Downloader", (), {"readinto": lambda _self, file: file.write(data)})()

    def upload_blob(self, file, overwrite, content_settings):
        self.container.files[self.name] = file.read()
        self.container.settings[self.name] = (overwrite, content_settings)


class FakeContainer:
    def __init__(self, files=None):
        self.files, self.settings = dict(files or {}), {}

    def get_blob_client(self, name):
        return FakeBlob(self, name)


def test_downloads_the_video_from_azure(tmp_path):
    videos = AzureBlobVideos("cuenta", container_client=FakeContainer({"orgs/o/matches/m/video.mp4": b"mp4"}))
    destination = tmp_path / "video.mp4"
    videos.download("orgs/o/matches/m/video.mp4", destination)
    assert destination.read_bytes() == b"mp4"


def test_a_missing_video_is_reported_as_not_found(tmp_path):
    videos = AzureBlobVideos("cuenta", container_client=FakeContainer())
    with pytest.raises(processor.VideoNotFoundError):
        videos.download("orgs/o/matches/m/video.mp4", tmp_path / "video.mp4")


@pytest.mark.parametrize("data", [b"", b"x" * 11])
def test_empty_or_too_large_videos_are_rejected_before_downloading(tmp_path, data):
    videos = AzureBlobVideos("cuenta", container_client=FakeContainer({"v.mp4": data}), max_bytes=10)
    with pytest.raises(processor.VideoTooLargeError):
        videos.download("v.mp4", tmp_path / "video.mp4")
    assert not (tmp_path / "video.mp4").exists()


def test_the_processed_video_is_uploaded_private_and_as_mp4(tmp_path):
    container = FakeContainer()
    source = tmp_path / "processed.mp4"
    source.write_bytes(b"resultado")
    AzureBlobVideos("cuenta", container_client=container).upload_processed(source, "orgs/o/matches/m/processed.mp4")
    assert container.files["orgs/o/matches/m/processed.mp4"] == b"resultado"
    overwrite, settings = container.settings["orgs/o/matches/m/processed.mp4"]
    assert overwrite is True
    assert settings.content_type == "video/mp4"
    assert settings.cache_control == "private, max-age=0"


def test_a_too_large_video_ends_in_error_with_a_message_for_the_user(tmp_path):
    class Store:
        errors = {}

        def mark_error(self, match_id, message):
            self.errors[match_id] = message

    class Storage:
        def download(self, video_path, destination):
            raise processor.VideoTooLargeError(600 * 1024 * 1024, 500 * 1024 * 1024)

    store = Store()
    match = {"videoPath": "orgs/o/matches/m/video.mp4", "playerPosition": "abajo", "orgId": "o"}
    assert processor.process_match("m", match, store, Storage(), lambda path: {}, tmp_path) == "error"
    assert "500 MB" in store.errors["m"]


def test_with_an_empty_queue_the_model_is_never_loaded(monkeypatch):
    import worker.__main__ as entry

    loaded = []
    monkeypatch.setattr(entry, "make_analyzer", lambda *args: loaded.append(args) or (lambda path: {"ok": path}))
    analyze = lazy_analyzer("config.yaml", "cpu")
    assert loaded == []
    assert analyze("a.mp4") == {"ok": "a.mp4"}
    assert analyze("b.mp4") == {"ok": "b.mp4"}
    assert loaded == [("config.yaml", "cpu")]


def test_azure_storage_is_used_when_an_account_is_configured(monkeypatch):
    import worker.firebase_backend as backend

    monkeypatch.setattr(backend.AzureBlobVideos, "__init__", lambda self, account, container: None)
    args = type("Args", (), {"azure_account": "acecamvideos", "azure_container": "videos", "bucket": None, "project": "p"})
    storage, where = make_storage(args)
    assert isinstance(storage, backend.AzureBlobVideos)
    assert where == "Azure Blob acecamvideos/videos"


def test_the_service_account_from_azure_is_written_privately(tmp_path, monkeypatch):
    monkeypatch.setenv("FIREBASE_SERVICE_ACCOUNT", '{"type": "service_account"}')
    monkeypatch.delenv("GOOGLE_APPLICATION_CREDENTIALS", raising=False)
    use_service_account_from_env(tmp_path)
    path = tmp_path / "service-account.json"
    assert os.environ["GOOGLE_APPLICATION_CREDENTIALS"] == str(path)
    assert path.read_text() == '{"type": "service_account"}'
    assert stat.S_IMODE(path.stat().st_mode) == 0o600


def test_an_existing_credentials_file_is_kept(tmp_path, monkeypatch):
    monkeypatch.setenv("FIREBASE_SERVICE_ACCOUNT", "{}")
    monkeypatch.setenv("GOOGLE_APPLICATION_CREDENTIALS", "/ruta/propia.json")
    use_service_account_from_env(tmp_path)
    assert os.environ["GOOGLE_APPLICATION_CREDENTIALS"] == "/ruta/propia.json"
    assert not (tmp_path / "service-account.json").exists()


def test_the_worker_version_comes_from_the_image(monkeypatch):
    monkeypatch.setenv("ACECAM_VERSION", "5c750eb1886fd65b45f53e3604988ec4cb139d37")
    assert processor.worker_version() == "acecam-model 5c750eb"
