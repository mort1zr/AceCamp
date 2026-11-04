import json
import time

import cv2

from config import config_from_args, resolve_path
from court import CourtTracker
from court_line_detector import CourtLineDetector
from mini_court import MiniCourt
from stats import build_frame_states, build_model_statistics, measure_shots, renumber_far_near
from trackers import BallTracker, PlayerTracker
from utils import VideoWriter, get_video_info, iter_frames
from utils.detection_cache import cache_path_for, file_sha256, load_detections, save_detections
from utils.player_stats_drawer_utils import StatsBox
from utils.progress import report_progress


def detect_video(video_path, num_frames, player_tracker, ball_tracker, court_tracker,
                 cached_players=None, cached_ball=None, player_every=1):
    """Primera pasada (PCIT-146): recorre el vídeo una vez y guarda solo las detecciones.

    Cada fotograma se usa para detectar jugadores, pelota y pista y se descarta: la
    memoria no crece con la duración del vídeo. Con detecciones en caché no se ejecuta
    YOLO, pero la pista se sigue detectando (cada N fotogramas, TA-11).

    player_every > 1 detecta a los jugadores en uno de cada N fotogramas; en el resto
    se dejan vacíos y la selección de jugadores interpola sus cajas.

    Devuelve (jugadores, candidatos de pelota, puntos clave, homografías), una entrada
    por fotograma.
    """
    players, ball, keypoints, homographies = [], [], [], []
    for i, frame in enumerate(iter_frames(video_path)):
        if cached_players is not None and i < len(cached_players):
            players.append(cached_players[i])
        elif i % player_every == 0:
            players.append(player_tracker.detect_frame(frame))
        else:
            players.append({})
        if cached_ball is not None and i < len(cached_ball):
            ball.append(cached_ball[i])
        else:
            ball.append(ball_tracker.detect_frame(frame))
        frame_keypoints, homography = court_tracker.update(frame)
        keypoints.append(frame_keypoints)
        homographies.append(homography)
        report_progress("Detección", i + 1, num_frames)
    return players, ball, keypoints, homographies


def run_pipeline(config, render=True):
    """Analiza el vídeo de config["paths"]["input"].

    Devuelve un diccionario con las estadísticas del modelo (build_model_statistics),
    los golpes medidos y la ruta del vídeo anotado (None si render es False).
    Lanza ValueError si no se reconoce la pista o los jugadores.
    """
    paths, models, detection = config["paths"], config["models"], config["detection"]

    input_video_path = resolve_path(paths["input"])
    if not input_video_path.exists():
        raise FileNotFoundError(f"No existe el vídeo de entrada: {input_video_path}")
    video_info = get_video_info(input_video_path)
    video_hash = file_sha256(input_video_path)
    cache_dir = resolve_path(paths["cache_dir"])

    player_tracker = PlayerTracker(model_path=str(resolve_path(models["players"])), device=detection["device"])
    ball_tracker = BallTracker(model_path=str(resolve_path(models["ball"])),
                               conf=detection["ball_confidence"],
                               device=detection["device"])
    court_line_detector = CourtLineDetector(str(resolve_path(models["court_keypoints"])),
                                            refine=config["court"]["refine_keypoints"])
    # Puntos clave y homografía imagen → pista (metros), re-detectados cada N fotogramas y suavizados
    court_tracker = CourtTracker(court_line_detector.predict,
                                 redetect_every=config["court"]["redetect_every_frames"],
                                 smoothing=config["court"]["smoothing"])

    player_every = int(detection.get("player_every_n_frames", 1))
    players_cache = cache_path_for(cache_dir, video_hash, "players", models["players"],
                                   **({"every": player_every} if player_every > 1 else {}))
    ball_cache = cache_path_for(cache_dir, video_hash, "ball", models["ball"],
                                conf=detection["ball_confidence"], all_candidates=True)
    cached_players = load_detections(players_cache, video_hash) if config["use_cache"] else None
    cached_ball = load_detections(ball_cache, video_hash) if config["use_cache"] else None

    player_detections, ball_candidates, court_keypoints, homography = detect_video(
        input_video_path, video_info.frame_count, player_tracker, ball_tracker, court_tracker,
        cached_players=cached_players, cached_ball=cached_ball, player_every=player_every)
    num_frames = len(ball_candidates)
    if num_frames == 0:
        raise ValueError(f"El vídeo no tiene fotogramas: {input_video_path}")
    if cached_players is None or len(cached_players) != num_frames:
        save_detections(players_cache, player_detections, video_hash)
    if cached_ball is None or len(cached_ball) != num_frames:
        save_detections(ball_cache, ball_candidates, video_hash)

    ball_detections = ball_tracker.select_ball_positions(ball_candidates, frame_height=video_info.height)
    ball_detections = ball_tracker.interpolate_ball_positions(ball_detections,
                                                              max_gap=detection["ball_max_interpolation_gap"])

    first = homography[0]
    print(f"Homografía: error de reproyección medio {first.mean_reprojection_error(court_keypoints[0]):.1f} px, "
          f"{int(first.inliers.sum())}/{len(first.inliers)} puntos clave coherentes")
    discarded = [i for i, ok in enumerate(first.inliers) if not ok]
    if discarded:
        print(f"  Puntos clave descartados por RANSAC (ver numeración en court/court_model.py): {discarded}")

    # Elegir a los dos jugadores: 1 = lado lejano, 2 = lado cercano
    player_detections = player_tracker.choose_and_filter_players(homography, player_detections)

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

    shots = measure_shots(ball_shot_frames, ball_detections, player_detections, player_court_positions,
                          video_info.fps)

    stats_shots, stats_positions = renumber_far_near(shots, player_court_positions)
    model_statistics = build_model_statistics(stats_shots, stats_positions, video_info.fps, num_frames)
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

    # Estadísticas de cada fotograma para el overlay (sin "nan": lo que aún no se mide es None)
    frame_states = build_frame_states(shots, num_frames)

    # Segunda pasada: se vuelve a leer el vídeo y cada fotograma se dibuja y se escribe al momento.
    output_video_path = resolve_path(paths["output"])
    output_video_path.parent.mkdir(parents=True, exist_ok=True)
    mini_court = stats_box = None
    with VideoWriter(output_video_path, fps=video_info.fps) as out:
        for i, frame in enumerate(iter_frames(input_video_path)):
            if i >= num_frames:
                break
            if mini_court is None:
                mini_court = MiniCourt(frame)
                stats_box = StatsBox(frame.shape, right=mini_court.end_x, top=mini_court.end_y)
                text_scale = mini_court.scale
            frame = player_tracker.draw_frame(frame, player_detections[i])
            frame = ball_tracker.draw_frame(frame, ball_detections[i])
            frame = court_line_detector.draw_keypoints(frame, court_keypoints[i])
            frame = mini_court.draw_frame(frame, player_court_positions[i], ball_court_positions[i])
            frame = stats_box.draw(frame, frame_states[i])
            cv2.putText(frame, f"Frame: {i}", (int(10 * text_scale), int(30 * text_scale)), cv2.FONT_HERSHEY_SIMPLEX,
                        text_scale, (0, 255, 0), max(1, int(round(2 * text_scale))))
            out.write(frame)
            report_progress("Vídeo anotado", i + 1, num_frames)
    print(f"Vídeo guardado en {output_video_path}")
    result["output_video"] = output_video_path
    return result


def main(argv=None):
    config = config_from_args(argv)
    started = time.perf_counter()
    try:
        result = run_pipeline(config, render=config["render_video"])
    except FileNotFoundError as exc:
        raise SystemExit(str(exc)) from exc
    elapsed = time.perf_counter() - started
    video_minutes = result["video_info"].duration_seconds / 60
    per_minute = f" ({elapsed / video_minutes:.0f} s por minuto de vídeo)" if video_minutes > 0 else ""
    print(f"Tiempo de proceso: {elapsed:.0f} s{per_minute}")
    stats_path = config["paths"].get("stats_json")
    if stats_path:
        stats_path = resolve_path(stats_path)
        stats_path.parent.mkdir(parents=True, exist_ok=True)
        stats_path.write_text(json.dumps(result["model_statistics"], indent=2, ensure_ascii=False))
        print(f"Estadísticas guardadas en {stats_path}")
    return result


if __name__ == "__main__":
    main()