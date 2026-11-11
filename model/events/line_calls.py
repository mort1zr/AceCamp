"""Dentro, fuera o dudoso de cada bote (TA-24).

Cada bote (con su posición en metros, TA-23) se compara con las líneas que le tocan:
- el bote de un saque, con el cuadro de saque cruzado del rival (según el lado del saque);
- el resto, con la pista de individuales (o la de dobles, configurable).

Una pelota que toca la línea es buena, así que lo que importa es la distancia a la línea
más cercana del área: si el bote cae a menos de DOUBT_MARGIN_M de ella (por dentro o por
fuera), la posición no basta para decidir y el bote es "dudoso". En los saques, un dudoso
cuenta como bueno (no es falta): en tenis, la duda favorece al jugador.

Cada bote lleva:
- call: "dentro", "fuera" o "dudoso";
- line_distance_cm: distancia a la línea más cercana, positiva por dentro y negativa por fuera;
- area: "cuadro de saque" o "pista".
"""

from __future__ import annotations

import math

from court import COURT_LENGTH, DOUBLES_WIDTH, NET_Y
from court.court_model import ALLEY_WIDTH, SERVICE_LINE_FROM_NET

DOUBT_MARGIN_M = 0.15
IN, OUT, DOUBTFUL = "dentro", "fuera", "dudoso"


def court_area(doubles=False):
    """(x0, x1, y0, y1) de la pista en metros: individuales o dobles, de fondo a fondo."""
    x0 = 0.0 if doubles else ALLEY_WIDTH
    return (x0, DOUBLES_WIDTH - x0, 0.0, COURT_LENGTH)


def service_box(server, side):
    """(x0, x1, y0, y1) del cuadro de saque cruzado del rival.

    server: 1 (fondo lejano) o 2 (fondo cercano); side: "derecha" o "izquierda" del sacador.
    El jugador 1 mira hacia la cámara, así que su derecha es la izquierda de la imagen.
    """
    if server == 2:  # saca desde el fondo cercano: el cuadro está en la mitad lejana
        y0, y1 = NET_Y - SERVICE_LINE_FROM_NET, NET_Y
    else:
        y0, y1 = NET_Y, NET_Y + SERVICE_LINE_FROM_NET
    server_on_right = (side == "derecha") == (server == 2)  # derecha de la imagen
    center = DOUBLES_WIDTH / 2
    x0, x1 = (ALLEY_WIDTH, center) if server_on_right else (center, DOUBLES_WIDTH - ALLEY_WIDTH)
    return (x0, x1, y0, y1)


def line_distance(x, y, area):
    """Distancia en metros del punto a la línea más cercana del área: + por dentro, - por fuera."""
    x0, x1, y0, y1 = area
    dx = max(x0 - x, 0.0, x - x1)
    dy = max(y0 - y, 0.0, y - y1)
    if dx == 0.0 and dy == 0.0:
        return min(x - x0, x1 - x, y - y0, y1 - y)
    return -math.hypot(dx, dy)


def call(x, y, area, margin=DOUBT_MARGIN_M):
    """"dentro", "fuera" o "dudoso" (a menos de margin de una línea)."""
    distance = line_distance(x, y, area)
    if abs(distance) < margin:
        return DOUBTFUL
    return IN if distance > 0 else OUT


def call_bounce(bounce, area, area_name, margin=DOUBT_MARGIN_M):
    """Copia del bote con call, line_distance_cm y area. Los botes sin posición no cambian."""
    if "x_m" not in bounce:
        return dict(bounce)
    distance = line_distance(bounce["x_m"], bounce["y_m"], area)
    return {**bounce, "call": call(bounce["x_m"], bounce["y_m"], area, margin),
            "line_distance_cm": round(100 * distance, 0), "area": area_name}


def call_bounces(bounces, points=(), doubles=False, margin=DOUBT_MARGIN_M):
    """Canta cada bote. points: los de events.detect_points(); sus saques dicen qué botes son de
    saque (se comparan con el cuadro de saque); el resto se compara con la pista."""
    serve_bounces = {a["bounce_frame"]: a for p in points for a in p.get("serve_attempts", [])
                     if a.get("bounce_frame") is not None}
    court = court_area(doubles)
    result = []
    for bounce in bounces:
        attempt = serve_bounces.get(bounce["frame"])
        if attempt is not None:
            result.append(call_bounce(bounce, service_box(attempt["player"], attempt["side"]), "cuadro de saque",
                                      margin))
        else:
            result.append(call_bounce(bounce, court, "pista", margin))
    return result


def call_counts(bounces):
    """Cuántos botes hay de cada tipo: {"dentro": n, "fuera": n, "dudoso": n}."""
    counts = {IN: 0, OUT: 0, DOUBTFUL: 0}
    for bounce in bounces:
        if bounce.get("call") in counts:
            counts[bounce["call"]] += 1
    return counts
