"""Análisis de un partido a partir de sus detecciones (todo lo que va después de detectar).

Recibe la pelota y los dos jugadores ya elegidos en cada fotograma, los puntos clave y la
homografía de la pista y qué fotogramas son de la cámara principal. No necesita el vídeo ni
los modelos de detección: por eso lo usan main.run_pipeline y el test de regresión de punta a
punta (TA-16), que lo ejecuta en la CI con detecciones guardadas en JSON.
"""

from __future__ import annotations

from events import (
    call_bounces,
    call_counts,
    decide_winners,
    detect_bounce_events,
    detect_hits,
    detect_points,
    detect_serves,
    locate_bounces,
)
from mini_court import MiniCourt
from scoreboard import load_corrections, review_list, score_points
from stats import add_serve_and_rally_stats, build_model_statistics, measure_shots, renumber_far_near


def analyze_detections(ball_detections, player_detections, court_keypoints, homography, main_camera, fps, config):
    """Eventos, puntos y estadísticas del partido. Devuelve un diccionario (ver el final)."""
    # Posiciones en metros sobre la pista
    player_court_positions, ball_court_positions = MiniCourt.court_positions(player_detections,
                                                                             ball_detections,
                                                                             homography)

    # Golpes (TA-22a) y saques (TA-18). Los saques se detectan por el lanzamiento y cuentan como
    # golpes para los botes: si no, el raquetazo del saque parece un bote.
    hits = detect_hits(ball_detections, player_detections, homography, fps)
    serves = detect_serves(ball_detections, player_detections, homography, fps,
                           main_camera=main_camera, hits=hits)
    all_hits = sorted(set(hits) | {s["frame"] for s in serves})

    # Botes (TA-22a) y su posición en la pista, en metros y con incertidumbre (TA-23).
    bounces = detect_bounce_events(ball_detections, player_detections, homography, fps,
                                   main_camera=main_camera, hits=all_hits)
    bounces = locate_bounces(bounces, ball_detections, homography, fps, hits=all_hits,
                             court_keypoints=court_keypoints)

    # División en puntos (TA-17) y cantada de cada bote: dentro, fuera o dudoso (TA-24). El bote
    # de un saque se compara con su cuadro de saque y el resto con la pista.
    line_calls = config["line_calls"]
    points = detect_points(ball_detections, player_detections, hits, bounces, fps,
                           main_camera=main_camera, serves=serves, doubt_margin=line_calls["doubt_margin_m"])
    bounces = call_bounces(bounces, points, doubles=line_calls["doubles"], margin=line_calls["doubt_margin_m"])
    # Quién gana cada punto, con su confianza (TA-28).
    points = decide_winners(points, bounces, all_hits, fps, ball_detections, player_detections)
    # Marcador punto a punto con el motor de TA-27, la configuración del partido y las correcciones
    # del entrenador (TA-29).
    points, match = score_points(points, config["match"], load_corrections(config["paths"].get("corrections")))

    # Golpes para las velocidades: los del detector de golpes (TA-22a) y los saques. El contador
    # original (get_ball_shot_frames) contaba en fotogramas fijos y a 50 fps daba golpes falsos
    # muy seguidos, con velocidades imposibles.
    shots = measure_shots(all_hits, ball_detections, player_detections, player_court_positions,
                          fps, main_camera=main_camera, hitters={s["frame"]: s["player"] for s in serves})

    stats_shots, stats_positions = renumber_far_near(shots, player_court_positions)
    model_statistics = build_model_statistics(stats_shots, stats_positions, fps, len(ball_detections))
    add_serve_and_rally_stats(model_statistics, points)
    counts = call_counts(bounces)
    model_statistics["bounces"] = {"count": len(bounces), "in": counts["dentro"], "out": counts["fuera"],
                                   "doubtful": counts["dudoso"]}
    model_statistics["points"] = {
        "count": len(points),
        "won": {str(player): sum(p["winner"] == player and p["counted"] for p in points) for player in (1, 2)},
        "lowConfidence": sum(p["confidence_level"] == "baja" for p in points),
        "corrected": sum(p["corrected"] for p in points),
        "toReview": review_list(points),
    }
    model_statistics["score"] = {"text": match.score_text(), **match.score()}
    return {
        "model_statistics": model_statistics,
        "shots": shots,
        "stats_shots": stats_shots,
        "player_court_positions": player_court_positions,
        "ball_court_positions": ball_court_positions,
        "hits": all_hits,
        "bounces": bounces,
        "serves": serves,
        "points": points,
        "match": match,
    }
