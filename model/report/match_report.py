"""Informe del partido (TA-30): un JSON completo y CSV por punto.

Se genera en cada ejecución a partir del mismo análisis que dibuja el vídeo, así que lo que
dice el informe coincide con lo que muestra el marcador del vídeo.

Archivos (en la carpeta del informe, --report-dir):
- report.json: todo el informe (esquema REPORT_VERSION, ver build_report);
- points.csv: una fila por punto (POINT_COLUMNS);
- bounces.csv: una fila por bote, con su posición y cantada (BOUNCE_COLUMNS, TA-25);
- positions.csv: posición de cada jugador en cada fotograma de juego (TA-32).

El JSON del worker (matches.statistics) sigue siendo el resumen por jugador de
stats.to_match_statistics, que ahora incluye el marcador y los puntos ganados (ver
docs/firestore-schema.md). Este informe es el detalle completo para el entrenador.

Los jugadores son 1 (fondo lejano en el vídeo) y 2 (cercano).
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

from stats import rally_category, rally_length

from .positions import POSITION_COLUMNS

REPORT_VERSION = "acecam.match-report.v1"
POINT_COLUMNS = (
    "number", "set", "game", "start_s", "end_s", "server", "expected_server", "serves", "faults",
    "shots", "bounces", "end_reason", "winner", "model_winner", "corrected", "win_reason", "confidence",
    "confidence_level", "score_after", "rally_length", "rally_category",
)
RALLY_CATEGORIES = ("short", "medium", "long")


BOUNCE_COLUMNS = ("frame", "time_s", "point", "x_m", "y_m", "call", "area", "line_distance_cm", "uncertainty_cm",
                  "inferred")


def bounce_rows(bounces, points, fps):
    """Lista de botes del informe (TA-25): dónde botó, su cantada y en qué punto."""
    rows = []
    for b in bounces:
        if "x_m" not in b:
            continue
        point = next((p["number"] for p in points if p["start"] <= b["frame"] <= p["end"]), None)
        rows.append({"frame": b["frame"], "time_s": _seconds(b["frame"], fps), "point": point, "x_m": b["x_m"],
                     "y_m": b["y_m"], "call": b.get("call"), "area": b.get("area"),
                     "line_distance_cm": b.get("line_distance_cm"), "uncertainty_cm": b.get("uncertainty_cm"),
                     "inferred": bool(b.get("inferred"))})
    return rows


def _seconds(frame, fps):
    return round(frame / fps, 2)


def point_row(point, bounces, fps, rally_cuts=(4, 8)):
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
        "rally_length": rally_length(point),
        "rally_category": rally_category(rally_length(point), *rally_cuts),
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


def _rally_summary(rows):
    """Peloteos de unas filas de puntos: total, % y quién ganó en cada categoría (TA-36)."""
    summary = {"count": len(rows)}
    for category in RALLY_CATEGORIES:
        in_category = [r for r in rows if r["rally_category"] == category]
        summary[category] = {
            "count": len(in_category),
            "pct": round(100 * len(in_category) / len(rows), 1) if rows else 0.0,
            "won": {str(p): sum(r["winner"] == p and r.get("counted", True) for r in in_category) for p in (1, 2)},
        }
    return summary


def rally_breakdown(rows, rally_cuts=(4, 8)):
    """Peloteos por partido y por set (TA-36): {"cuts", "partido": {...}, "set1": {...}, ...}.

    Se calcula con las mismas filas que points.csv, así que las cifras coinciden con el CSV.
    Los puntos anulados en corrections.json (sin ganador) cuentan como peloteo pero no como ganado.
    """
    breakdown = {"cuts": {"shortMax": rally_cuts[0], "mediumMax": rally_cuts[1]}, "partido": _rally_summary(rows)}
    for set_number in sorted({r["set"] for r in rows}):
        breakdown[f"set{set_number}"] = _rally_summary([r for r in rows if r["set"] == set_number])
    return breakdown


def build_report(analysis, fps, video=None):
    """Informe completo del partido a partir de pipeline_analysis.analyze_detections()."""
    points, bounces = analysis["points"], analysis["bounces"]
    statistics = analysis["model_statistics"]
    rows = [point_row(p, bounces, fps, analysis.get("rally_cuts", (4, 8))) for p in points]
    return {
        "schemaVersion": REPORT_VERSION,
        "video": {"name": video, "fps": fps, "durationSeconds": statistics.get("durationSeconds")},
        "score": statistics.get("score"),
        "players": {str(p): player_summary(statistics, points, p) for p in (1, 2)},
        "mostServes": _most_serves(statistics),
        "points": rows,
        "bounces": bounce_rows(bounces, points, fps),
        "toReview": statistics.get("points", {}).get("toReview", []),
        "rallies": rally_breakdown(rows, analysis.get("rally_cuts", (4, 8))),
    }


def write_csv(path, rows, columns):
    with Path(path).open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(columns), extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def write_report(report, out_dir, positions=None):
    """Escribe report.json, points.csv y bounces.csv en out_dir; con positions, también
    positions.csv (TA-32). Devuelve la carpeta."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    write_csv(out_dir / "points.csv", report["points"], POINT_COLUMNS)
    write_csv(out_dir / "bounces.csv", report["bounces"], BOUNCE_COLUMNS)
    if positions is not None:
        write_csv(out_dir / "positions.csv", positions, POSITION_COLUMNS)
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
