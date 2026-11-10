"""Descarga los pesos de los modelos y el vídeo de ejemplo.

Uso (desde la carpeta model/):

    python scripts/download_models.py            # modelos + vídeo de ejemplo
    python scripts/download_models.py --no-video # solo modelos
    python scripts/download_models.py --tracknet # además, los pesos de TrackNet (evaluación, TA-14b)
    python scripts/download_models.py --pose     # además, el modelo de pose para el saque (TA-19)
    python scripts/download_models.py --verify   # solo comprobar los archivos que ya están en disco
    python scripts/download_models.py --strict   # también falla si un archivo no tiene hash registrado

Los archivos ya descargados no se vuelven a bajar (usa --force para repetir).

Integridad (PCIT-166): cada archivo se compara con su sha256 de EXPECTED_SHA256.
Los pesos se cargan con torch.load, que deserializa con pickle: un archivo
reemplazado en Drive o en GitHub podría ejecutar código (CVE-2025-32434). Por eso
un archivo descargado que no coincide se borra y el script termina con error.
"""

from __future__ import annotations

import argparse
import hashlib
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
    # Versión más ligera, para vídeos largos (models.players en config.yaml).
    "models/yolov8m.pt": "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8m.pt",
}

# TrackNet (TA-14b): pesos de la implementación pública yastrebksv/TrackNet, solo para evaluar.
# No tienen licencia publicada: no se descargan por defecto (--tracknet).
TRACKNET_FILES = {
    "models/tracknet.pt": "1XEYZ4myUN7QT-NeBYJI0xteLsvs-ZAOl",
}

# Modelo de pose para reforzar el saque (TA-19, opcional): --pose.
POSE_FILES = {
    "models/yolov8m-pose.pt": "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8m-pose.pt",
}

SAMPLE_VIDEO = {
    "input_videos/input_video.mp4": (
        "https://raw.githubusercontent.com/abdullahtarek/tennis_analysis/main/input_videos/input_video.mp4"
    ),
}

# sha256 esperado de cada archivo. None = todavía sin registrar: el script avisa y
# muestra el hash calculado para copiarlo aquí (o falla con --strict).
EXPECTED_SHA256: dict[str, str | None] = {
    "models/yolo5_last.pt": None,
    "models/keypoints_model.pth": None,
    "models/yolov8x.pt": "3df4ada6b4dad6d657868f2fdf7faecfb34dcfccf3a25c4b82079064718524c8",
    "models/yolov8m.pt": "5d4a90cdc7a21786cc59cd19778e9eafff836df9e2da32524737c7ee6efe4fe5",
    "models/tracknet.pt": None,
    "models/yolov8m-pose.pt": "dbe539ea268db2534390942cfdf206e521f376f19e5415967a57f6a2ddfa3c90",
    # El mismo hash que registra eval/labels/botes_a_mano.json.
    "input_videos/input_video.mp4": "5f2584a2010864d5d8624c325d7f0571d48bd0756164657ef603dc8a97bab22d",
}


class IntegrityError(RuntimeError):
    """El archivo no coincide con su sha256 registrado."""


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def check_integrity(rel: str, path: Path, strict: bool = False) -> str:
    """Comprueba el sha256 de ``path``. Devuelve "ok" o "sin-hash"; lanza IntegrityError si no coincide."""
    actual = sha256_of(path)
    expected = EXPECTED_SHA256.get(rel)
    if expected is None:
        message = f"{rel} no tiene sha256 registrado. Calculado: {actual} (añádelo a EXPECTED_SHA256)."
        if strict:
            raise IntegrityError(message)
        print(f"AVISO {message}", file=sys.stderr)
        return "sin-hash"
    if actual != expected:
        raise IntegrityError(f"{rel}: sha256 {actual} no coincide con el esperado {expected}.")
    return "ok"


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
    parser.add_argument("--tracknet", action="store_true", help="descargar también los pesos de TrackNet (TA-14b)")
    parser.add_argument("--pose", action="store_true", help="descargar también el modelo de pose (TA-19)")
    parser.add_argument("--verify", action="store_true", help="solo comprobar el sha256 de los archivos en disco")
    parser.add_argument("--strict", action="store_true", help="fallar si un archivo no tiene sha256 registrado")
    args = parser.parse_args(argv)

    jobs: list[tuple[str, str, str]] = [(p, "drive", i) for p, i in DRIVE_FILES.items()]
    jobs += [(p, "url", u) for p, u in URL_FILES.items()]
    if args.tracknet or args.verify:  # --verify también comprueba TrackNet si está en disco
        jobs += [(p, "drive", i) for p, i in TRACKNET_FILES.items()]
    if args.pose or args.verify:
        jobs += [(p, "url", u) for p, u in POSE_FILES.items()]
    if not args.no_video:
        jobs += [(p, "url", u) for p, u in SAMPLE_VIDEO.items()]

    failures = 0
    for rel, kind, source in jobs:
        dest = MODEL_DIR / rel
        exists = dest.exists() and dest.stat().st_size > 0
        if args.verify:
            if not exists:
                print(f"Falta {rel}, se omite.")
                continue
            try:
                check_integrity(rel, dest, args.strict)
                print(f"OK {rel}")
            except IntegrityError as exc:
                failures += 1
                print(f"ERROR {exc} Vuelve a descargarlo con --force.", file=sys.stderr)
            continue
        if exists and not args.force:
            try:
                check_integrity(rel, dest, args.strict)
                print(f"Ya existe {rel} (verificado), se omite.")
            except IntegrityError as exc:
                failures += 1
                print(f"ERROR {exc} Vuelve a descargarlo con --force.", file=sys.stderr)
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            if kind == "drive":
                download_from_drive(source, dest)
            else:
                download_from_url(source, dest)
            check_integrity(rel, dest, args.strict)
            print(f"OK {rel}")
        except IntegrityError as exc:
            failures += 1
            dest.unlink(missing_ok=True)  # no dejar en disco un archivo que no es el esperado
            print(f"ERROR {exc} Se borró el archivo.", file=sys.stderr)
        except Exception as exc:  # noqa: BLE001 - se informa y se sigue con el resto
            failures += 1
            print(f"ERROR {rel}: {exc}", file=sys.stderr)

    return 1 if failures else 0

if __name__ == "__main__":
    sys.exit(main())
