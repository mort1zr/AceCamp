"""Salida MP4 para navegador (PCIT-161); FFmpeg incluido en el entorno del worker."""
from __future__ import annotations

import subprocess
from pathlib import Path


class ProcessedVideoError(RuntimeError):
    pass


def encode_browser_video(source: Path, destination: Path) -> Path:
    import imageio_ffmpeg

    try:
        subprocess.run(
            [imageio_ffmpeg.get_ffmpeg_exe(), "-nostdin", "-y", "-v", "error", "-i", str(source),
             "-map", "0:v:0", "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "23",
             "-threads", "2", "-vf", "scale=in_range=auto:out_range=tv,pad=ceil(iw/2)*2:ceil(ih/2)*2",
             "-pix_fmt", "yuv420p", "-color_range", "tv",
             "-movflags", "+faststart", str(destination)],
            check=True, capture_output=True, timeout=300,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        if not destination.is_file() or destination.stat().st_size == 0:
            raise ProcessedVideoError("FFmpeg no produjo un video")
    except (OSError, subprocess.SubprocessError, RuntimeError) as exc:
        destination.unlink(missing_ok=True)
        raise ProcessedVideoError("No se pudo convertir el video procesado a MP4") from exc
    return destination
