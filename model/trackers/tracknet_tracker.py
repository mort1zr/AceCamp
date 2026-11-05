"""Detector de pelota tipo TrackNet (TA-14b), alternativo al YOLO de la pelota.

TrackNet (Huang et al., 2019, https://arxiv.org/abs/1907.03698) mira 3 fotogramas
seguidos a la vez: por eso sigue viendo la pelota cuando está borrosa o casi tapada,
que es donde falla un detector de un solo fotograma. Su salida es un mapa de calor
(256 niveles por píxel) con la pelota en el máximo.

La arquitectura se define aquí según el artículo (codificador tipo VGG16 y decodificador
simétrico), con los nombres de capa de la implementación pública yastrebksv/TrackNet
para poder cargar sus pesos en la comparación de TA-14b. Esos pesos no tienen licencia
publicada: para usarlos en la plataforma hay que pedir permiso o entrenar los nuestros.

Se usa como BallTracker (misma interfaz: detect_frame devuelve los candidatos del
fotograma), así que selección, botes, saques y puntos no cambian.
"""

from __future__ import annotations

from collections import deque

import cv2
import numpy as np

from .ball_tracker import BallTracker

INPUT_WIDTH, INPUT_HEIGHT = 640, 360
HEATMAP_THRESHOLD = 127  # nivel mínimo (0-255) del máximo del mapa para aceptar la pelota
BALL_RADIUS_INPUT_PX = 4  # radio de la caja devuelta, en píxeles de la entrada 640x360


def build_model():
    """Red TrackNet: 9 canales de entrada (3 fotogramas RGB) y 256 niveles por píxel."""
    import torch.nn as nn

    class ConvBlock(nn.Module):
        def __init__(self, in_channels, out_channels):
            super().__init__()
            self.block = nn.Sequential(nn.Conv2d(in_channels, out_channels, 3, padding=1), nn.ReLU(),
                                       nn.BatchNorm2d(out_channels))

        def forward(self, x):
            return self.block(x)

    class TrackNet(nn.Module):
        def __init__(self, out_channels=256):
            super().__init__()
            self.out_channels = out_channels
            channels = [(9, 64), (64, 64), "pool", (64, 128), (128, 128), "pool", (128, 256), (256, 256), (256, 256),
                        "pool", (256, 512), (512, 512), (512, 512), "up", (512, 256), (256, 256), (256, 256), "up",
                        (256, 128), (128, 128), "up", (128, 64), (64, 64), (64, out_channels)]
            conv, pool, up = 0, 0, 0
            self.order = []
            for item in channels:
                if item == "pool":
                    pool += 1
                    setattr(self, f"pool{pool}", nn.MaxPool2d(2, 2))
                    self.order.append(f"pool{pool}")
                elif item == "up":
                    up += 1
                    setattr(self, f"ups{up}", nn.Upsample(scale_factor=2))
                    self.order.append(f"ups{up}")
                else:
                    conv += 1
                    setattr(self, f"conv{conv}", ConvBlock(*item))
                    self.order.append(f"conv{conv}")

        def forward(self, x):
            batch = x.size(0)
            for name in self.order:
                x = getattr(self, name)(x)
            return x.reshape(batch, self.out_channels, -1)

    return TrackNet()


def heatmap_peak(levels, threshold=HEATMAP_THRESHOLD):
    """(x, y, nivel) del máximo del mapa (INPUT_HEIGHT x INPUT_WIDTH, niveles 0-255), o None."""
    levels = np.asarray(levels).reshape(INPUT_HEIGHT, INPUT_WIDTH)
    peak = int(levels.max())
    if peak < threshold:
        return None
    mask = (levels >= threshold).astype(np.uint8)
    count, labels, stats, centroids = cv2.connectedComponentsWithStats(mask)
    if count <= 1:
        return None
    y_max, x_max = np.unravel_index(int(levels.argmax()), levels.shape)
    component = labels[y_max, x_max]
    x, y = centroids[component]
    return float(x), float(y), peak


class TrackNetBallTracker(BallTracker):
    """Detector de pelota con TrackNet. Cada fotograma se analiza junto a los dos anteriores.

    Hereda de BallTracker la selección, la interpolación y el dibujo: solo cambia la detección.
    """

    def __init__(self, model_path, device=None, threshold=HEATMAP_THRESHOLD, **_):
        super().__init__(model_path, device=device)
        self.threshold = threshold
        self.history = deque(maxlen=3)

    @property
    def model(self):
        if self._model is None:
            import torch

            self._torch = torch
            device = self.device or ("cuda" if torch.cuda.is_available() else "cpu")
            self._device = device
            model = build_model()
            model.load_state_dict(torch.load(self.model_path, map_location=device, weights_only=True))
            self._model = model.to(device).eval()
        return self._model

    def detect_frame(self, frame):
        """{0: [x1, y1, x2, y2, confianza]} con la pelota, o {} (también en los dos primeros fotogramas)."""
        height, width = frame.shape[:2]
        self.history.append(cv2.resize(frame, (INPUT_WIDTH, INPUT_HEIGHT)))
        if len(self.history) < 3:
            return {}
        model = self.model
        stacked = np.concatenate([self.history[2], self.history[1], self.history[0]], axis=2)  # actual, -1, -2
        tensor = np.rollaxis(stacked.astype(np.float32) / 255.0, 2, 0)[None]
        with self._torch.no_grad():
            out = model(self._torch.from_numpy(tensor).to(self._device))
        levels = out.argmax(dim=1).cpu().numpy()[0]
        peak = heatmap_peak(levels, self.threshold)
        if peak is None:
            return {}
        x, y, level = peak
        sx, sy = width / INPUT_WIDTH, height / INPUT_HEIGHT
        r = BALL_RADIUS_INPUT_PX
        return {0: [(x - r) * sx, (y - r) * sy, (x + r) * sx, (y + r) * sy, level / 255.0]}
