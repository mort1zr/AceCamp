"""Simulador de peloteos para los tests de botes, saques y puntos (TA-22a, TA-23, TA-17).

Simula la pelota en 3D (gravedad, botes con pérdida de energía, golpes de un
jugador a otro) y la proyecta con una cámara de retransmisión detrás del fondo
cercano. Devuelve lo mismo que el pipeline: la caja de la pelota y de los
jugadores por fotograma, la homografía de la pista y la verdad de cada bote.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from court import COURT_KEYPOINTS_M, COURT_LENGTH, DOUBLES_WIDTH, NET_Y, CourtHomography

G = 9.81
RESTITUTION = 0.72  # velocidad vertical que conserva la pelota al botar
FRICTION = 0.8  # velocidad horizontal que conserva al botar
PLAYER_HEIGHT_M, PLAYER_WIDTH_M = 1.8, 0.7


class BroadcastCamera:
    """Cámara de 1920x1080 detrás del fondo cercano, elevada, mirando al centro de la pista."""

    def __init__(self, width=1920, height=1080, position=(DOUBLES_WIDTH / 2, COURT_LENGTH + 14.0, 9.0),
                 target=(DOUBLES_WIDTH / 2, NET_Y - 1.0, 0.0), focal=1700.0):
        self.width, self.height = width, height
        eye, target = np.asarray(position, float), np.asarray(target, float)
        forward = (target - eye) / np.linalg.norm(target - eye)
        right = np.cross([0.0, 0.0, 1.0], forward)  # x de la pista hacia la derecha de la imagen
        right /= np.linalg.norm(right)
        down = np.cross(right, forward)
        self.rotation = np.stack([right, down, forward])  # filas: ejes de la cámara (x a la derecha, y abajo)
        self.eye = eye
        self.k = np.array([[focal, 0, width / 2], [0, focal, height / 2], [0, 0, 1.0]])

    def project(self, points_3d):
        pts = (np.atleast_2d(points_3d) - self.eye) @ self.rotation.T
        uv = pts @ self.k.T
        return uv[:, :2] / uv[:, 2:]

    def homography(self):
        ground = np.c_[COURT_KEYPOINTS_M, np.zeros(len(COURT_KEYPOINTS_M))]
        return CourtHomography.from_keypoints(self.project(ground).ravel())


@dataclass
class Rally:
    fps: float
    ball_3d: list  # (x, y, z) por fotograma
    players_m: list  # {1: (x, y), 2: (x, y)} por fotograma
    bounces: list = field(default_factory=list)  # [{"frame", "x_m", "y_m"}]
    shots: list = field(default_factory=list)  # [{"frame", "player"}]


def simulate_rally(num_shots=6, fps=30.0, seed=0, serve=False):
    """Peloteo entre el jugador 1 (fondo lejano) y el 2 (fondo cercano). Empieza golpeando el 2."""
    rng = np.random.default_rng(seed)
    dt_sub = 1.0 / (fps * 20)
    t, frame_t = 0.0, 0.0
    hitter = 2
    # En el fondo, los jugadores esperan la pelota 1,5-3 m detrás de la línea.
    home_y = {1: -rng.uniform(1.5, 3.0), 2: COURT_LENGTH + rng.uniform(1.5, 3.0)}
    players = {1: np.array([DOUBLES_WIDTH / 2, home_y[1]]), 2: np.array([DOUBLES_WIDTH / 2, home_y[2]])}
    start_height = 2.6 if serve else rng.uniform(0.7, 1.2)
    pos = np.array([players[2][0] + 0.3, players[2][1] - 0.4, start_height])
    if serve:
        players[2][1] = COURT_LENGTH + 0.3  # el saque se hace desde la línea de fondo
        pos = np.array([DOUBLES_WIDTH / 2 + 0.8, COURT_LENGTH + 0.1, start_height])
    rally = Rally(fps, [], [])

    for shot_index in range(num_shots):
        receiver = 1 if hitter == 2 else 2
        # Bote objetivo en la mitad del rival (en el saque, en el cuadro de saque).
        if serve and shot_index == 0:
            target = np.array([rng.uniform(4.2, 5.2), rng.uniform(NET_Y - 6.0, NET_Y - 1.5)])
        elif receiver == 1:
            target = np.array([rng.uniform(1.5, 9.5), rng.uniform(1.0, NET_Y - 2.0)])
        else:
            target = np.array([rng.uniform(1.5, 9.5), rng.uniform(NET_Y + 2.0, COURT_LENGTH - 1.0)])
        flight = rng.uniform(0.55, 0.9) if not (serve and shot_index == 0) else 0.55
        vel = np.array([(target[0] - pos[0]) / flight, (target[1] - pos[1]) / flight,
                        (0.5 * G * flight ** 2 - pos[2]) / flight])
        rally.shots.append({"frame": int(round(t * fps)), "player": hitter})
        bounced = False
        receiver_y = players[receiver][1]
        shot_start = t
        while True:
            vel[2] -= G * dt_sub
            pos = pos + vel * dt_sub
            t += dt_sub
            if pos[2] <= 0 and vel[2] < 0:
                pos[2] = 0.0
                impact_speed = -vel[2]
                vel[2] = -vel[2] * RESTITUTION
                vel[:2] *= FRICTION
                # Cuentan los botes visibles (una bola corta puede botar dos veces antes del golpe);
                # los rebotes diminutos de una pelota que ya rueda no se etiquetarían.
                if impact_speed > 2.0:
                    rally.bounces.append({"frame": int(round(t * fps)), "x_m": float(pos[0]), "y_m": float(pos[1])})
                if not bounced:
                    first_bounce_t = t
                bounced = True
            # El receptor se mueve hacia donde va a pasar la pelota (hasta 6 m/s) para golpearla
            # a un brazo de distancia.
            target_x = pos[0] - 0.6
            players[receiver][0] += np.clip(target_x - players[receiver][0], -6 * dt_sub, 6 * dt_sub)
            # Quien acaba de golpear vuelve detrás de su línea de fondo.
            players[hitter][1] += np.clip(home_y[hitter] - players[hitter][1], -4 * dt_sub, 4 * dt_sub)
            if frame_t + 1 / fps <= t:
                frame_t += 1 / fps
                rally.ball_3d.append(tuple(pos))
                rally.players_m.append({k: tuple(v) for k, v in players.items()})
            reached = pos[1] <= receiver_y + 0.8 if receiver == 1 else pos[1] >= receiver_y - 0.8
            # Si la bola es corta, el receptor se adelanta y la golpea al bajar, antes del segundo bote.
            falling_low = bounced and t - first_bounce_t > 0.25 and vel[2] < 0 and pos[2] < 0.7
            last_shot = shot_index == num_shots - 1
            if bounced and t - first_bounce_t > 0.2 and (reached or falling_low) and not last_shot:
                players[receiver][1] = pos[1] + (-0.5 if receiver == 1 else 0.5)
                break
            if last_shot and bounced and t - first_bounce_t > 0.5:
                break  # el último golpe es un ganador: se sigue 0,5 s tras su bote
            if t - shot_start > 5:
                raise RuntimeError("la pelota no llegó al receptor")
        hitter = receiver
    return rally


def render_detections(rally, camera, noise_px=1.5, miss_rate=0.03, seed=0):
    """Cajas de pelota y jugadores por fotograma, como las devuelve el pipeline."""
    rng = np.random.default_rng(seed + 100)
    ball, players = [], []
    for ball_3d, players_m in zip(rally.ball_3d, rally.players_m):
        frame_players = {}
        for pid, (x, y) in players_m.items():
            feet = camera.project([x, y, 0.0])[0]
            head = camera.project([x, y, PLAYER_HEIGHT_M])[0]
            half = abs(camera.project([x + PLAYER_WIDTH_M / 2, y, 0.0])[0][0] - feet[0])
            frame_players[pid] = [feet[0] - half, head[1], feet[0] + half, feet[1]]
        players.append(frame_players)
        if ball_3d is None or rng.random() < miss_rate:
            ball.append({})
            continue
        cx, cy = camera.project(ball_3d)[0] + rng.normal(0, noise_px, 2)
        ball.append({1: [cx - 6, cy - 6, cx + 6, cy + 6]})
    return ball, players
