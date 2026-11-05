"""Estado de las estadísticas en cada fotograma, para dibujarlas sobre el vídeo (TA-13).

Sustituye a la tabla de pandas de main.py, que dividía entre cero antes del primer
golpe y mostraba "nan" en el vídeo. Aquí un valor que todavía no se puede medir es
None, y el dibujo lo muestra como "-".
"""

from __future__ import annotations

from dataclasses import dataclass

PLAYERS = (1, 2)


@dataclass(frozen=True)
class PlayerFrameStats:
    shots: int = 0
    last_shot_kmh: float | None = None
    avg_shot_kmh: float | None = None
    # Velocidad del jugador mientras la pelota viaja hacia él (se mide en cada golpe del rival).
    last_speed_kmh: float | None = None
    avg_speed_kmh: float | None = None


@dataclass(frozen=True)
class FrameState:
    players: dict[int, PlayerFrameStats]


def build_frame_states(shots, num_frames):
    """Lista de FrameState, uno por fotograma, a partir de los golpes de stats.shots.measure_shots().

    El estado cambia solo en los fotogramas con golpe: los fotogramas intermedios
    comparten el mismo objeto, así que la memoria depende del número de golpes y no
    de la duración del vídeo.
    """
    totals = {p: {"shots": 0, "shot_sum": 0.0, "speed_count": 0, "speed_sum": 0.0} for p in PLAYERS}
    current = FrameState({p: PlayerFrameStats() for p in PLAYERS})
    changes = {}
    for shot in sorted(shots, key=lambda s: s["frame"]):
        hitter = shot["player"]
        opponent = 1 if hitter == 2 else 2
        t_hit, t_opp = totals[hitter], totals[opponent]
        t_hit["shots"] += 1
        t_hit["shot_sum"] += shot["speedKmh"]
        t_opp["speed_count"] += 1
        t_opp["speed_sum"] += shot["opponentSpeedKmh"]
        players = dict(current.players)
        players[hitter] = PlayerFrameStats(
            shots=t_hit["shots"],
            last_shot_kmh=shot["speedKmh"],
            avg_shot_kmh=t_hit["shot_sum"] / t_hit["shots"],
            last_speed_kmh=current.players[hitter].last_speed_kmh,
            avg_speed_kmh=current.players[hitter].avg_speed_kmh,
        )
        players[opponent] = PlayerFrameStats(
            shots=current.players[opponent].shots,
            last_shot_kmh=current.players[opponent].last_shot_kmh,
            avg_shot_kmh=current.players[opponent].avg_shot_kmh,
            last_speed_kmh=shot["opponentSpeedKmh"],
            avg_speed_kmh=t_opp["speed_sum"] / t_opp["speed_count"],
        )
        current = FrameState(players)
        changes[shot["frame"]] = current

    states, current = [], FrameState({p: PlayerFrameStats() for p in PLAYERS})
    for i in range(num_frames):
        current = changes.get(i, current)
        states.append(current)
    return states
