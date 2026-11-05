"""Mide tiempo y memoria del pipeline con vídeos de distinta duración (TA-37, PCIT-146).

Uso, desde model/ y en Linux (Colab), porque la memoria se mide con resource:

    python scripts/measure_performance.py --source input_videos/input_video.mp4 --minutes 0.5 10 --device cuda:0

Crea vídeos de la duración pedida repitiendo el de origen, ejecuta main.py en un proceso
aparte para cada uno (sin vídeo anotado y con él) y mide el tiempo por minuto de vídeo y
la memoria máxima del proceso. Criterios de PCIT-146: con 10 min a 1080p, menos de 4 GB, y
la memoria no crece con la duración.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

import cv2

MODEL_DIR = Path(__file__).resolve().parent.parent


def make_long_video(source, minutes, dest):
    """Repite el vídeo de origen hasta durar los minutos pedidos (sin cargarlo entero en memoria)."""
    cap = cv2.VideoCapture(str(source))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(round(minutes * 60 * fps))
    out = cv2.VideoWriter(str(dest), cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    written = 0
    while written < total:
        ok, frame = cap.read()
        if not ok:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
        out.write(frame)
        written += 1
    out.release()
    cap.release()
    return dest


# Se ejecuta main.main() en un proceso nuevo, que al terminar imprime su propia memoria máxima.
CHILD = (
    "import resource, sys\n"
    "import main\n"
    "main.main(sys.argv[1:])\n"
    "print('MEMORIA_MAXIMA_KB', resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)\n"
)


def run(video, device, render, workdir):
    """Ejecuta el pipeline en un proceso nuevo. Devuelve (segundos, memoria máxima en MB, salida)."""
    command = [sys.executable, "-c", CHILD, "--input", str(video), "--output", str(workdir / "salida.avi"),
               "--cache-dir", str(workdir / "cache")]
    if device:
        command += ["--device", device]
    if not render:
        command.append("--no-video")
    started = time.perf_counter()
    done = subprocess.run(command, cwd=MODEL_DIR, capture_output=True, text=True)
    elapsed = time.perf_counter() - started
    if done.returncode != 0:
        raise RuntimeError(f"main.py falló con {video.name}:\n{done.stderr[-2000:]}")
    peak = re.search(r"MEMORIA_MAXIMA_KB (\d+)", done.stdout)
    return elapsed, int(peak.group(1)) / 1024 if peak else float("nan"), done.stdout


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", type=Path, default=MODEL_DIR / "input_videos" / "input_video.mp4")
    parser.add_argument("--minutes", type=float, nargs="+", default=[0.5, 10.0])
    parser.add_argument("--device", help="cuda:0, cpu...")
    parser.add_argument("--workdir", type=Path, default=Path("/tmp/acecam_rendimiento"))
    parser.add_argument("--output", type=Path, default=Path("output_videos/rendimiento"))
    args = parser.parse_args(argv)

    args.workdir.mkdir(parents=True, exist_ok=True)
    rows = []
    for minutes in sorted(args.minutes):
        video = make_long_video(args.source, minutes, args.workdir / f"video_{minutes:g}min.mp4")
        for render in (False, True):
            elapsed, peak_mb, stdout = run(video, args.device, render, args.workdir)
            homography = re.search(r"Homografía: [^\n]*", stdout)
            rows.append({"minutes": minutes, "render_video": render, "seconds": round(elapsed, 1),
                         "seconds_per_video_minute": round(elapsed / minutes, 1), "peak_memory_mb": round(peak_mb),
                         "homography": homography.group(0) if homography else None})
            print(rows[-1], flush=True)

    lines = ["| Duración | Vídeo anotado | Tiempo | s por min de vídeo | Memoria máxima |", "|" + " --- |" * 5]
    for r in rows:
        lines.append(f"| {r['minutes']:g} min | {'sí' if r['render_video'] else 'no'} | {r['seconds']} s "
                     f"| {r['seconds_per_video_minute']} | {r['peak_memory_mb']} MB |")
    report = "\n".join(lines)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.with_suffix(".md").write_text(report + "\n")
    args.output.with_suffix(".json").write_text(json.dumps(rows, indent=1))
    print(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
