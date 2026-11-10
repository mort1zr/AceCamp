"""Detector de botes por reglas (TA-22a).

En la imagen, al botar la pelota cambia de golpe su velocidad vertical: el suelo
le da un impulso hacia arriba. En vuelo, en cambio, la trayectoria es suave (la
gravedad y la perspectiva la curvan, pero sin saltos). Un golpe también cambia la
trayectoria de golpe, pero además **invierte la dirección** de la pelota a lo largo
de la pista (deja de acercarse a la cámara y se aleja, o al revés); en un bote la
pelota sigue en la misma dirección. Por eso:

1. Golpes: fotogramas en que la velocidad vertical de la pelota en la imagen cambia
   de signo con fuerza, con la pelota cerca de un jugador y en el sentido de un golpe
   de ese jugador: el del fondo (1) recibe la pelota subiendo por la imagen y la
   devuelve bajando; el cercano (2), al revés. Un bote delante del jugador del fondo
   también invierte la dirección, pero en el sentido contrario (baja y luego sube).
2. En cada fotograma se ajusta una parábola a los K fotogramas anteriores y otra a
   los K siguientes, sin cruzar un golpe, y se compara su pendiente vertical en ese
   fotograma. Un bote es un salto negativo (impulso hacia arriba en la imagen).
3. El salto se pasa a metros por fotograma con la escala de la pista en ese punto
   (homografía): así el mismo umbral sirve en el fondo lejano, donde un metro ocupa
   pocos píxeles, y en el cercano.
4. De varios fotogramas seguidos se queda el de mayor salto, y se descartan los que
   están a menos de 0,15 s de un golpe o caen lejos de la pista (más de 6 m por detrás
   del fondo o 4 m por fuera de las laterales).

5. Botes en un hueco sin pelota: el jugador cercano suele tapar la pelota justo
   cuando bota delante de él, y el detector de pelota a veces la pierde. Si hay
   trayectoria antes y después del hueco y entre medias no hubo golpe, se ajusta una
   curva a cada lado y se busca el fotograma en que se cruzan; si ahí la pelota pasa
   de golpe de bajar a subir, se cuenta el bote en ese fotograma.

Devuelve los fotogramas de bote. La posición en la pista se calcula en TA-23.

Limitación: una pelota que sale del plano o queda tapada justo al botar no da
suficientes puntos para ajustar las parábolas, y ese bote no se detecta.
"""

from __future__ import annotations

import numpy as np

from court import COURT_LENGTH, DOUBLES_WIDTH, per_frame
from utils import get_center_of_bbox

# Los tiempos van en segundos para que valgan a cualquier fps (entre paréntesis, a 30 fps).
# Valores ajustados con peloteos simulados (tests/ball_sim.py); se revisarán con las etiquetas de TA-9.
FIT_SECONDS = 0.27  # ventana de ajuste a cada lado (8 fotogramas)
MIN_POINTS = 4  # puntos con pelota necesarios en cada lado (incluido el fotograma del bote)
# Salto mínimo de la velocidad vertical, en metros de pista por fotograma a 30 fps.
MIN_KINK_M_PER_FRAME = 0.45
SUPPRESSION_SECONDS = 0.27  # dos botes (o dos golpes) no pueden estar más cerca (8 fotogramas)

# Golpes
HIT_VELOCITY_SECONDS = 0.1  # para estimar la velocidad antes y después (3 fotogramas)
MIN_HIT_SPEED_M_PER_FRAME = 0.08  # velocidad vertical mínima a cada lado (~2,4 m/s)
# La pelota a menos de esta fracción de la altura de la caja de un jugador puede ser un golpe.
NEAR_PLAYER_FRACTION = 1.0
# Entre un golpe y un bote siempre pasa algo de tiempo: un salto más cerca es el propio golpe.
# 0,15 s es el mejor valor en los peloteos simulados y no cambia el resultado en los highlights.
HIT_EXCLUSION_SECONDS = 0.15
# Un bote tiene que caer en la pista o cerca: hasta estos metros por fuera de las líneas laterales y
# por detrás de las de fondo (más lejos son pelotas rodando o recogidas, no botes del punto).
OUT_MARGIN_SIDE_M = 4.0
OUT_MARGIN_BACK_M = 6.0

# Golpes dentro de un hueco sin pelota
MAX_HIT_GAP_SECONDS = 0.6
HIT_GAP_FIT_POINTS = 4

# Huecos sin pelota
MIN_GAP_FRAMES = 2  # huecos más cortos ya los cubre la detección normal
MAX_GAP_SECONDS = 0.5  # en un hueco más largo no se puede deducir la trayectoria (15 fotogramas)
GAP_FIT_POINTS = 5  # puntos a cada lado del hueco para ajustar las curvas
MAX_GAP_MISMATCH_M = 1.0  # distancia máxima entre las dos curvas en el cruce, en metros de pista


def _frames(seconds, fps):
    return max(1, int(round(seconds * fps)))


def _ball_centers(ball_detections):
    centers = np.full((len(ball_detections), 2), np.nan)
    for i, frame in enumerate(ball_detections):
        if 1 in frame:
            centers[i] = get_center_of_bbox(frame[1])
    return centers


def _pixels_per_meter(homography, point):
    """Píxeles verticales de imagen por metro a lo largo de la pista, alrededor de point."""
    x, y = homography.image_to_court(point)
    a, b = homography.court_to_image([[x, y - 0.5], [x, y + 0.5]])
    return max(abs(b[1] - a[1]), 1e-6)


def _players_near(point, player_boxes, fraction):
    """IDs de los jugadores cuya caja (ampliada) contiene el punto."""
    near = []
    for pid, (x1, y1, x2, y2) in player_boxes.items():
        margin = fraction * (y2 - y1)
        dx = max(x1 - point[0], 0.0, point[0] - x2)
        dy = max(y1 - point[1], 0.0, point[1] - y2)
        if np.hypot(dx, dy) <= margin:
            near.append(pid)
    return near


def _near_player(point, player_boxes, fraction):
    return bool(_players_near(point, player_boxes, fraction))


def _slope(offsets, values, degree):
    """Pendiente en el offset 0 de un polinomio ajustado (recta si hay pocos puntos)."""
    degree = min(degree, len(values) - 2) if len(values) > 2 else 1
    return np.polyfit(offsets, values, max(degree, 1))[-2]


def _side(y, i, step, limit, barriers):
    """Índices seguidos desde i (incluido) hacia un lado, sin cruzar una barrera, con pelota."""
    indices = [i]
    j = i + step
    while 0 <= j < len(y) and abs(j - i) <= limit and j not in barriers:
        if not np.isnan(y[j]):
            indices.append(j)
        j += step
    return indices


def detect_hits(ball_detections, player_detections, homography, fps,
                near_player_fraction=NEAR_PLAYER_FRACTION, min_speed=MIN_HIT_SPEED_M_PER_FRAME):
    """Fotogramas en que un jugador golpea la pelota: su dirección vertical se invierte junto a él.

    Los jugadores deben venir numerados 1 = fondo lejano y 2 = fondo cercano (TA-12).
    """
    # Al menos 3 fotogramas por lado: a 25 fps, 0,1 s son 2 y la pendiente salía muy ruidosa.
    frames, suppression = max(3, _frames(HIT_VELOCITY_SECONDS, fps)), _frames(SUPPRESSION_SECONDS, fps)
    centers = _ball_centers(ball_detections)
    homographies = per_frame(homography, len(ball_detections))
    y = centers[:, 1]
    candidates = []
    for i in range(len(y)):
        if np.isnan(y[i]) or homographies[i] is None:
            continue
        near = _players_near(centers[i], player_detections[i], near_player_fraction)
        if not near:
            continue
        left, right = _side(y, i, -1, frames, ()), _side(y, i, 1, frames, ())
        if len(left) < 3 or len(right) < 3:
            continue
        scale = _pixels_per_meter(homographies[i], centers[i]) * (30.0 / fps)
        before = _slope(np.array(left) - i, y[left], 1) / scale
        after = _slope(np.array(right) - i, y[right], 1) / scale
        if min(abs(before), abs(after)) < min_speed:
            continue
        far_hit = 1 in near and before < 0 < after  # sube hacia el jugador del fondo y vuelve bajando
        near_hit = 2 in near and before > 0 > after  # baja hacia el jugador cercano y vuelve subiendo
        if far_hit or near_hit:
            candidates.append((-abs(after - before), i))
    candidates += _gap_hits(centers, player_detections, homographies, fps, near_player_fraction, min_speed)
    hits = []
    for _, i in sorted(candidates):
        if all(abs(i - j) >= suppression for j in hits):
            hits.append(i)
    return sorted(hits)


def _gap_hits(centers, player_detections, homographies, fps, near_player_fraction, min_speed):
    """Golpes dentro de un hueco sin pelota: [(-cambio de velocidad, fotograma)].

    En vídeo real el detector pierde a menudo la pelota justo en el golpe: se solapa con el
    jugador, va muy rápida o sale del encuadre por abajo junto al jugador cercano. Si antes del
    hueco la pelota iba hacia un jugador y después se aleja de él, y en los bordes del hueco está
    junto a ese jugador, hubo un golpe dentro. El fotograma es donde se cruzan las dos rectas.
    """
    y = centers[:, 1]
    found = []
    for start, end in _gaps(y, 1, _frames(MAX_HIT_GAP_SECONDS, fps)):
        before = [j for j in range(start - 1, max(-1, start - 1 - 2 * HIT_GAP_FIT_POINTS), -1)
                  if not np.isnan(y[j])][:HIT_GAP_FIT_POINTS]
        after = [j for j in range(end + 1, min(len(y), end + 1 + 2 * HIT_GAP_FIT_POINTS))
                 if not np.isnan(y[j])][:HIT_GAP_FIT_POINTS]
        if len(before) < 3 or len(after) < 3 or homographies[start - 1] is None:
            continue
        scale = _pixels_per_meter(homographies[start - 1], centers[start - 1]) * (30.0 / fps)
        fit_b, fit_a = np.polyfit(before, y[before], 1), np.polyfit(after, y[after], 1)
        slope_b, slope_a = fit_b[0] / scale, fit_a[0] / scale
        if min(abs(slope_b), abs(slope_a)) < min_speed:
            continue
        near = set(_players_near(centers[start - 1], player_detections[start - 1], near_player_fraction))
        near |= set(_players_near(centers[end + 1], player_detections[end + 1], near_player_fraction))
        far_hit = 1 in near and slope_b < 0 < slope_a
        near_hit = 2 in near and slope_b > 0 > slope_a
        if not (far_hit or near_hit):
            continue
        cross = (fit_a[1] - fit_b[1]) / (fit_b[0] - fit_a[0])  # donde se cortan las dos rectas
        frame = int(round(min(max(cross, start - 1), end + 1)))
        found.append((-abs(slope_a - slope_b), frame))
    return found


def bounce_scores(ball_detections, homography, fps, hits=(), fit_frames=None, min_points=MIN_POINTS):
    """Salto de la velocidad vertical en cada fotograma (m por fotograma a 30 fps; NaN si no se puede medir).

    Las ventanas de ajuste no cruzan los golpes (hits): así se detecta un bote aunque el
    golpe llegue pocos fotogramas después, que es lo habitual.
    """
    fit_frames = fit_frames or _frames(FIT_SECONDS, fps)
    centers = _ball_centers(ball_detections)
    homographies = per_frame(homography, len(ball_detections))
    y = centers[:, 1]
    barriers = set(hits)
    scores = np.full(len(y), np.nan)
    for i in range(len(y)):
        if np.isnan(y[i]) or homographies[i] is None or i in barriers:
            continue
        left = _side(y, i, -1, fit_frames, barriers)
        right = _side(y, i, 1, fit_frames, barriers)
        if len(left) < min_points or len(right) < min_points:
            continue
        slope_left = _slope(np.array(left) - i, y[left], 2)
        slope_right = _slope(np.array(right) - i, y[right], 2)
        scale = _pixels_per_meter(homographies[i], centers[i])
        scores[i] = (slope_right - slope_left) * fps / (scale * 30.0)  # m por fotograma a 30 fps
    return scores


def _gaps(y, min_gap, max_gap):
    """Huecos sin pelota como (primer fotograma sin pelota, último), con pelota antes y después."""
    gaps, start = [], None
    for i, value in enumerate(y):
        if np.isnan(value):
            if start is None:
                start = i
        elif start is not None:
            if start > 0 and min_gap <= i - start <= max_gap:
                gaps.append((start, i - 1))
            start = None
    return gaps


def gap_bounces(ball_detections, homography, fps, hits=(), min_kink=MIN_KINK_M_PER_FRAME):
    """Botes deducidos dentro de huecos sin pelota: [(fotograma, salto, (x, y) en la imagen)].

    La posición es la del cruce de las dos curvas: en ese fotograma no hay pelota detectada.
    """
    centers = _ball_centers(ball_detections)
    homographies = per_frame(homography, len(ball_detections))
    y = centers[:, 1]
    hit_set = set(hits)
    found = []
    for start, end in _gaps(y, MIN_GAP_FRAMES, _frames(MAX_GAP_SECONDS, fps)):
        if any(start - 1 <= h <= end + 1 for h in hit_set):
            continue  # un golpe dentro del hueco: no se puede saber si además botó
        before = [j for j in range(start - 1, max(-1, start - 1 - 2 * GAP_FIT_POINTS), -1)
                  if not np.isnan(y[j]) and j not in hit_set][:GAP_FIT_POINTS]
        after = []
        for j in range(end + 1, min(len(y), end + 1 + 2 * GAP_FIT_POINTS)):
            if j in hit_set:
                break
            if not np.isnan(y[j]):
                after.append(j)
        after = after[:GAP_FIT_POINTS]
        if len(before) < 3 or len(after) < 3 or homographies[start - 1] is None:
            continue
        degree_b, degree_a = (2 if len(before) >= 4 else 1), (2 if len(after) >= 4 else 1)
        fit_b = [np.polyfit(before, centers[before, k], degree_b if k else 1) for k in (0, 1)]
        fit_a = [np.polyfit(after, centers[after, k], degree_a if k else 1) for k in (0, 1)]
        times = np.linspace(start - 1, end + 1, 8 * (end - start + 3))
        diff = np.hypot(np.polyval(fit_b[0], times) - np.polyval(fit_a[0], times),
                        np.polyval(fit_b[1], times) - np.polyval(fit_a[1], times))
        t = times[int(np.argmin(diff))]
        point = (np.polyval(fit_b[0], t), np.polyval(fit_b[1], t))
        scale = _pixels_per_meter(homographies[start - 1], point)
        if diff.min() / scale > MAX_GAP_MISMATCH_M:
            continue  # las dos curvas no se cruzan: no es la misma trayectoria
        kink = (np.polyval(np.polyder(fit_a[1]), t) - np.polyval(np.polyder(fit_b[1]), t)) * fps / (scale * 30.0)
        if kink <= -min_kink:
            found.append((int(round(t)), float(kink), (float(point[0]), float(point[1]))))
    return found


def detect_bounces(ball_detections, player_detections, homography, fps, main_camera=None, hits=None,
                   min_kink=MIN_KINK_M_PER_FRAME):
    """Fotogramas con bote, en orden (ver detect_bounce_events para la posición)."""
    events = detect_bounce_events(ball_detections, player_detections, homography, fps, main_camera, hits, min_kink)
    return [event["frame"] for event in events]


def detect_bounce_events(ball_detections, player_detections, homography, fps, main_camera=None, hits=None,
                         min_kink=MIN_KINK_M_PER_FRAME):
    """Botes en orden: [{"frame", "x_px", "y_px", "inferred"}].

    x_px, y_px: posición de la pelota en la imagen en el bote. inferred es True si el bote
    se dedujo dentro de un hueco sin pelota (entonces la posición sale del cruce de las curvas).

    ball_detections: por fotograma, {1: caja} o {} (la pelota ya elegida e interpolada).
    player_detections: por fotograma, {id: caja} de los dos jugadores.
    homography: una para todo el vídeo o una por fotograma.
    main_camera: opcional, por fotograma; fuera de la cámara principal no hay botes (TA-15).
    hits: fotogramas de golpe; si no se dan, se detectan con detect_hits().
    """
    fit_frames, suppression = _frames(FIT_SECONDS, fps), _frames(SUPPRESSION_SECONDS, fps)
    exclusion = _frames(HIT_EXCLUSION_SECONDS, fps)
    if hits is None:
        hits = detect_hits(ball_detections, player_detections, homography, fps)
    scores = bounce_scores(ball_detections, homography, fps, hits, fit_frames)
    centers = _ball_centers(ball_detections)
    candidates = []
    for i, score in enumerate(scores):
        if np.isnan(score) or score > -min_kink:
            continue
        if main_camera is not None and not all(main_camera[max(0, i - fit_frames):i + fit_frames + 1]):
            continue
        if any(abs(i - h) <= exclusion for h in hits):
            continue
        candidates.append((score, i, (float(centers[i][0]), float(centers[i][1])), False))
    for i, score, point in gap_bounces(ball_detections, homography, fps, hits, min_kink):
        if main_camera is not None and not all(main_camera[max(0, i - fit_frames):i + fit_frames + 1]):
            continue
        candidates.append((score, i, point, True))
    homographies = per_frame(homography, len(ball_detections))

    def plausible(i, point):
        if homographies[i] is None:
            return False
        x, y = homographies[i].image_to_court(point)
        return (-OUT_MARGIN_SIDE_M <= x <= DOUBLES_WIDTH + OUT_MARGIN_SIDE_M
                and -OUT_MARGIN_BACK_M <= y <= COURT_LENGTH + OUT_MARGIN_BACK_M)

    candidates = [c for c in candidates if plausible(c[1], c[2])]
    chosen = []
    for score, i, point, inferred in sorted(candidates, key=lambda c: c[0]):  # primero los saltos más grandes
        if all(abs(i - event["frame"]) >= suppression for event in chosen):
            chosen.append({"frame": i, "x_px": round(point[0], 1), "y_px": round(point[1], 1),
                           "inferred": inferred})
    return sorted(chosen, key=lambda event: event["frame"])
