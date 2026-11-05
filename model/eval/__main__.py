"""Compara las predicciones del modelo con el set de validación (TA-9).

Uso, desde la carpeta model/:

    python -m eval --labels eval/labels --predictions eval/predictions
    python -m eval --labels eval/labels --predictions eval/predictions --json resultados.json

Cada archivo de etiquetas <clip>.json se compara con el archivo del mismo
nombre en la carpeta de predicciones (mismo formato, ver eval/labels.py).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .labels import LabelError, load
from .metrics import DetectionScore, evaluate


def _fmt(value):
    if value is None:
        return "—"
    return f"{value:.3f}" if isinstance(value, float) else str(value)


def _row(name, value):
    if isinstance(value, DetectionScore):
        return (f"  {name:<26} precisión {_fmt(value.precision):>6}  recall {_fmt(value.recall):>6}  "
                f"F1 {_fmt(value.f1):>6}  (TP {value.true_positives}, FP {value.false_positives}, "
                f"FN {value.false_negatives})")
    return f"  {name:<26} {_fmt(value)}"


def _serializable(results):
    return {k: (v.to_dict() if isinstance(v, DetectionScore) else v) for k, v in results.items()}


def run(labels_dir: Path, predictions_dir: Path):
    label_files = sorted(labels_dir.glob("*.json"))
    if not label_files:
        raise SystemExit(f"No hay etiquetas (*.json) en {labels_dir}")

    per_clip, totals, averages = {}, {}, {}
    for label_file in label_files:
        prediction_file = predictions_dir / label_file.name
        if not prediction_file.exists():
            print(f"{label_file.name}: sin predicciones en {predictions_dir}, se omite", file=sys.stderr)
            continue
        actual = load(label_file)
        if actual.get("reviewed") is False:
            # Pre-etiquetas sin revisar: son predicciones del modelo y darían métricas perfectas y falsas.
            print(f"{label_file.name}: sin revisar (\"reviewed\": false), se omite. Revísalo con "
                  f"python -m eval.review", file=sys.stderr)
            continue
        results = evaluate(load(prediction_file), actual)
        per_clip[label_file.stem] = results
        for key, value in results.items():
            if isinstance(value, DetectionScore):
                totals[key] = totals[key] + value if key in totals else value
            elif value is not None:
                averages.setdefault(key, []).append(value)

    summary = {**totals, **{k: sum(v) / len(v) for k, v in averages.items()}}
    return per_clip, summary


def main(argv=None):
    parser = argparse.ArgumentParser(description="Evalúa el modelo contra el set de validación etiquetado.")
    parser.add_argument("--labels", required=True, type=Path, help="carpeta con las etiquetas <clip>.json")
    parser.add_argument("--predictions", required=True, type=Path, help="carpeta con las predicciones <clip>.json")
    parser.add_argument("--json", type=Path, help="guardar también los resultados en este archivo")
    args = parser.parse_args(argv)

    try:
        per_clip, summary = run(args.labels, args.predictions)
    except LabelError as exc:
        raise SystemExit(f"Etiquetas no válidas: {exc}") from exc

    for clip, results in per_clip.items():
        print(clip)
        for name, value in results.items():
            print(_row(name, value))
    print(f"TOTAL ({len(per_clip)} clips)")
    for name, value in summary.items():
        print(_row(name, value))

    if args.json:
        args.json.write_text(json.dumps(
            {"clips": {c: _serializable(r) for c, r in per_clip.items()}, "total": _serializable(summary)},
            indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
