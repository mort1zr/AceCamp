import cv2
import pandas as pd

from utils.detection_cache import load_detections, save_detections
from utils.progress import report_progress

from .ball_selection import MAX_INTERPOLATION_GAP, fill_short_gaps, select_ball


class BallTracker:
    def __init__(self, model_path, conf=0.15, device=None):
        self.model_path = model_path
        self.conf = conf
        self.device = device
        self._model = None

    @property
    def model(self):
        # El modelo se carga solo si hace falta: con la caché no se usa.
        if self._model is None:
            from ultralytics import YOLO

            self._model = YOLO(self.model_path)
        return self._model

    def select_ball_positions(self, ball_candidates, frame_height=1080):
        """Elige la pelota en cada fotograma entre todas las detecciones (ver ball_selection)."""
        return select_ball(ball_candidates, scale=frame_height / 1080)

    def interpolate_ball_positions(self, ball_positions, max_gap=MAX_INTERPOLATION_GAP):
        """Rellena solo los huecos cortos; los largos quedan sin pelota para no borrar botes."""
        return fill_short_gaps(ball_positions, max_gap=max_gap)

    def get_ball_shot_frames(self, ball_positions, minimum_change_frames_for_hit=25, rolling_window=5):
        ball_positions = [x.get(1,[]) for x in ball_positions]
        # convert the list into pandas dataframe
        df_ball_positions = pd.DataFrame(ball_positions,columns=['x1','y1','x2','y2'])

        df_ball_positions['ball_hit'] = 0

        df_ball_positions['mid_y'] = (df_ball_positions['y1'] + df_ball_positions['y2'])/2
        df_ball_positions['mid_y_rolling_mean'] = df_ball_positions['mid_y'].rolling(window=rolling_window, min_periods=1, center=False).mean()
        df_ball_positions['delta_y'] = df_ball_positions['mid_y_rolling_mean'].diff()
        for i in range(1,len(df_ball_positions)- int(minimum_change_frames_for_hit*1.2) ):
            negative_position_change = df_ball_positions['delta_y'].iloc[i] >0 and df_ball_positions['delta_y'].iloc[i+1] <0
            positive_position_change = df_ball_positions['delta_y'].iloc[i] <0 and df_ball_positions['delta_y'].iloc[i+1] >0

            if negative_position_change or positive_position_change:
                change_count = 0 
                for change_frame in range(i+1, i+int(minimum_change_frames_for_hit*1.2)+1):
                    negative_position_change_following_frame = df_ball_positions['delta_y'].iloc[i] >0 and df_ball_positions['delta_y'].iloc[change_frame] <0
                    positive_position_change_following_frame = df_ball_positions['delta_y'].iloc[i] <0 and df_ball_positions['delta_y'].iloc[change_frame] >0

                    if negative_position_change and negative_position_change_following_frame:
                        change_count+=1
                    elif positive_position_change and positive_position_change_following_frame:
                        change_count+=1
            
                if change_count>minimum_change_frames_for_hit-1:
                    df_ball_positions.loc[i, 'ball_hit'] = 1

        frame_nums_with_ball_hits = df_ball_positions[df_ball_positions['ball_hit']==1].index.tolist()

        return frame_nums_with_ball_hits

    def detect_frames(self, frames, cache_path=None, video_hash=None, use_cache=False):
        """Detecta la pelota en cada fotograma.

        Si use_cache es True y existe una caché válida para este vídeo
        (mismo hash), se devuelve sin ejecutar el modelo. Si se da
        cache_path, el resultado se guarda para la próxima vez.
        """
        if use_cache and cache_path is not None:
            cached = load_detections(cache_path, video_hash)
            if cached is not None and len(cached) == len(frames):
                return cached

        ball_detections = []
        for i, frame in enumerate(frames, start=1):
            ball_detections.append(self.detect_frame(frame))
            report_progress("Pelota", i, len(frames))

        if cache_path is not None:
            save_detections(cache_path, ball_detections, video_hash)

        return ball_detections

    def detect_frame(self,frame):
        results = self.model.predict(frame, conf=self.conf, device=self.device, verbose=False)[0]

        # Todas las detecciones, de mayor a menor confianza: [x1, y1, x2, y2, conf].
        # La pelota se elige después, con seguimiento entre fotogramas (select_ball_positions).
        candidates = sorted(
            (box.xyxy.tolist()[0] + [float(box.conf.tolist()[0])] for box in results.boxes),
            key=lambda c: c[4],
            reverse=True,
        )
        return {i: candidate for i, candidate in enumerate(candidates)}

    @staticmethod
    def draw_frame(frame, ball_dict):
        """Dibuja la caja de la pelota en un fotograma (lo modifica y lo devuelve)."""
        for track_id, bbox in ball_dict.items():
            x1, y1, x2, y2 = bbox[:4]
            cv2.putText(frame, f"Ball ID: {track_id}", (int(x1), int(y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.9,
                        (0, 255, 255), 2)
            cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 255), 2)
        return frame

    def draw_bboxes(self, video_frames, ball_detections):
        return [self.draw_frame(frame, ball_dict) for frame, ball_dict in zip(video_frames, ball_detections)]
