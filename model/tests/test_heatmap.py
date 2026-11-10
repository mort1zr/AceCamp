"""Tests de TA-33: mapa de calor de cada jugador."""

import cv2
import numpy as np
import pytest

from court import COURT_LENGTH, DOUBLES_WIDTH
from report.heatmap import CELL_M, MARGIN_X_M, MARGIN_Y_M, accumulate, grid_shape, heatmaps, render, write_heatmaps

FPS = 30


def stay(player, x, y, frames, set_number=1):
    return [{"player": player, "x_m": x, "y_m": y, "set": set_number} for _ in range(frames)]


def test_time_is_accumulated_in_half_meter_cells():
    rows = stay(1, 5.4, -1.2, 60) + stay(2, 3.0, 25.0, 30)
    grid1 = accumulate(rows, 1, FPS)
    assert grid1.sum() == pytest.approx(2.0)  # 60 fotogramas a 30 fps = 2 s
    i, j = np.unravel_index(grid1.argmax(), grid1.shape)
    assert (i, j) == (int((-1.2 + MARGIN_Y_M) // CELL_M), int((5.4 + MARGIN_X_M) // CELL_M))
    assert accumulate(rows, 2, FPS).sum() == pytest.approx(1.0)


def test_positions_outside_the_grid_are_clamped_to_the_border():
    grid = accumulate(stay(1, -50.0, 99.0, 3), 1, FPS)
    assert grid.sum() == pytest.approx(0.1) and grid[-1, 0] == pytest.approx(0.1)


def test_synthetic_positions_produce_the_expected_map():
    """Criterio de TA-33: un jugador que pasa el doble de tiempo en un sitio da el doble de calor
    allí, y el mapa suavizado conserva el tiempo total."""
    rows = stay(1, 2.0, -1.0, 90) + stay(1, 9.0, -1.0, 45)
    grid = heatmaps(rows, FPS)[1]
    left = grid[int((-1.0 + MARGIN_Y_M) // CELL_M), int((2.0 + MARGIN_X_M) // CELL_M)]
    right = grid[int((-1.0 + MARGIN_Y_M) // CELL_M), int((9.0 + MARGIN_X_M) // CELL_M)]
    assert left == pytest.approx(2 * right, rel=0.01)
    assert grid.sum() == pytest.approx(4.5, rel=0.01)  # 135 fotogramas
    assert grid.shape == grid_shape()


def test_png_per_player_on_a_scaled_court(tmp_path):
    rows = stay(1, 5.0, -1.0, 60) + stay(2, 5.0, COURT_LENGTH + 1.0, 60)
    written = write_heatmaps(rows, FPS, tmp_path)
    assert set(written) == {"heatmap_J1.png", "heatmap_J2.png"}
    image = cv2.imread(str(written["heatmap_J1.png"]))
    assert image.shape[0] > image.shape[1]  # la pista, a lo largo
    assert image.shape[1] == pytest.approx((DOUBLES_WIDTH + 2 * MARGIN_X_M) * 20, abs=2)
    blank = render(np.zeros(grid_shape()), 0)
    assert blank.any()  # sin datos se ve la pista vacía
