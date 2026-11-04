"""Carga de la configuración del pipeline (config.yaml + línea de comandos)."""

from __future__ import annotations

import argparse
import copy
from pathlib import Path
from typing import Any

import yaml

MODEL_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = MODEL_DIR / "config.yaml"

DEFAULTS: dict[str, Any] = {
    "paths": {
        "input": "input_videos/input_video.mp4",
        "output": "output_videos/output_video.avi",
        "cache_dir": "cache",
    },
    "models": {
        "players": "models/yolov8x.pt",
        "ball": "models/yolo5_last.pt",
        "court_keypoints": "models/keypoints_model.pth",
    },
    "detection": {"device": None, "ball_confidence": 0.15, "ball_max_interpolation_gap": 5},
    "court": {"redetect_every_frames": 30, "smoothing": 0.3, "refine_keypoints": True},
    "shots": {"min_change_frames_for_hit": 25, "rolling_window": 5},
    "use_cache": False,
    "render_video": True,
}


def _merge(base: dict, override: dict) -> dict:
    result = copy.deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _merge(result[key], value)
        else:
            result[key] = value
    return result


def load_config(path: str | Path | None = None) -> dict[str, Any]:
    """Lee el YAML y lo combina con los valores por defecto."""
    path = Path(path) if path else DEFAULT_CONFIG_PATH
    data = yaml.safe_load(path.read_text()) or {}
    if not isinstance(data, dict):
        raise ValueError(f"{path} debe contener un diccionario YAML")
    return _merge(DEFAULTS, data)


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Analiza un vídeo de tenis y genera un vídeo anotado.")
    parser.add_argument("--config", help="ruta del config.yaml (por defecto, el de model/)")
    parser.add_argument("--input", help="vídeo de entrada")
    parser.add_argument("--output", help="vídeo de salida (.avi)")
    parser.add_argument(
        "--use-cache",
        action="store_true",
        help="reutilizar las detecciones guardadas de este mismo vídeo (se identifican por su hash)",
    )
    parser.add_argument("--cache-dir", help="carpeta de la caché de detecciones")
    parser.add_argument("--device", help="dispositivo de inferencia: cpu, cuda:0, mps...")
    parser.add_argument("--stats-json", help="guardar las estadísticas del partido en este archivo JSON")
    parser.add_argument("--no-video", action="store_true", help="no dibujar ni guardar el vídeo anotado (más rápido)")
    return parser


def config_from_args(argv: list[str] | None = None) -> dict[str, Any]:
    """Configuración final: valores por defecto < config.yaml < línea de comandos."""
    args = build_arg_parser().parse_args(argv)
    config = load_config(args.config)
    overrides: dict[str, Any] = {"paths": {}, "detection": {}}
    if args.input:
        overrides["paths"]["input"] = args.input
    if args.output:
        overrides["paths"]["output"] = args.output
    if args.cache_dir:
        overrides["paths"]["cache_dir"] = args.cache_dir
    if args.device:
        overrides["detection"]["device"] = args.device
    if args.use_cache:
        overrides["use_cache"] = True
    if args.stats_json:
        overrides["paths"]["stats_json"] = args.stats_json
    if args.no_video:
        overrides["render_video"] = False
    return _merge(config, overrides)


def resolve_path(path: str | Path) -> Path:
    """Las rutas relativas se interpretan desde model/, no desde el directorio actual."""
    path = Path(path)
    return path if path.is_absolute() else MODEL_DIR / path
