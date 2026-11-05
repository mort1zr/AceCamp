import cv2
import numpy as np
import pytest

from court import COURT_KEYPOINTS_M, COURT_LINES, CourtHomography, per_frame, refine_keypoints, track_court

COURT_TO_IMAGE = np.array([[62.0, -9.0, 610.0], [0.0, 16.0, 260.0], [0.0, -0.012, 1.0]])


def true_keypoints(matrix=COURT_TO_IMAGE):
    pts = np.c_[COURT_KEYPOINTS_M, np.ones(14)] @ matrix.T
    return pts[:, :2] / pts[:, 2:]


def court_image(keypoints, line_width=5):
    """Fotograma 1080p con las líneas blancas de la pista sobre fondo verde."""
    img = np.full((1080, 1920, 3), (60, 120, 60), np.uint8)
    for a, b in COURT_LINES:
        cv2.line(img, tuple(np.round(keypoints[a]).astype(int)), tuple(np.round(keypoints[b]).astype(int)),
                 (240, 240, 240), line_width, cv2.LINE_AA)
    return img


# ------------------------------------------------------- refinamiento


def test_refinement_snaps_noisy_keypoints_to_the_line_crossings():
    truth = true_keypoints()
    noisy = truth + np.random.default_rng(1).uniform(-8, 8, truth.shape)

    refined = refine_keypoints(court_image(truth), noisy.ravel()).reshape(-1, 2)

    error_before = np.linalg.norm(noisy - truth, axis=1).mean()
    error_after = np.linalg.norm(refined - truth, axis=1).mean()
    assert error_before > 4.0
    assert error_after < 2.0  # criterio de TA-11: < 4 px


def test_refinement_keeps_points_where_there_are_no_lines():
    truth = true_keypoints()
    blank = np.full((1080, 1920, 3), (60, 120, 60), np.uint8)

    refined = refine_keypoints(blank, truth.ravel())

    np.testing.assert_allclose(refined, truth.ravel())


def test_refinement_keeps_points_too_close_to_the_image_border():
    keypoints = true_keypoints()
    keypoints[0] = (3.0, 3.0)

    refined = refine_keypoints(court_image(true_keypoints()), keypoints.ravel()).reshape(-1, 2)

    np.testing.assert_allclose(refined[0], (3.0, 3.0))


# ---------------------------------------------- seguimiento en el tiempo


class Detector:
    """Doble del detector: devuelve los puntos clave que se le indiquen por fotograma."""

    def __init__(self, keypoints_for_frame):
        self.keypoints_for_frame = keypoints_for_frame
        self.calls = []

    def __call__(self, frame):
        self.calls.append(frame)
        return self.keypoints_for_frame(frame).ravel()


def test_redetects_every_n_frames_and_holds_in_between():
    detector = Detector(lambda i: true_keypoints())

    keypoints, homographies = track_court(list(range(70)), detector, redetect_every=30)

    assert detector.calls == [0, 30, 60]
    assert len(keypoints) == len(homographies) == 70
    assert homographies[29] is homographies[0]


def test_smoothing_reduces_the_jitter_of_the_cnn():
    truth = true_keypoints()
    rng = np.random.default_rng(3)
    jitter = {i: rng.normal(0, 4, truth.shape) for i in range(0, 300, 10)}
    detector = Detector(lambda i: truth + jitter[i])

    keypoints, _ = track_court(list(range(300)), detector, redetect_every=10, smoothing=0.3)

    raw = np.mean([np.linalg.norm(jitter[i], axis=1).mean() for i in jitter])
    smoothed = np.mean([np.linalg.norm(keypoints[i].reshape(-1, 2) - truth, axis=1).mean() for i in range(100, 300)])
    assert smoothed < 0.7 * raw


def test_a_camera_move_resets_instead_of_blending():
    moved = COURT_TO_IMAGE.copy()
    moved[0, 2] += 120  # la cámara se desplaza 120 px a la derecha
    detector = Detector(lambda i: true_keypoints() if i < 30 else true_keypoints(moved))

    keypoints, _ = track_court(list(range(40)), detector, redetect_every=30, smoothing=0.3)

    np.testing.assert_allclose(keypoints[30].reshape(-1, 2), true_keypoints(moved))


def test_camera_cuts_force_a_detection():
    detector = Detector(lambda i: true_keypoints())

    track_court(list(range(50)), detector, redetect_every=30, cut_frames=[12])

    assert detector.calls == [0, 12, 30]


def test_an_invalid_detection_keeps_the_previous_court():
    def keypoints_for(i):
        return true_keypoints() if i == 0 else np.full((14, 2), 50.0)  # pista tapada: todo en un punto

    keypoints, homographies = track_court(list(range(40)), Detector(keypoints_for), redetect_every=30)

    np.testing.assert_allclose(keypoints[35].reshape(-1, 2), true_keypoints())
    assert homographies[35] is homographies[0]


def test_an_invalid_first_detection_is_an_error():
    with pytest.raises(ValueError):
        track_court([0], Detector(lambda i: np.full((14, 2), 50.0)))


def test_empty_video():
    assert track_court([], Detector(lambda i: true_keypoints())) == ([], [])


def test_per_frame_accepts_one_or_many_homographies():
    h = CourtHomography.from_keypoints(true_keypoints().ravel())

    assert per_frame(h, 3) == [h, h, h]
    assert per_frame([h, h], 2) == [h, h]
    with pytest.raises(ValueError):
        per_frame([h], 2)
