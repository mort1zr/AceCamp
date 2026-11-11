"""Estadísticas del partido para la plataforma (PCIT-35).

Dos niveles:

1. build_model_statistics(): lo que mide el modelo, por jugador del vídeo
   (1 = lado lejano, 2 = lado cercano). Es lo que escribe main.py --stats-json.

2. to_match_statistics(): lo traduce al objeto matches.statistics del esquema
   de Firestore (docs/firestore-schema.md, PCIT-22), con "player" = el jugador
   registrado y "opponent" = el rival, según playerPosition ('arriba'/'abajo').

Reglas del esquema que se respetan:
- se guardan sumas y cantidades, no promedios, para combinar partidos;
- una métrica que el modelo no calcula se omite (nunca 0);
- un 0 significa que se midió y dio cero (por ejemplo, 0 golpes).
"""

from __future__ import annotations

import math

import numpy as np

MODEL_STATS_VERSION = "acecam.model-stats.v1"
MATCH_STATS_VERSION = "acecam.match-stats.v1"

FAR_PLAYER, NEAR_PLAYER = 1, 2
POSITION_TO_PLAYER = {"arriba": FAR_PLAYER, "abajo": NEAR_PLAYER}

# Suavizado de la posición de los pies antes de medir distancias: el temblor de la
# caja de YOLO sumaría metros que el jugador no recorrió.
SMOOTHING_SECONDS = 0.3
# Ventana para la velocidad máxima de desplazamiento.
SPEED_WINDOW_SECONDS = 1.0


def _round(value, digits=1):
    return round(float(value), digits)


def _moving_average(points, window):
    if window <= 1 or len(points) < window:
        return points
    kernel = np.ones(window) / window
    return np.column_stack([np.convolve(points[:, k], kernel, mode="valid") for k in range(2)])


def _valid(position):
    return position is not None and not any(math.isnan(v) for v in position)


def _runs(positions_m):
    """Tramos seguidos de posiciones válidas (un hueco, por ejemplo una repetición, corta el tramo)."""
    runs, current = [], []
    for position in positions_m:
        if _valid(position):
            current.append(position)
        elif current:
            runs.append(current)
            current = []
    if current:
        runs.append(current)
    return runs


def movement_stats(positions_m, fps, smoothing_seconds=SMOOTHING_SECONDS, window_seconds=SPEED_WINDOW_SECONDS):
    """Distancia recorrida y velocidades de un jugador a partir de su posición en cada fotograma.

    positions_m: lista de (x, y) en metros (None o NaN en los fotogramas sin posición).
    Cada tramo seguido de posiciones se mide por separado: entre dos tramos (por ejemplo,
    antes y después de una repetición) no se suma la distancia (TA-15).
    Devuelve None si no hay suficientes posiciones para medir.
    """
    smoothing = max(1, int(round(smoothing_seconds * fps)))
    window = max(1, int(round(window_seconds * fps)))
    distance, num_steps, max_speed = 0.0, 0, None
    for run in _runs(positions_m):
        if len(run) < 2:
            continue
        points = _moving_average(np.asarray(run, dtype=float), smoothing)
        steps = np.linalg.norm(np.diff(points, axis=0), axis=1)
        if len(steps) == 0:
            continue
        distance += float(steps.sum())
        num_steps += len(steps)
        if len(steps) >= window:
            per_window = np.convolve(steps, np.ones(window), mode="valid")  # metros en cada ventana
            run_max = float(per_window.max()) / window_seconds * 3.6
        else:
            run_max = float(steps.sum()) / (len(steps) / fps) * 3.6
        max_speed = run_max if max_speed is None else max(max_speed, run_max)
    if num_steps == 0:
        return None
    # Tiempo de los mismos tramos que la distancia (el suavizado recorta unos fotogramas en los extremos).
    duration = num_steps / fps
    return {
        "distanceMeters": _round(distance),
        "avgSpeedKmh": _round(distance / duration * 3.6),
        "maxSpeedKmh": _round(max_speed),
    }


def shot_stats(speeds_kmh):
    stats = {"count": len(speeds_kmh), "sumSpeedKmh": _round(sum(speeds_kmh))}
    if speeds_kmh:
        stats["maxSpeedKmh"] = _round(max(speeds_kmh))
    return stats


def build_model_statistics(shots, player_positions, fps, num_frames):
    """Estadísticas de los dos jugadores del vídeo.

    shots: lista de {"frame", "player", "speedKmh"} (un elemento por golpe medido).
    player_positions: por fotograma, {1: (x, y), 2: (x, y)} en metros.
    """
    players = {}
    for player in (FAR_PLAYER, NEAR_PLAYER):
        entry = {"shots": shot_stats([s["speedKmh"] for s in shots if s["player"] == player])}
        movement = movement_stats([frame.get(player) for frame in player_positions], fps)
        if movement is not None:
            entry["movement"] = movement
        players[str(player)] = entry
    return {
        "schemaVersion": MODEL_STATS_VERSION,
        "durationSeconds": _round(num_frames / fps),
        "players": players,
    }


RALLY_SHORT_MAX, RALLY_MEDIUM_MAX = 4, 8  # peloteo corto: 0-4 golpes; medio: 5-8; largo: 9 o más


def serve_stats(points, player):
    """Saques de un jugador a partir de los puntos (events.detect_points). Ver docs del esquema.

    Solo cuentan los puntos en que se detectó el saque. Las métricas que dependen de saber si
    un saque entró se omiten si en algún punto no se pudo saber (regla del esquema: nunca 0
    en lugar de desconocido).
    """
    attempts = [a for p in points for a in p.get("serve_attempts", []) if a["player"] == player]
    speeds = [a["speedKmh"] for a in attempts if a["speedKmh"] is not None]
    stats = {
        "count": len(attempts),
        "fromRight": sum(a["side"] == "derecha" for a in attempts),
        "fromLeft": sum(a["side"] == "izquierda" for a in attempts),
        "sumSpeedKmh": _round(sum(speeds)),
        "sampleCount": len(speeds),
    }
    if speeds:
        stats["maxSpeedKmh"] = _round(max(speeds))
    # Faltas (TA-21): solo si se supo de todos los saques si entraron.
    if attempts and all(a["fault"] is not None for a in attempts):
        stats["faults"] = sum(a["fault"] is True for a in attempts)
    # Aces: puntos que ganó con el saque sin que el rival la devolviera (TA-28: "saque no devuelto").
    # Incluye los saques que el rival toca sin devolverlos; la cámara no distingue un ace de uno así.
    own = [p for p in points if p.get("serve_attempts") and p["serve_attempts"][0]["player"] == player]
    if own and all("win_reason" in p for p in own):
        stats["aces"] = sum(p.get("winner") == player and p["win_reason"] == "saque no devuelto" for p in own)
    served = [p["serve_attempts"] for p in points if p.get("serve_attempts") and p["serve_attempts"][0]["player"] == player]
    if served and all(s[0]["fault"] is not None for s in served):
        stats["firstServeAttempts"] = len(served)
        stats["firstServeIn"] = sum(s[0]["fault"] is False for s in served)
        after_fault = [s for s in served if s[0]["fault"]]
        if all(len(s) > 1 and s[1]["fault"] is not None for s in after_fault):
            stats["doubleFaults"] = sum(s[1]["fault"] is True for s in after_fault)
    return stats


def rally_length(point):
    """Golpes del peloteo de un punto, saque incluido (un primer saque que fue falta no cuenta)."""
    return point["shots"] - max(0, len(point.get("serve_attempts", [])) - 1)


def rally_category(length, short_max=RALLY_SHORT_MAX, medium_max=RALLY_MEDIUM_MAX):
    """"short", "medium" o "long" (TA-35). Los cortes se configuran en config.yaml (rallies)."""
    if length <= short_max:
        return "short"
    return "medium" if length <= medium_max else "long"


def rally_stats(points, short_max=RALLY_SHORT_MAX, medium_max=RALLY_MEDIUM_MAX):
    """Peloteos del partido: cuántos, golpes totales, el más largo y por longitud (opción A)."""
    lengths = [rally_length(p) for p in points]
    categories = [rally_category(n, short_max, medium_max) for n in lengths]
    return {
        "count": len(lengths),
        "sumShots": sum(lengths),
        "longestShots": max(lengths) if lengths else 0,
        "short": categories.count("short"),
        "medium": categories.count("medium"),
        "long": categories.count("long"),
    }


def add_serve_and_rally_stats(model_statistics, points, short_max=RALLY_SHORT_MAX, medium_max=RALLY_MEDIUM_MAX):
    """Añade serve a cada jugador y rallies al partido (TA-17, TA-18). Devuelve el mismo objeto."""
    for player in (FAR_PLAYER, NEAR_PLAYER):
        model_statistics["players"][str(player)]["serve"] = serve_stats(points, player)
    model_statistics["rallies"] = rally_stats(points, short_max, medium_max)
    return model_statistics


def renumber_far_near(shots, player_positions):
    """Numera a los jugadores como 1 = lado lejano y 2 = lado cercano.

    Se decide por la posición media de cada uno a lo largo de la pista (la y en
    metros crece hacia la cámara). Si los jugadores ya vienen numerados así, no
    cambia nada. Devuelve (golpes, posiciones) con la numeración nueva.
    """
    ys = {}
    for frame in player_positions:
        for pid, position in frame.items():
            if position is not None and not any(math.isnan(v) for v in position):
                ys.setdefault(pid, []).append(position[1])
    order = sorted(ys, key=lambda pid: float(np.mean(ys[pid])))[:2]
    mapping = {pid: number for number, pid in enumerate(order, start=1)}
    positions = [{mapping[pid]: pos for pid, pos in frame.items() if pid in mapping} for frame in player_positions]
    shots = [{**shot, "player": mapping[shot["player"]]} for shot in shots if shot["player"] in mapping]
    return shots, positions


def to_match_statistics(model_statistics, player_position):
    """Objeto matches.statistics: el jugador registrado y su rival según playerPosition."""
    if model_statistics.get("schemaVersion") != MODEL_STATS_VERSION:
        raise ValueError(f"versión de estadísticas del modelo no reconocida: {model_statistics.get('schemaVersion')}")
    if player_position not in POSITION_TO_PLAYER:
        raise ValueError(f"playerPosition debe ser 'arriba' o 'abajo', llegó {player_position!r}")
    player = POSITION_TO_PLAYER[player_position]
    opponent = NEAR_PLAYER if player == FAR_PLAYER else FAR_PLAYER
    statistics = {
        "schemaVersion": MATCH_STATS_VERSION,
        "durationSeconds": model_statistics["durationSeconds"],
        "player": model_statistics["players"][str(player)],
        "opponent": model_statistics["players"][str(opponent)],
    }
    if "rallies" in model_statistics:
        statistics["rallies"] = model_statistics["rallies"]
    order = (player - 1, opponent - 1)  # índices de [jugador 1, jugador 2] → [player, opponent]
    score = model_statistics.get("score")
    if score:  # marcador del modelo (TA-29/TA-30), visto desde el jugador registrado
        winner = score.get("winner")
        statistics["score"] = {
            "sets": [
                {"playerGames": completed_set[order[0]], "opponentGames": completed_set[order[1]]}
                for completed_set in score["sets"]
            ],
            "games": [score["games"][order[0]], score["games"][order[1]]],
            "points": [score["points"][order[0]], score["points"][order[1]]],
            "winner": None if winner is None else ("player" if winner == player else "opponent"),
        }
    points = model_statistics.get("points")
    if points:
        statistics["points"] = {
            "count": points["count"],
            "playerWon": points["won"][str(player)],
            "opponentWon": points["won"][str(opponent)],
            "lowConfidence": points["lowConfidence"],
            "toReview": len(points.get("toReview", [])),
        }
    return statistics
