"""Caché de detecciones en JSON, identificada por el contenido del vídeo.

Sustituye a los pickles del proyecto original: un JSON no ejecuta código al
leerse y, al ir ligado al hash del vídeo y del modelo, nunca se reutilizan
detecciones de otro vídeo.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

CACHE_FORMAT_VERSION = 1


def file_sha256(path: str | Path, chunk_size: int = 1 << 20) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def cache_path_for(cache_dir: str | Path, video_hash: str, kind: str, model_path: str | Path, **params) -> Path:
    """Ruta del archivo de caché para un vídeo, un tipo de detección y un modelo concretos."""
    key = json.dumps({"model": Path(model_path).name, **params}, sort_keys=True)
    key_hash = hashlib.sha256(key.encode()).hexdigest()[:12]
    return Path(cache_dir) / f"{video_hash[:16]}_{kind}_{key_hash}.json"


def save_detections(path: str | Path, detections: list[dict[int, list[float]]], video_hash: str) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "format": CACHE_FORMAT_VERSION,
        "video_sha256": video_hash,
        # JSON solo admite claves de texto: los IDs de seguimiento se guardan como str.
        "detections": [{str(track_id): list(map(float, bbox)) for track_id, bbox in frame.items()} for frame in detections],
    }
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload))
    tmp.replace(path)


def load_detections(path: str | Path, video_hash: str) -> list[dict[int, list[float]]] | None:
    """Devuelve las detecciones guardadas, o None si no hay caché válida para este vídeo."""
    path = Path(path)
    if not path.exists():
        return None
    payload = json.loads(path.read_text())
    if payload.get("format") != CACHE_FORMAT_VERSION or payload.get("video_sha256") != video_hash:
        return None
    return [{int(track_id): bbox for track_id, bbox in frame.items()} for frame in payload["detections"]]
