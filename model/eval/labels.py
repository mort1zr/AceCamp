"""Formato de las etiquetas del set de validación (TA-9).

Cada clip etiquetado es un JSON. Las predicciones del modelo usan el mismo
formato, así que el evaluador compara campo a campo. Todos los campos salvo
"format" y "video" son opcionales: se evalúa solo lo que esté en ambos.

{
  "format": "tennis-labels/v1",
  "video": {"file": "clip_01.mp4", "sha256": "…", "fps": 30, "frames": 900},
  "reviewed": true,                            # false = pre-etiquetas sin revisar: el evaluador las omite
  "review": {"ball_every": 5, "keypoints_every": 150},   # opcional, lo usa eval.review

  "court_keypoints": {"0": [[x, y], … 14 puntos …], "450": [...]},
  "ball": {"0": [x, y], "1": null, …},        # centro en píxeles; null = no visible
  "shots":   [{"frame": 120, "player": 1}],
  "bounces": [{"frame": 140, "x_px": 812.0, "y_px": 640.5, "x_m": 3.2, "y_m": 20.1}],  # posición opcional
  "serves":  [{"frame": 100, "player": 1}],
  "cuts":    [312, 640],                       # fotogramas con cambio de plano
  "points":  [{"start": 90, "end": 400, "winner": 2}]
}

Jugador 1 = lado lejano, 2 = lado cercano (como en el pipeline).
Los fotogramas son índices desde 0. En "ball" solo cuentan los fotogramas
listados: se puede etiquetar uno de cada N.
"""

from __future__ import annotations

import json
from pathlib import Path

FORMAT = "tennis-labels/v1"
NUM_KEYPOINTS = 14


class LabelError(ValueError):
    pass


def _check_frame_list(data, key, required_fields):
    for i, item in enumerate(data.get(key, [])):
        if not isinstance(item, dict) or not all(f in item for f in required_fields):
            raise LabelError(f"{key}[{i}] debe tener los campos {required_fields}")
        if not isinstance(item["frame" if "frame" in required_fields else required_fields[0]], int):
            raise LabelError(f"{key}[{i}]: los fotogramas deben ser enteros")


def validate(data: dict) -> dict:
    """Comprueba la estructura y devuelve las etiquetas con las claves de fotograma como int."""
    if data.get("format") != FORMAT:
        raise LabelError(f"format debe ser '{FORMAT}'")
    if "video" not in data or "file" not in data["video"]:
        raise LabelError("falta video.file")

    result = dict(data)
    if "court_keypoints" in data:
        keypoints = {}
        for frame, points in data["court_keypoints"].items():
            if len(points) != NUM_KEYPOINTS or any(len(p) != 2 for p in points):
                raise LabelError(f"court_keypoints[{frame}] debe tener {NUM_KEYPOINTS} puntos [x, y]")
            keypoints[int(frame)] = [tuple(map(float, p)) for p in points]
        result["court_keypoints"] = keypoints
    if "ball" in data:
        ball = {}
        for frame, center in data["ball"].items():
            if center is not None and len(center) != 2:
                raise LabelError(f"ball[{frame}] debe ser [x, y] o null")
            ball[int(frame)] = None if center is None else tuple(map(float, center))
        result["ball"] = ball
    _check_frame_list(data, "shots", ("frame",))
    _check_frame_list(data, "bounces", ("frame",))
    _check_frame_list(data, "serves", ("frame",))
    _check_frame_list(data, "points", ("start", "end", "winner"))
    if not all(isinstance(f, int) for f in data.get("cuts", [])):
        raise LabelError("cuts debe ser una lista de fotogramas enteros")
    return result


def load(path: str | Path) -> dict:
    path = Path(path)
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise LabelError(f"{path.name}: JSON no válido ({exc})") from exc
    try:
        return validate(data)
    except LabelError as exc:
        raise LabelError(f"{path.name}: {exc}") from exc
