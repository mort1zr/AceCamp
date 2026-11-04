"""Progreso en consola para los pasos largos (la detección fotograma a fotograma)."""

import sys


def report_progress(label, done, total, every=10):
    """Escribe 'label: done/total fotogramas' en la misma línea cada `every` fotogramas y al final."""
    if total <= 0 or (done % every and done != total):
        return
    end = "\n" if done == total else ""
    print(f"\r{label}: {done}/{total} fotogramas ({100 * done // total} %)", end=end, file=sys.stderr, flush=True)
