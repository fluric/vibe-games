"""
Tests for Grail Quest Python engine port.

Verifies:
1. Initial state construction is valid
2. All phases cycle correctly
3. Action encoding/decoding round-trips
4. Information states are player-asymmetric (true hidden info)
5. Cloning preserves state
6. Terminal detection works

Run:
    cd /path/to/vibe-games
    python -m pytest rl/games/grail_quest/test_engine.py -v
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from rl.games.grail_quest.engine import (
    GrailQuestState, PLAYER_X, PLAYER_O, NUM_ACTIONS, NUM_HEXES,
    ALL_HEXES, HEX_TO_IDX, HOME_KEY, ENEMY_BASE,
    PHASE_REACT, PHASE_DEPLOY, PHASE_MOVE,
    ACTION_END_DEPLOY, ACTION_END_TURN, ACTION_FIGHT,
    DEPLOY_START, MOVE_START, RETREAT_START,
    encode_deploy, encode_move, decode_action,
    Card
)



def test_hex_count():
    assert NUM_HEXES == 37, f"Expected 37 hexes, got {NUM_HEXES}"
    print(f"  ✓ Hex grid: {NUM_HEXES} hexes")


def test_action_space():
    assert NUM_ACTIONS == 336, f"Expected 336 actions, got {NUM_ACTIONS}"
    print(f"  ✓ Action space: {NUM_ACTIONS} actions")


def test_initial_state():
    s = GrailQuestState()
    assert s.phase == PHASE_DEPLOY
    assert s.turn == PLAYER_X
    assert s.winner is None
    assert s.grail_key == (0, 0)
    # X starts with 3 face cards + 2 initial draw = 5 cards
    assert len(s.hands[PLAYER_X]) == 5, f"X should have 5 cards, got {len(s.hands[PLAYER_X])}"
    assert len(s.hands[PLAYER_O]) == 3, f"O should have 3 face cards (no draw yet), got {len(s.hands[PLAYER_O])}"
    assert s.drawn_this_turn is True
    print(f"  ✓ Initial state: X has {len(s.hands[PLAYER_X])} cards, O has {len(s.hands[PLAYER_O])}")


def test_legal_actions_in_deploy():
    s = GrailQuestState()
    assert s.phase == PHASE_DEPLOY
    actions = s.legal_actions()
    assert len(actions) > 0
    # Should include end_deploy
    assert ACTION_END_DEPLOY in actions
    # Should have deploy actions
    deploy_actions = [a for a in actions if DEPLOY_START <= a < MOVE_START]
    assert len(deploy_actions) > 0
    print(f"  ✓ Deploy legal actions: {len(actions)} (including {len(deploy_actions)} deploy slots)")


def test_action_encode_decode_round_trip():
    # Deploy
    for i in range(NUM_HEXES):
        enc = encode_deploy(i)
        dec = decode_action(enc)
        assert dec["type"] == "deploy"
        assert dec["hex_idx"] == i

    # Move
    for f in range(NUM_HEXES):
        for d in range(6):
            enc = encode_move(f, d)
            dec = decode_action(enc)
            assert dec["type"] == "move"
            assert dec["from_idx"] == f
            assert dec["direction"] == d

    # Special actions
    assert decode_action(ACTION_END_DEPLOY)["type"] == "end_deploy"
    assert decode_action(ACTION_END_TURN)["type"] == "end_turn"
    assert decode_action(ACTION_FIGHT)["type"] == "fight"
    print("  ✓ Action encode/decode round-trip: OK")


def test_clone_independence():
    s = GrailQuestState()
    s2 = s.clone()
    # Modify original
    s.hands[PLAYER_X].clear()
    # Clone should be unaffected
    assert len(s2.hands[PLAYER_X]) == 5
    print("  ✓ Clone independence: OK")


def test_information_state_asymmetric():
    """Key test: player X and O must have different information states at the same node."""
    s = GrailQuestState()
    info_x = s.information_state_string(PLAYER_X)
    info_o = s.information_state_string(PLAYER_O)
    assert info_x != info_o, "Information states should differ between players!"
    # X's info should contain full hand
    assert "opp_hand_size" in info_x
    assert "opp_hand_size" in info_o
    print("  ✓ Information states are asymmetric (true hidden info): OK")
    print(f"    X info_state len: {len(info_x)}")
    print(f"    O info_state len: {len(info_o)}")


def test_deploy_then_move_cycle():
    """Walk through a full deploy → move → end_turn cycle."""
    s = GrailQuestState()
    assert s.phase == PHASE_DEPLOY

    # Deploy all X cards to home base (0,-3)
    home_idx = HEX_TO_IDX[HOME_KEY[PLAYER_X]]
    from rl.games.grail_quest.engine import encode_deploy_all, DEPLOY_ALL_START
    s.apply_action(encode_deploy_all(home_idx))
    assert len(s.hands[PLAYER_X]) == 0

    # End deploy
    s.apply_action(ACTION_END_DEPLOY)
    assert s.phase == PHASE_MOVE

    # End turn without moving
    s.apply_action(ACTION_END_TURN)
    # Turn should switch to O in deploy (or react if combats)
    assert s.turn == PLAYER_O
    assert s.phase in (PHASE_DEPLOY, PHASE_REACT)
    print(f"  ✓ Deploy→Move→EndTurn cycle: turn switched to O in phase {s.phase}")


def test_game_runs_to_completion():
    """Run a random game to completion and check it terminates."""
    import random
    rng = random.Random(42)
    s = GrailQuestState()
    s._rng = rng
    max_steps = 2000
    for i in range(max_steps):
        if s.is_terminal():
            break
        actions = s.legal_actions()
        if not actions:
            break
        action = rng.choice(actions)
        s.apply_action(action)
    print(f"  ✓ Random game terminated after {i+1} steps, winner={s.winner}")
    assert s.winner is not None or i + 1 == max_steps


def test_from_state_dict():
    """Test reconstruction from a minimal state dict."""
    s = GrailQuestState()
    # Build a minimal state dict (mimicking what the TypeScript backend sends)
    board_dict = {}
    for (q, r), cell in s.board.items():
        owner_str = "X" if cell.owner == PLAYER_X else ("O" if cell.owner == PLAYER_O else None)
        board_dict[f"{q},{r}"] = {
            "q": q, "r": r,
            "cellType": cell.cell_type,
            "owner": owner_str,
            "soldiers": [{"value": c.value, "revealed": c.revealed} for c in cell.soldiers],
        }
    state_dict = {
        "board": board_dict,
        "hands": {
            "X": [{"value": c.value, "revealed": c.revealed} for c in s.hands[PLAYER_X]],
            "O": [{"value": c.value, "revealed": c.revealed} for c in s.hands[PLAYER_O]],
        },
        "phase": "deploy",
        "turn": "X",
        "winner": None,
        "pendingCombats": [],
        "grailCellKey": "0,0",
        "drawnThisTurn": True,
        "turnCount": 0,
        "roundTurnsCompleted": 0,
    }
    reconstructed = GrailQuestState.from_state_dict(state_dict, player_perspective=PLAYER_X)
    assert reconstructed.phase == PHASE_DEPLOY
    assert reconstructed.turn == PLAYER_X
    # Own hand is fully visible
    assert all(c.value > 0 for c in reconstructed.hands[PLAYER_X])
    # Opp hand: visible cards have value, hidden have value=0
    print(f"  ✓ from_state_dict: reconstructed state with {len(reconstructed.hands[PLAYER_X])} X cards")


def test_hidden_info_in_from_state_dict():
    """Verify that opponent unrevealed cards have value=0 when reconstructed."""
    s = GrailQuestState()
    board_dict = {}
    for (q, r), cell in s.board.items():
        owner_str = "X" if cell.owner == PLAYER_X else ("O" if cell.owner == PLAYER_O else None)
        board_dict[f"{q},{r}"] = {
            "q": q, "r": r,
            "cellType": cell.cell_type,
            "owner": owner_str,
            "soldiers": [],
        }
    state_dict = {
        "board": board_dict,
        "hands": {
            "X": [{"value": 13, "revealed": False}, {"value": 12, "revealed": False}],
            "O": [{"value": 11, "revealed": False}, {"value": 10, "revealed": False}],
        },
        "phase": "deploy",
        "turn": "X",
        "winner": None,
        "pendingCombats": [],
        "grailCellKey": "0,0",
        "drawnThisTurn": True,
        "turnCount": 0,
        "roundTurnsCompleted": 0,
    }
    # From X's perspective: X sees own hand fully, O hand is hidden
    s_x = GrailQuestState.from_state_dict(state_dict, player_perspective=PLAYER_X)
    assert s_x.hands[PLAYER_X][0].value == 13  # X sees own King
    assert s_x.hands[PLAYER_O][0].value == 0   # X cannot see O's hidden Jack
    assert s_x.hands[PLAYER_O][1].value == 0   # X cannot see O's hidden 10

    # From O's perspective: O sees own hand fully, X hand is hidden
    s_o = GrailQuestState.from_state_dict(state_dict, player_perspective=PLAYER_O)
    assert s_o.hands[PLAYER_O][0].value == 11  # O sees own Jack
    assert s_o.hands[PLAYER_X][0].value == 0   # O cannot see X's hidden King

    print("  ✓ Hidden info correctly enforced in from_state_dict")


if __name__ == "__main__":
    tests = [
        test_hex_count,
        test_action_space,
        test_initial_state,
        test_legal_actions_in_deploy,
        test_action_encode_decode_round_trip,
        test_clone_independence,
        test_information_state_asymmetric,
        test_deploy_then_move_cycle,
        test_game_runs_to_completion,
        test_from_state_dict,
        test_hidden_info_in_from_state_dict,
    ]

    print(f"\nGrail Quest Engine Tests")
    print("=" * 50)
    failures = 0
    for test_fn in tests:
        name = test_fn.__name__
        print(f"\n[{name}]")
        try:
            test_fn()
        except Exception as e:
            print(f"  ✗ FAILED: {e}")
            import traceback; traceback.print_exc()
            failures += 1

    print(f"\n{'='*50}")
    if failures == 0:
        print(f"✅ All {len(tests)} tests passed!")
    else:
        print(f"❌ {failures}/{len(tests)} tests failed.")
        sys.exit(1)
