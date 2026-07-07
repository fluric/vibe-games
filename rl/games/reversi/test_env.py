from rl.games.reversi.env import ReversiEnv, PLAYER_X, PLAYER_O, EMPTY, PASS_ACTION

def run_tests():
    print("🧪 Testing ReversiEnv...")

    # 1. Initialization
    print("👉 Testing: initialization")
    env = ReversiEnv()
    assert env.turn == PLAYER_X
    assert env.winner is None
    assert env.board[27] == PLAYER_O
    assert env.board[28] == PLAYER_X
    assert env.board[35] == PLAYER_X
    assert env.board[36] == PLAYER_O

    # 2. Legal Actions
    print("👉 Testing: legal actions")
    moves = env.legal_actions()
    assert sorted(moves) == [19, 26, 37, 44]

    # 3. Step
    print("👉 Testing: step")
    env.step(19)
    assert env.turn == PLAYER_O
    assert env.board[19] == PLAYER_X
    assert env.board[27] == PLAYER_X

    # 4. Pass Action
    print("👉 Testing: pass action")
    pass_env = ReversiEnv()
    for i in range(64):
        pass_env.board[i] = PLAYER_O
    pass_env.board[0] = EMPTY
    pass_env._turn = PLAYER_X
    # X has no legal moves
    moves = pass_env.legal_actions()
    assert moves == [PASS_ACTION]
    
    pass_env.step(PASS_ACTION)
    assert pass_env.turn == PLAYER_O

    # 5. Terminal State
    print("👉 Testing: terminal state")
    term_env = ReversiEnv()
    for i in range(64):
        term_env.board[i] = PLAYER_O
    term_env.board[0] = PLAYER_X
    term_env._turn = PLAYER_X
    # X has no moves. O has no moves.
    # We step pass for X, which will trigger terminal check?
    # Actually step checks my_moves and opp_moves at the END.
    # So if X passes, it checks if O has moves and if X has moves.
    # Since neither has moves, winner is evaluated.
    term_env.board[0] = EMPTY
    term_env.step(PASS_ACTION)
    assert term_env.winner == PLAYER_O
    assert term_env.is_terminal() == True

    # 6. Encode
    print("👉 Testing: encode")
    env2 = ReversiEnv()
    tensor = env2.encode()
    assert tensor.shape == (3, 8, 8)
    assert tensor[0][3][4] == 1.0  # PLAYER_X at 28
    assert tensor[1][3][3] == 1.0  # PLAYER_O at 27
    assert tensor[2][0][0] == 1.0  # Constant plane

    print("✅ All ReversiEnv tests passed!")

if __name__ == "__main__":
    run_tests()
