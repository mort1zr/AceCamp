"""Motor de puntuación de tenis (TA-27).

Máquina de estados en Python puro, sin dependencias de visión: recibe el
ganador de cada punto y lleva puntos, juegos, sets, tie-breaks y el sacador.

Los jugadores se identifican como 1 y 2.

Ejemplo:

    match = Match(MatchFormat(best_of=3), first_server=1)
    match.point_won_by(1)
    match.score_text()   # '0-0 15-0'
"""

from __future__ import annotations

from dataclasses import dataclass, field

PLAYERS = (1, 2)
POINT_NAMES = ("0", "15", "30", "40")

# Modos del set decisivo
FINAL_SET_TIEBREAK = "tiebreak"  # tie-break normal a 7 en el último set
FINAL_SET_ADVANTAGE = "advantage"  # sin tie-break: se gana por dos juegos
FINAL_SET_MATCH_TIEBREAK = "match_tiebreak"  # el último set es un super tie-break a 10
FINAL_SET_MODES = (FINAL_SET_TIEBREAK, FINAL_SET_ADVANTAGE, FINAL_SET_MATCH_TIEBREAK)


def other(player: int) -> int:
    return 2 if player == 1 else 1


@dataclass(frozen=True)
class MatchFormat:
    best_of: int = 3
    games_per_set: int = 6
    tiebreak_points: int = 7
    match_tiebreak_points: int = 10
    no_ad: bool = False
    final_set: str = FINAL_SET_TIEBREAK

    def __post_init__(self):
        if self.best_of < 1 or self.best_of % 2 == 0:
            raise ValueError("best_of debe ser un número impar positivo (1, 3, 5...)")
        if self.games_per_set < 1:
            raise ValueError("games_per_set debe ser positivo")
        if self.tiebreak_points < 1 or self.match_tiebreak_points < 1:
            raise ValueError("los puntos de tie-break deben ser positivos")
        if self.final_set not in FINAL_SET_MODES:
            raise ValueError(f"final_set debe ser uno de {FINAL_SET_MODES}")

    @property
    def sets_to_win(self) -> int:
        return self.best_of // 2 + 1


@dataclass(frozen=True)
class PointResult:
    """Lo que cambió con un punto."""

    winner: int
    game_winner: int | None = None
    set_winner: int | None = None
    match_winner: int | None = None


@dataclass
class Match:
    format: MatchFormat = field(default_factory=MatchFormat)
    first_server: int = 1

    def __post_init__(self):
        if self.first_server not in PLAYERS:
            raise ValueError("first_server debe ser 1 o 2")
        self.completed_sets: list[tuple[int, int]] = []
        # Puntos del tie-break de cada set terminado (None si no hubo tie-break).
        self.tiebreak_scores: list[tuple[int, int] | None] = []
        self.games = {1: 0, 2: 0}
        self.points = {1: 0, 2: 0}
        self.winner: int | None = None
        # Sacador del juego actual (en un tie-break: el que saca el primer punto).
        self._game_server = self.first_server
        self.in_tiebreak = self._starts_as_match_tiebreak()

    # ----------------------------------------------------------- consultas

    @property
    def sets_won(self) -> dict[int, int]:
        won = {1: 0, 2: 0}
        for a, b in self.completed_sets:
            won[1 if a > b else 2] += 1
        return won

    @property
    def is_final_set(self) -> bool:
        return all(count == self.format.sets_to_win - 1 for count in self.sets_won.values())

    @property
    def is_match_tiebreak(self) -> bool:
        return self.in_tiebreak and self.is_final_set and self.format.final_set == FINAL_SET_MATCH_TIEBREAK

    @property
    def server(self) -> int:
        """Quién saca el próximo punto."""
        if not self.in_tiebreak:
            return self._game_server
        # Tie-break: el primero saca un punto y luego se alterna cada dos.
        played = self.points[1] + self.points[2]
        return self._game_server if ((played + 1) // 2) % 2 == 0 else other(self._game_server)

    def game_score(self) -> tuple[str, str]:
        """Marcador del juego actual: ('30', '15'), ('40', 'AD') o puntos del tie-break."""
        p1, p2 = self.points[1], self.points[2]
        if self.in_tiebreak:
            return str(p1), str(p2)
        if p1 >= 3 and p2 >= 3 and not self.format.no_ad:
            if p1 == p2:
                return "40", "40"
            return ("AD", "40") if p1 > p2 else ("40", "AD")
        return POINT_NAMES[min(p1, 3)], POINT_NAMES[min(p2, 3)]

    def score(self) -> dict:
        """Marcador completo en un diccionario apto para JSON."""
        return {
            "sets": [list(s) for s in self.completed_sets],
            "tiebreaks": [list(t) if t else None for t in self.tiebreak_scores],
            "games": [self.games[1], self.games[2]],
            "points": list(self.game_score()),
            "in_tiebreak": self.in_tiebreak,
            "server": None if self.winner else self.server,
            "winner": self.winner,
        }

    def score_text(self) -> str:
        """Marcador legible: '6-4 7-6(5) 3-2 30-15'. Con el partido terminado, solo los sets.

        Entre paréntesis van los puntos del perdedor del tie-break, como en la notación habitual.
        """
        parts = []
        for (a, b), tiebreak in zip(self.completed_sets, self.tiebreak_scores):
            parts.append(f"{a}-{b}" + (f"({min(tiebreak)})" if tiebreak else ""))
        if self.winner is None:
            parts.append(f"{self.games[1]}-{self.games[2]}")
            parts.append("-".join(self.game_score()))
        return " ".join(parts)

    # ------------------------------------------------------------- puntos

    def point_won_by(self, player: int) -> PointResult:
        if player not in PLAYERS:
            raise ValueError("player debe ser 1 o 2")
        if self.winner is not None:
            raise RuntimeError("el partido ya terminó")

        self.points[player] += 1
        if not self._game_is_over(player):
            return PointResult(winner=player)

        was_tiebreak = self.in_tiebreak
        tiebreak_points = (self.points[1], self.points[2]) if was_tiebreak else None
        self.points = {1: 0, 2: 0}
        self.games[player] += 1
        # El sacador rota también después de un tie-break: saca el primer juego
        # del set siguiente quien recibió el primer punto del tie-break.
        self._game_server = other(self._game_server)
        self.in_tiebreak = False

        if not (was_tiebreak or self._set_is_over(player)):
            if self._set_goes_to_tiebreak():
                self.in_tiebreak = True
            return PointResult(winner=player, game_winner=player)

        self.completed_sets.append((self.games[1], self.games[2]))
        self.tiebreak_scores.append(tiebreak_points)
        self.games = {1: 0, 2: 0}
        if self.sets_won[player] == self.format.sets_to_win:
            self.winner = player
            return PointResult(winner=player, game_winner=player, set_winner=player, match_winner=player)

        self.in_tiebreak = self._starts_as_match_tiebreak()
        return PointResult(winner=player, game_winner=player, set_winner=player)

    # ------------------------------------------------------------ reglas

    def _game_is_over(self, player: int) -> bool:
        mine, theirs = self.points[player], self.points[other(player)]
        if self.in_tiebreak:
            target = self.format.match_tiebreak_points if self.is_match_tiebreak else self.format.tiebreak_points
            return mine >= target and mine - theirs >= 2
        if self.format.no_ad:
            return mine >= 4
        return mine >= 4 and mine - theirs >= 2

    def _set_is_over(self, player: int) -> bool:
        mine, theirs = self.games[player], self.games[other(player)]
        return mine >= self.format.games_per_set and mine - theirs >= 2

    def _set_goes_to_tiebreak(self) -> bool:
        n = self.format.games_per_set
        if not (self.games[1] == self.games[2] == n):
            return False
        return not (self.is_final_set and self.format.final_set == FINAL_SET_ADVANTAGE)

    def _starts_as_match_tiebreak(self) -> bool:
        return self.is_final_set and self.format.best_of > 1 and self.format.final_set == FINAL_SET_MATCH_TIEBREAK
