"""Evaluación final del modelo (TA-31): métricas de cada módulo en una tabla Markdown.

Uso (desde model/): python scripts/evaluate_model.py [--seeds 20]

Dos fuentes:
- Partidos simulados (tests/ball_sim.py): verdad exacta de cada evento. Cada partido tiene
  ganadores, una falta, golpes fuera, una bola a la red y una doble falta. Detecciones con ruido
  de 1,5 px y un 3 % de pelotas perdidas; homografía con 0,5 px de error en los puntos clave.
- Detecciones reales guardadas (tests/data): botes marcados a mano en el vídeo de ejemplo y h1.

Todo pasa por pipeline_analysis.analyze_detections, el mismo análisis que el vídeo y el worker.
Las cifras de simulación son una cota superior: los vídeos reales tienen oclusiones, cortes y
detecciones peores.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path[:0] = [str(ROOT), str(ROOT / "tests")]

from ball_sim import BroadcastCamera, render_detections, simulate_match  # noqa: E402
from test_regression import load_case  # noqa: E402

from config import DEFAULTS  # noqa: E402
from court import COURT_KEYPOINTS_M, CourtHomography  # noqa: E402
from eval.metrics import match_events  # noqa: E402
from events.line_calls import call, court_area, line_distance  # noqa: E402
from events.points import point_boundaries_ok  # noqa: E402
from pipeline_analysis import analyze_detections  # noqa: E402
from stats import rally_length  # noqa: E402

CAMERA = BroadcastCamera()
FPS = 30


def camera_for(height):
    """Cámara de retransmisión a 1080p o 720p (misma vista; la focal escala con la resolución)."""
    scale = height / 1080
    return BroadcastCamera(width=int(round(1920 * scale)), height=height, focal=1700.0 * scale)


def simulated_matches(seeds, height=1080, fps=FPS, noise_px=1.5, miss_rate=0.03, occlusion_rate=0.0):
    CAMERA = camera_for(height)
    FPS = fps
    for seed in seeds:
        rng = np.random.default_rng(seed + 7)
        keypoints = CAMERA.project(np.c_[COURT_KEYPOINTS_M, np.zeros(14)]) + rng.normal(0, 0.5, (14, 2))
        homography = CourtHomography.from_keypoints(keypoints.ravel())
        match = simulate_match(num_points=8, seed=seed, fault_points=(1,), out_points=(2,), net_points=(5,),
                               double_fault_points=(6,), max_shots=12, fps=FPS)
        ball, players = render_detections(match, CAMERA, noise_px=noise_px, miss_rate=miss_rate, seed=seed,
                                          occlusion_rate=occlusion_rate)
        analysis = analyze_detections(ball, players, [keypoints.ravel()] * len(ball), homography,
                                      [True] * len(ball), FPS, DEFAULTS)
        yield match, analysis, FPS


def evaluate_simulation(seeds, **conditions):
    bounce_score = serve_score = None
    position_errors, calls, speed_errors, winners, nets, rallies, boundaries = [], [], [], [], [], [], []
    singles = court_area()
    for match, analysis, FPS in simulated_matches(seeds, **conditions):
        bounces = [b for b in analysis["bounces"] if "x_m" in b]
        score, matched = match_events([b["frame"] for b in bounces], [b["frame"] for b in match.bounces],
                                      max(2, round(2 * FPS / 30)))
        bounce_score = score if bounce_score is None else bounce_score + score
        for i, j in matched:
            truth = match.bounces[j]
            position_errors.append(np.hypot(bounces[i]["x_m"] - truth["x_m"], bounces[i]["y_m"] - truth["y_m"]))
            if abs(line_distance(truth["x_m"], truth["y_m"], singles)) > 0.30 and bounces[i]["area"] == "pista":
                calls.append(bounces[i]["call"] == call(truth["x_m"], truth["y_m"], singles, margin=0.0))
        score, _ = match_events([s["frame"] for s in analysis["serves"]], [s["frame"] for s in match.serves],
                                max(3, round(3 * FPS / 30)))
        serve_score = score if serve_score is None else serve_score + score
        for attempt in (a for p in analysis["points"] for a in p["serve_attempts"] if a["speedKmh"]):
            real = min(match.serves, key=lambda s: abs(s["frame"] - attempt["frame"]))
            speed_errors.append(abs(attempt["speedKmh"] / real["speedKmh"] - 1))
        boundaries.append(point_boundaries_ok(analysis["points"], match.points, FPS))
        for real in match.points:
            best = max(analysis["points"], key=lambda p: min(p["end"], real["end"]) - max(p["start"], real["start"]))
            winners.append((best["model_winner"] == real["winner"], best["confidence_level"]))
            if real["how"] == "red":
                nets.append(best["win_reason"] == "red")
            if real["how"] == "doble falta":
                truth_len = 1
            else:
                faults = sum(1 for s in match.serves if real["start"] <= s["frame"] <= real["end"] and s["fault"])
                truth_len = sum(1 for s in match.shots if real["start"] <= s["frame"] <= real["end"]) - min(faults, 1)
            rallies.append(abs(rally_length(best) - truth_len) <= 1)

    by_level = {level: [ok for ok, lv in winners if lv == level] for level in ("alta", "media", "baja")}
    return {
        "bounces": bounce_score, "serves": serve_score,
        "position_cm": (100 * np.mean(position_errors), 100 * np.percentile(position_errors, 90)),
        "calls": (np.mean(calls), len(calls)),
        "serve_speed": (100 * np.mean(speed_errors), 100 * np.max(speed_errors), len(speed_errors)),
        "boundaries": float(np.mean(boundaries)),
        "winners": (np.mean([ok for ok, _ in winners]), len(winners),
                    {k: (np.mean(v) if v else None, len(v)) for k, v in by_level.items()}),
        "nets": (np.mean(nets), len(nets)),
        "rallies": (np.mean(rallies), len(rallies)),
    }


def evaluate_real():
    rows = {}
    for name in ("input_video", "h4", "h1"):
        data, ball, players, homographies = load_case(name)
        analysis = analyze_detections(ball, players, data["court_keypoints"], homographies, [True] * len(ball),
                                      data["fps"], DEFAULTS)
        score, _ = match_events([b["frame"] for b in analysis["bounces"]], data["bounces_labeled"],
                                max(2, round(2 * data["fps"] / 30)))
        rows[name] = (score, len(data["bounces_labeled"]))
    return rows


def pct(value):
    return f"{100 * value:.1f} %"


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--seeds", type=int, default=20, help="partidos simulados (8 puntos cada uno)")
    args = parser.parse_args(argv)
    sim = evaluate_simulation(range(args.seeds))
    real = evaluate_real()
    b, s = sim["bounces"], sim["serves"]
    w_all, n_points, levels = sim["winners"]
    level_text = ", ".join(f"{k} {pct(v)} ({n})" for k, (v, n) in levels.items() if v is not None)
    print(f"| Módulo | Métrica | Simulación ({args.seeds} partidos, {n_points} puntos) |")
    print("| --- | --- | --- |")
    print(f"| Botes (TA-22a) | F1 ±2 fotogramas | {b.f1:.3f} (P {b.precision:.2f}, R {b.recall:.2f}) |")
    print(f"| Posición del bote (TA-23) | Error medio / p90 | {sim['position_cm'][0]:.0f} cm / "
          f"{sim['position_cm'][1]:.0f} cm |")
    print(f"| Dentro/fuera (TA-24) | Acierto a > 30 cm de la línea | {pct(sim['calls'][0])} ({sim['calls'][1]} botes) |")
    print(f"| Saques (TA-18/19) | F1 ±3 fotogramas | {s.f1:.3f} (P {s.precision:.2f}, R {s.recall:.2f}) |")
    print(f"| Velocidad del saque (TA-20) | Error medio / máximo | {sim['serve_speed'][0]:.1f} % / "
          f"{sim['serve_speed'][1]:.1f} % ({sim['serve_speed'][2]} saques) |")
    print(f"| Puntos (TA-17) | Inicio y fin a < 1 s | {pct(sim['boundaries'])} |")
    print(f"| Ganador del punto (TA-28) | Acierto | {pct(w_all)}; por confianza: {level_text} |")
    print(f"| Pelota en la red (TA-26) | Detectadas | {pct(sim['nets'][0])} ({sim['nets'][1]} bolas a la red) |")
    print(f"| Peloteos (TA-35) | Golpes ±1 | {pct(sim['rallies'][0])} ({sim['rallies'][1]} puntos) |")
    print()
    print("| Vídeo real | Botes marcados a mano | F1 botes ±2 fotogramas |")
    print("| --- | --- | --- |")
    for name, (score, n) in real.items():
        print(f"| {name} | {n} | {score.f1:.3f} (P {score.precision:.2f}, R {score.recall:.2f}) |")
    return 0


if __name__ == "__main__":
    sys.exit(main())
