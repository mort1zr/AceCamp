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
    if not fps or math.isnan(fps) or fps <= 0:
        warnings.warn(f"{video_path} no informa de sus fps; se usan {FALLBACK_FPS}.", stacklevel=2)
        fps = FALLBACK_FPS
    return VideoInfo(fps=float(fps), width=width, height=height, frame_count=frame_count)


def read_video(video_path):
    cap = cv2.VideoCapture(str(video_path))
    frames = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frames.append(frame)
    cap.release()
    return frames


def save_video(output_video_frames, output_video_path, fps=FALLBACK_FPS):
    fourcc = cv2.VideoWriter_fourcc(*'MJPG')
    height, width = output_video_frames[0].shape[:2]
    out = cv2.VideoWriter(str(output_video_path), fourcc, fps, (width, height))
    for frame in output_video_frames:
        out.write(frame)
    out.release()
