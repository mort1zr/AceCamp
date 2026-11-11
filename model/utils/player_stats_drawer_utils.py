"""Caja de estadísticas de los jugadores sobre el vídeo (TA-13).

Se dibuja debajo de la mini-pista y a escala del fotograma: el diseño de
referencia es 1080p y en 720p (o vídeos verticales) todo se reduce en proporción,
sin salirse del fotograma ni pisar la mini-pista.

Las fuentes de OpenCV solo tienen caracteres ASCII: los textos van sin tildes y un
valor que todavía no se puede medir se muestra como "-" (nunca "nan").
"""

from __future__ import annotations

import math

import cv2

MISSING = "-"
FONT = cv2.FONT_HERSHEY_SIMPLEX
WHITE = (255, 255, 255)

# Medidas en píxeles para un fotograma de 1080 de alto.
BOX_WIDTH, BOX_HEIGHT = 350, 300
GAP_BELOW_MINI_COURT = 20
ROWS = (
    ("Vel. golpe", "last_shot_kmh"),
    ("Vel. jugador", "last_speed_kmh"),
    ("Media golpe", "avg_shot_kmh"),
    ("Media jugador", "avg_speed_kmh"),
)


def frame_scale(frame_shape) -> float:
    """Factor de escala del overlay respecto a un vídeo horizontal de 1080p."""
    height, width = frame_shape[:2]
    return min(height / 1080, width / 1920) if width >= height else width / 1080


def format_speed(value) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return MISSING
    return f"{value:.1f} km/h"


class StatsBox:
    """Rectángulo de la caja: alineado a la derecha con la mini-pista y justo debajo de ella."""

    def __init__(self, frame_shape, right, top):
        self.scale = frame_scale(frame_shape)
        height, width = frame_shape[:2]
        self.width = int(round(BOX_WIDTH * self.scale))
        self.height = int(round(BOX_HEIGHT * self.scale))
        self.end_x = min(int(right), width)
        self.start_x = max(0, self.end_x - self.width)
        self.start_y = int(top + GAP_BELOW_MINI_COURT * self.scale)
        self.end_y = min(height, self.start_y + self.height)

    def _text(self, frame, text, x, y, size, thickness):
        s = self.scale
        cv2.putText(frame, text, (self.start_x + int(x * s), self.start_y + int(y * s)), FONT, size * s, WHITE,
                    max(1, int(round(thickness * s))), cv2.LINE_AA)

    def draw(self, frame, state, serves=None):
        """Dibuja la caja con el FrameState del fotograma (lo modifica y lo devuelve).

        serves: saques acumulados de cada jugador hasta este fotograma (report.serve_states, TA-21).
        """
        overlay = frame.copy()
        cv2.rectangle(overlay, (self.start_x, self.start_y), (self.end_x, self.end_y), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.5, frame, 0.5, 0, frame)

        self._text(frame, "Jugador 1", 140, 30, 0.55, 2)
        self._text(frame, "Jugador 2", 250, 30, 0.55, 2)
        self._text(frame, "(fondo)", 150, 50, 0.4, 1)
        self._text(frame, "(cerca)", 260, 50, 0.4, 1)
        for row, (label, field) in enumerate(ROWS):
            y = 90 + 38 * row
            self._text(frame, label, 10, y, 0.45, 1)
            self._text(frame, format_speed(getattr(state.players[1], field)), 140, y, 0.45, 1)
            self._text(frame, format_speed(getattr(state.players[2], field)), 250, y, 0.45, 1)
        if serves is not None:
            y = 90 + 38 * len(ROWS)
            self._text(frame, "Saques", 10, y, 0.45, 1)
            self._text(frame, "1er saque", 10, y + 38, 0.45, 1)
            for player, x in ((1, 140), (2, 250)):
                pct = serves[player]["firstPct"]
                self._text(frame, str(serves[player]["count"]), x, y, 0.45, 1)
                self._text(frame, MISSING if pct is None else f"{pct} %", x, y + 38, 0.45, 1)
        return frame


def draw_player_stats_frame(frame, state, box):
    return box.draw(frame, state)


def draw_player_stats(output_video_frames, frame_states, box):
    return [box.draw(frame, state) for frame, state in zip(output_video_frames, frame_states)]
