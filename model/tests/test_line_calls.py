"""Tests de TA-24: dentro, fuera o dudoso de cada bote."""

import numpy as np
import pytest
from ball_sim import BroadcastCamera, render_detections, simulate_match, simulate_rally

from court import COURT_KEYPOINTS_M, COURT_LENGTH, DOUBLES_WIDTH, NET_Y, CourtHomography
from court.court_model import ALLEY_WIDTH, SERVICE_LINE_FROM_NET
from eval.metrics import match_events
from events import call_bounces, call_counts, detect_bounce_events, detect_hits, detect_points, locate_bounces
from events.line_calls import DOUBTFUL, IN, OUT, call, court_area, line_distance, service_box

CAMERA = BroadcastCamera()
SINGLES = court_area()


# --- Geometría ---------------------------------------------------------------------------

@pytest.mark.parametrize("x, y, expected", [
    (DOUBLES_WIDTH / 2, NET_Y - 3, IN),  # en medio de la pista
    (ALLEY_WIDTH + 0.5, 1.0, IN),
    (ALLEY_WIDTH - 0.5, 5.0, OUT),  # en el pasillo de dobles: fuera en individuales
    (DOUBLES_WIDTH / 2, -0.4, OUT),  # larga por el fondo lejano
    (DOUBLES_WIDTH / 2, COURT_LENGTH + 0.4, OUT),  # larga por el fondo cercano
    (ALLEY_WIDTH, 5.0, DOUBTFUL),  # sobre la línea
    (ALLEY_WIDTH + 0.10, 5.0, DOUBTFUL),  # a 10 cm por dentro
    (ALLEY_WIDTH - 0.10, 5.0, DOUBTFUL),  # a 10 cm por fuera
    (ALLEY_WIDTH + 0.20, 5.0, IN),  # a 20 cm por dentro
    (ALLEY_WIDTH - 0.20, 5.0, OUT),  # a 20 cm por fuera
    (ALLEY_WIDTH - 0.10, -0.10, DOUBTFUL),  # fuera de la esquina: 10 cm en cada eje son 14 cm
    (ALLEY_WIDTH - 0.20, -0.20, OUT),  # 28 cm en diagonal
])
def test_singles_court_calls(x, y, expected):
    assert call(x, y, SINGLES) == expected


def test_line_distance_is_signed_and_measured_to_the_nearest_line():
    assert line_distance(ALLEY_WIDTH + 0.3, 5.0, SINGLES) == pytest.approx(0.3)
    assert line_distance(ALLEY_WIDTH - 0.3, 5.0, SINGLES) == pytest.approx(-0.3)
    assert line_distance(ALLEY_WIDTH - 0.3, -0.4, SINGLES) == pytest.approx(-0.5)  # esquina: 0,3 y 0,4 → 0,5


def test_doubles_court_includes_the_alleys_and_margin_is_configurable():
    x, y = ALLEY_WIDTH - 0.5, 5.0
    assert call(x, y, SINGLES) == OUT
    assert call(x, y, court_area(doubles=True)) == IN
    assert call(ALLEY_WIDTH + 0.20, 5.0, SINGLES, margin=0.30) == DOUBTFUL


@pytest.mark.parametrize("server, side, x_range, y_range", [
    # El 2 saca desde el fondo cercano hacia la mitad lejana; su derecha es la derecha de la imagen
    # y el saque cruzado va al cuadro izquierdo de la imagen.
    (2, "derecha", (ALLEY_WIDTH, DOUBLES_WIDTH / 2), (NET_Y - SERVICE_LINE_FROM_NET, NET_Y)),
    (2, "izquierda", (DOUBLES_WIDTH / 2, DOUBLES_WIDTH - ALLEY_WIDTH), (NET_Y - SERVICE_LINE_FROM_NET, NET_Y)),
    # El 1 mira a la cámara: su derecha es la izquierda de la imagen y saca al cuadro derecho.
    (1, "derecha", (DOUBLES_WIDTH / 2, DOUBLES_WIDTH - ALLEY_WIDTH), (NET_Y, NET_Y + SERVICE_LINE_FROM_NET)),
    (1, "izquierda", (ALLEY_WIDTH, DOUBLES_WIDTH / 2), (NET_Y, NET_Y + SERVICE_LINE_FROM_NET)),
])
def test_service_box_is_the_diagonal_one(server, side, x_range, y_range):
    assert service_box(server, side) == pytest.approx((*x_range, *y_range))


def test_serve_bounces_use_the_service_box_and_the_rest_the_court():
    # Un bote a 1 m detrás de la línea de saque lejana: largo para un saque, bueno en el peloteo.
    long_serve = {"frame": 10, "x_m": 3.0, "y_m": NET_Y - SERVICE_LINE_FROM_NET - 1.0}
    rally = {"frame": 40, "x_m": 3.0, "y_m": NET_Y - SERVICE_LINE_FROM_NET - 1.0}
    no_position = {"frame": 50}
    points = [{"serve_attempts": [{"player": 2, "side": "derecha", "bounce_frame": 10}]}]
    called = call_bounces([long_serve, rally, no_position], points)
    assert (called[0]["call"], called[0]["area"], called[0]["line_distance_cm"]) == (OUT, "cuadro de saque", -100)
    assert (called[1]["call"], called[1]["area"]) == (IN, "pista")
    assert "call" not in called[2]
    assert call_counts(called) == {IN: 1, OUT: 1, DOUBTFUL: 0}


# --- Simulación de punta a punta ------------------------------------------------------------

def called_vs_truth(seeds, noise_px=1.5):
    """(cantada, cantada real, distancia real a la línea) de cada bote detectado de peloteos simulados."""
    rows = []
    for seed in seeds:
        rng = np.random.default_rng(seed + 50)
        keypoints = CAMERA.project(np.c_[COURT_KEYPOINTS_M, np.zeros(14)]) + rng.normal(0, 0.5, (14, 2))
        homography = CourtHomography.from_keypoints(keypoints.ravel())
        rally = simulate_rally(6, seed=seed, last_out=seed % 2 == 0)
        ball, players = render_detections(rally, CAMERA, noise_px=noise_px, seed=seed)
        hits = detect_hits(ball, players, homography, 30)
        events = detect_bounce_events(ball, players, homography, 30, hits=hits)
        located = locate_bounces(events, ball, homography, 30, hits=hits,
                                 court_keypoints=[keypoints.ravel()] * len(ball))
        called = call_bounces(located)
        _, matched = match_events([b["frame"] for b in called], [b["frame"] for b in rally.bounces], 2)
        for i, j in matched:
            truth = rally.bounces[j]
            rows.append((called[i]["call"], call(truth["x_m"], truth["y_m"], SINGLES, margin=0.0),
                         line_distance(truth["x_m"], truth["y_m"], SINGLES)))
    return rows


def test_calls_are_95_percent_right_more_than_30_cm_from_a_line():
    """Criterio de TA-24: ≥ 95 % de acierto en los botes a más de 30 cm de una línea (un dudoso
    cuenta como fallo)."""
    rows = called_vs_truth(range(30))
    clear = [(got, truth) for got, truth, distance in rows if abs(distance) > 0.30]
    outs = [r for r in clear if r[1] == OUT]

    assert len(clear) >= 100 and len(outs) >= 8  # hay botes fuera de verdad, no solo dentro
    accuracy = np.mean([got == truth for got, truth in clear])
    assert accuracy >= 0.95, accuracy


def test_a_clearly_wrong_call_never_flips_in_and_out_far_from_the_lines():
    """A más de 50 cm de la línea, un bote bueno nunca se canta fuera ni al revés."""
    rows = called_vs_truth(range(30))
    flips = [r for r in rows if abs(r[2]) > 0.50 and {r[0], r[1]} == {IN, OUT}]
    assert not flips


def test_serve_faults_in_a_simulated_match_come_from_the_line_call():
    match = simulate_match(num_points=6, seed=3, fault_points=(1, 4))
    rng = np.random.default_rng(7)
    keypoints = CAMERA.project(np.c_[COURT_KEYPOINTS_M, np.zeros(14)]) + rng.normal(0, 0.5, (14, 2))
    homography = CourtHomography.from_keypoints(keypoints.ravel())
    ball, players = render_detections(match, CAMERA, seed=3)
    from events import detect_serves

    hits = detect_hits(ball, players, homography, 30)
    serves = detect_serves(ball, players, homography, 30, hits=hits)
    all_hits = sorted(set(hits) | {s["frame"] for s in serves})
    bounces = detect_bounce_events(ball, players, homography, 30, hits=all_hits)
    bounces = locate_bounces(bounces, ball, homography, 30, hits=all_hits,
                             court_keypoints=[keypoints.ravel()] * len(ball))
    points = detect_points(ball, players, hits, bounces, 30, serves=serves)
    called = {b["frame"]: b for b in call_bounces(bounces, points)}
    attempts = [a for p in points for a in p["serve_attempts"] if a["bounce_frame"] is not None]
    assert attempts
    for attempt in attempts:
        bounce = called[attempt["bounce_frame"]]
        assert bounce["area"] == "cuadro de saque"
        assert attempt["call"] == bounce["call"]
        assert attempt["fault"] == (bounce["call"] == OUT)
    assert sum(a["fault"] for a in attempts) >= 1
