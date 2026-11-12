"""Progreso en consola para los pasos largos (la detección fotograma a fotograma)."""

import sys
from contextvars import ContextVar

progress_listener = ContextVar("progress_listener", default=None)


def report_stage(stage, done=None, total=None):
    listener = progress_listener.get()
    if listener is not None:
        listener(stage, done, total)


def report_progress(label, done, total, every=10, *, stage=None):
    """Escribe 'label: done/total fotogramas' en la misma línea cada `every` fotogramas y al final."""
    if total <= 0 or (done % every and done != total):
        return
    end = "\n" if done == total else ""
    print(f"\r{label}: {done}/{total} fotogramas ({100 * done // total} %)", end=end, file=sys.stderr, flush=True)
    if stage is not None:
        report_stage(stage, done, total)
