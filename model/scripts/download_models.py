"""Descarga los pesos de los modelos y el vídeo de ejemplo.

Uso (desde la carpeta model/):

    python scripts/download_models.py            # modelos + vídeo de ejemplo
    python scripts/download_models.py --no-video # solo modelos

Los archivos ya descargados no se vuelven a bajar (usa --force para repetir).
"""

from __future__ import annotations

import argparse
import sys
import urllib.request
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parent.parent

# Pesos entrenados por el autor del repositorio original (enlaces públicos de su README).
DRIVE_FILES = {
    "models/yolo5_last.pt": "1UZwiG1jkWgce9lNhxJ2L0NVjX1vGM05U",
    "models/keypoints_model.pth": "1QrTOF1ToQ4plsSZbkBs3zOLkVt3MBlta",
}

# Detector de personas preentrenado de Ultralytics.
URL_FILES = {
    "models/yolov8x.pt": "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8x.pt",
}

SAMPLE_VIDEO = {
    "input_videos/input_video.mp4": (
        "https://raw.githubusercontent.com/abdullahtarek/tennis_analysis/main/input_videos/input_video.mp4"
    ),
}


def download_from_drive(file_id: str, dest: Path) -> None:
    import gdown  # se importa aquí para que --help funcione sin dependencias

    result = gdown.download(id=file_id, output=str(dest), quiet=False)
    if result is None:
        raise RuntimeError(f"No se pudo descargar {dest.name} de Google Drive (id {file_id}).")


def download_from_url(url: str, dest: Path) -> None:
    print(f"Descargando {url}")
    tmp = dest.with_suffix(dest.suffix + ".part")
    urllib.request.urlretrieve(url, tmp)
    tmp.replace(dest)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--no-video", action="store_true", help="no descargar el vídeo de ejemplo")
    parser.add_argument("--force", action="store_true", help="descargar aunque el archivo ya exista")
    args = parser.parse_args(argv)

    jobs: list[tuple[str, str, str]] = [(p, "drive", i) for p, i in DRIVE_FILES.items()]
    jobs += [(p, "url", u) for p, u in URL_FILES.items()]
    if not args.no_video:
        jobs += [(p, "url", u) for p, u in SAMPLE_VIDEO.items()]

    failures = 0
    for rel, kind, source in jobs:
        dest = MODEL_DIR / rel
        if dest.exists() and dest.stat().st_size > 0 and not args.force:
            print(f"Ya existe {rel}, se omite.")
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            if kind == "drive":
                download_from_drive(source, dest)
            else:
                download_from_url(source, dest)
            print(f"OK {rel}")
        except Exception as exc:  # noqa: BLE001 - se informa y se sigue con el resto
            failures += 1
            print(f"ERROR {rel}: {exc}", file=sys.stderr)

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
