from types import SimpleNamespace

import numpy as np
import pytest

from court import COURT_KEYPOINTS_M, CourtHomography
from trackers import PlayerTracker
from trackers.player_selection import FAR_PLAYER, NEAR_PLAYER, select_players

COURT_TO_IMAGE = np.array([[62.0, -9.0, 610.0], [0.0, 16.0, 260.0], [0.0, -0.012, 1.0]])


def project(point_m):
    x, y, w = COURT_TO_IMAGE @ np.array([point_m[0], point_m[1], 1.0])
    return x / w, y / w


def box_at(point_m, height=150):
    """Caja de una persona con los pies en point_m (metros de la pista)."""
    x, y = project(point_m)
    return [x - 25.0, y - height, x + 25.0, y]


@pytest.fixture(scope="module")
def homography():
    pts = np.c_[COURT_KEYPOINTS_M, np.ones(14)] @ COURT_TO_IMAGE.T
    return CourtHomography.from_keypoints((pts[:, :2] / pts[:, 2:]).ravel())


def feet_m(homography, bbox):
    return homography.image_to_court(((bbox[0] + bbox[2]) / 2, bbox[3]))


def test_players_are_renumbered_far_1_and_near_2(homography):
    frames = [{17: box_at((5.0, 25.5)), 4: box_at((5.5, -1.0))} for _ in range(10)]

    selected = select_players(frames, homography)

    assert all(set(frame) == {FAR_PLAYER, NEAR_PLAYER} for frame in selected)
    assert feet_m(homography, selected[0][FAR_PLAYER])[1] < 0  # lejano: detrás del fondo de arriba
    assert feet_m(homography, selected[0][NEAR_PLAYER])[1] > 23.77


def test_officials_and_spectators_are_ignored(homography):
    frame = {
        1: box_at((5.0, -1.5)),  # jugador lejano
        2: box_at((6.0, 25.0)),  # jugador cercano
        3: box_at((-4.5, 11.9)),  # juez de silla, al lado de la red, fuera de la zona de juego
        4: box_at((5.0, 40.0)),  # público detrás del fondo cercano
    }

    selected = select_players([frame] * 5, homography)

    np.testing.assert_allclose(feet_m(homography, selected[0][FAR_PLAYER]), (5.0, -1.5), atol=0.05)
    np.testing.assert_allclose(feet_m(homography, selected[0][NEAR_PLAYER]), (6.0, 25.0), atol=0.05)


def test_a_ball_kid_seen_as_often_as_the_player_does_not_win(homography):
    frame = {
        8: box_at((12.5, -6.5)),  # recogepelotas en la esquina del fondo, dentro de la zona
        3: box_at((5.2, -0.8)),  # jugador lejano, junto al centro del fondo
        4: box_at((5.0, 24.5)),
    }

    selected = select_players([frame] * 20, homography)

    np.testing.assert_allclose(feet_m(homography, selected[0][FAR_PLAYER]), (5.2, -0.8), atol=0.05)


def test_follows_the_player_when_the_tracker_changes_its_id(homography):
    frames = []
    for i in range(40):
        near_id = 2 if i < 20 else 99  # a mitad del clip ByteTrack le da otro ID
        frames.append({1: box_at((5.0, -1.0)), near_id: box_at((3.0 + 0.1 * i, 25.0))})
    # Un recogepelotas aparece en el lado cercano justo cuando cambia el ID, pero lejos del jugador.
    frames[20][50] = box_at((10.5, 28.0))

    selected = select_players(frames, homography)

    xs = [feet_m(homography, frame[NEAR_PLAYER])[0] for frame in selected]
    np.testing.assert_allclose(xs, [3.0 + 0.1 * i for i in range(40)], atol=0.05)


def test_missing_frames_are_interpolated(homography):
    frames = [{1: box_at((5.0, -1.0)), 2: box_at((2.0 + 0.2 * i, 25.0))} for i in range(11)]
    for i in (4, 5, 6):
        del frames[i][2]  # el jugador cercano no se detecta tres fotogramas
    frames[0] = {1: frames[0][1]}  # ni en el primero

    selected = select_players(frames, homography)

    xs = [feet_m(homography, frame[NEAR_PLAYER])[0] for frame in selected]
    assert xs[0] == pytest.approx(2.2, abs=0.05)  # el primero repite el siguiente conocido
    np.testing.assert_allclose(xs[3:8], [2.6, 2.8, 3.0, 3.2, 3.4], atol=0.05)


def test_error_when_one_side_never_has_a_player(homography):
    frames = [{1: box_at((5.0, -1.0))} for _ in range(5)]

    with pytest.raises(ValueError, match="cercano"):
        select_players(frames, homography)


def test_detect_frame_skips_boxes_without_track_id():
    def box(track_id, cls=0.0):
        return SimpleNamespace(
            id=None if track_id is None else SimpleNamespace(tolist=lambda: [float(track_id)]),
            xyxy=SimpleNamespace(tolist=lambda: [[1.0, 2.0, 3.0, 4.0]]),
            cls=SimpleNamespace(tolist=lambda: [cls]),
        )

    results = SimpleNamespace(names={0: "person", 1: "car"}, boxes=[box(None), box(7), box(8, cls=1.0)])
    tracker = PlayerTracker(model_path="no-se-carga.pt")
    tracker._model = SimpleNamespace(track=lambda *args, **kwargs: [results])

    assert tracker.detect_frame(frame=None) == {7: [1.0, 2.0, 3.0, 4.0]}
