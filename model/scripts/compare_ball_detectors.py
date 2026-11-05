"""Compara los detectores de pelota YOLO y TrackNet sobre varios vídeos (TA-14b).

Uso, desde model/ (en Colab con GPU, ver training/sprint3_colab.ipynb):

    python scripts/compare_ball_detectors.py --videos input_videos/h1.mp4 input_videos/h4.mp4 --device cuda:0

Para cada vídeo y detector ejecuta el pipeline completo (sin dibujar el vídeo) y mide:
- en qué porcentaje de fotogramas hay pelota elegida;
- los botes frente a los marcados a mano (eval/labels/botes_a_mano.json), con ±2 fotogramas a 30 fps;
- los saques y los puntos detectados;
- el tiempo de proceso por minuto de vídeo.

Escribe el informe en Markdown (para la PR y Jira) y en JSON.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(MODEL_DIR))

from config import load_config  # noqa: E402
from eval.metrics import match_events  # noqa: E402
from utils.detection_cache import file_sha256  # noqa: E402

DEFAULT_LABELS = MODEL_DIR / "eval" / "labels" / "botes_a_mano.json"


def reference_bounces(video, labels):
    """Botes marcados a mano para este vídeo, si es el mismo archivo (mismo SHA-256)."""
    entry = labels.get("videos", {}).get(Path(video).name)
    if entry and entry.get("sha256") == file_sha256(video):
        return entry["bounces"]
    return None


def analyze(video, detector, device, use_cache):
    import main as pipeline

    config = load_config()
    config["paths"]["input"] = str(Path(video).resolve())
    config["detection"]["ball_detector"] = detector
    config["use_cache"] = use_cache
    if device:
        config["detection"]["device"] = device
    started = time.perf_counter()
    result = pipeline.run_pipeline(config, render=False)
    return result, time.perf_counter() - started


def measure(video, detector, device, use_cache, labels):
    result, elapsed = analyze(video, detector, device, use_cache)
    info = result["video_info"]
    ball = result["ball_detections"]
    row = {
        "video": Path(video).name, "detector": detector,
        "resolution": f"{info.width}x{info.height}", "fps": round(info.fps, 1), "frames": len(ball),
        "ball_frames_pct": round(100 * sum(1 in f for f in ball) / max(len(ball), 1), 1),
        "bounces": len(result["bounces"]), "serves": len(result["serves"]), "points": len(result["points"]),
        "seconds_per_video_minute": round(elapsed / (info.duration_seconds / 60), 1),
    }
    reference = reference_bounces(video, labels)
    if reference is not None:
        tolerance = max(2, round(2 * info.fps / 30))
        score, _ = match_events([b["frame"] for b in result["bounces"]], reference, tolerance)
        row.update(bounces_reference=len(reference), bounce_precision=score.precision, bounce_recall=score.recall,
                   bounce_f1=score.f1)
    return row


def _fmt(value):
    if value is None:
        return "-"
    return f"{value:.2f}" if isinstance(value, float) and value <= 1 else str(value)


def markdown(rows):
    header = ("| Vídeo | Detector | Resolución | fps | Pelota (% fotogramas) | Botes (marcados) | Precisión | Recall "
              "| F1 | Saques | Puntos | s por min de vídeo |")
    lines = [header, "|" + " --- |" * 12]
    for r in rows:
        lines.append(f"| {r['video']} | {r['detector']} | {r['resolution']} | {r['fps']} | {r['ball_frames_pct']} "
                     f"| {r['bounces']} ({r.get('bounces_reference', '-')}) | {_fmt(r.get('bounce_precision'))} "
                     f"| {_fmt(r.get('bounce_recall'))} | {_fmt(r.get('bounce_f1'))} | {r['serves']} | {r['points']} "
                     f"| {r['seconds_per_video_minute']} |")
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--videos", nargs="+", required=True, type=Path)
    parser.add_argument("--detectors", nargs="+", default=["yolo", "tracknet"], choices=["yolo", "tracknet"])
    parser.add_argument("--device", help="cuda:0, cpu...")
    parser.add_argument("--labels", type=Path, default=DEFAULT_LABELS, help="botes marcados a mano")
    parser.add_argument("--use-cache", action="store_true",
                        help="reutilizar detecciones guardadas (el tiempo medido ya no es el de la detección)")
    parser.add_argument("--output", type=Path, default=Path("output_videos/comparacion_pelota"),
                        help="prefijo de los informes (.md y .json)")
    args = parser.parse_args(argv)

    labels = json.loads(args.labels.read_text()) if args.labels.exists() else {}
    rows = []
    for video in args.videos:
        for detector in args.detectors:
            print(f"== {video.name} con {detector}", flush=True)
            rows.append(measure(video, detector, args.device, args.use_cache, labels))
    report = markdown(rows)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.with_suffix(".md").write_text(report + "\n")
    args.output.with_suffix(".json").write_text(json.dumps(rows, indent=1))
    print(report)
    print(f"\nInforme guardado en {args.output.with_suffix('.md')} y {args.output.with_suffix('.json')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
