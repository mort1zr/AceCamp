"""Pre-etiquetado de un clip para el set de validación (TA-9).

Ejecuta el modelo sobre el clip y escribe un JSON de etiquetas
(tennis-labels/v1, ver eval/labels.py) con lo que detecta: puntos clave de la
pista, posición de la pelota y golpes. Así el equipo solo revisa y corrige
(python -m eval.review) en lugar de etiquetar desde cero.

Lo que el modelo aún no detecta (saques y el ganador de cada punto)
queda vacío: se etiqueta a mano en la revisión.

Uso, desde la carpeta model/:

    python -m eval.prelabel --input clips/clip_01.mp4 --output eval/labels/clip_01.json
    python -m eval.prelabel --input clips/clip_01.mp4 --output eval/labels/clip_01.json --use-cache --device cuda:0

IMPORTANTE: el pre-etiquetado son predicciones del modelo. Evaluar el modelo
contra un archivo sin revisar daría resultados perfectos y falsos: el archivo
lleva "reviewed": false hasta que alguien lo revise en eval.review.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from config import load_config

from .labels import FORMAT

BALL_EVERY_FRAMES = 5  # se etiqueta la pelota en uno de cada N fotogramas
KEYPOINTS_EVERY_FRAMES = 150  # y los puntos clave de la pista cada N (5 s a 30 fps)


def _ball_center(frame_detections):
    box = frame_detections.get(1)
    if box is None:
        return None
    return [round((box[0] + box[2]) / 2, 1), round((box[1] + box[3]) / 2, 1)]


def build_prelabels(result, video_file, ball_every=BALL_EVERY_FRAMES, keypoints_every=KEYPOINTS_EVERY_FRAMES):
    """Etiquetas iniciales a partir del resultado de main.run_pipeline()."""
    info = result["video_info"]
    num_frames = len(result["ball_detections"])
    keypoints = result["court_keypoints"]
    return {
        "format": FORMAT,
        "video": {"file": Path(video_file).name, "sha256": result["video_hash"],
                  "fps": info.fps, "frames": num_frames},
        "reviewed": False,
        "review": {"ball_every": ball_every, "keypoints_every": keypoints_every, "source": "modelo"},
        "court_keypoints": {
            str(i): [[round(float(x), 1), round(float(y), 1)] for x, y in zip(keypoints[i][::2], keypoints[i][1::2])]
            for i in range(0, num_frames, keypoints_every)
            if keypoints[i] is not None
        },
        "ball": {str(i): _ball_center(result["ball_detections"][i]) for i in range(0, num_frames, ball_every)},
        "shots": [{"frame": s["frame"], "player": s["player"]} for s in result["shots"]],
        "bounces": [{k: b[k] for k in ("frame", "x_px", "y_px", "x_m", "y_m") if k in b}
                    for b in result.get("bounces", [])],
        "serves": [],
        "cuts": list(result.get("cuts", [])),
        "points": [{"start": p["start"], "end": p["end"]} for p in result.get("points", [])],
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description="Pre-etiqueta un clip con las detecciones del modelo.")
    parser.add_argument("--input", required=True, type=Path, help="vídeo del clip")
    parser.add_argument("--output", required=True, type=Path, help="JSON de etiquetas a crear")
    parser.add_argument("--ball-every", type=int, default=BALL_EVERY_FRAMES)
    parser.add_argument("--keypoints-every", type=int, default=KEYPOINTS_EVERY_FRAMES)
    parser.add_argument("--use-cache", action="store_true", help="reutilizar detecciones guardadas de este vídeo")
    parser.add_argument("--device", help="cpu, cuda:0, mps...")
    parser.add_argument("--force", action="store_true", help="sobrescribir el JSON si ya existe")
    args = parser.parse_args(argv)

    if args.output.exists() and not args.force:
        raise SystemExit(f"{args.output} ya existe. Puede tener correcciones a mano: usa --force para sobrescribirlo.")
    if not args.input.exists():
        raise SystemExit(f"No existe el vídeo {args.input}")

    import main as pipeline  # carga el modelo solo al ejecutar

    config = load_config()
    config["paths"]["input"] = str(args.input.resolve())
    config["use_cache"] = args.use_cache
    if args.device:
        config["detection"]["device"] = args.device
    result = pipeline.run_pipeline(config, render=False)

    labels = build_prelabels(result, args.input, args.ball_every, args.keypoints_every)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(labels, indent=1, ensure_ascii=False))
    print(f"Pre-etiquetas guardadas en {args.output}. Revísalas con:\n"
          f"  python -m eval.review --video {args.input} --labels {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
