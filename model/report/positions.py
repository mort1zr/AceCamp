"""Posiciones de los jugadores durante los puntos (TA-32), para los mapas de calor.

Se guarda la posición en metros de cada jugador en cada fotograma válido:
- de la cámara principal (sin cortes ni repeticiones, TA-15);
- dentro de un punto (TA-17): las pausas entre puntos, cuando los jugadores van a recoger la
  pelota o a su silla, se excluyen para no sesgar el mapa.

Cada fila va etiquetada con el punto, el juego y el set del marcador (TA-29), así que corregir
un punto en corrections.json cambia los límites de set del mapa.

positions.csv: frame, time_s, player, x_m, y_m, point, game, set.
"""

from __future__ import annotations

import math

POSITION_COLUMNS = ("frame", "time_s", "player", "x_m", "y_m", "point", "game", "set")


def position_rows(player_positions, points, fps, main_camera=None):
    """Filas de positions.csv. player_positions: por fotograma, {1: (x, y), 2: (x, y)} en metros."""
    rows = []
    n = len(player_positions)
    main = main_camera if main_camera is not None else [True] * n
    for point in points:
        for frame in range(max(0, point["start"]), min(n - 1, point["end"]) + 1):
            if not main[frame]:
                continue
            for player in (1, 2):
                position = player_positions[frame].get(player)
                if position is None or any(math.isnan(v) for v in position):
                    continue
                rows.append({"frame": frame, "time_s": round(frame / fps, 3), "player": player,
                             "x_m": round(float(position[0]), 2), "y_m": round(float(position[1]), 2),
                             "point": point["number"], "game": point["game_number"], "set": point["set_number"]})
    return rows
