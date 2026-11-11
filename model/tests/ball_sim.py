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
from court.court_model import ALLEY_WIDTH

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


def simulate_rally(num_shots=6, fps=30.0, seed=0, serve=False, serve_side="derecha", serve_fault=False,
                   last_out=False, last_net=False):
    """Peloteo entre el jugador 1 (fondo lejano) y el 2 (fondo cercano). Empieza golpeando el 2.

    last_out: el último golpe bota fuera de la pista de individuales (por un lado o largo), a
    0,4-2 m de la línea.
    last_net: el último golpe se queda en la red: cae y bota en el lado de quien golpeó, a 0,5-2 m
    de la red.
    """
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
        # Visto desde la cámara (detrás del jugador 2), la derecha del sacador es x mayor.
        serve_x = DOUBLES_WIDTH / 2 + (0.8 if serve_side == "derecha" else -0.8)
        players[2][0] = serve_x
        pos = np.array([serve_x, COURT_LENGTH + 0.1, start_height])
    rally = Rally(fps, [], [])

    for shot_index in range(num_shots):
        receiver = 1 if hitter == 2 else 2
        # Bote objetivo en la mitad del rival (en el saque, en el cuadro de saque).
        if serve and shot_index == 0:
            # Saque cruzado: al cuadro de saque del otro lado de la línea central.
            box_x = (1.8, 5.0) if serve_side == "derecha" else (6.0, 9.2)
            target = np.array([rng.uniform(*box_x), rng.uniform(NET_Y - 6.0, NET_Y - 1.5)])
            if serve_fault:  # larga: bota 1,5-3 m detrás de la línea de saque
                target[1] = NET_Y - 6.4 - rng.uniform(1.5, 3.0)
        elif receiver == 1:
            target = np.array([rng.uniform(1.5, 9.5), rng.uniform(1.0, NET_Y - 2.0)])
        else:
            target = np.array([rng.uniform(1.5, 9.5), rng.uniform(NET_Y + 2.0, COURT_LENGTH - 1.0)])
        if shot_index < num_shots - 1 and not (serve and shot_index == 0):
            # Una pelota que se devuelve cae al alcance del receptor (hasta ~3 m a cada lado): en un
            # partido real nadie golpea una pelota a la que no llega. El último golpe no se limita.
            reach = players[receiver][0]
            target[0] = float(np.clip(target[0], max(1.5, reach - 3.0), min(9.5, reach + 3.0)))
        if last_out and shot_index == num_shots - 1:
            miss = rng.uniform(0.4, 2.0)
            kind = rng.integers(3)
            if kind == 0:  # ancha por la izquierda
                target[0] = ALLEY_WIDTH - miss
            elif kind == 1:  # ancha por la derecha
                target[0] = DOUBLES_WIDTH - ALLEY_WIDTH + miss
            else:  # larga
                target[1] = -miss if receiver == 1 else COURT_LENGTH + miss
        if last_net and shot_index == num_shots - 1:
            short = rng.uniform(0.5, 2.0)
            target[1] = NET_Y + short if hitter == 2 else NET_Y - short
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
            if frame_t <= t:  # el fotograma i es el instante i / fps
                frame_t += 1 / fps
                rally.ball_3d.append(tuple(pos))
                rally.players_m.append({k: tuple(v) for k, v in players.items()})
            reached = pos[1] <= receiver_y + 0.8 if receiver == 1 else pos[1] >= receiver_y - 0.8
            # Si la bola es corta, el receptor se adelanta y la golpea al bajar, antes del segundo bote.
            falling_low = bounced and t - first_bounce_t > 0.25 and vel[2] < 0 and pos[2] < 0.7
            last_shot = shot_index == num_shots - 1
            if bounced and t - first_bounce_t > 0.2 and (reached or falling_low) and not last_shot:
                players[receiver][1] = pos[1] + (-0.5 if receiver == 1 else 0.5)
                players[receiver][0] = pos[0] - 0.6  # la golpea a un brazo de distancia
                break
            if last_shot and bounced and t - first_bounce_t > 0.5:
                break  # el último golpe es un ganador: se sigue 0,5 s tras su bote
            if t - shot_start > 5:
                raise RuntimeError("la pelota no llegó al receptor")
        hitter = receiver
    return rally


def render_detections(rally, camera, noise_px=1.5, miss_rate=0.03, seed=0, occlusion_rate=0.0):
    """Cajas de pelota y jugadores por fotograma, como las devuelve el pipeline.

    Una pelota fuera del encuadre no se detecta. occlusion_rate: probabilidad de perder la pelota
    en cada fotograma en que está delante de un jugador (en vídeo real el detector la pierde a
    menudo cuando se solapa con el jugador, justo en el golpe).
    """
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
        if not (0 <= cx < camera.width and 0 <= cy < camera.height):
            ball.append({})
            continue
        if occlusion_rate and any(x1 <= cx <= x2 and y1 <= cy <= y2 for x1, y1, x2, y2 in frame_players.values()) \
                and rng.random() < occlusion_rate:
            ball.append({})
            continue
        ball.append({1: [cx - 6, cy - 6, cx + 6, cy + 6]})
    return ball, players


@dataclass
class Match:
    fps: float
    ball_3d: list
    players_m: list
    bounces: list = field(default_factory=list)
    shots: list = field(default_factory=list)
    serves: list = field(default_factory=list)  # [{"frame", "player", "side"}]
    points: list = field(default_factory=list)  # [{"start", "end", "server", "winner", "how"}]


def _mirror(rally):
    """El mismo peloteo girado 180° sobre la pista: saca el jugador 1 (fondo lejano)."""
    swap = {1: 2, 2: 1}
    rally.ball_3d = [None if b is None else (DOUBLES_WIDTH - b[0], COURT_LENGTH - b[1], b[2]) for b in rally.ball_3d]
    rally.players_m = [{swap[k]: (DOUBLES_WIDTH - x, COURT_LENGTH - y) for k, (x, y) in p.items()}
                       for p in rally.players_m]
    rally.bounces = [{**b, "x_m": DOUBLES_WIDTH - b["x_m"], "y_m": COURT_LENGTH - b["y_m"]} for b in rally.bounces]
    rally.shots = [{**s, "player": swap[s["player"]]} for s in rally.shots]
    return rally


def simulate_match(num_points=4, fps=30.0, seed=0, max_shots=8, fault_points=(), out_points=(),
                   double_fault_points=(), net_points=()):
    """Varios puntos seguidos: pausa sin pelota, lanzamiento del saque y peloteo.

    Saca el jugador 2 dos puntos y luego el 1 otros dos, desde la derecha y la izquierda
    alternadamente (la derecha del sacador, mirando a la red). El
    inicio de cada punto es el primer fotograma del lanzamiento de la pelota; el fin,
    el último fotograma con la pelota en juego. En los puntos de fault_points el primer
    saque es falta (bota largo) y, tras una pausa, viene el segundo saque.

    Cada punto lleva su ganador real (winner) y cómo acabó (how):
    - "ganador": el último golpe bota dentro y el rival no llega (gana quien lo dio);
    - "fuera": en out_points el último golpe bota fuera (gana el rival de quien lo dio);
    - "doble falta": en double_fault_points los dos saques son falta (gana el receptor);
    - "red": en net_points el último golpe se queda en la red (gana el rival de quien lo dio).
    """
    rng = np.random.default_rng(seed + 1000)
    match = Match(fps, [], [])
    for point in range(num_points):
        server = 2 if point % 4 < 2 else 1
        serve_side = "derecha" if point % 2 == 0 else "izquierda"
        pause = int(rng.uniform(3.0, 7.0) * fps)
        point_start = None
        if point in fault_points or point in double_fault_points:
            fault = simulate_rally(1, fps=fps, seed=seed * 100 + point + 50, serve=True, serve_side=serve_side,
                                   serve_fault=True)
            if server == 1:
                fault = _mirror(fault)
            point_start = _append_serve(match, fault, server, serve_side, pause, fps, fault=True)
            pause = int(rng.uniform(3.0, 5.0) * fps)
        receiver = 1 if server == 2 else 2
        if point in double_fault_points:
            second = simulate_rally(1, fps=fps, seed=seed * 100 + point + 70, serve=True, serve_side=serve_side,
                                    serve_fault=True)
            if server == 1:
                second = _mirror(second)
            start = _append_serve(match, second, server, serve_side, pause, fps, fault=True)
            winner, how = receiver, "doble falta"
        else:
            out, net = point in out_points, point in net_points
            # Un golpe fuera o a la red necesita al menos el saque y un resto (si no, sería una falta).
            shots = int(rng.integers(2 if out or net else 1, max_shots + 1))
            rally = simulate_rally(shots, fps=fps, seed=seed * 100 + point, serve=True, serve_side=serve_side,
                                   last_out=out, last_net=net)
            if server == 1:
                rally = _mirror(rally)
            start = _append_serve(match, rally, server, serve_side, pause, fps, fault=False)
            last = rally.shots[-1]["player"]
            winner, how = (3 - last, "fuera") if out else (3 - last, "red") if net else (last, "ganador")
        match.points.append({"start": start if point_start is None else point_start,
                             "end": len(match.ball_3d) - 1, "server": server, "winner": winner, "how": how})
    for _ in range(int(2 * fps)):
        match.ball_3d.append(None)
        match.players_m.append(match.players_m[-1])
    return match


def _append_serve(match, rally, server, serve_side, pause, fps, fault):
    """Añade una pausa, el lanzamiento y el peloteo (o el saque fallado). Devuelve el inicio del lanzamiento."""
    idle = {k: v for k, v in rally.players_m[0].items()}
    for _ in range(pause):
        match.ball_3d.append(None)
        match.players_m.append(idle)
    # Lanzamiento: la pelota sube desde la mano (1,2 m) hasta 2,9 m y baja a 2,6 m, donde la golpea.
    hit_x, hit_y, _ = rally.ball_3d[0]
    up = np.sqrt(2 * G * (2.9 - 1.2))
    toss_time = up / G + np.sqrt(2 * (2.9 - 2.6) / G)
    start = len(match.ball_3d)
    for k in range(int(round(toss_time * fps))):
        t = k / fps
        match.ball_3d.append((hit_x, hit_y, 1.2 + up * t - 0.5 * G * t * t))
        match.players_m.append(idle)
    offset = len(match.ball_3d)
    match.ball_3d += rally.ball_3d
    match.players_m += rally.players_m
    match.shots += [{**s, "frame": s["frame"] + offset} for s in rally.shots]
    match.bounces += [{**b, "frame": b["frame"] + offset} for b in rally.bounces]
    first = rally.bounces[0]
    speed = np.hypot(first["x_m"] - hit_x, first["y_m"] - hit_y) / (first["frame"] / fps) * 3.6
    match.serves.append({"frame": offset, "player": server, "side": serve_side, "fault": fault,
                         "speedKmh": float(speed)})  # velocidad media hasta el bote
    return start
