"""División del vídeo en puntos (TA-17).

Un punto empieza con el saque y termina cuando la pelota deja de estar en juego.
Con lo que ya detecta el modelo (pelota, golpes, botes y cortes de cámara):

1. Tramos de juego: fotogramas de la cámara principal con pelota, cortados donde la
   pelota no se ve durante más de PAUSE_SECONDS o hay un corte de cámara (repetición).
2. Un tramo sin ningún golpe no es un punto (el jugador botando la pelota antes de
   sacar, una pelota rodando, el recogepelotas).
3. Inicio: el lanzamiento del saque (events.serves). Si en el tramo no se detectó el
   saque (el vídeo empieza a mitad del punto), el primer fotograma con pelota en los
   MAX_TOSS_SECONDS anteriores al primer golpe. Lo que haya antes es el jugador
   botando la pelota y no cuenta. El sacador es el del saque, o si no lo hay, quien
   da el primer golpe.
4. Fin: lo primero que ocurra de
   - doble bote: dos botes seguidos en el mismo lado de la red sin golpe entre medias;
   - bote claramente fuera: más de OUT_MARGIN_M por fuera de las líneas de dobles
     (salvo el bote del saque: una falta no acaba el punto, viene el segundo saque);
   - la pelota deja de verse (fin del tramo).
   Un doble bote o un bote fuera seguidos de otro golpe antes de NEXT_HIT_SECONDS no
   acaban el punto: el bote era falso (o mal situado) y el punto seguía.
5. Primera falta: un tramo con un solo golpe (el saque, sin resto) cuyo saque bota
   claramente fuera de los cuadros de saque, seguido antes de SECOND_SERVE_SECONDS de
   otro saque del mismo jugador, es el mismo punto: se juntan y el punto lleva los dos
   saques. Sin bote del saque no se juntan (podría ser un ace).

Cada saque del punto (serve_attempts) lleva si fue falta: el saque debe botar en el cuadro
de saque cruzado del rival. Su bote se canta con events.line_calls (TA-24): fuera es falta;
dentro o dudoso (a menos del margen de duda de una línea), no. Si no se ve su bote pero el
rival lo devolvió, entró; si no se ve ni hay resto, no se sabe (None).
Con el bote también se estima su velocidad: distancia del sacador al bote entre el tiempo.

Salida: [{"start", "end", "server", "serve_frames", "serve_attempts", "shots", "end_reason"}].
"""

from __future__ import annotations

import numpy as np

from court import COURT_LENGTH, DOUBLES_WIDTH, NET_Y
from court.court_model import ALLEY_WIDTH, SERVICE_LINE_FROM_NET
from utils import get_center_of_bbox, measure_distance

from .line_calls import DOUBT_MARGIN_M, OUT, call, service_box

PAUSE_SECONDS = 3.0
MAX_TOSS_SECONDS = 1.5
OUT_MARGIN_M = 1.0
END_AFTER_BOUNCE_SECONDS = 0.3  # el punto acaba un poco después del bote que lo decide
SECOND_SERVE_SECONDS = 30.0
NEXT_HIT_SECONDS = 1.5  # si hay un golpe poco después del supuesto final, el punto seguía
SERVICE_BOX_MARGIN_M = 0.3


def hitter(frame, ball_detections, player_detections):
    """El jugador más cercano a la pelota en el fotograma del golpe (1 = fondo lejano, 2 = cercano)."""
    for offset in (0, -1, 1, -2, 2):
        i = frame + offset
        if 0 <= i < len(ball_detections) and 1 in ball_detections[i] and player_detections[i]:
            center = get_center_of_bbox(ball_detections[i][1])
            players = player_detections[i]
            return min(players, key=lambda pid: measure_distance(center, get_center_of_bbox(players[pid])))
    return None


def _segments(visible, pause):
    """Tramos (primer, último) de fotogramas visibles, sin huecos de más de pause fotogramas."""
    result, start, last = [], None, None
    for i, ok in enumerate(visible):
        if not ok:
            continue
        if start is None:
            start = i
        elif i - last > pause:
            result.append((start, last))
            start = i
        last = i
    if start is not None:
        result.append((start, last))
    return result


def _out_clearly(bounce):
    return (bounce["x_m"] < -OUT_MARGIN_M or bounce["x_m"] > DOUBLES_WIDTH + OUT_MARGIN_M
            or bounce["y_m"] < -OUT_MARGIN_M or bounce["y_m"] > COURT_LENGTH + OUT_MARGIN_M)


MIN_SERVE_SPEED_KMH, MAX_SERVE_SPEED_KMH = 50.0, 260.0
MIN_SERVE_FLIGHT_SECONDS = 0.25  # el bote del saque no puede llegar antes


def _serve_attempt(serve, next_hit, bounces, fps, doubt_margin=DOUBT_MARGIN_M):
    """Resultado de un saque: bote, cantada del bote, falta (True/False/None) y velocidad estimada."""
    min_flight = MIN_SERVE_FLIGHT_SECONDS * fps

    def receiver_half(b):
        return b["y_m"] < NET_Y if serve["player"] == 2 else b["y_m"] > NET_Y

    after = [b for b in bounces if b["frame"] - serve["frame"] >= min_flight and "x_m" in b and receiver_half(b)
             and (next_hit is None or b["frame"] < next_hit)]
    bounce = after[0] if after else None
    attempt = {"frame": serve["frame"], "player": serve["player"], "side": serve["side"],
               "fault": None, "call": None, "bounce_frame": None, "speedKmh": None}
    if bounce is not None:
        attempt["bounce_frame"] = bounce["frame"]
        attempt["call"] = call(bounce["x_m"], bounce["y_m"], service_box(serve["player"], serve["side"]),
                               doubt_margin)
        attempt["fault"] = attempt["call"] == OUT
        if "x_m" in serve and bounce["frame"] > serve["frame"]:
            meters = float(np.hypot(bounce["x_m"] - serve["x_m"], bounce["y_m"] - serve["y_m"]))
            flight = (bounce.get("contact_frame", bounce["frame"]) - serve["frame"]) / fps
            speed = meters / flight * 3.6 if flight > 0 else 0.0
            if MIN_SERVE_SPEED_KMH <= speed <= MAX_SERVE_SPEED_KMH:
                attempt["speedKmh"] = round(speed, 1)
    elif next_hit is not None:
        attempt["fault"] = False  # sin bote visto, pero el rival lo devolvió: entró
    return attempt


def in_service_area(bounce, margin=SERVICE_BOX_MARGIN_M):
    """Si un bote cae dentro de los cuadros de saque (cualquiera de los dos lados de la red)."""
    x, y = bounce["x_m"], bounce["y_m"]
    inside_x = ALLEY_WIDTH - margin <= x <= DOUBLES_WIDTH - ALLEY_WIDTH + margin
    inside_y = NET_Y - SERVICE_LINE_FROM_NET - margin <= y <= NET_Y + SERVICE_LINE_FROM_NET + margin
    return inside_x and inside_y


def _end_of_play(start, end, hits, bounces, fps):
    """Fotograma y motivo del fin de un tramo de juego."""
    after = int(round(END_AFTER_BOUNCE_SECONDS * fps))
    next_hit = int(round(NEXT_HIT_SECONDS * fps))

    def play_continues(frame):
        return any(frame < h <= frame + next_hit for h in hits)

    events = sorted([(h, "golpe", None) for h in hits] + [(b["frame"], "bote", b) for b in bounces])
    previous_bounce, serve_bounce_seen = None, False
    for frame, kind, bounce in events:
        if not start <= frame <= end:
            continue
        if kind == "golpe":
            previous_bounce = None
            continue
        if "x_m" in bounce:
            first_bounce = not serve_bounce_seen
            serve_bounce_seen = True
            if _out_clearly(bounce) and not first_bounce and not play_continues(frame):
                return min(end, frame + after), "fuera"
            if (previous_bounce is not None and "x_m" in previous_bounce
                    and (previous_bounce["y_m"] < NET_Y) == (bounce["y_m"] < NET_Y) and not play_continues(frame)):
                return min(end, frame + after), "doble bote"
        previous_bounce = bounce
    return end, "sin pelota"


def detect_points(ball_detections, player_detections, hits, bounces, fps, main_camera=None, serves=(),
                  doubt_margin=DOUBT_MARGIN_M):
    """Puntos del vídeo, en orden.

    bounces: los de events.locate_bounces() (con x_m, y_m); serves: los de events.detect_serves().
    doubt_margin: margen de duda de las líneas para cantar el bote del saque (TA-24).
    """
    n = len(ball_detections)
    main = main_camera if main_camera is not None else [True] * n
    visible = [1 in ball_detections[i] and main[i] for i in range(n)]
    pause = max(1, int(round(PAUSE_SECONDS * fps)))
    toss = int(round(MAX_TOSS_SECONDS * fps))
    serve_at = {s["frame"]: s for s in serves}
    hits = sorted(set(hits) | set(serve_at))

    plays = []
    for seg_start, seg_end in _segments(visible, pause):
        # Un corte de cámara dentro del tramo lo cierra: lo de después es otra cosa.
        cut = next((i for i in range(seg_start, seg_end + 1) if not main[i]), None)
        if cut is not None:
            seg_end = max(seg_start, cut - 1)
        seg_hits = [h for h in hits if seg_start <= h <= seg_end]
        if not seg_hits:
            continue
        # Si hay un saque al principio del tramo, el punto empieza en él (lo anterior son golpes
        # falsos mientras el jugador bota la pelota o la lanza).
        opening = [h for h in seg_hits if h in serve_at and h - seg_start <= toss + pause]
        if opening:
            seg_hits = [h for h in seg_hits if h >= opening[0]]
        first_hit = seg_hits[0]
        serve = serve_at.get(first_hit)
        if serve is not None:
            start = serve["toss_start"]
        else:
            start = next((i for i in range(max(seg_start, first_hit - toss), first_hit + 1) if visible[i]),
                         first_hit)
        end, reason = _end_of_play(start, seg_end, seg_hits, bounces, fps)
        next_hit = seg_hits[1] if len(seg_hits) > 1 else None
        attempts = ([_serve_attempt(serve, next_hit, [b for b in bounces if b["frame"] <= end], fps, doubt_margin)]
                    if serve else [])
        if attempts:
            fault = attempts[0]["fault"] is True
        else:  # sin saque detectado: falta si el primer bote cae fuera de los cuadros
            after_first = [b for b in bounces if first_hit < b["frame"] <= end and "x_m" in b
                           and (next_hit is None or b["frame"] < next_hit)]
            fault = bool(after_first) and not in_service_area(after_first[0])
        server = serve["player"] if serve is not None else hitter(first_hit, ball_detections, player_detections)
        plays.append({"start": start, "end": end, "server": server,
                      "serve_frames": [first_hit], "serve_attempts": attempts, "shots": len(seg_hits),
                      "end_reason": reason, "fault": fault})

    # Primera falta + segundo saque del mismo jugador = un solo punto.
    points = []
    second_serve = int(round(SECOND_SERVE_SECONDS * fps))
    for play in plays:
        last = points[-1] if points else None
        if (last is not None and last["shots"] == 1 and len(last["serve_frames"]) == 1 and last["fault"]
                and last["server"] is not None and play["server"] == last["server"]
                and play["start"] - last["end"] <= second_serve):
            last.update(end=play["end"], serve_frames=last["serve_frames"] + play["serve_frames"],
                        serve_attempts=last["serve_attempts"] + play["serve_attempts"],
                        shots=last["shots"] + play["shots"], end_reason=play["end_reason"])
            continue
        points.append(dict(play))
    for point in points:
        point.pop("fault", None)
    return points


def point_boundaries_ok(predicted, actual, fps, tolerance_seconds=1.0):
    """Fracción de puntos reales con un punto detectado cuyo inicio y fin están a menos de la tolerancia."""
    if not actual:
        return None
    tol = tolerance_seconds * fps
    used, ok = set(), 0
    for real in actual:
        for k, pred in enumerate(predicted):
            if k not in used and abs(pred["start"] - real["start"]) <= tol and abs(pred["end"] - real["end"]) <= tol:
                used.add(k)
                ok += 1
                break
    return ok / len(actual)
