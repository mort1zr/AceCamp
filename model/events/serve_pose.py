"""Refuerzo del detector de saque (TA-19).

Dos comprobaciones que se suman a las reglas de TA-18:

1. Coherencia del sacador (siempre activa): en un mismo juego saca siempre el mismo jugador.
   Si en un juego el modelo vio sacar a los dos, los saques del jugador minoritario son valores
   atípicos (un saque mal atribuido) y se reasignan al sacador mayoritario del juego. Con un
   empate se usa el sacador que dice el marcador (TA-29). En un tie-break el sacador cambia cada
   dos puntos, así que no se toca.

2. Pose (opcional, serves.pose_model en config.yaml): en el golpe de saque el sacador tiene una
   muñeca por encima de la cabeza. Un modelo de pose (YOLOv8-pose, 17 puntos COCO) mira al
   jugador en los fotogramas alrededor del golpe; si en ninguno levanta la muñeca, el saque se
   descarta. Cuesta poco: solo se ejecuta en los saques candidatos, no en todo el vídeo.
"""

from __future__ import annotations

from collections import Counter

import cv2
import numpy as np

# Índices de los puntos clave COCO del modelo de pose.
NOSE, LEFT_EYE, RIGHT_EYE, LEFT_EAR, RIGHT_EAR = 0, 1, 2, 3, 4
LEFT_WRIST, RIGHT_WRIST = 9, 10
MIN_KEYPOINT_CONFIDENCE = 0.3
POSE_WINDOW_FRAMES = 4  # se mira el golpe ±4 fotogramas
CROP_MARGIN = 0.6  # el recorte del jugador se amplía un 60 % (sobre todo hacia arriba, por el brazo)


# ----------------------------------------------------------------------- coherencia del sacador

def fix_servers(points):
    """Corrige el sacador de los puntos atípicos dentro de cada juego (no en tie-breaks).

    points: los de scoreboard.score_points (con set_number, game_number, expected_server y
    score_before). Devuelve copias; los corregidos llevan server_fixed=True y su sacador (y el de
    sus serve_attempts) pasa a ser el mayoritario del juego.
    """
    games = {}
    for point in points:
        if point.get("server") in (1, 2) and not point["score_before"].get("in_tiebreak"):
            games.setdefault((point["set_number"], point["game_number"]), []).append(point)
    majority = {}
    for key, game_points in games.items():
        counts = Counter(p["server"] for p in game_points).most_common()
        if len(counts) > 1 and counts[0][1] == counts[1][1]:
            majority[key] = game_points[0].get("expected_server")  # empate: el del marcador
        else:
            majority[key] = counts[0][0]
    fixed = []
    for point in points:
        key = (point.get("set_number"), point.get("game_number"))
        server = majority.get(key)
        if server in (1, 2) and point.get("server") in (1, 2) and point["server"] != server \
                and not point["score_before"].get("in_tiebreak"):
            attempts = [{**a, "player": server} for a in point.get("serve_attempts", [])]
            fixed.append({**point, "server": server, "serve_attempts": attempts, "server_fixed": True})
        else:
            fixed.append(point)
    return fixed


# ------------------------------------------------------------------------------------ pose

def wrist_above_head(keypoints, min_confidence=MIN_KEYPOINT_CONFIDENCE):
    """Si alguna muñeca está por encima de la cabeza (en la imagen, y menor).

    keypoints: array (17, 3) de COCO con x, y y confianza. La cabeza es el punto más alto que se
    vea de nariz, ojos y orejas. None si no se ven ni la cabeza ni las muñecas.
    """
    keypoints = np.asarray(keypoints, float)
    head = [keypoints[i, 1] for i in (NOSE, LEFT_EYE, RIGHT_EYE, LEFT_EAR, RIGHT_EAR)
            if keypoints[i, 2] >= min_confidence]
    wrists = [keypoints[i, 1] for i in (LEFT_WRIST, RIGHT_WRIST) if keypoints[i, 2] >= min_confidence]
    if not head or not wrists:
        return None
    return bool(min(wrists) < min(head))


def crop_box(box, frame_shape, margin=CROP_MARGIN):
    """Recorte del jugador ampliado: el brazo del saque sale por encima de la caja."""
    x1, y1, x2, y2 = box
    w, h = x2 - x1, y2 - y1
    height, width = frame_shape[:2]
    return (int(max(0, x1 - margin * w / 2)), int(max(0, y1 - margin * h)),
            int(min(width, x2 + margin * w / 2)), int(min(height, y2 + margin * h / 4)))


class PoseServeVerifier:
    """Comprueba con un modelo de pose que el sacador levanta la muñeca en el saque."""

    def __init__(self, model_path, device=None):
        from ultralytics import YOLO  # se importa aquí: solo si se activa la pose

        self.model = YOLO(model_path)
        self.device = device

    def keypoints(self, image):
        """Puntos clave (17, 3) de la persona más grande del recorte, o None."""
        result = self.model.predict(image, device=self.device, verbose=False)[0]
        if result.keypoints is None or len(result.keypoints) == 0:
            return None
        data = result.keypoints.data.cpu().numpy()
        areas = [(b[2] - b[0]) * (b[3] - b[1]) for b in result.boxes.xyxy.cpu().numpy()]
        return data[int(np.argmax(areas))]

    def confirms(self, frames, boxes):
        """True si en algún fotograma la muñeca está sobre la cabeza; None si no se pudo ver."""
        seen = False
        for frame, box in zip(frames, boxes):
            if box is None:
                continue
            x1, y1, x2, y2 = crop_box(box, frame.shape)
            keypoints = self.keypoints(frame[y1:y2, x1:x2])
            if keypoints is None:
                continue
            above = wrist_above_head(keypoints)
            if above:
                return True
            seen = seen or above is not None
        return False if seen else None


def read_frames(video_path, frame_numbers):
    """Lee solo los fotogramas pedidos del vídeo: {número: imagen}."""
    wanted = sorted(set(frame_numbers))
    frames = {}
    capture = cv2.VideoCapture(str(video_path))
    try:
        for number in wanted:
            capture.set(cv2.CAP_PROP_POS_FRAMES, number)
            ok, frame = capture.read()
            if ok:
                frames[number] = frame
    finally:
        capture.release()
    return frames


def filter_serves_by_pose(serves, player_detections, verifier, frames_by_number, window=POSE_WINDOW_FRAMES):
    """Saques confirmados por la pose. Se descartan los que la pose contradice (no levanta la
    muñeca en ningún fotograma visto); si no se pudo ver al jugador, el saque se queda."""
    kept = []
    for serve in serves:
        numbers = range(serve["frame"] - window, serve["frame"] + window + 1)
        frames = [frames_by_number.get(i) for i in numbers]
        boxes = [player_detections[i].get(serve["player"]) if 0 <= i < len(player_detections) else None
                 for i in numbers]
        pairs = [(f, b) for f, b in zip(frames, boxes) if f is not None]
        verdict = verifier.confirms([f for f, _ in pairs], [b for _, b in pairs])
        if verdict is not False:
            kept.append({**serve, "pose_confirmed": verdict})
    return kept
