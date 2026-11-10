"""Configuración del partido, correcciones y marcador punto a punto (TA-29).

El modelo propone el ganador de cada punto (TA-28); aquí se convierte en el marcador del
partido con el motor de TA-27, a partir de:

- la configuración del partido (sección match de config.yaml o un match.yaml con
  --match-config): formato, sacador inicial y marcador inicial (para un vídeo que empieza a
  mitad de partido);
- las correcciones (corrections.json con --corrections): el ganador correcto de los puntos que
  el entrenador revisó. Se reaplican en cada ejecución, así que corregir un punto actualiza el
  marcador del resto del partido sin volver a procesar el vídeo.

corrections.json: {"3": 1, "7": 2} → el punto 3 lo ganó el jugador 1 y el 7, el 2
(numeración de los puntos del informe, desde 1; 1 = jugador del fondo, 2 = el de cerca).
Un valor null anula el punto (no cuenta para el marcador: p. ej., un let o un punto repetido).

Los puntos sin ganador y sin corrección no cambian el marcador y quedan en la lista de revisión,
junto con los de confianza baja.
"""

from __future__ import annotations

import json
from pathlib import Path

from scoring import Match, MatchFormat
from scoring.engine import FINAL_SET_ADVANTAGE

POINT_VALUES = {"0": 0, "15": 1, "30": 2, "40": 3}
FORMAT_KEYS = ("best_of", "games_per_set", "tiebreak_points", "match_tiebreak_points", "no_ad", "final_set")
DEFAULT_MATCH = {"first_server": "auto", "best_of": 3, "games_per_set": 6, "tiebreak_points": 7,
                 "match_tiebreak_points": 10, "no_ad": False, "final_set": "tiebreak", "initial_score": None}


def load_corrections(path):
    """{número de punto: ganador (1, 2 o None)} desde corrections.json. Sin archivo, {}."""
    if not path:
        return {}
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("corrections.json debe ser un objeto: {\"3\": 1, \"7\": 2}")
    corrections = {}
    for key, winner in data.items():
        if winner not in (1, 2, None):
            raise ValueError(f"corrections.json: el ganador del punto {key} debe ser 1, 2 o null")
        corrections[int(key)] = winner
    return corrections


def _point_counts(points):
    """('40', 'AD') → (3, 4); ('30', '15') → (2, 1); en tie-break, los números tal cual."""
    a, b = (str(p).upper() for p in points)
    if "AD" in (a, b):
        return (4, 3) if a == "AD" else (3, 4)
    if a in POINT_VALUES and b in POINT_VALUES:
        return POINT_VALUES[a], POINT_VALUES[b]
    return int(a), int(b)


def new_match(settings, first_server):
    """Partido del motor TA-27 con el formato y el marcador inicial de settings (sección match)."""
    settings = {**DEFAULT_MATCH, **(settings or {})}
    match = Match(MatchFormat(**{k: settings[k] for k in FORMAT_KEYS}), first_server=first_server)
    initial = settings.get("initial_score")
    if initial:
        match.completed_sets = [tuple(s) for s in initial.get("sets", [])]
        match.tiebreak_scores = [None] * len(match.completed_sets)
        games = initial.get("games", [0, 0])
        match.games = {1: int(games[0]), 2: int(games[1])}
        n = match.format.games_per_set
        final_advantage = match.is_final_set and match.format.final_set == FINAL_SET_ADVANTAGE
        match.in_tiebreak = (games[0] == games[1] == n and not final_advantage) or match._starts_as_match_tiebreak()
        points = _point_counts(initial.get("points", ["0", "0"])) if not match.in_tiebreak else \
            tuple(int(p) for p in initial.get("points", [0, 0]))
        match.points = {1: points[0], 2: points[1]}
        match._game_server = int(initial.get("server", first_server))
    return match


def score_points(points, settings=None, corrections=None):
    """Copia de los puntos numerados con el marcador antes y después de cada uno.

    points: los de events.decide_winners() (con winner y confidence_level).
    Cada punto lleva:
    - number (desde 1); winner (el corregido si hay corrección), model_winner (el del modelo) y
      corrected; counted: si sumó al marcador;
    - set_number y game_number (juego dentro del set) en que se jugó;
    - expected_server: quién debía sacar según el marcador; server_mismatch si el modelo vio sacar
      a otro (señal de un saque mal detectado o de un sacador inicial mal configurado);
    - score_before / score_after (dict del motor) y score_text (marcador tras el punto).
    """
    settings = {**DEFAULT_MATCH, **(settings or {})}
    corrections = corrections or {}
    first_server = settings["first_server"]
    if first_server == "auto":
        first_server = next((p["server"] for p in points if p.get("server") in (1, 2)), 1)
    match = new_match(settings, int(first_server))
    if settings.get("initial_score") and "server" not in settings["initial_score"]:
        match._game_server = int(first_server)

    scored = []
    for number, point in enumerate(points, start=1):
        corrected = number in corrections
        winner = corrections[number] if corrected else point.get("winner")
        before = match.score()
        set_number = len(match.completed_sets) + 1
        game_number = match.games[1] + match.games[2] + 1
        expected_server = match.server if match.winner is None else None
        counted = winner in (1, 2) and match.winner is None
        if counted:
            match.point_won_by(winner)
        scored.append({
            **point, "number": number, "winner": winner, "model_winner": point.get("winner"),
            "corrected": corrected, "counted": counted, "set_number": set_number, "game_number": game_number,
            "expected_server": expected_server,
            "server_mismatch": point.get("server") in (1, 2) and expected_server is not None
            and point["server"] != expected_server,
            "score_before": before, "score_after": match.score(), "score_text": match.score_text(),
        })
    return scored, match


def review_list(scored_points):
    """Puntos para revisar a mano: confianza baja o sin ganador, que aún no se han corregido."""
    return [p["number"] for p in scored_points
            if not p["corrected"] and (p.get("winner") is None or p.get("confidence_level") == "baja")]
