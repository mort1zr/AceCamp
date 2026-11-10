"""Informe del partido (TA-30): un JSON completo y CSV por punto.

Se genera en cada ejecución a partir del mismo análisis que dibuja el vídeo, así que lo que
dice el informe coincide con lo que muestra el marcador del vídeo.

Archivos (en la carpeta del informe, --report-dir):
- report.json: todo el informe (esquema REPORT_VERSION, ver build_report);
- points.csv: una fila por punto (POINT_COLUMNS).

El JSON del worker (matches.statistics) sigue siendo el resumen por jugador de
stats.to_match_statistics, que ahora incluye el marcador y los puntos ganados (ver
docs/firestore-schema.md). Este informe es el detalle completo para el entrenador.

Los jugadores son 1 (fondo lejano en el vídeo) y 2 (cercano).
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

REPORT_VERSION = "acecam.match-report.v1"
POINT_COLUMNS = (
    "number", "set", "game", "start_s", "end_s", "server", "expected_server", "serves", "faults",
    "shots", "bounces", "end_reason", "winner", "model_winner", "corrected", "win_reason", "confidence",
    "confidence_level", "score_after",
)


def _seconds(frame, fps):
    return round(frame / fps, 2)


def point_row(point, bounces, fps):
    """Fila de un punto para el informe y points.csv."""
    attempts = point.get("serve_attempts", [])
    in_point = [b for b in bounces if point["start"] <= b["frame"] <= point["end"]]
    return {
        "number": point["number"],
        "set": point["set_number"],
        "game": point["game_number"],
        "start_s": _seconds(point["start"], fps),
        "end_s": _seconds(point["end"], fps),
        "server": point.get("server"),
        "expected_server": point.get("expected_server"),
        "serves": len(attempts),
        "faults": sum(a["fault"] is True for a in attempts),
        "shots": point.get("shots"),
        "bounces": len(in_point),
        "end_reason": point.get("end_reason"),
        "winner": point.get("winner"),
        "model_winner": point.get("model_winner"),
        "corrected": point.get("corrected", False),
        "win_reason": point.get("win_reason"),
        "confidence": point.get("confidence"),
        "confidence_level": point.get("confidence_level"),
        "score_after": point.get("score_text"),
    }


def _serve_summary(serve):
    """Estadísticas de saque del modelo más los porcentajes y la velocidad media (TA-21)."""
    summary = dict(serve)
    if serve.get("sampleCount"):
        summary["avgSpeedKmh"] = round(serve["sumSpeedKmh"] / serve["sampleCount"], 1)
    if serve.get("firstServeAttempts"):
        summary["firstServePct"] = round(100 * serve["firstServeIn"] / serve["firstServeAttempts"], 1)
    return summary


def player_summary(model_statistics, points, player):
    """Resumen de un jugador: golpes, saques, desplazamiento y puntos ganados."""
    stats = model_statistics["players"][str(player)]
    shots = stats.get("shots", {})
    summary = {
        "shots": shots.get("count", 0),
        "avgShotSpeedKmh": round(shots["sumSpeedKmh"] / shots["count"], 1) if shots.get("count") else None,
        "maxShotSpeedKmh": shots.get("maxSpeedKmh"),
        "pointsWon": sum(p.get("winner") == player and p.get("counted") for p in points),
        "pointsWonOnServe": sum(p.get("winner") == player and p.get("counted") and p.get("server") == player
                                for p in points),
        "serve": _serve_summary(stats.get("serve", {})),
    }
    if "movement" in stats:
        summary["movement"] = stats["movement"]
    return summary


def _most_serves(statistics):
    """Quién sacó más (1 o 2), o None si empataron."""
    counts = {p: statistics["players"][str(p)].get("serve", {}).get("count", 0) for p in (1, 2)}
    return None if counts[1] == counts[2] else max(counts, key=counts.get)


def serve_states(points, num_frames):
    """Saques acumulados de cada jugador en cada fotograma, para el overlay (TA-21):
    {1: {"count", "firstPct"}, 2: {...}}; firstPct es None hasta que se sepa algún primer saque."""
    firsts = []  # (fotograma, jugador, entró)
    attempts = []
    for point in points:
        for k, attempt in enumerate(point.get("serve_attempts", [])):
            attempts.append((attempt["frame"], attempt["player"]))
            if k == 0 and attempt["fault"] is not None:
                firsts.append((attempt["frame"], attempt["player"], attempt["fault"] is False))
    states = []
    for i in range(num_frames):
        state = {}
        for player in (1, 2):
            known = [ok for frame, p, ok in firsts if p == player and frame <= i]
            state[player] = {"count": sum(1 for frame, p in attempts if p == player and frame <= i),
                             "firstPct": round(100 * sum(known) / len(known)) if known else None}
        states.append(state)
    return states


def build_report(analysis, fps, video=None):
    """Informe completo del partido a partir de pipeline_analysis.analyze_detections()."""
    points, bounces = analysis["points"], analysis["bounces"]
    statistics = analysis["model_statistics"]
    return {
        "schemaVersion": REPORT_VERSION,
        "video": {"name": video, "fps": fps, "durationSeconds": statistics.get("durationSeconds")},
        "score": statistics.get("score"),
        "players": {str(p): player_summary(statistics, points, p) for p in (1, 2)},
        "mostServes": _most_serves(statistics),
        "points": [point_row(p, bounces, fps) for p in points],
        "toReview": statistics.get("points", {}).get("toReview", []),
    }


def write_csv(path, rows, columns):
    with Path(path).open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(columns), extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def write_report(report, out_dir):
    """Escribe report.json y points.csv en out_dir. Devuelve la carpeta."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    write_csv(out_dir / "points.csv", report["points"], POINT_COLUMNS)
    return out_dir


def scoreboard_states(points, num_frames, match_settings_score=None):
    """Marcador a mostrar en cada fotograma: el de antes del punto mientras se juega y el de
    después desde que acaba. Devuelve una lista (un dict del motor por fotograma, o None)."""
    states = [match_settings_score] * num_frames
    if not points:
        return states
    current = points[0]["score_before"]
    k = 0
    for i in range(num_frames):
        while k < len(points) and i > points[k]["end"]:
            current = points[k]["score_after"]
            k += 1
        states[i] = current
    return states
