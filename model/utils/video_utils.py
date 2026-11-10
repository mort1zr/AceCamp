import math
import warnings
from dataclasses import dataclass

import cv2

# Solo se usa si el contenedor del vídeo no informa de sus fps.
FALLBACK_FPS = 24.0


@dataclass(frozen=True)
class VideoInfo:
    fps: float
    width: int
    height: int
    frame_count: int
    fps_reported: bool = True

    @property
    def duration_seconds(self) -> float:
        return self.frame_count / self.fps


def get_video_info(video_path) -> VideoInfo:
    """Lee fps, resolución y número de fotogramas del vídeo."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"No se puede abrir el vídeo: {video_path}")
    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    finally:
        cap.release()
    fps_reported = math.isfinite(fps) and fps > 0
    if not fps_reported:
        warnings.warn(f"{video_path} no informa de sus fps; se usan {FALLBACK_FPS}.", stacklevel=2)
        fps = FALLBACK_FPS
    return VideoInfo(fps=float(fps), width=width, height=height, frame_count=frame_count, fps_reported=fps_reported)


def iter_frames(video_path):
    """Recorre los fotogramas del vídeo de uno en uno (PCIT-146).

    Solo hay un fotograma en memoria cada vez: la memoria no crece con la
    duración del vídeo, a diferencia de read_video().
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"No se puede abrir el vídeo: {video_path}")
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            yield frame
    finally:
        cap.release()


def read_video(video_path):
    """Todos los fotogramas en una lista. Solo para clips cortos: a 1080p ocupa ~11 GB por minuto."""
    return list(iter_frames(video_path))


class VideoWriter:
    """Escribe un vídeo fotograma a fotograma; el tamaño se toma del primero.

        with VideoWriter(ruta, fps) as out:
            for frame in ...:
                out.write(frame)
    """

    def __init__(self, path, fps=FALLBACK_FPS, fourcc="MJPG"):
        self.path = str(path)
        self.fps = fps
        self.fourcc = cv2.VideoWriter_fourcc(*fourcc)
        self._out = None

    def write(self, frame):
        if self._out is None:
            height, width = frame.shape[:2]
            self._out = cv2.VideoWriter(self.path, self.fourcc, self.fps, (width, height))
        self._out.write(frame)

    def close(self):
        if self._out is not None:
            self._out.release()
            self._out = None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


def save_video(output_video_frames, output_video_path, fps=FALLBACK_FPS):
    with VideoWriter(output_video_path, fps) as out:
        for frame in output_video_frames:
            out.write(frame)
