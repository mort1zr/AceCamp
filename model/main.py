import json
import time
from dataclasses import dataclass

import cv2

from camera import CutDetector, main_camera_frames, segments
from config import config_from_args, resolve_path
from court import CourtTracker
from court_line_detector import CourtLineDetector
from events import detect_bounce_events, detect_hits, detect_points, detect_serves, locate_bounces
from mini_court import MiniCourt
from stats import build_frame_states, build_model_statistics, measure_shots, renumber_far_near, serve_and_point_stats
from trackers import BallTracker, PlayerTracker
from utils import VideoWriter, get_video_info, iter_frames
from utils.detection_cache import cache_path_for, file_sha256, load_detections, save_detections
from utils.player_stats_drawer_utils import StatsBox
from utils.progress import report_progress

MINI_COURT_BOUNCES = 6  # botes que se ven a la vez en la mini-pista


# Con ball_image_size "auto", los vídeos más estrechos que esto se analizan ampliados a
# AUTO_BALL_IMAGE_SIZE para buscar la pelota (en 640x360 mide 2-3 px y el detector la pierde).
AUTO_SMALL_VIDEO_WIDTH = 1280
AUTO_BALL_IMAGE_SIZE = 1280


def resolve_ball_image_size(setting, video_width):
    """Tamaño de imagen para el detector de pelota: un número, None (el de YOLO) o "auto"."""
    if setting == "auto":
        return AUTO_BALL_IMAGE_SIZE if video_width < AUTO_SMALL_VIDEO_WIDTH else None
    return int(setting) if setting else None


@dataclass
class VideoDetections:
    """Resultado de la primera pasada: una entrada por fotograma (salvo cuts)."""

    players: list
    ball: list
    keypoints: list
    homographies: list
    court_visible: list
    cuts: list


def detect_video(video_path, num_frames, player_tracker, ball_tracker, court_tracker, cut_detector=None,
                 cached_players=None, cached_ball=None, player_every=1):
    """Primera pasada (PCIT-146): recorre el vídeo una vez y guarda solo las detecciones.

    Cada fotograma se usa para detectar jugadores, pelota y pista y se descarta: la
    memoria no crece con la duración del vídeo. Con detecciones en caché no se ejecuta
    YOLO, pero la pista se sigue detectando (cada N fotogramas, TA-11).

    player_every > 1 detecta a los jugadores en uno de cada N fotogramas; en el resto
    se dejan vacíos y la selección de jugadores interpola sus cajas.

    Con cut_detector, cada corte de cámara obliga a volver a detectar la pista (TA-15).
    """
    result = VideoDetections([], [], [], [], [], [])
    players, ball = result.players, result.ball
    for i, frame in enumerate(iter_frames(video_path)):
        cut = cut_detector.update(frame) if cut_detector is not None else False
        if cut:
            result.cuts.append(i)
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
        frame_keypoints, homography = court_tracker.update(frame, cut=cut)
        result.keypoints.append(frame_keypoints)
        result.homographies.append(homography)
        result.court_visible.append(court_tracker.court_visible)
        report_progress("Detección", i + 1, num_frames)
    return result


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

    ball_image_size = resolve_ball_image_size(detection.get("ball_image_size"), video_info.width)
    player_tracker = PlayerTracker(model_path=str(resolve_path(models["players"])), device=detection["device"])
    ball_tracker = BallTracker(model_path=str(resolve_path(models["ball"])),
                               conf=detection["ball_confidence"],
                               device=detection["device"],
                               image_size=ball_image_size)
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
                                conf=detection["ball_confidence"], all_candidates=True,
                                **({"imgsz": ball_image_size} if ball_image_size else {}))
    cached_players = load_detections(players_cache, video_hash) if config["use_cache"] else None
    cached_ball = load_detections(ball_cache, video_hash) if config["use_cache"] else None

    detections = detect_video(
        input_video_path, video_info.frame_count, player_tracker, ball_tracker, court_tracker,
        cut_detector=CutDetector() if config["cameras"]["detect_cuts"] else None,
        cached_players=cached_players, cached_ball=cached_ball, player_every=player_every)
    num_frames = len(detections.ball)
    if num_frames == 0:
        raise ValueError(f"El vídeo no tiene fotogramas: {input_video_path}")
    if cached_players is None or len(cached_players) != num_frames:
        save_detections(players_cache, detections.players, video_hash)
    if cached_ball is None or len(cached_ball) != num_frames:
        save_detections(ball_cache, detections.ball, video_hash)
    court_keypoints, homography = detections.keypoints, detections.homographies

    # Cámara principal (TA-15): fuera de ella (repeticiones, primeros planos) se descartan
    # jugadores y pelota, así que no generan golpes ni botes ni suman metros.
    main_camera = main_camera_frames(court_keypoints, detections.court_visible, video_info.width,
                                     max_shift_fraction=config["cameras"]["max_shift_fraction"])
    main_segments = segments(main_camera)
    if not main_segments:
        raise ValueError("no se reconoció la pista en ningún tramo del vídeo")
    main_frames = sum(end - start + 1 for start, end in main_segments)
    if detections.cuts or main_frames < num_frames:
        print(f"Cámara principal: {main_frames}/{num_frames} fotogramas en {len(main_segments)} tramos; "
              f"{len(detections.cuts)} cortes de cámara")
    player_detections = [d if main else {} for d, main in zip(detections.players, main_camera)]
    ball_candidates = [d if main else {} for d, main in zip(detections.ball, main_camera)]

    ball_detections = ball_tracker.select_ball_positions(ball_candidates, frame_height=video_info.height,
                                                         fps=video_info.fps)
    ball_detections = ball_tracker.interpolate_ball_positions(ball_detections,
                                                              max_gap=detection["ball_max_interpolation_gap"])
    ball_detections = [d if main else {} for d, main in zip(ball_detections, main_camera)]

    first_main = main_segments[0][0]
    first = homography[first_main]
    print(f"Homografía: error de reproyección medio {first.mean_reprojection_error(court_keypoints[first_main]):.1f} px, "
          f"{int(first.inliers.sum())}/{len(first.inliers)} puntos clave coherentes")
    discarded = [i for i, ok in enumerate(first.inliers) if not ok]
    if discarded:
        print(f"  Puntos clave descartados por RANSAC (ver numeración en court/court_model.py): {discarded}")

    # Elegir a los dos jugadores: 1 = lado lejano, 2 = lado cercano
    player_detections = player_tracker.choose_and_filter_players(homography, player_detections)
    # La selección interpola las cajas en los huecos; fuera de la cámara principal no hay jugadores.
    player_detections = [d if main else {} for d, main in zip(player_detections, main_camera)]

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

    # Botes (TA-22a) y su posición en la pista, en metros y con incertidumbre (TA-23).
    hits = detect_hits(ball_detections, player_detections, homography, video_info.fps)
    bounces = detect_bounce_events(ball_detections, player_detections, homography, video_info.fps,
                                   main_camera=main_camera, hits=hits)
    bounces = locate_bounces(bounces, ball_detections, homography, video_info.fps, hits=hits,
                             court_keypoints=court_keypoints)

    # Saques (TA-18) y división en puntos (TA-17).
    serves = detect_serves(ball_detections, player_detections, homography, video_info.fps,
                           main_camera=main_camera, hits=hits)
    points = detect_points(ball_detections, player_detections, hits, bounces, video_info.fps,
                           main_camera=main_camera, serves=serves)

    shots = measure_shots(ball_shot_frames, ball_detections, player_detections, player_court_positions,
                          video_info.fps, main_camera=main_camera)

    stats_shots, stats_positions = renumber_far_near(shots, player_court_positions)
    model_statistics = build_model_statistics(stats_shots, stats_positions, video_info.fps, num_frames)
    model_statistics.update(serve_and_point_stats(serves, points))
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
        "cuts": detections.cuts,
        "bounces": bounces,
        "serves": serves,
        "points": points,
        "main_camera_segments": main_segments,
    }
    if not render:
        return result

    # Estadísticas de cada fotograma para el overlay (sin "nan": lo que aún no se mide es None)
    frame_states = build_frame_states(shots, num_frames)

    # Segunda pasada: se vuelve a leer el vídeo y cada fotograma se dibuja y se escribe al momento.
    output_video_path = resolve_path(paths["output"])
    output_video_path.parent.mkdir(parents=True, exist_ok=True)
    mini_court = stats_box = None
    bounce_marker_frames = max(1, int(round(0.5 * video_info.fps)))
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
            if main_camera[i]:
                frame = court_line_detector.draw_keypoints(frame, court_keypoints[i])
            else:
                cv2.putText(frame, "Otra camara: no se analiza", (int(10 * text_scale), int(70 * text_scale)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8 * text_scale, (0, 165, 255), max(1, int(round(2 * text_scale))))
            frame = mini_court.draw_frame(frame, player_court_positions[i], ball_court_positions[i])
            # Los últimos botes, en su posición de la pista (TA-23).
            recent = [b for b in bounces if b["frame"] <= i][-MINI_COURT_BOUNCES:]
            frame = mini_court.draw_bounces(frame, [(b["x_m"], b["y_m"]) for b in recent])
            for bounce in bounces:  # marca cada bote durante medio segundo
                if 0 <= i - bounce["frame"] < bounce_marker_frames:
                    center = (int(bounce["x_px"]), int(bounce["y_px"]))
                    cv2.circle(frame, center, int(18 * text_scale), (255, 0, 255), max(1, int(round(3 * text_scale))))
                    cv2.putText(frame, "BOTE", (center[0] + int(22 * text_scale), center[1]), cv2.FONT_HERSHEY_SIMPLEX,
                                0.7 * text_scale, (255, 0, 255), max(1, int(round(2 * text_scale))))
            for serve in serves:  # marca cada saque durante medio segundo, sobre el sacador
                if 0 <= i - serve["frame"] < bounce_marker_frames and serve["player"] in player_detections[i]:
                    x1, y1, x2, _ = player_detections[i][serve["player"]]
                    cv2.putText(frame, f"SAQUE ({serve['side']})", (int(x1), int(y1 - 30 * text_scale)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7 * text_scale, (0, 255, 255),
                                max(1, int(round(2 * text_scale))))
            current = next((k for k, p in enumerate(points, start=1) if p["start"] <= i <= p["end"]), None)
            if current is not None:
                cv2.putText(frame, f"Punto {current}", (int(10 * text_scale), int(110 * text_scale)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8 * text_scale, (0, 255, 255), max(1, int(round(2 * text_scale))))
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