"""Medición de cada golpe (TA-13): quién golpea, velocidad de la pelota y del rival.

Antes estaba dentro de main.py, mezclada con el dibujo del vídeo.
"""

from __future__ import annotations

from utils import get_center_of_bbox, get_foot_position, measure_distance, speed_km_per_hour


def measure_shots(shot_frames, ball_detections, player_detections, player_positions_m, fps, main_camera=None):
    """Un elemento por golpe medido: {"frame", "endFrame", "player", "speedKmh", "opponentSpeedKmh"}.

    Cada golpe va de su fotograma al del siguiente golpe (el último no se mide: no
    se sabe dónde termina). Se omiten los golpes sin pelota detectada en su fotograma.

    - Quién golpea: el jugador más cercano a la pelota **en la imagen**. La pelota está
      en el aire y su proyección al suelo no es fiable.
    - Velocidad de la pelota: de los pies del que golpea a los del rival cuando la
      devuelve, en metros (los pies están en el suelo: su posición en metros es exacta).
    - Velocidad del rival: lo que se desplaza mientras la pelota viaja hacia él.

    main_camera (opcional, TA-15): por fotograma, si es de la cámara principal. Un golpe
    cuyo recorrido incluye otro plano (una repetición) no se mide.
    """
    shots = []
    for start, end in zip(shot_frames, shot_frames[1:]):
        if main_camera is not None and not all(main_camera[start:end + 1]):
            continue
        ball = ball_detections[start].get(1)
        players = player_detections[start]
        if ball is None or not players:
            continue
        ball_center = get_center_of_bbox(ball)
        hitter = min(players, key=lambda pid: measure_distance(get_foot_position(players[pid]), ball_center))
        opponent = 1 if hitter == 2 else 2
        if opponent not in player_positions_m[start] or opponent not in player_positions_m[end]:
            continue
        frames = end - start
        ball_m = measure_distance(player_positions_m[start][hitter], player_positions_m[end][opponent])
        opponent_m = measure_distance(player_positions_m[start][opponent], player_positions_m[end][opponent])
        shots.append({
            "frame": int(start),
            "endFrame": int(end),
            "player": int(hitter),
            "speedKmh": float(speed_km_per_hour(ball_m, frames, fps)),
            "opponentSpeedKmh": float(speed_km_per_hour(opponent_m, frames, fps)),
        })
    return shots
