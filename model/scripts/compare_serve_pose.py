"""Compara el detector de saque con y sin pose (TA-19) frente a saques marcados a mano.

Uso (desde model/, con el modelo de pose descargado: python scripts/download_models.py --pose):

    python scripts/compare_serve_pose.py --input input_videos/h4.mp4 --labels eval/labels/h4.json --use-cache

--labels es un archivo tennis-labels/v1 (eval/labels.py) con "serves": [{"frame", "player"}].
Imprime precisión, recall y F1 de los saques (±3 fotogramas) sin pose y con pose. El criterio
de TA-19 es una mejora de al menos 3 puntos de F1; si no la hay, se documenta que no compensa.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import load_config, resolve_path  # noqa: E402
from eval.labels import load as load_labels  # noqa: E402
from eval.metrics import match_events  # noqa: E402

SERVE_TOLERANCE_FRAMES = 3


def serve_scores(config, labels):
    from main import run_pipeline

    result = run_pipeline(config, render=False)
    predicted = [s["frame"] for s in result["serves"]]
    scores, _ = match_events(predicted, [s["frame"] for s in labels["serves"]], SERVE_TOLERANCE_FRAMES)
    return scores


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--input", required=True)
    parser.add_argument("--labels", required=True)
    parser.add_argument("--pose-model", default="models/yolov8m-pose.pt")
    parser.add_argument("--use-cache", action="store_true")
    args = parser.parse_args(argv)

    labels = load_labels(args.labels)
    if not labels.get("serves"):
        raise SystemExit("El archivo de etiquetas no tiene saques (serves).")
    config = load_config()
    config["paths"]["input"] = args.input
    config["use_cache"] = args.use_cache
    rows = []
    for name, pose in (("sin pose", None), ("con pose", str(resolve_path(args.pose_model)))):
        config["serves"] = {"pose_model": pose}
        scores = serve_scores(config, labels)
        rows.append((name, scores))
        print(f"{name}: precisión {scores.precision:.2f}  recall {scores.recall:.2f}  F1 {scores.f1:.2f}")
    gain = 100 * (rows[1][1].f1 - rows[0][1].f1)
    print(f"Mejora de F1 con pose: {gain:+.1f} puntos ({'compensa' if gain >= 3 else 'no compensa'}: criterio +3)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
