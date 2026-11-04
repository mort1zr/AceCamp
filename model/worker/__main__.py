"""Worker de AceCam: procesa los partidos 'en cola' de Firestore (PCIT-35).

Uso, desde la carpeta model/:

    python -m worker --once          # procesa un partido (si hay) y termina
    python -m worker                 # se queda escuchando la cola

Variables de entorno:

    GOOGLE_APPLICATION_CREDENTIALS   ruta al JSON de la cuenta de servicio (nunca en el repo)
    FIREBASE_PROJECT_ID              por defecto, el de .firebaserc (acecam-e93a2)
    FIREBASE_STORAGE_BUCKET          por defecto, <proyecto>.firebasestorage.app

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

from .processor import VideoTooLongError, run_forever, run_once

DEFAULT_PROJECT_ID = "acecam-e93a2"


def make_analyzer(config_path=None, device=None):
    """Función vídeo → estadísticas del modelo, con la configuración de config.yaml."""
    import main as pipeline  # se importa aquí: carga trackers y modelos solo si hay trabajo
    from utils import get_video_info

    base = load_config(config_path)
    max_seconds = base["worker"]["max_duration_seconds"]

    def analyze(video_path: Path):
        # La duración se lee de la cabecera del vídeo, sin cargar los fotogramas en memoria.
        duration = get_video_info(video_path).duration_seconds
        if max_seconds and duration > max_seconds:
            raise VideoTooLongError(duration, max_seconds)
        config = {**base, "paths": {**base["paths"], "input": str(video_path)},
                  "detection": {**base["detection"], **({"device": device} if device else {})},
                  "use_cache": True}  # mismo vídeo (mismo hash) en un reintento: no repite YOLO
        return pipeline.run_pipeline(config, render=False)["model_statistics"]

    return analyze


def main(argv=None):
    parser = argparse.ArgumentParser(description="Procesa los partidos en cola de Firestore.")
    parser.add_argument("--once", action="store_true", help="procesar como mucho un partido y terminar")
    parser.add_argument("--poll-seconds", type=float, default=10.0, help="espera con la cola vacía (por defecto 10)")
    parser.add_argument("--project", default=os.environ.get("FIREBASE_PROJECT_ID", DEFAULT_PROJECT_ID))
    parser.add_argument("--bucket", default=os.environ.get("FIREBASE_STORAGE_BUCKET"))
    parser.add_argument("--config", help="config.yaml del modelo (por defecto, el de model/)")
    parser.add_argument("--device", help="cpu, cuda:0, mps... (por defecto, el de config.yaml)")
    parser.add_argument("--workdir", type=Path, default=Path(tempfile.gettempdir()) / "acecam-worker",
                        help="carpeta temporal para los videos descargados")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    from .firebase_backend import CloudStorageVideos, FirestoreMatchStore

    bucket = args.bucket or f"{args.project}.firebasestorage.app"
    args.workdir.mkdir(parents=True, exist_ok=True)
    store = FirestoreMatchStore(args.project)
    storage = CloudStorageVideos(args.project, bucket)
    analyze = make_analyzer(args.config, args.device)
    logging.info("worker listo: proyecto %s, bucket %s", args.project, bucket)

    if args.once:
        result = run_once(store, storage, analyze, args.workdir)
        logging.info("cola vacía" if result is None else f"{result[0]}: {result[1]}")
        return 0
    run_forever(store, storage, analyze, args.workdir, poll_seconds=args.poll_seconds)
    return 0


if __name__ == "__main__":
    sys.exit(main())
