import cv2

from utils import measure_distance, get_center_of_bbox
from utils.detection_cache import load_detections, save_detections


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

    def choose_and_filter_players(self, court_keypoints, player_detections):
        player_detections_first_frame = player_detections[0]
        chosen_player = self.choose_players(court_keypoints, player_detections_first_frame)
        filtered_player_detections = []
        for player_dict in player_detections:
            filtered_player_dict = {track_id: bbox for track_id, bbox in player_dict.items() if track_id in chosen_player}
            filtered_player_detections.append(filtered_player_dict)
        return filtered_player_detections

    def choose_players(self, court_keypoints, player_dict):
        distances = []
        for track_id, bbox in player_dict.items():
            player_center = get_center_of_bbox(bbox)

            min_distance = float('inf')
            for i in range(0,len(court_keypoints),2):
                court_keypoint = (court_keypoints[i], court_keypoints[i+1])
                distance = measure_distance(player_center, court_keypoint)
                if distance < min_distance:
                    min_distance = distance
            distances.append((track_id, min_distance))
        
        # sorrt the distances in ascending order
        distances.sort(key = lambda x: x[1])
        # Choose the first 2 tracks
        chosen_players = [distances[0][0], distances[1][0]]
        return chosen_players


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

        player_detections = [self.detect_frame(frame) for frame in frames]

        if cache_path is not None:
            save_detections(cache_path, player_detections, video_hash)

        return player_detections

    def detect_frame(self,frame):
        results = self.model.track(frame, persist=True, device=self.device, verbose=False)[0]
        id_name_dict = results.names

        player_dict = {}
        for box in results.boxes:
            track_id = int(box.id.tolist()[0])
            result = box.xyxy.tolist()[0]
            object_cls_id = box.cls.tolist()[0]
            object_cls_name = id_name_dict[object_cls_id]
            if object_cls_name == "person":
                player_dict[track_id] = result
        
        return player_dict

    def draw_bboxes(self,video_frames, player_detections):
        output_video_frames = []
        for frame, player_dict in zip(video_frames, player_detections):
            # Draw Bounding Boxes
            for track_id, bbox in player_dict.items():
                x1, y1, x2, y2 = bbox
                cv2.putText(frame, f"Player ID: {track_id}",(int(bbox[0]),int(bbox[1] -10 )),cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
                cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 2)
            output_video_frames.append(frame)
        
        return output_video_frames


    