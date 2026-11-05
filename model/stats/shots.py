"""Medición de cada golpe (TA-13): quién golpea, velocidad de la pelota y del rival.

Antes estaba dentro de main.py, mezclada con el dibujo del vídeo.
"""

from __future__ import annotations

from utils import get_center_of_bbox, get_foot_position, measure_distance, speed_km_per_hour

# Por encima de esta velocidad un golpe es un error de medida (el récord de saque ronda los 263 km/h).
MAX_SHOT_SPEED_KMH = 250.0


def _hitter(frame, ball_detections, player_detections, known):
    if frame in known:
        return known[frame]
    ball = ball_detections[frame].get(1)
    players = player_detections[frame]
    if ball is None or not players:
        return None
    center = get_center_of_bbox(ball)
    return min(players, key=lambda pid: measure_distance(get_foot_position(players[pid]), center))


def measure_shots(shot_frames, ball_detections, player_detections, player_positions_m, fps, main_camera=None,
                  hitters=None):
    """Un elemento por golpe medido: {"frame", "endFrame", "player", "speedKmh", "opponentSpeedKmh"}.

    shot_frames: fotogramas de golpe, en orden (events.detect_hits y los saques de
    events.detect_serves). hitters: {fotograma: jugador} para los golpes cuyo autor ya
    se conoce (el sacador); el resto se deduce.

    Cada golpe va de su fotograma al del siguiente golpe (el último no se mide: no
    se sabe dónde termina). No se mide si no se sabe quién golpea, si el siguiente golpe
    no es del rival (falta un golpe por detectar entre medias) o si sale una velocidad
    imposible (más de MAX_SHOT_SPEED_KMH).

    - Quién golpea: el jugador más cercano a la pelota **en la imagen**. La pelota está
      en el aire y su proyección al suelo no es fiable.
    - Velocidad de la pelota: de los pies del que golpea a los del rival cuando la
      devuelve, en metros (los pies están en el suelo: su posición en metros es exacta).
    - Velocidad del rival: lo que se desplaza mientras la pelota viaja hacia él.

    main_camera (opcional, TA-15): por fotograma, si es de la cámara principal. Un golpe
    cuyo recorrido incluye otro plano (una repetición) no se mide.
    """
    known = hitters or {}
    shots = []
    for start, end in zip(shot_frames, shot_frames[1:]):
        if main_camera is not None and not all(main_camera[start:end + 1]):
            continue
        hitter = _hitter(start, ball_detections, player_detections, known)
        if hitter is None:
            continue
        opponent = 1 if hitter == 2 else 2
        if _hitter(end, ball_detections, player_detections, known) not in (opponent, None):
            continue
        if not all(pid in player_positions_m[f] for pid in (hitter, opponent) for f in (start, end)):
            continue
        frames = end - start
        ball_m = measure_distance(player_positions_m[start][hitter], player_positions_m[end][opponent])
        opponent_m = measure_distance(player_positions_m[start][opponent], player_positions_m[end][opponent])
        speed = float(speed_km_per_hour(ball_m, frames, fps))
        if speed > MAX_SHOT_SPEED_KMH:
            continue
        shots.append({
            "frame": int(start),
            "endFrame": int(end),
            "player": int(hitter),
            "speedKmh": speed,
            "opponentSpeedKmh": float(speed_km_per_hour(opponent_m, frames, fps)),
        })
    return shots
