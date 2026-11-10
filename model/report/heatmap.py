"""Mapas de calor de los jugadores (TA-33).

Las posiciones de positions.csv (TA-32) se acumulan en una cuadrícula de CELL_M (0,5 m) sobre la
pista y sus alrededores, en segundos (cada fotograma vale 1/fps). Luego se suaviza con un
filtro gaussiano y se dibuja sobre un plano de la pista a escala, uno por jugador.

La escala de color es común: con el mismo vmax, el mismo color significa el mismo tiempo en
todos los mapas, para comparar jugadores y sets (TA-34). El suavizado es lineal, así que los
mapas por set suman exactamente el del partido.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from court import COURT_KEYPOINTS_M, COURT_LENGTH, DOUBLES_WIDTH
from court.court_model import COURT_LINES

CELL_M = 0.5
MARGIN_X_M, MARGIN_Y_M = 3.0, 6.0  # los jugadores juegan por fuera de las líneas
SMOOTH_SIGMA_CELLS = 1.5
PIXELS_PER_METER = 20


def grid_shape(cell=CELL_M):
    """(filas, columnas) de la cuadrícula: a lo largo (y) y a lo ancho (x) de la pista con márgenes."""
    rows = int(np.ceil((COURT_LENGTH + 2 * MARGIN_Y_M) / cell))
    cols = int(np.ceil((DOUBLES_WIDTH + 2 * MARGIN_X_M) / cell))
    return rows, cols


def accumulate(rows, player, fps, cell=CELL_M, set_number=None):
    """Segundos que pasó el jugador en cada celda (sin suavizar). Con set_number, solo ese set.

    rows: filas de positions.csv (dicts con player, x_m, y_m y set). Las posiciones fuera de la
    cuadrícula se ajustan al borde para no perder tiempo.
    """
    shape = grid_shape(cell)
    grid = np.zeros(shape, np.float64)
    for row in rows:
        if int(row["player"]) != player or (set_number is not None and int(row["set"]) != set_number):
            continue
        i = int((float(row["y_m"]) + MARGIN_Y_M) // cell)
        j = int((float(row["x_m"]) + MARGIN_X_M) // cell)
        grid[min(max(i, 0), shape[0] - 1), min(max(j, 0), shape[1] - 1)] += 1.0 / fps
    return grid


def smooth(grid, sigma_cells=SMOOTH_SIGMA_CELLS):
    """Suavizado gaussiano (lineal: suavizar la suma = sumar los suavizados)."""
    if sigma_cells <= 0:
        return grid.copy()
    return cv2.GaussianBlur(grid, (0, 0), sigmaX=sigma_cells, sigmaY=sigma_cells, borderType=cv2.BORDER_CONSTANT)


def _to_pixels(x_m, y_m, ppm=PIXELS_PER_METER):
    return int(round((x_m + MARGIN_X_M) * ppm)), int(round((y_m + MARGIN_Y_M) * ppm))


def render(grid, vmax, title="", ppm=PIXELS_PER_METER, cell=CELL_M):
    """Imagen BGR del mapa sobre la pista a escala. vmax: segundos que corresponden al color máximo
    (común entre mapas para poder compararlos)."""
    height = int(round((COURT_LENGTH + 2 * MARGIN_Y_M) * ppm))
    width = int(round((DOUBLES_WIDTH + 2 * MARGIN_X_M) * ppm))
    scaled = np.clip(grid / vmax, 0, 1) if vmax > 0 else np.zeros_like(grid)
    big = cv2.resize(scaled.astype(np.float32), (int(grid.shape[1] * cell * ppm), int(grid.shape[0] * cell * ppm)),
                     interpolation=cv2.INTER_LINEAR)[:height, :width]
    colored = cv2.applyColorMap((big * 255).astype(np.uint8), cv2.COLORMAP_JET)
    court = np.full((height, width, 3), (70, 120, 70), np.uint8)  # verde de pista
    alpha = np.clip(big * 1.5, 0, 0.85)[..., None]  # donde no estuvo, se ve la pista
    image = (court * (1 - alpha) + colored * alpha).astype(np.uint8)
    for a, b in COURT_LINES:
        cv2.line(image, _to_pixels(*COURT_KEYPOINTS_M[a], ppm), _to_pixels(*COURT_KEYPOINTS_M[b], ppm),
                 (255, 255, 255), 2, cv2.LINE_AA)
    net_y = COURT_LENGTH / 2
    cv2.line(image, _to_pixels(-0.9, net_y, ppm), _to_pixels(DOUBLES_WIDTH + 0.9, net_y, ppm), (200, 200, 200), 3)
    if title:
        cv2.putText(image, title, (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA)
    return image


def heatmaps(rows, fps, set_number=None, cell=CELL_M):
    """Mapas suavizados de los dos jugadores: {1: grid, 2: grid}."""
    return {p: smooth(accumulate(rows, p, fps, cell, set_number)) for p in (1, 2)}


def write_heatmaps(rows, fps, out_dir, sets=None):
    """PNG por jugador del partido completo (heatmap_J1.png, heatmap_J2.png) y, si se piden sets,
    de cada set (heatmap_set2_J1.png...). Escala común a todos. Devuelve {nombre: ruta}."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    maps = {("partido", p): grid for p, grid in heatmaps(rows, fps).items()}
    for set_number in sets or []:
        maps.update({(f"set{set_number}", p): grid for p, grid in heatmaps(rows, fps, set_number).items()})
    vmax = max((float(grid.max()) for grid in maps.values()), default=0.0)
    written = {}
    for (scope, player), grid in maps.items():
        name = f"heatmap_J{player}.png" if scope == "partido" else f"heatmap_{scope}_J{player}.png"
        label = f"J{player} {'(fondo)' if player == 1 else '(cerca)'} - {scope}"
        cv2.imwrite(str(out_dir / name), render(grid, vmax, label))
        written[name] = out_dir / name
    return written
