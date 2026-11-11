"""Tests de la verificación de integridad de download_models.py (PCIT-166)."""

import hashlib
import importlib.util
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "download_models.py"


@pytest.fixture
def dm(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location("download_models", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    monkeypatch.setattr(module, "MODEL_DIR", tmp_path)
    # Un solo archivo por fuente para que los tests no dependan de la lista real.
    monkeypatch.setattr(module, "DRIVE_FILES", {"models/a.pt": "id-a"})
    monkeypatch.setattr(module, "URL_FILES", {"models/b.pt": "https://example.test/b.pt"})
    monkeypatch.setattr(module, "TRACKNET_FILES", {})
    monkeypatch.setattr(module, "POSE_FILES", {})
    monkeypatch.setattr(module, "SAMPLE_VIDEO", {})
    return module


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fake_download(contents):
    def download(_source, dest):
        dest.write_bytes(contents[dest.name])

    return download


def test_known_hashes_are_valid_hex(dm):
    spec = importlib.util.spec_from_file_location("real", SCRIPT)
    real = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(real)
    files = {**real.DRIVE_FILES, **real.URL_FILES, **real.TRACKNET_FILES, **real.POSE_FILES, **real.SAMPLE_VIDEO}
    assert set(real.EXPECTED_SHA256) == set(files)  # cada archivo descargable tiene su entrada
    for value in real.EXPECTED_SHA256.values():
        assert value is None or (len(value) == 64 and int(value, 16) >= 0)


def test_download_ok_when_hash_matches(dm, monkeypatch, tmp_path):
    contents = {"a.pt": b"pesos a", "b.pt": b"pesos b"}
    monkeypatch.setattr(dm, "EXPECTED_SHA256", {"models/a.pt": sha(b"pesos a"), "models/b.pt": sha(b"pesos b")})
    monkeypatch.setattr(dm, "download_from_drive", fake_download(contents))
    monkeypatch.setattr(dm, "download_from_url", fake_download(contents))
    assert dm.main([]) == 0
    assert (tmp_path / "models/a.pt").read_bytes() == b"pesos a"


def test_tampered_download_is_deleted_and_fails(dm, monkeypatch, tmp_path, capsys):
    contents = {"a.pt": b"pesos cambiados", "b.pt": b"pesos b"}
    monkeypatch.setattr(dm, "EXPECTED_SHA256", {"models/a.pt": sha(b"pesos a"), "models/b.pt": sha(b"pesos b")})
    monkeypatch.setattr(dm, "download_from_drive", fake_download(contents))
    monkeypatch.setattr(dm, "download_from_url", fake_download(contents))
    assert dm.main([]) == 1
    assert not (tmp_path / "models/a.pt").exists()
    assert (tmp_path / "models/b.pt").exists()
    assert "no coincide" in capsys.readouterr().err


def test_unknown_hash_warns_or_fails_with_strict(dm, monkeypatch, tmp_path, capsys):
    contents = {"a.pt": b"pesos a", "b.pt": b"pesos b"}
    monkeypatch.setattr(dm, "EXPECTED_SHA256", {"models/a.pt": None, "models/b.pt": sha(b"pesos b")})
    monkeypatch.setattr(dm, "download_from_drive", fake_download(contents))
    monkeypatch.setattr(dm, "download_from_url", fake_download(contents))
    assert dm.main([]) == 0
    assert sha(b"pesos a") in capsys.readouterr().err  # muestra el hash para registrarlo
    assert dm.main(["--force", "--strict"]) == 1
    assert not (tmp_path / "models/a.pt").exists()


def test_verify_checks_existing_files_without_downloading(dm, monkeypatch, tmp_path):
    (tmp_path / "models").mkdir()
    (tmp_path / "models/a.pt").write_bytes(b"pesos a")
    monkeypatch.setattr(dm, "EXPECTED_SHA256", {"models/a.pt": sha(b"pesos a"), "models/b.pt": sha(b"pesos b")})

    def no_download(*_args):
        raise AssertionError("--verify no debe descargar")

    monkeypatch.setattr(dm, "download_from_drive", no_download)
    monkeypatch.setattr(dm, "download_from_url", no_download)
    assert dm.main(["--verify"]) == 0  # b.pt falta: se omite
    (tmp_path / "models/a.pt").write_bytes(b"otro contenido")
    assert dm.main(["--verify"]) == 1
    assert (tmp_path / "models/a.pt").exists()  # en --verify no se borra nada


def test_existing_file_is_verified_before_skipping(dm, monkeypatch, tmp_path):
    (tmp_path / "models").mkdir()
    (tmp_path / "models/a.pt").write_bytes(b"cambiado")
    (tmp_path / "models/b.pt").write_bytes(b"pesos b")
    monkeypatch.setattr(dm, "EXPECTED_SHA256", {"models/a.pt": sha(b"pesos a"), "models/b.pt": sha(b"pesos b")})
    assert dm.main([]) == 1
