from types import SimpleNamespace

import pytest

from trackers import BallTracker
from trackers.ball_selection import box_center, fill_short_gaps, select_ball


def ball(x, y, conf=0.9, size=8):
    return [x - size / 2, y - size / 2, x + size / 2, y + size / 2, conf]


def straight_flight(num_frames=30, x0=200, y0=300, vx=40, vy=10):
    return [(x0 + vx * i, y0 + vy * i) for i in range(num_frames)]


def centers(selected):
    return [box_center(frame[1]) if 1 in frame else None for frame in selected]


def test_starts_with_the_most_confident_detection():
    frames = [{0: ball(100, 100, conf=0.3), 1: ball(900, 500, conf=0.8)}]

    assert centers(select_ball(frames)) == [(900, 500)]


def test_ignores_a_more_confident_false_positive_far_from_the_trajectory():
    path = straight_flight()
    frames = [{0: ball(x, y, conf=0.5)} for x, y in path]
    for i in range(10, 20):
        frames[i][1] = ball(1600, 900, conf=0.95)  # un logotipo detectado como pelota

    selected = select_ball(frames)

    assert centers(selected) == [pytest.approx(p) for p in path]


def test_frames_without_a_plausible_ball_stay_empty():
    path = straight_flight()
    frames = [{0: ball(x, y)} for x, y in path]
    frames[15] = {0: ball(1800, 50)}  # solo hay un falso positivo lejos de la trayectoria

    selected = select_ball(frames)

    assert selected[15] == {}
    assert centers(selected)[16] == pytest.approx(path[16])  # y se recupera en el siguiente


def test_reacquires_the_ball_after_losing_it_for_long():
    frames = [{0: ball(200 + 40 * i, 300)} for i in range(10)]
    frames += [{} for _ in range(15)]  # 15 fotogramas sin pelota: se reinicia el seguimiento
    frames += [{0: ball(1500, 800)}]  # reaparece lejos (otro punto del partido)

    selected = select_ball(frames)

    assert centers(selected)[-1] == (1500, 800)


def test_gate_scales_with_video_resolution():
    frames = [{0: ball(100, 100)}, {0: ball(100, 100)}, {0: ball(250, 100)}]  # salto de 150 px

    assert select_ball(frames, scale=1.0)[2] != {}  # en 1080p el salto es plausible
    assert select_ball(frames, scale=0.5)[2] == {}  # en 540p equivale a 300 px: no lo es


def test_short_gaps_are_interpolated():
    positions = [{1: [0.0, 0.0, 10.0, 10.0]}, {}, {}, {1: [30.0, 0.0, 40.0, 10.0]}]

    filled = fill_short_gaps(positions, max_gap=5)

    assert filled[1] == {1: [10.0, 0.0, 20.0, 10.0]}
    assert filled[2] == {1: [20.0, 0.0, 30.0, 10.0]}


def test_long_gaps_and_edges_are_not_invented():
    gap = [{} for _ in range(6)]
    positions = [{}] + [{1: [0.0, 0.0, 1.0, 1.0]}] + gap + [{1: [5.0, 5.0, 6.0, 6.0]}] + [{}]

    filled = fill_short_gaps(positions, max_gap=5)

    assert filled == positions


def test_detect_frame_returns_every_candidate_sorted_by_confidence():
    def box(x, conf):
        return SimpleNamespace(xyxy=SimpleNamespace(tolist=lambda: [[x, 0.0, x + 5, 5.0]]),
                               conf=SimpleNamespace(tolist=lambda: [conf]))

    results = SimpleNamespace(boxes=[box(10.0, 0.2), box(50.0, 0.7)])
    tracker = BallTracker(model_path="no-se-carga.pt")
    tracker._model = SimpleNamespace(predict=lambda *args, **kwargs: [results])

    assert tracker.detect_frame(frame=None) == {0: [50.0, 0.0, 55.0, 5.0, 0.7], 1: [10.0, 0.0, 15.0, 5.0, 0.2]}


def test_shot_detection_tolerates_frames_without_ball():
    from test_ball_shots import triangle_trajectory

    detections = triangle_trajectory(num_frames=200, half_period=40)
    for i in range(100, 108):
        detections[i] = {}

    shots = BallTracker(model_path="no-se-carga.pt").get_ball_shot_frames(detections)

    assert len(shots) >= 3


# ---------------------------------------------- detecciones quietas


def test_a_static_mark_on_the_court_is_not_taken_for_the_ball():
    """Una marca de la pista detectada en todos los fotogramas, con más confianza que la pelota:
    el seguimiento se enganchaba a ella cuando perdía la pelota (pelota "congelada")."""
    import numpy as np
    from ball_sim import BroadcastCamera, render_detections, simulate_rally

    from trackers.ball_selection import box_center, select_ball

    rally = simulate_rally(6, seed=4)
    ball, _ = render_detections(rally, BroadcastCamera(), miss_rate=0.2, seed=4)
    mark = [1300.0, 800.0, 1310.0, 810.0, 0.95]
    candidates = [{0: mark, **({1: b[1] + [0.4]} if 1 in b else {})} for b in ball]

    selected = select_ball(candidates)

    on_mark = sum(1 for s in selected if 1 in s and np.hypot(*np.subtract(box_center(s[1]), (1305, 805))) < 5)
    on_ball = sum(1 for s, b in zip(selected, ball) if 1 in s and 1 in b and s[1] == b[1][:4])
    assert on_mark == 0
    assert on_ball >= 0.95 * sum(1 for b in ball if 1 in b)


def test_a_moving_ball_is_never_removed_as_static():
    from trackers.ball_selection import remove_static_candidates

    candidates = [{0: [100 + 6 * i, 500 - 3 * i, 110 + 6 * i, 510 - 3 * i, 0.5]} for i in range(100)]

    assert remove_static_candidates(candidates) == candidates
