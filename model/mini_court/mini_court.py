"""Mini-pista dibujada a escala en una esquina del vídeo.

Trabaja en metros reales: las posiciones llegan ya convertidas con la
homografía de la pista (court.CourtHomography) y aquí solo se pasan a
píxeles de la mini-pista para dibujarlas.
"""

import cv2
import numpy as np

from court import COURT_KEYPOINTS_M, COURT_LENGTH, COURT_LINES, DOUBLES_WIDTH, NET_Y, per_frame
from utils import get_center_of_bbox, get_foot_position

# Espacio alrededor de la pista que también se dibuja (los jugadores suelen estar detrás del fondo).
MARGIN_X_M = 1.5
MARGIN_Y_M = 3.0


class MiniCourt:
    def __init__(self, frame):
        self.drawing_rectangle_width = 250
        self.drawing_rectangle_height = 500
        self.buffer = 50
        self.padding = 10

        frame_width = frame.shape[1]
        self.end_x = frame_width - self.buffer
        self.start_x = self.end_x - self.drawing_rectangle_width
        self.start_y = self.buffer
        self.end_y = self.start_y + self.drawing_rectangle_height

        # Escala única para x e y: la pista se dibuja sin deformar.
        usable_w = self.drawing_rectangle_width - 2 * self.padding
        usable_h = self.drawing_rectangle_height - 2 * self.padding
        self.pixels_per_meter = min(
            usable_w / (DOUBLES_WIDTH + 2 * MARGIN_X_M),
            usable_h / (COURT_LENGTH + 2 * MARGIN_Y_M),
        )
        drawn_w = (DOUBLES_WIDTH + 2 * MARGIN_X_M) * self.pixels_per_meter
        drawn_h = (COURT_LENGTH + 2 * MARGIN_Y_M) * self.pixels_per_meter
        # Origen (0, 0) de la pista dentro del rectángulo, centrando el dibujo.
        self.origin_x = self.start_x + (self.drawing_rectangle_width - drawn_w) / 2 + MARGIN_X_M * self.pixels_per_meter
        self.origin_y = self.start_y + (self.drawing_rectangle_height - drawn_h) / 2 + MARGIN_Y_M * self.pixels_per_meter

    # ------------------------------------------------------------ escalas

    def meters_to_mini(self, point_m):
        """(x, y) en metros de la pista → píxeles de la mini-pista, recortado al rectángulo."""
        x = self.origin_x + point_m[0] * self.pixels_per_meter
        y = self.origin_y + point_m[1] * self.pixels_per_meter
        x = min(max(x, self.start_x), self.end_x)
        y = min(max(y, self.start_y), self.end_y)
        return int(round(x)), int(round(y))

    # ------------------------------------------------------ posiciones

    @staticmethod
    def court_positions(player_boxes, ball_boxes, homography):
        """Convierte las detecciones de cada fotograma a metros sobre la pista.

        - Jugadores: el punto medio inferior de su caja (los pies), que está en el suelo.
        - Pelota: el centro de su caja. Es aproximado mientras vuela; exacto solo en el bote.

        homography puede ser una sola para todo el vídeo o una lista con una por fotograma.
        Devuelve (jugadores, pelota): listas por fotograma de {id: (x_m, y_m)}.
        """
        players_m, ball_m = [], []
        homographies = per_frame(homography, len(player_boxes))
        for frame_players, frame_ball, homography in zip(player_boxes, ball_boxes, homographies):
            players_m.append(
                {pid: tuple(homography.image_to_court(get_foot_position(bbox))) for pid, bbox in frame_players.items()}
            )
            ball_m.append(
                {bid: tuple(homography.image_to_court(get_center_of_bbox(bbox))) for bid, bbox in frame_ball.items()}
            )
        return players_m, ball_m

    # ------------------------------------------------------------- dibujo

    def draw_background_rectangle(self, frame):
        overlay = frame.copy()
        cv2.rectangle(overlay, (self.start_x, self.start_y), (self.end_x, self.end_y), (255, 255, 255), cv2.FILLED)
        return cv2.addWeighted(overlay, 0.5, frame, 0.5, 0)

    def draw_court(self, frame):
        for a, b in COURT_LINES:
            cv2.line(frame, self.meters_to_mini(COURT_KEYPOINTS_M[a]), self.meters_to_mini(COURT_KEYPOINTS_M[b]),
                     (0, 0, 0), 2)
        cv2.line(frame, self.meters_to_mini((0, NET_Y)), self.meters_to_mini((DOUBLES_WIDTH, NET_Y)), (255, 0, 0), 2)
        for point in COURT_KEYPOINTS_M:
            cv2.circle(frame, self.meters_to_mini(point), 3, (0, 0, 255), -1)
        return frame

    def draw_mini_court(self, frames):
        return [self.draw_court(self.draw_background_rectangle(frame)) for frame in frames]

    def draw_points(self, frame, frame_positions, color=(0, 255, 0)):
        """Dibuja en la mini-pista de un fotograma las posiciones {id: (x_m, y_m)}."""
        for position in frame_positions.values():
            if position is None or np.any(np.isnan(position)):
                continue
            cv2.circle(frame, self.meters_to_mini(position), 5, color, -1)
        return frame

    def draw_frame(self, frame, player_positions, ball_positions):
        """Mini-pista completa de un fotograma: fondo, líneas, jugadores (verde) y pelota (amarillo)."""
        frame = self.draw_court(self.draw_background_rectangle(frame))
        frame = self.draw_points(frame, player_positions)
        return self.draw_points(frame, ball_positions, color=(0, 255, 255))

    def draw_points_on_mini_court(self, frames, positions_m, color=(0, 255, 0)):
        for frame, frame_positions in zip(frames, positions_m):
            self.draw_points(frame, frame_positions, color)
        return frames
