"""Quién gana cada punto (TA-28).

Reglas, en este orden, con lo que ya detecta el modelo (saques, golpes, botes y su cantada):

1. Doble falta: los dos saques del punto son falta → gana el receptor.
2. Saque no devuelto: el saque entró y nadie la devolvió → gana el sacador.
3. Lo decide el primer bote tras el último golpe (TA-24):
   - fuera → pierde quien la golpeó, que es el rival del jugador en cuyo lado botó (fuera por
     el fondo cuenta como su lado);
   - dentro o dudoso → pierde el jugador de ese lado, que no la devolvió: con doble bote visto
     (más fiable) o porque la pelota dejó de verse.
   Pelota en la red (TA-26): si ese primer bote cae en el lado de quien golpeó, la pelota no
   cruzó la red → gana el rival de quien golpeó. Quien golpeó se decide por el jugador más
   cercano a la pelota y, si hay un bote anterior, debe coincidir con su lado (si no, no se
   marca como red).
4. Sin bote tras el último golpe (pelota en la red o fuera sin ver el bote): lo más probable es
   que el golpe fallara → gana el rival de quien golpeó.

Cada decisión lleva una confianza entre 0 y 1: una base según la regla (cuánto se fía de ella)
multiplicada por la de la cantada del bote que decide, si lo hay. Un bote dudoso, o cuya
distancia a la línea es menor que su incertidumbre, baja la confianza.

Coherencia: entre dos golpes la pelota bota como mucho una vez (o dos en el mismo lado, si es
el final, y separados al menos MIN_DOUBLE_BOUNCE_SECONDS: tras botar, la pelota sube y tarda
en volver a caer; dos "botes" más seguidos suelen ser un bote y un golpe que no se detectó). Si tras el último golpe hay botes en los dos lados de la red, se perdió un golpe: el
bote que decide es el primero del último lado. Cuando los golpes y los botes del punto no
cuadran así, la confianza se multiplica por INCONSISTENT_FACTOR: es probable que falte un golpe
o que sobre un bote, y la regla puede estar aplicándose al golpe equivocado.
"""

from __future__ import annotations

from court import NET_Y

from .line_calls import DOUBTFUL, OUT
from .points import hitter

# Base de confianza de cada regla.
BASE_CONFIDENCE = {
    "doble falta": 0.95,
    "doble bote": 0.85,
    "fuera": 0.9,
    "saque no devuelto": 0.7,
    "no devuelta": 0.55,
    "golpe fallado": 0.3,
    "red": 0.6,  # depende de saber quién golpeó: como mucho, confianza media
}
HIGH_CONFIDENCE, MEDIUM_CONFIDENCE = 0.75, 0.5
INCONSISTENT_FACTOR = 0.7
MIN_DOUBLE_BOUNCE_SECONDS = 0.4


def confidence_level(confidence):
    """"alta", "media" o "baja"."""
    if confidence >= HIGH_CONFIDENCE:
        return "alta"
    return "media" if confidence >= MEDIUM_CONFIDENCE else "baja"


def _other(player):
    return None if player is None else 3 - player


def _side_of(bounce):
    """Jugador en cuyo lado de la red botó la pelota: 1 = lejano (y < red), 2 = cercano."""
    return 1 if bounce["y_m"] < NET_Y else 2


def _call_factor(bounce):
    """Cuánto se puede fiar de la cantada de un bote (1 = nada que dudar)."""
    if bounce is None or bounce.get("call") is None:
        return 0.8
    if bounce["call"] == DOUBTFUL:
        return 0.5
    distance = abs(bounce.get("line_distance_cm", 0.0))
    uncertainty = bounce.get("uncertainty_cm") or 0.0
    return 1.0 if distance >= uncertainty else 0.75


def _decision(winner, reason, bounce=None, consistent=True):
    confidence = BASE_CONFIDENCE[reason] * (_call_factor(bounce) if bounce is not None else 1.0)
    if not consistent:
        confidence *= INCONSISTENT_FACTOR
    return {"winner": winner, "win_reason": reason, "confidence": round(confidence, 2),
            "confidence_level": confidence_level(confidence), "consistent": consistent}


def _consistent(point_hits, located, fps):
    """Si los golpes y los botes del punto cuadran: entre dos golpes, como mucho un bote, y tras el
    último golpe, botes de un solo lado y no demasiado seguidos."""
    edges = list(point_hits) + [None]
    for a, b in zip(edges, edges[1:]):
        between = [x for x in located if x["frame"] > a and (b is None or x["frame"] < b)]
        if b is not None and len(between) > 1:
            return False
        if b is None:
            if len({_side_of(x) for x in between}) > 1:
                return False
            gaps = [y["frame"] - x["frame"] for x, y in zip(between, between[1:])]
            if any(gap < MIN_DOUBLE_BOUNCE_SECONDS * fps for gap in gaps):
                return False
    return True


def _striker(last_hit, located, ball_detections, player_detections):
    """Quién dio el último golpe, solo si las dos pistas coinciden: el jugador más cercano a la
    pelota y el lado del bote anterior (el golpe lo da quien estaba en ese lado). Si no hay bote
    anterior, basta el jugador más cercano. None si no se sabe o no coinciden."""
    if last_hit is None or ball_detections is None or player_detections is None:
        return None
    nearest = hitter(last_hit, ball_detections, player_detections)
    before = [b for b in located if b["frame"] < last_hit]
    if before and nearest is not None and _side_of(before[-1]) != nearest:
        return None
    return nearest


def decide_point(point, bounces, hits, fps, ball_detections=None, player_detections=None):
    """Ganador de un punto: {"winner", "win_reason", "confidence", "confidence_level"}.

    point: uno de events.detect_points(); bounces: los de events.call_bounces() (con call);
    hits: fotogramas de los golpes y saques.
    """
    server = point.get("server")
    attempts = point.get("serve_attempts", [])
    if len(attempts) >= 2 and attempts[-1]["fault"] is True and attempts[-2]["fault"] is True:
        return _decision(_other(server), "doble falta", consistent=True)

    start, end = point["start"], point["end"]
    located = [b for b in bounces if start <= b["frame"] <= end and "x_m" in b]
    point_hits = [h for h in hits if start <= h <= end]
    last_hit = point_hits[-1] if point_hits else None
    after_last_hit = [b for b in located if last_hit is None or b["frame"] > last_hit]
    consistent = _consistent(point_hits, located, fps)
    # Botes en los dos lados tras el último golpe: se perdió un golpe; cuenta el último lado.
    while len({_side_of(b) for b in after_last_hit}) > 1:
        after_last_hit = after_last_hit[1:]

    # Saque sin resto: si entró, gana el sacador.
    if attempts and point.get("shots", 0) <= len(attempts) and attempts[-1]["fault"] is False:
        bounce = next((b for b in located if b["frame"] == attempts[-1].get("bounce_frame")), None)
        return _decision(server, "saque no devuelto", bounce, consistent)

    # Lo que decide es el primer bote tras el último golpe: fuera → pierde quien golpeó;
    # dentro o dudoso → pierde el jugador de ese lado, que no la devolvió (con doble bote visto o
    # porque la pelota dejó de verse).
    if after_last_hit:
        first = after_last_hit[0]
        side = _side_of(first)
        striker = _striker(last_hit, located, ball_detections, player_detections)
        if striker is not None and striker == side:
            return _decision(_other(striker), "red", first, consistent)
        if first.get("call") == OUT:
            return _decision(side, "fuera", first, consistent)
        reason = "doble bote" if point.get("end_reason") == "doble bote" else "no devuelta"
        return _decision(_other(side), reason, first, consistent)

    # Sin bote tras el último golpe: lo más probable es que el golpe fallara (red o fuera sin ver).
    striker = None
    if last_hit is not None and ball_detections is not None and player_detections is not None:
        striker = hitter(last_hit, ball_detections, player_detections)
    if striker is None and last_hit is not None:
        # Sin jugadores: el golpe es del lado contrario al del bote anterior.
        before = [b for b in located if b["frame"] < last_hit]
        striker = _side_of(before[-1]) if before else server
    return _decision(_other(striker), "golpe fallado", consistent=consistent)


def decide_winners(points, bounces, hits, fps, ball_detections=None, player_detections=None):
    """Copia de los puntos con winner, win_reason, confidence, confidence_level y consistent."""
    return [{**point, **decide_point(point, bounces, hits, fps, ball_detections, player_detections)}
            for point in points]
