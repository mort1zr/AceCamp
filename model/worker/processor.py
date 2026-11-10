"""Lógica del worker (PCIT-35), independiente de Firebase.

Ciclo de cada partido (docs/firestore-schema.md, PCIT-22):

    en cola ──▶ procesando ──▶ listo     (statistics escritas)
                     └──────▶ error      (errorMessage apto para el usuario)

store y storage son interfaces: en producción, Firestore y Cloud Storage
(worker/firebase_backend.py); en los tests, dobles en memoria.

    store.claim_next(worker_version) -> (match_id, datos) o None
        Toma el partido 'en cola' más antiguo y lo pasa a 'procesando' en una
        transacción, para que dos workers nunca tomen el mismo.
    store.mark_ready(match_id, statistics, processed_video_path=None)
    store.mark_error(match_id, error_message)
    storage.download(video_path, destino)  -> lanza VideoNotFoundError si no existe
    storage.upload_processed(origen, ruta_storage) -> sube el MP4 privado
    analyze(ruta_local) -> AnalysisResult (estadísticas y MP4); admite también
        estadísticas sin vídeo para consumidores anteriores. Lanza VideoTooLongError si el vídeo
        supera la duración máxima, VideoResolutionError si no llega a la resolución
        mínima o VideoFrameRateError si no cumple el rango de FPS.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
import time
import traceback
from dataclasses import dataclass
from pathlib import Path

from stats import to_match_statistics

from .video import ProcessedVideoError

log = logging.getLogger("worker")

MESSAGE_VIDEO_NOT_FOUND = "No encontramos el video subido. Vuelve a subirlo e inténtalo de nuevo."
MESSAGE_NOT_RECOGNIZED = (
    "No pudimos reconocer la cancha o a los dos jugadores en el video. Usa una grabación con la cámara "
    "fija detrás del fondo, donde se vea toda la cancha."
)
MESSAGE_BAD_MATCH_DATA = "Faltan datos del partido (posición del jugador o ruta del video). Vuelve a registrarlo."
MESSAGE_INTERNAL = "Ocurrió un error al analizar el video. Inténtalo de nuevo más tarde."
MESSAGE_VIDEO_OUTPUT = "No pudimos guardar el video procesado. Vuelve a intentarlo."


@dataclass
class AnalysisResult:
    statistics: dict
    output_video: Path


class VideoNotFoundError(Exception):
    pass


class VideoTooLongError(Exception):
    """El vídeo supera la duración máxima admitida (PCIT-147)."""

    def __init__(self, duration_seconds: float, max_seconds: float):
        super().__init__(f"el vídeo dura {duration_seconds:.0f} s y el máximo es {max_seconds:.0f} s")
        self.duration_seconds = duration_seconds
        self.max_seconds = max_seconds


def _format_duration(seconds: float) -> str:
    seconds = int(round(seconds))
    if seconds < 60:
        return f"{seconds} segundos"
    minutes, rest = divmod(seconds, 60)
    unit = "minuto" if minutes == 1 else "minutos"
    return f"{minutes} {unit}" if rest == 0 else f"{minutes} min {rest} s"


class VideoResolutionError(Exception):
    """El vídeo tiene menos resolución de la mínima admitida (lado corto en píxeles)."""

    def __init__(self, width: int, height: int, min_short_side: int):
        super().__init__(f"el vídeo es de {width}x{height} y el mínimo es {min_short_side}p")
        self.width, self.height, self.min_short_side = width, height, min_short_side


class VideoFrameRateError(Exception):
    """El vídeo no informa de sus FPS o están fuera del rango admitido."""

    def __init__(self, fps: float | None, min_fps: float, max_fps: float):
        self.user_message = (
            f"No se pudieron verificar los FPS del video. Expórtalo entre {min_fps:g} y {max_fps:g} FPS."
            if fps is None else
            f"El video debe tener entre {min_fps:g} y {max_fps:g} FPS. Grábalo o expórtalo dentro de ese rango."
        )
        super().__init__(self.user_message if fps is None else f"el vídeo tiene {fps:g} FPS. {self.user_message}")


def message_low_resolution(min_short_side: int) -> str:
    long_side = round(min_short_side * 16 / 9)
    return (f"El video debe tener al menos {min_short_side}p ({long_side}x{min_short_side}). "
            "Grábalo o expórtalo en 720p o 1080p y vuelve a subirlo.")


def message_too_long(max_seconds: float) -> str:
    return (f"Por ahora el análisis admite videos de hasta {_format_duration(max_seconds)}. "
            "Recorta el video y vuelve a subirlo.")


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
        analysis = analyze(local_video)
        model_statistics = analysis.statistics if isinstance(analysis, AnalysisResult) else analysis
        statistics = to_match_statistics(model_statistics, player_position)
        processed_path = None
        if isinstance(analysis, AnalysisResult):
            org_id = match.get("orgId", "")
            expected_parent = f"orgs/{org_id}/matches/{match_id}"
            if (not org_id or any(part in ("", ".", "..") or "/" in part for part in (org_id, match_id))
                    or str(Path(video_path).parent).replace("\\", "/") != expected_parent
                    or analysis.output_video.resolve().parent != match_dir.resolve()
                    or not analysis.output_video.is_file()
                    or not 0 < analysis.output_video.stat().st_size <= 500 * 1024 * 1024):
                raise ProcessedVideoError("Ruta del resultado no válida")
            processed_path = f"{expected_parent}/processed.mp4"
            try:
                storage.upload_processed(analysis.output_video, processed_path)
            except Exception as exc:
                raise ProcessedVideoError("No se pudo subir el resultado") from exc
    except VideoNotFoundError:
        store.mark_error(match_id, MESSAGE_VIDEO_NOT_FOUND)
        log.warning("%s: no existe el video %s", match_id, video_path)
        return "error"
    except VideoTooLongError as exc:
        store.mark_error(match_id, message_too_long(exc.max_seconds))
        log.warning("%s: %s", match_id, exc)
        return "error"
    except VideoResolutionError as exc:
        store.mark_error(match_id, message_low_resolution(exc.min_short_side))
        log.warning("%s: %s", match_id, exc)
        return "error"
    except VideoFrameRateError as exc:
        store.mark_error(match_id, exc.user_message)
        log.warning("%s: %s", match_id, exc)
        return "error"
    except ProcessedVideoError:
        store.mark_error(match_id, MESSAGE_VIDEO_OUTPUT)
        log.error("%s: fallo del video procesado\n%s", match_id, traceback.format_exc())
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

    if processed_path:
        store.mark_ready(match_id, statistics, processed_video_path=processed_path)
    else:
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
