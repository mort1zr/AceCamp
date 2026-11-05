"""Detector de saque por reglas (TA-18).

Lo que distingue un saque en el vídeo es el lanzamiento: la pelota sube despacio por
encima de la cabeza del sacador, que está detrás de su línea de fondo, y se golpea
cerca de su punto más alto. Después sale tan rápida que el detector a menudo la
pierde unos fotogramas, así que no se busca el golpe por la trayectoria (como en
events.bounces.detect_hits, que necesita que la pelota invierta su dirección) sino
por el lanzamiento:

1. Fotogramas de lanzamiento: la pelota está por encima de la caja de un jugador (y
   como mucho TOSS_MAX_HEIGHT_BOXES alturas de caja por encima), centrada sobre él, y
   se mueve despacio; el jugador tiene los pies a menos de BASELINE_MARGIN_M de su
   línea de fondo (o detrás).
2. Un lanzamiento son al menos MIN_TOSS_SECONDS seguidos de esos fotogramas (con
   huecos de pocos fotogramas). El saque es el último fotograma del lanzamiento, o
   antes si la velocidad de la pelota salta (HIT_SPEED_JUMP veces la del lanzamiento):
   justo tras el golpe, una pelota que se aleja de la cámara apenas se mueve en la
   imagen y todavía parece lanzamiento unos fotogramas.
3. Un saque abre el punto: no puede haber golpes en los QUIET_BEFORE_SECONDS
   anteriores al lanzamiento. Así se descartan las pelotas lentas que pasan por
   encima de un jugador a mitad del peloteo (un globo, una pelota alta).
4. Lado: derecha o izquierda del sacador según de qué lado de la marca central está.
   El jugador del fondo mira hacia la cámara, así que su derecha es la izquierda de la
   imagen.

Salida: [{"frame", "player", "side", "toss_start"}], con 1 = fondo lejano, 2 = cercano.
"""

from __future__ import annotations

import numpy as np

from court import COURT_LENGTH, DOUBLES_WIDTH, per_frame
from utils import get_center_of_bbox

MIN_TOSS_SECONDS = 0.2
MAX_TOSS_GAP_SECONDS = 0.1
TOSS_MAX_HEIGHT_BOXES = 1.5  # la pelota no sube más de 1,5 alturas de la caja del jugador sobre ella
TOSS_MAX_OFFSET_BOXES = 1.0  # ni se separa a los lados más de un ancho de caja
TOSS_MAX_SPEED_BOXES = 0.15  # velocidad máxima en la imagen, en alturas de caja por fotograma (a 30 fps)
BASELINE_MARGIN_M = 1.5  # los pies del sacador, como mucho a esta distancia por delante de su fondo
MIN_SECONDS_BETWEEN_SERVES = 3.0
QUIET_BEFORE_SECONDS = 2.0
HIT_SPEED_JUMP = 3.0


def _feet(box):
    return ((box[0] + box[2]) / 2, box[3])


def _toss_player(center, previous, players, homography, fps):
    """El jugador sobre el que está lanzada la pelota en este fotograma, o None."""
    for pid, (x1, y1, x2, y2) in players.items():
        height, width = y2 - y1, x2 - x1
        if height <= 0 or not (y1 - TOSS_MAX_HEIGHT_BOXES * height <= center[1] < y1):
            continue
        if abs(center[0] - (x1 + x2) / 2) > TOSS_MAX_OFFSET_BOXES * width:
            continue
        if previous is not None:
            speed = np.hypot(center[0] - previous[0], center[1] - previous[1]) * fps / 30.0
            if speed > TOSS_MAX_SPEED_BOXES * height:
                continue
        if homography is None:
            continue
        _, y_m = homography.image_to_court(_feet((x1, y1, x2, y2)))
        behind = y_m <= BASELINE_MARGIN_M if pid == 1 else y_m >= COURT_LENGTH - BASELINE_MARGIN_M
        if behind:
            return pid
    return None


def serve_side(player, x_m):
    """Lado desde el que saca: 'derecha' o 'izquierda' del sacador, mirando a la red."""
    right_of_center = x_m > DOUBLES_WIDTH / 2  # a la derecha de la imagen
    return "derecha" if right_of_center == (player == 2) else "izquierda"


def _hit_frame(ball_detections, start, last, fps):
    """Fotograma del golpe de saque dentro del lanzamiento [start, last]."""
    frames = [i for i in range(start, last + 1) if 1 in ball_detections[i]]
    centers = [get_center_of_bbox(ball_detections[i][1]) for i in frames]
    speeds = [np.hypot(b[0] - a[0], b[1] - a[1]) / (j - i)
              for (i, a), (j, b) in zip(zip(frames, centers), zip(frames[1:], centers[1:]))]
    if len(speeds) < 3:
        return last
    toss_speed = max(float(np.median(speeds[: max(2, len(speeds) // 2)])), 1.0)
    for k, speed in enumerate(speeds):
        if k >= 2 and speed > HIT_SPEED_JUMP * toss_speed:
            return frames[k]
    return last


def detect_serves(ball_detections, player_detections, homography, fps, main_camera=None, hits=None):
    """Saques del vídeo, en orden. hits: golpes (events.detect_hits); si no se dan, se detectan."""
    if hits is None:
        from .bounces import detect_hits

        hits = detect_hits(ball_detections, player_detections, homography, fps)
    quiet = int(round(QUIET_BEFORE_SECONDS * fps))
    homographies = per_frame(homography, len(ball_detections))
    min_toss = max(2, int(round(MIN_TOSS_SECONDS * fps)))
    max_gap = max(1, int(round(MAX_TOSS_GAP_SECONDS * fps)))
    min_between = int(round(MIN_SECONDS_BETWEEN_SERVES * fps))

    toss = [None] * len(ball_detections)
    previous = None
    for i, frame in enumerate(ball_detections):
        if 1 not in frame or (main_camera is not None and not main_camera[i]):
            previous = None
            continue
        center = get_center_of_bbox(frame[1])
        toss[i] = _toss_player(center, previous, player_detections[i], homographies[i], fps)
        previous = center

    serves, i = [], 0
    while i < len(toss):
        if toss[i] is None:
            i += 1
            continue
        player, start, last, j = toss[i], i, i, i + 1
        while j < len(toss) and j - last <= max_gap + 1:
            if toss[j] == player:
                last = j
            elif toss[j] is not None:
                break
            j += 1
        opens_point = not any(start - quiet <= h < start for h in hits)
        if (last - start + 1 >= min_toss and opens_point
                and (not serves or start - serves[-1]["frame"] >= min_between)):
            hit = _hit_frame(ball_detections, start, last, fps)
            box = player_detections[hit][player]
            x_m, _ = homographies[hit].image_to_court(_feet(box))
            serves.append({"frame": hit, "player": player, "side": serve_side(player, float(x_m)),
                           "toss_start": start})
        i = last + 1
    return serves
