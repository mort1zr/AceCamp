"""Homografía entre la imagen y el plano de la pista (TA-10).

Con los 14 puntos clave detectados en la imagen y sus posiciones reales en
metros se estima la homografía con RANSAC. Así cualquier punto del suelo
(los pies de un jugador, el bote de la pelota) se convierte a metros reales,
con perspectiva incluida.

Solo es exacta para puntos que están en el suelo: un punto en el aire (la
pelota en vuelo) se proyecta donde corta el suelo la línea que lo une con la
cámara, más lejos de lo que está en realidad.
"""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from .court_model import COURT_KEYPOINTS_M, NUM_KEYPOINTS

# Distancia máxima (en píxeles) para que RANSAC acepte un punto clave como válido.
RANSAC_REPROJECTION_THRESHOLD_PX = 10.0
MIN_INLIERS = 6


def keypoints_to_array(keypoints) -> np.ndarray:
    """Acepta la salida del detector ([x0, y0, x1, y1, ...]) o una matriz (14, 2)."""
    points = np.asarray(keypoints, dtype=np.float64).reshape(-1, 2)
    if points.shape != (NUM_KEYPOINTS, 2):
        raise ValueError(f"se esperaban {NUM_KEYPOINTS} puntos clave, llegaron {points.shape[0]}")
    return points


def _apply(matrix: np.ndarray, points) -> np.ndarray:
    pts = np.asarray(points, dtype=np.float64)
    single = pts.ndim == 1
    pts = pts.reshape(-1, 1, 2)
    out = cv2.perspectiveTransform(pts, matrix).reshape(-1, 2)
    return out[0] if single else out


@dataclass(frozen=True)
class CourtHomography:
    image_to_court_matrix: np.ndarray  # 3x3: píxeles → metros
    court_to_image_matrix: np.ndarray  # 3x3: metros → píxeles
    inliers: np.ndarray  # máscara booleana de los puntos clave aceptados por RANSAC

    @classmethod
    def from_keypoints(cls, image_keypoints, threshold_px: float = RANSAC_REPROJECTION_THRESHOLD_PX):
        """Estima la homografía a partir de los 14 puntos clave detectados en la imagen."""
        image_points = keypoints_to_array(image_keypoints)
        court_to_image, mask = cv2.findHomography(COURT_KEYPOINTS_M, image_points, cv2.RANSAC, threshold_px)
        if court_to_image is None:
            raise ValueError("no se pudo estimar la homografía con estos puntos clave")
        inliers = mask.ravel().astype(bool)
        if inliers.sum() < MIN_INLIERS:
            raise ValueError(f"solo {inliers.sum()} puntos clave coherentes; se necesitan al menos {MIN_INLIERS}")
        return cls(
            image_to_court_matrix=np.linalg.inv(court_to_image),
            court_to_image_matrix=court_to_image,
            inliers=inliers,
        )

    def image_to_court(self, points) -> np.ndarray:
        """Píxeles (x, y) → metros (x, y) sobre la pista. Acepta un punto o una lista de puntos."""
        return _apply(self.image_to_court_matrix, points)

    def court_to_image(self, points) -> np.ndarray:
        """Metros (x, y) sobre la pista → píxeles (x, y)."""
        return _apply(self.court_to_image_matrix, points)

    def reprojection_errors(self, image_keypoints) -> np.ndarray:
        """Distancia en píxeles entre cada punto clave y la proyección de su posición real."""
        image_points = keypoints_to_array(image_keypoints)
        projected = self.court_to_image(COURT_KEYPOINTS_M)
        return np.linalg.norm(projected - image_points, axis=1)

    def mean_reprojection_error(self, image_keypoints) -> float:
        return float(self.reprojection_errors(image_keypoints).mean())


def per_frame(homography, num_frames):
    """Acepta una homografía para todo el vídeo o una lista con una por fotograma."""
    if isinstance(homography, CourtHomography):
        return [homography] * num_frames
    homographies = list(homography)
    if len(homographies) != num_frames:
        raise ValueError(f"se esperaban {num_frames} homografías, llegaron {len(homographies)}")
    return homographies
