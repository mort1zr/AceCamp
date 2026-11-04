import numpy as np
import pytest

from court import COURT_KEYPOINTS_M, COURT_LENGTH, DOUBLES_WIDTH, CourtHomography
from mini_court import MiniCourt

# Homografía "real" de una cámara elevada detrás del fondo: la pista se ve como un trapecio.
TRUE_COURT_TO_IMAGE = np.array(
    [
        [62.0, -9.0, 610.0],
        [0.0, 16.0, 260.0],
        [0.0, -0.012, 1.0],
    ]
)


def project(points_m, matrix=TRUE_COURT_TO_IMAGE):
    pts = np.c_[np.asarray(points_m, dtype=float), np.ones(len(points_m))] @ matrix.T
    return pts[:, :2] / pts[:, 2:]


def synthetic_keypoints(noise_px=0.0, seed=0):
    image_points = project(COURT_KEYPOINTS_M)
    if noise_px:
        image_points = image_points + np.random.default_rng(seed).normal(0, noise_px, image_points.shape)
    return image_points.ravel().tolist()  # mismo formato que CourtLineDetector.predict


def test_synthetic_court_looks_like_a_broadcast_view():
    pts = project(COURT_KEYPOINTS_M)
    far_width = pts[1, 0] - pts[0, 0]
    near_width = pts[3, 0] - pts[2, 0]
    assert near_width > far_width  # el fondo cercano se ve más ancho
    assert pts[2, 1] > pts[0, 1]  # el fondo cercano está más abajo en la imagen


def test_recovers_the_true_homography_from_exact_keypoints():
    homography = CourtHomography.from_keypoints(synthetic_keypoints())

    np.testing.assert_allclose(homography.image_to_court(project(COURT_KEYPOINTS_M)), COURT_KEYPOINTS_M, atol=1e-6)
    assert homography.inliers.all()
    assert homography.mean_reprojection_error(synthetic_keypoints()) < 1e-3


def test_round_trip_of_any_point_on_the_ground():
    homography = CourtHomography.from_keypoints(synthetic_keypoints())
    points_m = np.array([[5.485, 11.885], [-2.0, 26.0], [3.3, 0.5]])  # centro, detrás del fondo, cerca de la red

    back = homography.image_to_court(homography.court_to_image(points_m))

    np.testing.assert_allclose(back, points_m, atol=1e-6)


def test_single_point_in_single_point_out():
    homography = CourtHomography.from_keypoints(synthetic_keypoints())
    corner_px = project(COURT_KEYPOINTS_M[3:4])[0]

    np.testing.assert_allclose(homography.image_to_court(corner_px), (DOUBLES_WIDTH, COURT_LENGTH), atol=1e-6)


def test_reprojection_error_stays_under_5_px_with_detector_noise():
    keypoints = synthetic_keypoints(noise_px=2.0)

    homography = CourtHomography.from_keypoints(keypoints)

    assert homography.mean_reprojection_error(keypoints) < 5.0


def test_ransac_ignores_a_badly_detected_keypoint():
    keypoints = np.array(synthetic_keypoints()).reshape(-1, 2)
    keypoints[12] += (150.0, -90.0)  # la T lejana detectada muy lejos de su sitio

    homography = CourtHomography.from_keypoints(keypoints.ravel())

    assert not homography.inliers[12]
    assert homography.inliers.sum() == 13
    np.testing.assert_allclose(homography.image_to_court(project(COURT_KEYPOINTS_M[:1])), [(0.0, 0.0)], atol=1e-3)


def test_distances_in_meters_are_real_despite_perspective():
    homography = CourtHomography.from_keypoints(synthetic_keypoints())
    # La anchura de dobles mide lo mismo en el fondo lejano y en el cercano, aunque en la imagen no.
    far = homography.image_to_court(project(COURT_KEYPOINTS_M[[0, 1]]))
    near = homography.image_to_court(project(COURT_KEYPOINTS_M[[2, 3]]))

    assert np.linalg.norm(far[1] - far[0]) == pytest.approx(DOUBLES_WIDTH, abs=1e-6)
    assert np.linalg.norm(near[1] - near[0]) == pytest.approx(DOUBLES_WIDTH, abs=1e-6)


@pytest.mark.parametrize("bad", [[1.0, 2.0] * 13, [1.0, 2.0] * 15])
def test_wrong_number_of_keypoints_is_rejected(bad):
    with pytest.raises(ValueError):
        CourtHomography.from_keypoints(bad)


def test_degenerate_keypoints_are_rejected():
    with pytest.raises(ValueError):
        CourtHomography.from_keypoints([100.0, 100.0] * 14)  # todos en el mismo píxel


# ------------------------------------------------------------ mini-pista


def blank_frame():
    return np.zeros((1080, 1920, 3), dtype=np.uint8)


def test_mini_court_keeps_the_court_proportions():
    mini = MiniCourt(blank_frame())
    x0, y0 = mini.meters_to_mini((0, 0))
    x1, y1 = mini.meters_to_mini((DOUBLES_WIDTH, COURT_LENGTH))

    assert (y1 - y0) / (x1 - x0) == pytest.approx(COURT_LENGTH / DOUBLES_WIDTH, rel=0.02)
    assert mini.start_x <= x0 < x1 <= mini.end_x
    assert mini.start_y <= y0 < y1 <= mini.end_y


def test_points_far_outside_the_court_are_clipped_to_the_box():
    mini = MiniCourt(blank_frame())

    assert mini.meters_to_mini((-100, -100)) == (mini.start_x, mini.start_y)
    assert mini.meters_to_mini((100, 100)) == (mini.end_x, mini.end_y)


def test_player_feet_are_projected_to_meters():
    homography = CourtHomography.from_keypoints(synthetic_keypoints())
    feet_px = project([(5.0, 25.0)])[0]  # jugador 1,23 m detrás del fondo cercano
    bbox = [feet_px[0] - 30, feet_px[1] - 160, feet_px[0] + 30, feet_px[1]]

    players_m, ball_m = MiniCourt.court_positions([{1: bbox}], [{}], homography)

    assert players_m[0][1] == pytest.approx((5.0, 25.0), abs=0.05)  # caja redondeada a píxeles enteros
    assert ball_m == [{}]


def test_drawing_does_not_fail_with_missing_ball_positions():
    mini = MiniCourt(blank_frame())
    frames = mini.draw_mini_court([blank_frame()])

    mini.draw_points_on_mini_court(frames, [{1: (float("nan"), float("nan")), 2: (5.0, 3.0)}])

    assert frames[0].any()
