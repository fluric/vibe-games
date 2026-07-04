import numpy as np
from rl.games.mill.env import MillEnv, PLAYER_X, PLAYER_O, EMPTY

def test_initial_state():
    env = MillEnv()
    assert env.phase == "placement"
    assert env.placements_remaining[PLAYER_X] == 9
    assert env.placements_remaining[PLAYER_O] == 9
    assert env.pieces_on_board[PLAYER_X] == 0
    assert env.pieces_on_board[PLAYER_O] == 0
    assert env.turn == PLAYER_X
    assert env.winner is None
    assert env.mill_formed_this_turn is False

def test_valid_placement():
    env = MillEnv()
    env.step(0)  # X places at 0
    
    assert env.board[0] == PLAYER_X
    assert env.placements_remaining[PLAYER_X] == 8
    assert env.pieces_on_board[PLAYER_X] == 1
    assert env.turn == PLAYER_O
    assert env.phase == "placement"

def test_mill_formation():
    env = MillEnv()
    env.step(0)  # X
    env.step(9)  # O
    env.step(1)  # X
    env.step(10) # O
    env.step(2)  # X forms mill (0,1,2)
    
    assert env.mill_formed_this_turn is True
    assert env.turn == PLAYER_X  # Still X's turn to remove
    
    env.step(9)  # X removes O from 9
    
    assert env.board[9] == EMPTY
    assert env.pieces_on_board[PLAYER_O] == 1
    assert env.mill_formed_this_turn is False
    assert env.turn == PLAYER_O

def test_movement_phase():
    env = MillEnv()
    # Manually transition to movement phase
    env.phase = "movement"
    env.placements_remaining = {PLAYER_X: 0, PLAYER_O: 0}
    env.pieces_on_board = {PLAYER_X: 4, PLAYER_O: 4}
    env.board[0] = PLAYER_X
    env.board[1] = EMPTY
    
    # Move from 0 to 1
    env.step(24 + 0 * 24 + 1)
    
    assert env.board[0] == EMPTY
    assert env.board[1] == PLAYER_X
    assert env.turn == PLAYER_O

def test_invalid_move():
    env = MillEnv()
    env.phase = "movement"
    env.placements_remaining = {PLAYER_X: 0, PLAYER_O: 0}
    env.pieces_on_board = {PLAYER_X: 4, PLAYER_O: 4}
    env.board[0] = PLAYER_X
    env.board[8] = EMPTY  # Not adjacent to 0
    
    try:
        env.step(24 + 0 * 24 + 8)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "Not adjacent" in str(e)

def test_state_dict_serialization():
    env = MillEnv()
    env.step(0)
    
    state = env.to_state_dict()
    assert state["board"][0] == "X"
    assert state["turn"] == "O"
    assert state["phase"] == "placement"
    
    env2 = MillEnv.from_state_dict(state)
    assert env2.board[0] == PLAYER_X
    assert env2.turn == PLAYER_O
    assert env2.phase == "placement"

def test_legal_actions_placement():
    env = MillEnv()
    env.step(0)
    actions = env.legal_actions()
    assert 0 not in actions
    assert 1 in actions
    assert len(actions) == 23

def test_legal_actions_movement():
    env = MillEnv()
    env.phase = "movement"
    env.placements_remaining = {PLAYER_X: 0, PLAYER_O: 0}
    env.pieces_on_board = {PLAYER_X: 4, PLAYER_O: 4}
    env.board[0] = PLAYER_X
    env.board[1] = EMPTY
    env.board[7] = PLAYER_O  # Blocked by O
    
    actions = env.legal_actions()
    # Can only move 0->1
    assert (24 + 0 * 24 + 1) in actions
    assert (24 + 0 * 24 + 7) not in actions
