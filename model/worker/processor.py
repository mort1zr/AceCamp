"""Lógica del worker (PCIT-35), independiente de Firebase.

Ciclo de cada partido (docs/firestore-schema.md, PCIT-22):

    en cola ──▶ procesando ──▶ listo     (statistics escritas)
                     └──────▶ error      (errorMessage apto para el usuario)

store y storage son interfaces: en producción, Firestore y Cloud Storage
(worker/firebase_backend.py); en los tests, dobles en memoria.

    store.claim_next(worker_version) -> (match_id, datos) o None
        Toma el partido 'en cola' más antiguo y lo pasa a 'procesando' en una
        transacción, para que dos workers nunca tomen el mismo.
    store.mark_ready(match_id, statistics)
    store.mark_error(match_id, error_message)
    storage.download(video_path, destino)  -> lanza VideoNotFoundError si no existe
"""

from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
import time
import traceback
from pathlib import Path

from stats import to_match_statistics

log = logging.getLogger("worker")

MESSAGE_VIDEO_NOT_FOUND = "No encontramos el video subido. Vuelve a subirlo e inténtalo de nuevo."
MESSAGE_NOT_RECOGNIZED = (
    "No pudimos reconocer la cancha o a los dos jugadores en el video. Usa una grabación con la cámara "
    "fija detrás del fondo, donde se vea toda la cancha."
)
MESSAGE_BAD_MATCH_DATA = "Faltan datos del partido (posición del jugador o ruta del video). Vuelve a registrarlo."
MESSAGE_INTERNAL = "Ocurrió un error al analizar el video. Inténtalo de nuevo más tarde."


class VideoNotFoundError(Exception):
    pass


def worker_version() -> str:
    """Versión del modelo que procesa el partido (commit de git si está disponible)."""
    try:
        commit = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"], cwd=Path(__file__).resolve().parent,
            capture_output=True, text=True, timeout=5, check=True,
        ).stdout.strip()
        return f"acecam-model {commit}"
    except (OSError, subprocess.SubprocessError):
        return "acecam-model dev"


def process_match(match_id, match, store, storage, analyze, workdir: Path) -> str:
    """Procesa un partido ya reclamado (en 'procesando'). Devuelve el estado final: 'listo' o 'error'."""
    video_path = match.get("videoPath")
    player_position = match.get("playerPosition")
    if not video_path or player_position not in ("arriba", "abajo"):
        store.mark_error(match_id, MESSAGE_BAD_MATCH_DATA)
        log.warning("%s: datos incompletos (videoPath=%r, playerPosition=%r)", match_id, video_path, player_position)
        return "error"

    Path(workdir).mkdir(parents=True, exist_ok=True)
    match_dir = Path(tempfile.mkdtemp(prefix=f"match-{match_id}-", dir=workdir))
    try:
        local_video = match_dir / f"video{Path(video_path).suffix or '.mp4'}"
        storage.download(video_path, local_video)
        model_statistics = analyze(local_video)
        statistics = to_match_statistics(model_statistics, player_position)
    except VideoNotFoundError:
        store.mark_error(match_id, MESSAGE_VIDEO_NOT_FOUND)
        log.warning("%s: no existe el video %s", match_id, video_path)
        return "error"
    except ValueError:
        # El pipeline lanza ValueError cuando no reconoce la pista o los jugadores.
        store.mark_error(match_id, MESSAGE_NOT_RECOGNIZED)
        log.warning("%s: video no reconocido\n%s", match_id, traceback.format_exc())
        return "error"
    except Exception:  # noqa: BLE001 - cualquier otro fallo deja el partido en error, nunca colgado
        store.mark_error(match_id, MESSAGE_INTERNAL)
        log.error("%s: error inesperado\n%s", match_id, traceback.format_exc())
        return "error"
    finally:
        shutil.rmtree(match_dir, ignore_errors=True)

    store.mark_ready(match_id, statistics)
    log.info("%s: listo (%d golpes del jugador)", match_id, statistics["player"]["shots"]["count"])
    return "listo"


def run_once(store, storage, analyze, workdir: Path, version: str | None = None):
    """Procesa como mucho un partido. Devuelve (match_id, estado final) o None si la cola está vacía."""
    claimed = store.claim_next(version or worker_version())
    if claimed is None:
        return None
    match_id, match = claimed
    log.info("%s: procesando %s", match_id, match.get("videoPath"))
    return match_id, process_match(match_id, match, store, storage, analyze, workdir)


def run_forever(store, storage, analyze, workdir: Path, poll_seconds: float = 10.0, max_iterations=None):
    """Bucle de consulta de la cola. Con la cola vacía espera poll_seconds antes de volver a mirar."""
    version = worker_version()
    iterations = 0
    while max_iterations is None or iterations < max_iterations:
        iterations += 1
        try:
            processed = run_once(store, storage, analyze, workdir, version)
        except Exception:  # noqa: BLE001 - un fallo de red al consultar la cola no debe parar el worker
            log.error("error consultando la cola; se reintenta en %ss\n%s", poll_seconds, traceback.format_exc())
            processed = None
        if processed is None:
            time.sleep(poll_seconds)
