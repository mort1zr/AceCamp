"""Worker de AceCam: procesa los partidos 'en cola' de Firestore (PCIT-35).

Uso, desde la carpeta model/:

    python -m worker --once          # procesa un partido (si hay) y termina
    python -m worker                 # se queda escuchando la cola

Variables de entorno:

    GOOGLE_APPLICATION_CREDENTIALS   ruta al JSON de la cuenta de servicio (nunca en el repo)
    FIREBASE_PROJECT_ID              por defecto, el de .firebaserc (acecam-e93a2)
    FIREBASE_STORAGE_BUCKET          por defecto, <proyecto>.firebasestorage.app

En Azure (PCIT-226), los videos están en Azure Blob Storage:

    AZURE_STORAGE_ACCOUNT            cuenta de almacenamiento (activa Azure en vez de Firebase Storage)
    AZURE_STORAGE_CONTAINER          contenedor de videos (por defecto, videos)
    AZURE_CLIENT_ID                  identidad administrada que lee y escribe los videos
    FIREBASE_SERVICE_ACCOUNT         JSON de la cuenta de servicio (secreto de Azure, en lugar del archivo)
    ACECAM_VERSION                   commit de la imagen, para workerVersion

Con los emuladores de Firebase (sin credenciales):

    FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
    STORAGE_EMULATOR_HOST=http://127.0.0.1:9199
    FIREBASE_PROJECT_ID=demo-acecam
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import tempfile
from pathlib import Path

from config import load_config
from utils.progress import report_stage

from .processor import (
    AnalysisResult,
    VideoFrameRateError,
    VideoResolutionError,
    VideoTooLongError,
    run_forever,
    run_once,
)
from .video import encode_browser_video

DEFAULT_PROJECT_ID = "acecam-e93a2"


def make_analyzer(config_path=None, device=None, render_video=True):
    """Función vídeo → estadísticas del modelo, con la configuración de config.yaml."""
    import main as pipeline  # se importa aquí: carga trackers y modelos solo si hay trabajo
    from utils import get_video_info

    base = load_config(config_path)
    max_seconds = base["worker"]["max_duration_seconds"]
    min_short_side = base["worker"].get("min_resolution")
    min_long_side = round(min_short_side * 16 / 9) if min_short_side else 0
    min_fps = base["worker"]["min_fps"]
    max_fps = base["worker"]["max_fps"]

    def analyze(video_path: Path):
        # Los metadatos se leen sin cargar los fotogramas.
        info = get_video_info(video_path)
        if not info.fps_reported:
            raise VideoFrameRateError(None, min_fps, max_fps)
        if max_seconds and info.duration_seconds > max_seconds:
            raise VideoTooLongError(info.duration_seconds, max_seconds)
        if min_short_side and (min(info.width, info.height) < min_short_side
                               or max(info.width, info.height) < min_long_side):
            raise VideoResolutionError(info.width, info.height, min_short_side, min_long_side)
        if not min_fps <= info.fps <= max_fps:
            raise VideoFrameRateError(info.fps, min_fps, max_fps)
        config = {**base, "paths": {**base["paths"], "input": str(video_path),
                                  "output": str(video_path.parent / "annotated.avi")},
                  "detection": {**base["detection"], **({"device": device} if device else {})},
                  "use_cache": True}  # mismo vídeo (mismo hash) en un reintento: no repite YOLO
        result = pipeline.run_pipeline(config, render=render_video)
        if not render_video:
            return result["model_statistics"]
        report_stage("encoding")
        output = encode_browser_video(Path(result["output_video"]), video_path.parent / "processed.mp4")
        return AnalysisResult(result["model_statistics"], output)

    return analyze


def lazy_analyzer(config_path=None, device=None):
    """Como make_analyzer, pero carga el modelo la primera vez que hay un partido.

    En Azure el worker arranca cada pocos minutos con --once: si la cola está vacía,
    termina en segundos sin cargar PyTorch ni los pesos (PCIT-226).
    """
    analyzer = None

    def analyze(video_path: Path):
        nonlocal analyzer
        if analyzer is None:
            analyzer = make_analyzer(config_path, device)
        return analyzer(video_path)

    return analyze


def use_service_account_from_env(workdir: Path) -> None:
    """Si el JSON llega en FIREBASE_SERVICE_ACCOUNT (secreto de Azure), lo deja en un archivo
    privado y apunta GOOGLE_APPLICATION_CREDENTIALS a él, como espera la librería de Google."""
    content = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "").strip()
    if not content or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        return
    path = workdir / "service-account.json"
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as file:
        file.write(content)
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(path)


def make_storage(args):
    """Azure Blob si hay AZURE_STORAGE_ACCOUNT (PCIT-226); si no, Firebase Storage."""
    from .firebase_backend import AzureBlobVideos, CloudStorageVideos

    if args.azure_account:
        return AzureBlobVideos(args.azure_account, args.azure_container), f"Azure Blob {args.azure_account}/{args.azure_container}"
    bucket = args.bucket or f"{args.project}.firebasestorage.app"
    return CloudStorageVideos(args.project, bucket), f"bucket {bucket}"


def main(argv=None):
    parser = argparse.ArgumentParser(description="Procesa los partidos en cola de Firestore.")
    parser.add_argument("--once", action="store_true", help="procesar como mucho un partido y terminar")
    parser.add_argument("--poll-seconds", type=float, default=10.0, help="espera con la cola vacía (por defecto 10)")
    parser.add_argument("--project", default=os.environ.get("FIREBASE_PROJECT_ID", DEFAULT_PROJECT_ID))
    parser.add_argument("--bucket", default=os.environ.get("FIREBASE_STORAGE_BUCKET"))
    parser.add_argument("--azure-account", default=os.environ.get("AZURE_STORAGE_ACCOUNT"),
                        help="cuenta de Azure Blob Storage de los videos (PCIT-226)")
    parser.add_argument("--azure-container", default=os.environ.get("AZURE_STORAGE_CONTAINER") or "videos")
    parser.add_argument("--config", help="config.yaml del modelo (por defecto, el de model/)")
    parser.add_argument("--device", help="cpu, cuda:0, mps... (por defecto, el de config.yaml)")
    parser.add_argument("--workdir", type=Path, default=Path(tempfile.gettempdir()) / "acecam-worker",
                        help="carpeta temporal para los videos descargados")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    from .firebase_backend import FirestoreMatchStore

    args.workdir.mkdir(parents=True, exist_ok=True)
    use_service_account_from_env(args.workdir)
    store = FirestoreMatchStore(args.project)
    storage, where = make_storage(args)
    analyze = lazy_analyzer(args.config, args.device)
    logging.info("worker listo: proyecto %s, videos en %s", args.project, where)

    if args.once:
        result = run_once(store, storage, analyze, args.workdir)
        logging.info("cola vacía" if result is None else f"{result[0]}: {result[1]}")
        return 0
    run_forever(store, storage, analyze, args.workdir, poll_seconds=args.poll_seconds)
    return 0


if __name__ == "__main__":
    sys.exit(main())
