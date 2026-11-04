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


def movement_stats(positions_m, fps, smoothing_seconds=SMOOTHING_SECONDS, window_seconds=SPEED_WINDOW_SECONDS):
    """Distancia recorrida y velocidades de un jugador a partir de su posición en cada fotograma.

    positions_m: lista de (x, y) en metros (None o NaN en los fotogramas sin posición).
    Devuelve None si no hay suficientes posiciones para medir.
    """
    valid = [p for p in positions_m if p is not None and not any(math.isnan(v) for v in p)]
    if len(valid) < 2:
        return None
    points = _moving_average(np.asarray(valid, dtype=float), max(1, int(round(smoothing_seconds * fps))))
    steps = np.linalg.norm(np.diff(points, axis=0), axis=1)
    distance = float(steps.sum())
    # Tiempo del mismo tramo que la distancia (el suavizado recorta unos fotogramas en los extremos).
    duration = len(steps) / fps

    window = max(1, int(round(window_seconds * fps)))
    if len(steps) >= window:
        per_window = np.convolve(steps, np.ones(window), mode="valid")  # metros en cada ventana
        max_speed = float(per_window.max()) / window_seconds * 3.6
    else:
        max_speed = distance / duration * 3.6
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
    return {
        "schemaVersion": MATCH_STATS_VERSION,
        "durationSeconds": model_statistics["durationSeconds"],
        "player": model_statistics["players"][str(player)],
        "opponent": model_statistics["players"][str(opponent)],
    }
