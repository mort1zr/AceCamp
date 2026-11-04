import pytest

from scoring import FINAL_SET_ADVANTAGE, FINAL_SET_MATCH_TIEBREAK, Match, MatchFormat


def play(match, sequence):
    """Juega una secuencia de ganadores de punto, p. ej. '1122' o [1, 1, 2]."""
    results = [match.point_won_by(int(p)) for p in sequence]
    return results[-1] if results else None


def win_game(match, player):
    return play(match, [player] * 4)


def win_games(match, player, n):
    for _ in range(n):
        win_game(match, player)


# --------------------------------------------------------------- juegos


def test_points_are_named_like_in_tennis():
    match = Match()
    assert match.game_score() == ("0", "0")
    play(match, "1")
    assert match.game_score() == ("15", "0")
    play(match, "12")
    assert match.game_score() == ("30", "15")
    play(match, "2")
    assert match.game_score() == ("30", "30")
    play(match, "1")
    assert match.game_score() == ("40", "30")


def test_game_won_at_40_to_30():
    match = Match()
    result = play(match, "11121")

    assert result.game_winner == 1
    assert match.games == {1: 1, 2: 0}
    assert match.game_score() == ("0", "0")


def test_deuce_and_advantage():
    match = Match()
    play(match, "111222")
    assert match.game_score() == ("40", "40")

    play(match, "1")
    assert match.game_score() == ("AD", "40")

    play(match, "2")
    assert match.game_score() == ("40", "40")

    play(match, "2")
    assert match.game_score() == ("40", "AD")

    result = play(match, "2")
    assert result.game_winner == 2
    assert match.games == {1: 0, 2: 1}


def test_no_ad_deciding_point_at_40_40():
    match = Match(MatchFormat(no_ad=True))
    play(match, "111222")
    assert match.game_score() == ("40", "40")

    result = play(match, "2")

    assert result.game_winner == 2


# ------------------------------------------------------------------ sets


def test_set_won_6_4():
    match = Match()
    win_games(match, 1, 3)
    win_games(match, 2, 4)
    win_games(match, 1, 2)

    result = win_game(match, 1)

    assert result.set_winner == 1
    assert match.completed_sets == [(6, 4)]
    assert match.games == {1: 0, 2: 0}


def test_5_5_needs_two_games_7_5():
    match = Match()
    win_games(match, 1, 5)
    win_games(match, 2, 5)
    win_game(match, 1)
    assert match.completed_sets == [] and match.games == {1: 6, 2: 5}

    result = win_game(match, 1)

    assert result.set_winner == 1
    assert match.completed_sets == [(7, 5)]


def test_6_6_goes_to_tiebreak_and_7_6_ends_the_set():
    match = Match()
    win_games(match, 1, 5)
    win_games(match, 2, 6)
    win_game(match, 1)
    assert match.in_tiebreak
    assert match.game_score() == ("0", "0")

    play(match, "1212121212")  # 5-5 en el tie-break
    assert match.game_score() == ("5", "5")
    result = play(match, "11")

    assert result.set_winner == 1
    assert match.completed_sets == [(7, 6)]
    assert match.tiebreak_scores == [(7, 5)]
    assert not match.in_tiebreak
    assert match.score_text() == "7-6(5) 0-0 0-0"


def reach_6_6(match):
    for _ in range(6):
        win_game(match, 1)
        win_game(match, 2)
    assert match.in_tiebreak


def test_tiebreak_goes_beyond_7_until_two_points_ahead():
    match = Match()
    reach_6_6(match)
    play(match, "121212121212")  # 6-6
    play(match, "1")  # 7-6: no basta
    assert match.in_tiebreak
    play(match, "2")  # 7-7
    play(match, "22")  # 7-9

    assert match.completed_sets == [(6, 7)]
    assert match.tiebreak_scores == [(7, 9)]


# --------------------------------------------------------------- partido


def test_best_of_three_ends_after_two_sets():
    match = Match(MatchFormat(best_of=3))
    win_games(match, 1, 11)
    result = win_game(match, 1)

    assert result.match_winner == 1
    assert match.winner == 1
    assert match.completed_sets == [(6, 0), (6, 0)]
    assert match.score() == {
        "sets": [[6, 0], [6, 0]],
        "tiebreaks": [None, None],
        "games": [0, 0],
        "points": ["0", "0"],
        "in_tiebreak": False,
        "server": None,
        "winner": 1,
    }
    assert match.score_text() == "6-0 6-0"


def test_best_of_five_needs_three_sets():
    match = Match(MatchFormat(best_of=5))
    win_games(match, 1, 6)
    win_games(match, 2, 6)
    win_games(match, 1, 6)
    assert match.winner is None
    win_games(match, 1, 6)

    assert match.winner == 1
    assert match.sets_won == {1: 3, 2: 1}


def test_no_points_after_the_match_ends():
    match = Match(MatchFormat(best_of=1))
    win_games(match, 2, 6)

    with pytest.raises(RuntimeError):
        match.point_won_by(1)


def test_final_set_with_tiebreak_by_default():
    match = Match()
    win_games(match, 1, 6)
    win_games(match, 2, 6)
    reach_6_6(match)
    play(match, "1111111")

    assert match.winner == 1
    assert match.completed_sets == [(6, 0), (0, 6), (7, 6)]


def test_final_set_with_advantage_has_no_tiebreak():
    match = Match(MatchFormat(final_set=FINAL_SET_ADVANTAGE))
    win_games(match, 1, 6)
    win_games(match, 2, 6)
    for _ in range(6):
        win_game(match, 1)
        win_game(match, 2)
    assert not match.in_tiebreak
    win_game(match, 1)
    assert match.winner is None  # 7-6: hay que ganar por dos juegos
    win_game(match, 1)

    assert match.winner == 1
    assert match.completed_sets[-1] == (8, 6)


def test_advantage_rule_only_applies_to_the_final_set():
    match = Match(MatchFormat(final_set=FINAL_SET_ADVANTAGE))
    reach_6_6(match)

    assert match.in_tiebreak  # primer set: sí hay tie-break


def test_match_tiebreak_to_10_replaces_the_final_set():
    match = Match(MatchFormat(final_set=FINAL_SET_MATCH_TIEBREAK))
    win_games(match, 1, 6)
    win_games(match, 2, 6)
    assert match.in_tiebreak and match.is_match_tiebreak

    play(match, "1" * 9)
    assert match.winner is None  # a 7 no basta en un super tie-break
    result = play(match, "1")

    assert result.match_winner == 1
    assert match.completed_sets[-1] == (1, 0)
    assert match.tiebreak_scores[-1] == (10, 0)
    assert match.score_text() == "6-0 0-6 1-0(0)"


def test_best_of_one_never_starts_with_a_match_tiebreak():
    match = Match(MatchFormat(best_of=1, final_set=FINAL_SET_MATCH_TIEBREAK))

    assert not match.in_tiebreak


# ---------------------------------------------------------------- saque


def test_server_alternates_every_game():
    match = Match(first_server=2)
    servers = []
    for _ in range(4):
        servers.append(match.server)
        win_game(match, 1)

    assert servers == [2, 1, 2, 1]


def test_server_in_tiebreak_changes_after_first_point_then_every_two():
    match = Match(first_server=1)
    reach_6_6(match)  # 12 juegos: vuelve a sacar el 1
    servers = []
    for p in "121212121212":
        servers.append(match.server)
        play(match, p)

    assert servers == [1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2, 1]


def test_after_tiebreak_the_first_receiver_serves_the_next_set():
    match = Match(first_server=1)
    reach_6_6(match)
    first_tiebreak_server = match.server
    play(match, "1111111")

    assert match.server != first_tiebreak_server


def test_score_dict_during_a_game():
    match = Match(first_server=2)
    win_game(match, 1)
    play(match, "12")

    assert match.score() == {
        "sets": [],
        "tiebreaks": [],
        "games": [1, 0],
        "points": ["15", "15"],
        "in_tiebreak": False,
        "server": 1,
        "winner": None,
    }
    assert match.score_text() == "1-0 15-15"


# ---------------------------------------------------------- validaciones


@pytest.mark.parametrize(
    "kwargs",
    [
        {"best_of": 2},
        {"best_of": 0},
        {"games_per_set": 0},
        {"tiebreak_points": 0},
        {"match_tiebreak_points": 0},
        {"final_set": "otro"},
    ],
)
def test_invalid_formats_are_rejected(kwargs):
    with pytest.raises(ValueError):
        MatchFormat(**kwargs)


def test_invalid_players_are_rejected():
    with pytest.raises(ValueError):
        Match(first_server=3)
    with pytest.raises(ValueError):
        Match().point_won_by(0)
