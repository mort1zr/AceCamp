"""Selección de los dos jugadores entre todas las personas detectadas (TA-12).

YOLO detecta a todas las personas: jugadores, recogepelotas, jueces de silla
y de línea, público. Aquí se eligen los dos jugadores por su posición en la
pista (en metros, con la homografía) y se renumeran siempre igual:

    1 = jugador del lado lejano (detrás de la red, arriba en la imagen)
    2 = jugador del lado cercano (abajo en la imagen)

Es robusto a:
- cambios de ID del tracker (tras una oclusión, ByteTrack puede dar otro ID
  al mismo jugador): se sigue al candidato más cercano a la última posición;
- fotogramas sin detección: se rellenan interpolando la caja.
"""

from __future__ import annotations

from collections import Counter

import numpy as np

from court import COURT_LENGTH, DOUBLES_WIDTH, NET_Y
from utils import get_foot_position

FAR_PLAYER, NEAR_PLAYER = 1, 2

# Zona donde puede estar un jugador: la pista más el espacio detrás de los fondos
# y un poco a los lados. Deja fuera a jueces de línea y público de las gradas.
ZONE_MARGIN_X_M = 2.0
ZONE_MARGIN_Y_M = 7.0
# Lo máximo que puede moverse un jugador entre dos fotogramas seguidos (~ 9 m/s a 30 fps).
MAX_STEP_M = 0.3


def in_player_zone(point_m) -> bool:
    x, y = point_m
    return (-ZONE_MARGIN_X_M <= x <= DOUBLES_WIDTH + ZONE_MARGIN_X_M) and (
        -ZONE_MARGIN_Y_M <= y <= COURT_LENGTH + ZONE_MARGIN_Y_M
    )


def side_of(point_m) -> int:
    return FAR_PLAYER if point_m[1] < NET_Y else NEAR_PLAYER


def _candidates(frame_detections, homography):
    """{track_id: (bbox, posición en metros)} de las personas dentro de la zona de juego."""
    result = {}
    for track_id, bbox in frame_detections.items():
        position = homography.image_to_court(get_foot_position(bbox))
        if in_player_zone(position):
            result[track_id] = (bbox, position)
    return result


def _seed_track(candidates_per_frame, side):
    """El ID que más fotogramas pasa en ese lado de la pista.

    Si hay empate (por ejemplo, un recogepelotas que se ve durante todo el clip),
    gana el que está más cerca, en mediana, del centro de su línea de fondo.
    """
    counts = Counter()
    distances = {}
    baseline_center = np.array([DOUBLES_WIDTH / 2, 0.0 if side == FAR_PLAYER else COURT_LENGTH])
    for frame in candidates_per_frame:
        for track_id, (_, position) in frame.items():
            if side_of(position) == side:
                counts[track_id] += 1
                distances.setdefault(track_id, []).append(np.linalg.norm(position - baseline_center))
    if not counts:
        return None
    return max(counts, key=lambda tid: (counts[tid], -np.median(distances[tid])))


def _follow(frames, side, seed, last_position):
    """Sigue al jugador de un lado fotograma a fotograma (None donde no se encontró)."""
    boxes, frames_since_seen = [], 0
    for frame in frames:
        chosen = None
        if seed in frame and side_of(frame[seed][1]) == side:
            chosen = seed
        else:
            # El ID se perdió: el candidato del mismo lado más cercano a la última posición,
            # si está a una distancia alcanzable en los fotogramas transcurridos.
            reach = MAX_STEP_M * (frames_since_seen + 1)
            same_side = [(np.linalg.norm(pos - last_position), tid)
                         for tid, (_, pos) in frame.items() if side_of(pos) == side]
            if same_side:
                distance, track_id = min(same_side)
                if distance <= reach:
                    chosen = seed = track_id
        if chosen is None:
            boxes.append(None)
            frames_since_seen += 1
        else:
            bbox, last_position = frame[chosen]
            boxes.append(list(bbox))
            frames_since_seen = 0
    return boxes


def _follow_side(candidates_per_frame, side):
    """Caja del jugador de un lado en cada fotograma (None si no se encontró).

    Parte del primer fotograma en que aparece el ID semilla y sigue hacia
    delante y hacia atrás, por si el tracker le dio otro ID al principio.
    """
    seed = _seed_track(candidates_per_frame, side)
    if seed is None:
        return [None] * len(candidates_per_frame)
    first = next(i for i, frame in enumerate(candidates_per_frame)
                 if seed in frame and side_of(frame[seed][1]) == side)
    start_position = candidates_per_frame[first][seed][1]
    forward = _follow(candidates_per_frame[first:], side, seed, start_position)
    backward = _follow(candidates_per_frame[first - 1::-1], side, seed, start_position) if first else []
    return backward[::-1] + forward


def _fill_gaps(boxes):
    """Interpola linealmente las cajas que faltan; en los extremos repite la más cercana."""
    known = [i for i, box in enumerate(boxes) if box is not None]
    if not known:
        return boxes
    filled = list(boxes)
    for i in range(len(boxes)):
        if filled[i] is not None:
            continue
        before = max((k for k in known if k < i), default=None)
        after = min((k for k in known if k > i), default=None)
        if before is None:
            filled[i] = list(boxes[after])
        elif after is None:
            filled[i] = list(boxes[before])
        else:
            t = (i - before) / (after - before)
            filled[i] = [a + (b - a) * t for a, b in zip(boxes[before], boxes[after])]
    return filled


def select_players(player_detections, homography):
    """Devuelve, por fotograma, {1: caja del jugador lejano, 2: caja del jugador cercano}.

    Lanza ValueError si en todo el vídeo no aparece nadie en alguno de los dos lados.
    """
    candidates_per_frame = [_candidates(frame, homography) for frame in player_detections]
    tracks = {}
    for side in (FAR_PLAYER, NEAR_PLAYER):
        boxes = _fill_gaps(_follow_side(candidates_per_frame, side))
        if all(box is None for box in boxes):
            name = "lejano" if side == FAR_PLAYER else "cercano"
            raise ValueError(f"no se encontró ningún jugador en el lado {name} de la pista")
        tracks[side] = boxes
    return [{FAR_PLAYER: tracks[FAR_PLAYER][i], NEAR_PLAYER: tracks[NEAR_PLAYER][i]}
            for i in range(len(player_detections))]
