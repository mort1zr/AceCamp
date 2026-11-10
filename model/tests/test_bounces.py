"""Tests de TA-22a: detector de botes (y de golpes) con peloteos simulados (tests/ball_sim.py)."""

import pytest
from ball_sim import BroadcastCamera, render_detections, simulate_rally

from eval.metrics import DetectionScore, match_events
from events import detect_bounces, detect_hits

CAMERA = BroadcastCamera()
HOMOGRAPHY = CAMERA.homography()


def score(seeds, fps=30, noise_px=1.5, miss_rate=0.03):
    bounces, hits = DetectionScore(0, 0, 0), DetectionScore(0, 0, 0)
    tolerance = 2 * fps // 30
    for seed in seeds:
        rally = simulate_rally(8, fps=fps, seed=seed)
        ball, players = render_detections(rally, CAMERA, noise_px=noise_px, miss_rate=miss_rate, seed=seed)
        found_hits = detect_hits(ball, players, HOMOGRAPHY, fps)
        found = detect_bounces(ball, players, HOMOGRAPHY, fps, hits=found_hits)
        bounces += match_events(found, [b["frame"] for b in rally.bounces], tolerance)[0]
        hits += match_events(found_hits, [s["frame"] for s in rally.shots[1:]], tolerance)[0]
    return bounces, hits


def test_f1_on_simulated_rallies_meets_the_target():
    """Criterio de TA-22a: F1 ≥ 0,7 con tolerancia de ± 2 fotogramas (aquí, sobre peloteos simulados)."""
    bounces, hits = score(range(20))

    assert bounces.f1 >= 0.85
    assert hits.f1 >= 0.9


def test_noisier_detections_still_meet_the_target():
    bounces, _ = score(range(20), noise_px=3.0, miss_rate=0.10)

    assert bounces.f1 >= 0.7


def test_works_at_60_fps():
    bounces, _ = score(range(10), fps=60)

    assert bounces.f1 >= 0.8


def test_a_single_flight_without_bounce_gives_no_bounces():
    rally = simulate_rally(1, seed=3)
    ball, players = render_detections(rally, CAMERA, noise_px=0, miss_rate=0)
    first_bounce = rally.bounces[0]["frame"]
    flight = [b if i < first_bounce - 3 else {} for i, b in enumerate(ball)]  # solo el vuelo hasta antes del bote

    assert detect_bounces(flight, players, HOMOGRAPHY, 30) == []


def test_hits_are_not_counted_as_bounces():
    rally = simulate_rally(6, seed=5)
    ball, players = render_detections(rally, CAMERA, noise_px=0, miss_rate=0)

    found = detect_bounces(ball, players, HOMOGRAPHY, 30)

    for shot in rally.shots[1:]:
        assert all(abs(f - shot["frame"]) > 2 for f in found)


def test_no_bounces_outside_the_main_camera():
    rally = simulate_rally(6, seed=5)
    ball, players = render_detections(rally, CAMERA, noise_px=0, miss_rate=0)
    main_camera = [False] * len(ball)

    assert detect_bounces(ball, players, HOMOGRAPHY, 30, main_camera=main_camera) == []


def test_without_ball_there_are_no_bounces():
    assert detect_bounces([{}] * 50, [{}] * 50, HOMOGRAPHY, 30) == []


@pytest.mark.parametrize("seed", [0, 1, 2])
def test_bounces_are_close_to_the_real_frame(seed):
    rally = simulate_rally(6, seed=seed)
    ball, players = render_detections(rally, CAMERA, noise_px=0, miss_rate=0)

    found = detect_bounces(ball, players, HOMOGRAPHY, 30)
    real = [b["frame"] for b in rally.bounces]

    result, matched = match_events(found, real, 2)
    assert result.recall >= 0.8
    assert all(abs(found[i] - real[j]) <= 1 for i, j in matched)


# --------------------------------------------------- vídeo de ejemplo real


def real_video():
    import json
    from pathlib import Path

    from court import CourtHomography

    data = json.loads((Path(__file__).parent / "data" / "input_video_detections.json").read_text())
    ball = [{int(k): v for k, v in frame.items()} for frame in data["ball"]]
    players = [{int(k): v for k, v in frame.items()} for frame in data["players"]]
    homographies = [CourtHomography.from_keypoints(k) for k in data["court_keypoints"]]
    return data, ball, players, homographies


def test_bounces_of_the_sample_video():
    """Los 5 botes del vídeo de ejemplo, marcados a mano (input_videos/input_video.mp4).

    Tres de ellos ocurren con la pelota sin detectar: dos tapados por el jugador cercano
    (80 y 170) y uno que el detector pierde en el fondo lejano (203). Se deducen del cruce
    de la trayectoria de antes y de después del hueco. El 170 está tapado del 166 al 176:
    el fotograma marcado a mano es aproximado y la trayectoria da ~166-167.
    """
    data, ball, players, homographies = real_video()

    hits = detect_hits(ball, players, homographies, data["fps"])
    found = detect_bounces(ball, players, homographies, data["fps"], hits=hits)

    # El golpe del 129 ocurre con la pelota sin detectar (127-135, junto al jugador del fondo): se
    # deduce del cambio de dirección antes y después del hueco.
    assert hits == [10, 56, 94, 129, 182]
    result, _ = match_events(found, data["bounces_labeled"], 2)
    assert result.true_positives >= 4
    assert result.false_positives <= 1
    assert result.f1 >= 0.8


def test_the_pipeline_handles_bounces_without_a_ball_in_their_frame(monkeypatch, tmp_path):
    """De punta a punta con las detecciones del vídeo de ejemplo: hay botes deducidos en huecos
    sin pelota (80, 170, 203) y el pipeline debe darles posición y dibujarlos sin fallar."""
    import cv2
    import numpy as np

    import main

    data, _, _, _ = real_video()
    width, height = data["size"]
    bits = 10  # el número de fotograma va en binario, en bloques blancos y negros que la compresión no altera

    def index(frame):
        return sum(1 << b for b in range(bits) if frame[:40, 40 * b:40 * b + 40].mean() > 128)

    video = tmp_path / "ejemplo.avi"
    out = cv2.VideoWriter(str(video), cv2.VideoWriter_fourcc(*"MJPG"), data["fps"], (width, height))
    for i in range(len(data["ball"])):
        frame = np.full((height, width, 3), 90, np.uint8)
        for b in range(bits):
            frame[:40, 40 * b:40 * b + 40] = 255 if i >> b & 1 else 0
        out.write(frame)
    out.release()

    class RealPlayers(main.PlayerTracker):
        def detect_frame(self, frame):
            return {int(k): v for k, v in data["players"][index(frame)].items()}

    class RealBall(main.BallTracker):
        def detect_frame(self, frame):
            box = data["ball"][index(frame)].get("1")
            return {} if box is None else {0: box + [0.9]}

    class RealCourt:
        def __init__(self, model_path, refine=True):
            self.calls = 0

        def predict(self, image):
            return data["court_keypoints"][index(image)]

        def draw_keypoints(self, frame, keypoints):
            return frame

    monkeypatch.setattr(main, "PlayerTracker", RealPlayers)
    monkeypatch.setattr(main, "BallTracker", RealBall)
    monkeypatch.setattr(main, "CourtLineDetector", RealCourt)
    result = main.main(["--input", str(video), "--output", str(tmp_path / "salida.avi"),
                        "--cache-dir", str(tmp_path / "cache")])

    inferred = [b for b in result["bounces"] if b["inferred"]]
    assert inferred, "se esperaban botes deducidos en huecos sin pelota"
    for bounce in result["bounces"]:
        assert 0 <= bounce["x_px"] <= width and 0 <= bounce["y_px"] <= height
    # El pipeline vuelve a elegir la pelota y a seguir la pista sobre las detecciones guardadas:
    # debe dar los mismos botes que el detector directamente.
    _, ball, players, homographies = real_video()
    assert [b["frame"] for b in result["bounces"]] == detect_bounces(ball, players, homographies, data["fps"])


def test_bounces_of_a_low_resolution_highlight_with_court_marks():
    """Highlight de 640x360 con rozaduras blancas en la pista que el detector confunde con la pelota.

    Antes el seguimiento se enganchaba a las marcas (pelota congelada) y casi no había botes.
    Con las marcas descartadas, criterio de TA-22a frente a los 9 botes marcados a mano.
    """
    import json
    from collections import Counter
    from pathlib import Path

    from court import CourtHomography
    from trackers.ball_selection import box_center, fill_short_gaps, select_ball

    data = json.loads((Path(__file__).parent / "data" / "h1_detections.json").read_text())
    fps = data["fps"]
    candidates = [dict(enumerate(frame)) for frame in data["ball_candidates"]]
    players = [{int(k): v for k, v in frame.items()} for frame in data["players"]]
    homographies = [CourtHomography.from_keypoints(k) for k in data["court_keypoints"]]

    selected = select_ball(candidates, scale=data["size"][1] / 1080, fps=fps)
    repeated = Counter(tuple(round(v) for v in box_center(f[1])) for f in selected if 1 in f).most_common(1)
    assert repeated[0][1] <= 3, "la pelota no debe quedarse en una marca de la pista"

    ball = fill_short_gaps(selected, 5)
    found = detect_bounces(ball, players, homographies, fps)
    result, _ = match_events(found, data["bounces_labeled"], 2)
    assert result.recall >= 0.8
    assert result.f1 >= 0.7


def test_a_hit_hidden_by_the_player_is_inferred_from_the_gap():
    """La pelota desaparece 8 fotogramas junto al jugador del fondo y vuelve en sentido contrario."""
    homography = CAMERA.homography()
    players = [{1: [900, 150, 960, 260], 2: [900, 800, 1000, 1000]} for _ in range(60)]
    ball = []
    for i in range(60):
        if 22 <= i <= 29:
            ball.append({})  # tapada por el jugador
            continue
        y = 420 - 9 * i if i < 22 else 222 + 9 * (i - 26)  # sube hacia el jugador 1 y vuelve
        ball.append({1: [925, y - 5, 935, y + 5]})
    hits = detect_hits(ball, players, homography, 30)
    assert len(hits) == 1 and 22 <= hits[0] <= 29
    # Sin jugador cerca no es un golpe.
    far_away = [{1: [200, 150, 260, 260], 2: [900, 800, 1000, 1000]} for _ in range(60)]
    assert detect_hits(ball, far_away, homography, 30) == []


def test_toss_and_duplicate_hits_around_a_serve_are_dropped():
    from events.serves import drop_toss_hits

    serves = [{"frame": 100, "toss_start": 80}]
    assert drop_toss_hits([50, 85, 99, 100, 104, 130], serves, 30) == [50, 100, 130]
