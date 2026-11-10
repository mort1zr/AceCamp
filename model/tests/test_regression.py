"""Test de regresión de punta a punta (TA-16).

Ejecuta todo el análisis posterior a la detección (golpes, saques, botes, cantadas, puntos,
ganadores, marcador, estadísticas e informe) sobre detecciones reales guardadas en JSON y lo
compara con una salida de referencia. Corre en la CI sin GPU ni vídeo en unos segundos.

Si un cambio modifica el resultado a propósito, se regenera la referencia y se revisa el diff:

    UPDATE_REGRESSION=1 python -m pytest tests/test_regression.py
"""

import json
import os
from pathlib import Path

import pytest

from config import DEFAULTS
from court import CourtHomography
from pipeline_analysis import analyze_detections
from trackers.ball_selection import fill_short_gaps, select_ball

DATA = Path(__file__).parent / "data"
REFERENCE = DATA / "regression"


def load_case(name):
    data = json.loads((DATA / f"{name}_detections.json").read_text())
    players = [{int(k): v for k, v in frame.items()} for frame in data["players"]]
    if "ball" in data:
        ball = [{int(k): v for k, v in frame.items()} for frame in data["ball"]]
    else:  # candidatos del detector: se elige la pelota como en el pipeline
        height = data["size"][1]
        candidates = [dict(enumerate(frame)) for frame in data["ball_candidates"]]
        ball = fill_short_gaps(select_ball(candidates, scale=height / 1080, fps=data["fps"]), 5)
    homographies = [CourtHomography.from_keypoints(k) for k in data["court_keypoints"]]
    return data, ball, players, homographies


def summary(analysis):
    """Lo que se compara: eventos y estadísticas, redondeados para no depender del último decimal."""
    def bounce(b):
        return {k: b.get(k) for k in ("frame", "x_m", "y_m", "call", "inferred")}

    def point(p):
        keys = ("start", "end", "server", "shots", "end_reason", "winner", "win_reason", "confidence_level")
        return {k: p.get(k) for k in keys}

    return json.loads(json.dumps({
        "hits": analysis["hits"],
        "serves": [{k: s[k] for k in ("frame", "player", "side")} for s in analysis["serves"]],
        "bounces": [bounce(b) for b in analysis["bounces"]],
        "points": [point(p) for p in analysis["points"]],
        "statistics": analysis["model_statistics"],
    }, default=str))


@pytest.mark.parametrize("name", ["input_video", "h1"])
def test_pipeline_output_matches_the_reference(name):
    data, ball, players, homographies = load_case(name)
    analysis = analyze_detections(ball, players, data["court_keypoints"], homographies, [True] * len(ball),
                                  data["fps"], DEFAULTS)
    got = summary(analysis)
    reference = REFERENCE / f"{name}.json"
    if os.environ.get("UPDATE_REGRESSION") or not reference.exists():
        reference.write_text(json.dumps(got, indent=1, ensure_ascii=False) + "\n")
        pytest.skip(f"referencia regenerada: {reference.name}")
    expected = json.loads(reference.read_text())
    for key in expected:
        assert got[key] == expected[key], f"cambió '{key}' en {name}: regenera la referencia si es a propósito"
