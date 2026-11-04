import json
from copy import deepcopy

import cv2
import pandas as pd

from config import config_from_args, resolve_path
from court import track_court
from court_line_detector import CourtLineDetector
from mini_court import MiniCourt
from stats import build_model_statistics, renumber_far_near
from trackers import BallTracker, PlayerTracker
from utils import (
    draw_player_stats,
    get_center_of_bbox,
    get_foot_position,
    get_video_info,
    measure_distance,
    read_video,
    save_video,
    speed_km_per_hour,
)
from utils.detection_cache import cache_path_for, file_sha256


def run_pipeline(config, render=True):
    """Analiza el vídeo de config["paths"]["input"].

    Devuelve un diccionario con las estadísticas del modelo (build_model_statistics),
    los golpes medidos y la ruta del vídeo anotado (None si render es False).
    Lanza ValueError si no se reconoce la pista o los jugadores.
    """
    paths, models, detection = config["paths"], config["models"], config["detection"]

    # Read Video
    input_video_path = resolve_path(paths["input"])
    if not input_video_path.exists():
        raise FileNotFoundError(f"No existe el vídeo de entrada: {input_video_path}")
    video_info = get_video_info(input_video_path)
    video_frames = read_video(str(input_video_path))
    video_hash = file_sha256(input_video_path)
    cache_dir = resolve_path(paths["cache_dir"])

    # Detect Players and Ball
    player_tracker = PlayerTracker(model_path=str(resolve_path(models["players"])), device=detection["device"])
    ball_tracker = BallTracker(model_path=str(resolve_path(models["ball"])),
                               conf=detection["ball_confidence"],
                               device=detection["device"])

    player_detections = player_tracker.detect_frames(
        video_frames,
        cache_path=cache_path_for(cache_dir, video_hash, "players", models["players"]),
        video_hash=video_hash,
        use_cache=config["use_cache"],
    )
    ball_candidates = ball_tracker.detect_frames(
        video_frames,
        cache_path=cache_path_for(cache_dir, video_hash, "ball", models["ball"],
                                  conf=detection["ball_confidence"], all_candidates=True),
        video_hash=video_hash,
        use_cache=config["use_cache"],
    )
    ball_detections = ball_tracker.select_ball_positions(ball_candidates, frame_height=video_info.height)
    ball_detections = ball_tracker.interpolate_ball_positions(ball_detections,
                                                              max_gap=detection["ball_max_interpolation_gap"])


    # Court Line Detector model
    court_model_path = str(resolve_path(models["court_keypoints"]))
    court_line_detector = CourtLineDetector(court_model_path, refine=config["court"]["refine_keypoints"])

    # Puntos clave y homografía imagen → pista (metros), re-detectados cada N fotogramas y suavizados
    court_keypoints, homography = track_court(video_frames, court_line_detector.predict,
                                              redetect_every=config["court"]["redetect_every_frames"],
                                              smoothing=config["court"]["smoothing"])
    first = homography[0]
    print(f"Homografía: error de reproyección medio {first.mean_reprojection_error(court_keypoints[0]):.1f} px, "
          f"{int(first.inliers.sum())}/{len(first.inliers)} puntos clave coherentes")
    discarded = [i for i, ok in enumerate(first.inliers) if not ok]
    if discarded:
        print(f"  Puntos clave descartados por RANSAC (ver numeración en court/court_model.py): {discarded}")

    # Elegir a los dos jugadores: 1 = lado lejano, 2 = lado cercano
    player_detections = player_tracker.choose_and_filter_players(homography, player_detections)

    # MiniCourt
    mini_court = MiniCourt(video_frames[0])

    # Detect ball shots
    ball_shot_frames= ball_tracker.get_ball_shot_frames(
        ball_detections,
        minimum_change_frames_for_hit=config["shots"]["min_change_frames_for_hit"],
        rolling_window=config["shots"]["rolling_window"],
    )

    # Posiciones en metros sobre la pista
    player_court_positions, ball_court_positions = MiniCourt.court_positions(player_detections,
                                                                             ball_detections,
                                                                             homography)

    player_stats_data = [{
        'frame_num':0,
        'player_1_number_of_shots':0,
        'player_1_total_shot_speed':0,
        'player_1_last_shot_speed':0,
        'player_1_total_player_speed':0,
        'player_1_last_player_speed':0,

        'player_2_number_of_shots':0,
        'player_2_total_shot_speed':0,
        'player_2_last_shot_speed':0,
        'player_2_total_player_speed':0,
        'player_2_last_player_speed':0,
    } ]
    shots = []

    for ball_shot_ind in range(len(ball_shot_frames)-1):
        start_frame = ball_shot_frames[ball_shot_ind]
        end_frame = ball_shot_frames[ball_shot_ind+1]
        shot_frames = end_frame - start_frame

        # Quién golpea: el jugador más cercano a la pelota en la imagen en el fotograma del golpe.
        # (En la imagen y no en metros: la pelota está en el aire y su proyección al suelo no es fiable.)
        if 1 not in ball_detections[start_frame]:
            continue  # sin pelota en el fotograma del golpe: no se puede atribuir
        ball_center = get_center_of_bbox(ball_detections[start_frame][1])
        start_players = player_detections[start_frame]
        player_shot_ball = min(start_players.keys(),
                               key=lambda player_id: measure_distance(get_foot_position(start_players[player_id]),
                                                                      ball_center))
        opponent_player_id = 1 if player_shot_ball == 2 else 2

        # Distancia recorrida por la pelota: de la posición del que golpea a la del rival cuando la devuelve.
        # Se usan los pies de los jugadores porque están en el suelo y su posición en metros es exacta.
        distance_covered_by_ball_meters = measure_distance(player_court_positions[start_frame][player_shot_ball],
                                                           player_court_positions[end_frame][opponent_player_id])
        speed_of_ball_shot = speed_km_per_hour(distance_covered_by_ball_meters, shot_frames, video_info.fps)

        # Velocidad del rival mientras la pelota viaja hacia él
        distance_covered_by_opponent_meters = measure_distance(player_court_positions[start_frame][opponent_player_id],
                                                               player_court_positions[end_frame][opponent_player_id])
        speed_of_opponent = speed_km_per_hour(distance_covered_by_opponent_meters, shot_frames, video_info.fps)

        shots.append({"frame": int(start_frame), "endFrame": int(end_frame),
                      "player": int(player_shot_ball), "speedKmh": float(speed_of_ball_shot)})

        current_player_stats= deepcopy(player_stats_data[-1])
        current_player_stats['frame_num'] = start_frame
        current_player_stats[f'player_{player_shot_ball}_number_of_shots'] += 1
        current_player_stats[f'player_{player_shot_ball}_total_shot_speed'] += speed_of_ball_shot
        current_player_stats[f'player_{player_shot_ball}_last_shot_speed'] = speed_of_ball_shot

        current_player_stats[f'player_{opponent_player_id}_total_player_speed'] += speed_of_opponent
        current_player_stats[f'player_{opponent_player_id}_last_player_speed'] = speed_of_opponent

        player_stats_data.append(current_player_stats)

    stats_shots, stats_positions = renumber_far_near(shots, player_court_positions)
    model_statistics = build_model_statistics(stats_shots, stats_positions, video_info.fps, len(video_frames))
    result = {
        "model_statistics": model_statistics,
        "shots": stats_shots,
        "output_video": None,
        # Datos intermedios: los usa el pre-etiquetado del set de validación (python -m eval.prelabel).
        "video_info": video_info,
        "video_hash": video_hash,
        "ball_detections": ball_detections,
        "court_keypoints": court_keypoints,
        "player_detections": player_detections,
    }
    if not render:
        return result

    player_stats_data_df = pd.DataFrame(player_stats_data)
    frames_df = pd.DataFrame({'frame_num': list(range(len(video_frames)))})
    player_stats_data_df = pd.merge(frames_df, player_stats_data_df, on='frame_num', how='left')
    player_stats_data_df = player_stats_data_df.ffill()

    player_stats_data_df['player_1_average_shot_speed'] = player_stats_data_df['player_1_total_shot_speed']/player_stats_data_df['player_1_number_of_shots']
    player_stats_data_df['player_2_average_shot_speed'] = player_stats_data_df['player_2_total_shot_speed']/player_stats_data_df['player_2_number_of_shots']
    player_stats_data_df['player_1_average_player_speed'] = player_stats_data_df['player_1_total_player_speed']/player_stats_data_df['player_2_number_of_shots']
    player_stats_data_df['player_2_average_player_speed'] = player_stats_data_df['player_2_total_player_speed']/player_stats_data_df['player_1_number_of_shots']



    # Draw output
    ## Draw Player Bounding Boxes
    output_video_frames= player_tracker.draw_bboxes(video_frames, player_detections)
    output_video_frames= ball_tracker.draw_bboxes(output_video_frames, ball_detections)

    ## Draw court Keypoints
    output_video_frames  = court_line_detector.draw_keypoints_on_video(output_video_frames, court_keypoints)

    # Draw Mini Court
    output_video_frames = mini_court.draw_mini_court(output_video_frames)
    output_video_frames = mini_court.draw_points_on_mini_court(output_video_frames, player_court_positions)
    output_video_frames = mini_court.draw_points_on_mini_court(output_video_frames, ball_court_positions,
                                                               color=(0, 255, 255))

    # Draw Player Stats
    output_video_frames = draw_player_stats(output_video_frames,player_stats_data_df)

    ## Draw frame number on top left corner
    for i, frame in enumerate(output_video_frames):
        cv2.putText(frame, f"Frame: {i}",(10,30),cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

    output_video_path = resolve_path(paths["output"])
    output_video_path.parent.mkdir(parents=True, exist_ok=True)
    save_video(output_video_frames, str(output_video_path), fps=video_info.fps)
    print(f"Vídeo guardado en {output_video_path}")
    result["output_video"] = output_video_path
    return result


def main(argv=None):
    config = config_from_args(argv)
    try:
        result = run_pipeline(config, render=config["render_video"])
    except FileNotFoundError as exc:
        raise SystemExit(str(exc)) from exc
    stats_path = config["paths"].get("stats_json")
    if stats_path:
        stats_path = resolve_path(stats_path)
        stats_path.parent.mkdir(parents=True, exist_ok=True)
        stats_path.write_text(json.dumps(result["model_statistics"], indent=2, ensure_ascii=False))
        print(f"Estadísticas guardadas en {stats_path}")
    return result


if __name__ == "__main__":
    main()