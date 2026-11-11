"""Marcador sobre el vídeo (TA-30), abajo a la izquierda y a escala del fotograma.

    J1 (fondo)  * | 6 | 3 | 30
    J2 (cerca)    | 4 | 2 | 15

Columnas: sets terminados, juegos del set actual y puntos del juego. El asterisco marca al
sacador. Con el partido terminado, solo los sets. Las fuentes de OpenCV son ASCII: sin tildes.
"""

from __future__ import annotations

import cv2

from utils.player_stats_drawer_utils import frame_scale

FONT = cv2.FONT_HERSHEY_SIMPLEX
ROW_HEIGHT, NAME_WIDTH, CELL_WIDTH, MARGIN = 40, 170, 48, 30
NAMES = {1: "J1 (fondo)", 2: "J2 (cerca)"}


def score_cells(score):
    """Celdas de cada jugador: sets terminados, juegos y puntos (sin juego si acabó el partido)."""
    cells = {1: [], 2: []}
    for a, b in score["sets"]:
        cells[1].append(str(a))
        cells[2].append(str(b))
    if score.get("winner") is None:
        cells[1] += [str(score["games"][0]), str(score["points"][0])]
        cells[2] += [str(score["games"][1]), str(score["points"][1])]
    return cells


def draw_scoreboard(frame, score):
    """Dibuja el marcador (un dict de scoring.Match.score()) y devuelve el fotograma."""
    if score is None:
        return frame
    s = frame_scale(frame.shape)
    cells = score_cells(score)
    columns = max(len(cells[1]), 1)
    width = int((NAME_WIDTH + 20 + CELL_WIDTH * columns) * s)
    height = int(2 * ROW_HEIGHT * s + 10 * s)
    x0 = int(MARGIN * s)
    y0 = frame.shape[0] - int(MARGIN * s) - height
    overlay = frame.copy()
    cv2.rectangle(overlay, (x0, y0), (x0 + width, y0 + height), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)
    thickness = max(1, int(round(2 * s)))
    for row, player in enumerate((1, 2)):
        y = y0 + int((row + 1) * ROW_HEIGHT * s)
        winner = score.get("winner") == player
        color = (0, 255, 255) if winner else (255, 255, 255)
        name = NAMES[player] + (" *" if score.get("server") == player else "")
        cv2.putText(frame, name, (x0 + int(10 * s), y), FONT, 0.7 * s, color, thickness, cv2.LINE_AA)
        for col, value in enumerate(cells[player]):
            # La última columna (puntos del juego) en amarillo para distinguirla de los juegos.
            live = score.get("winner") is None and col == len(cells[player]) - 1
            cv2.putText(frame, value, (x0 + int((NAME_WIDTH + 20 + CELL_WIDTH * col) * s), y), FONT, 0.75 * s,
                        (0, 215, 255) if live else color, thickness, cv2.LINE_AA)
    return frame
