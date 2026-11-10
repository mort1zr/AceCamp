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
        "report_dir": "output_videos/informe",
    },
    "models": {
        "players": "models/yolov8m.pt",
        "ball": "models/yolo5_last.pt",
        "court_keypoints": "models/keypoints_model.pth",
        "ball_tracknet": "models/tracknet.pt",
    },
    "detection": {"device": None, "ball_confidence": 0.15, "ball_max_interpolation_gap": 5,
                  "player_every_n_frames": 1, "ball_image_size": "auto",
                  "ball_detector": "yolo"},
    "court": {"redetect_every_frames": 30, "smoothing": 0.3, "refine_keypoints": True},
    "cameras": {"detect_cuts": True, "max_shift_fraction": 0.08},
    "line_calls": {"doubt_margin_m": 0.15, "doubles": False},
    "rallies": {"short_max": 4, "medium_max": 8},
    "match": {"first_server": "auto", "best_of": 3, "games_per_set": 6, "tiebreak_points": 7,
              "match_tiebreak_points": 10, "no_ad": False, "final_set": "tiebreak", "initial_score": None},
    "worker": {"max_duration_seconds": 60, "min_resolution": 720, "min_fps": 25, "max_fps": 60},
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
    parser.add_argument("--match-config", help="match.yaml con el formato, el sacador y el marcador inicial (TA-29)")
    parser.add_argument("--report-dir", help="carpeta del informe del partido: report.json, points.csv... (TA-30)")
    parser.add_argument("--corrections", help="corrections.json con el ganador correcto de algunos puntos (TA-29)")
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
    if args.match_config:
        match = yaml.safe_load(Path(args.match_config).read_text(encoding="utf-8")) or {}
        overrides["match"] = match.get("match", match)  # con o sin la clave match:
    if args.report_dir:
        overrides["paths"]["report_dir"] = str(Path(args.report_dir).resolve())
    if args.corrections:
        overrides["paths"]["corrections"] = str(Path(args.corrections).resolve())
    return _merge(config, overrides)


def resolve_path(path: str | Path) -> Path:
    """Las rutas relativas se interpretan desde model/, no desde el directorio actual."""
    path = Path(path)
    return path if path.is_absolute() else MODEL_DIR / path
