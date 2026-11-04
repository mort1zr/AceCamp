import cv2

from utils.detection_cache import load_detections, save_detections
from utils.progress import report_progress

from .player_selection import select_players


class PlayerTracker:
    def __init__(self, model_path, device=None):
        self.model_path = model_path
        self.device = device
        self._model = None

    @property
    def model(self):
        # El modelo se carga solo si hace falta: con la caché no se usa.
        if self._model is None:
            from ultralytics import YOLO

            self._model = YOLO(self.model_path)
        return self._model

    def choose_and_filter_players(self, homography, player_detections):
        """Elige a los dos jugadores y los renumera: 1 = lado lejano, 2 = lado cercano."""
        return select_players(player_detections, homography)

    def detect_frames(self, frames, cache_path=None, video_hash=None, use_cache=False):
        """Detecta y sigue a las personas en cada fotograma.

        Si use_cache es True y existe una caché válida para este vídeo
        (mismo hash), se devuelve sin ejecutar el modelo. Si se da
        cache_path, el resultado se guarda para la próxima vez.
        """
        if use_cache and cache_path is not None:
            cached = load_detections(cache_path, video_hash)
            if cached is not None and len(cached) == len(frames):
                return cached

        player_detections = []
        for i, frame in enumerate(frames, start=1):
            player_detections.append(self.detect_frame(frame))
            report_progress("Jugadores", i, len(frames))

        if cache_path is not None:
            save_detections(cache_path, player_detections, video_hash)

        return player_detections

    def detect_frame(self,frame):
        results = self.model.track(frame, persist=True, device=self.device, verbose=False)[0]
        id_name_dict = results.names

        player_dict = {}
        for box in results.boxes:
            if box.id is None:
                # El tracker aún no asignó ID a esta detección (p. ej. en el primer fotograma).
                continue
            track_id = int(box.id.tolist()[0])
            result = box.xyxy.tolist()[0]
            object_cls_id = box.cls.tolist()[0]
            object_cls_name = id_name_dict[object_cls_id]
            if object_cls_name == "person":
                player_dict[track_id] = result
        
        return player_dict

    @staticmethod
    def draw_frame(frame, player_dict):
        """Dibuja las cajas de los jugadores en un fotograma (lo modifica y lo devuelve)."""
        for track_id, bbox in player_dict.items():
            x1, y1, x2, y2 = bbox
            cv2.putText(frame, f"Player ID: {track_id}", (int(x1), int(y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.9,
                        (0, 0, 255), 2)
            cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 2)
        return frame

    def draw_bboxes(self, video_frames, player_detections):
        return [self.draw_frame(frame, player_dict) for frame, player_dict in zip(video_frames, player_detections)]
