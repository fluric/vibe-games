from __future__ import annotations

import copy
import numpy as np
from typing import List, Optional

from rl.core.interfaces import BaseEnv

ROWS = 8
COLS = 8
TOTAL_CELLS = 64

# Action 64 is the pass action
PASS_ACTION = 64

PLAYER_X = 1   # Black
PLAYER_O = -1  # White
EMPTY = 0

DIRECTIONS = [
    -9, -8, -7,
    -1,      1,
     7,  8,  9
]


class ReversiEnv(BaseEnv):
    """
    Pure Python Reversi environment.

    All state is stored in self.board (np.array of shape (64,), dtype int8).
    Values: 1 = X, -1 = O, 0 = empty.
    """

    def __init__(self) -> None:
        self.board = np.zeros(TOTAL_CELLS, dtype=np.int8)
        self.board[27] = PLAYER_O
        self.board[28] = PLAYER_X
        self.board[35] = PLAYER_X
        self.board[36] = PLAYER_O
        self._turn: int = PLAYER_X
        self.winner: Optional[int] = None

    # ── Factory ──────────────────────────────────────────────────────────────

    @classmethod
    def from_state_dict(cls, state: dict) -> "ReversiEnv":
        env = cls()
        raw_board = state["board"]
        for i, cell in enumerate(raw_board):
            if cell == "X":
                env.board[i] = PLAYER_X
            elif cell == "O":
                env.board[i] = PLAYER_O
            else:
                env.board[i] = EMPTY
        env._turn = PLAYER_X if state["turn"] == "X" else PLAYER_O
        
        # In Reversi, the game state could be passed with no moves available
        # Calculate winner correctly if terminal
        w = state.get("winner")
        if w == "X":
            env.winner = PLAYER_X
        elif w == "O":
            env.winner = PLAYER_O
        elif w == "draw":
            env.winner = 0
        else:
            env.winner = None
            
        return env

    def to_state_dict(self) -> dict:
        board = []
        for cell in self.board:
            if cell == PLAYER_X:
                board.append("X")
            elif cell == PLAYER_O:
                board.append("O")
            else:
                board.append(None)

        winner_map = {PLAYER_X: "X", PLAYER_O: "O", 0: "draw", None: None}
        return {
            "board": board,
            "turn": "X" if self._turn == PLAYER_X else "O",
            "winner": winner_map.get(self.winner),
        }

    # ── Core interface ────────────────────────────────────────────────────────

    def reset(self) -> "ReversiEnv":
        self.board = np.zeros(TOTAL_CELLS, dtype=np.int8)
        self.board[27] = PLAYER_O
        self.board[28] = PLAYER_X
        self.board[35] = PLAYER_X
        self.board[36] = PLAYER_O
        self._turn = PLAYER_X
        self.winner = None
        return self

    def clone(self) -> "ReversiEnv":
        env = ReversiEnv()
        env.board = self.board.copy()
        env._turn = self._turn
        env.winner = self.winner
        return env

    def legal_actions(self) -> List[int]:
        if self.winner is not None:
            return []
        
        moves = []
        for i in range(TOTAL_CELLS):
            if self.board[i] == EMPTY and len(self._get_flipped(i, self._turn)) > 0:
                moves.append(i)
                
        if len(moves) == 0:
            return [PASS_ACTION]
            
        return moves

    def is_terminal(self) -> bool:
        return self.winner is not None

    def step(self, action: int) -> "ReversiEnv":
        if self.winner is not None:
            raise ValueError("Game is already finished")
        if action < 0 or action > PASS_ACTION:
            raise ValueError(f"Invalid action {action}")

        next_turn = -self._turn

        if action == PASS_ACTION:
            # Verify pass is valid
            moves = self.legal_actions()
            if len(moves) > 0 and moves[0] != PASS_ACTION:
                raise ValueError("Cannot pass when legal moves are available")
            
            # Change turn
            self._turn = next_turn
        else:
            if self.board[action] != EMPTY:
                raise ValueError("Position is already occupied")

            flipped = self._get_flipped(action, self._turn)
            if len(flipped) == 0:
                raise ValueError("Invalid move: must flip at least one opponent disc")

            self.board[action] = self._turn
            for f in flipped:
                self.board[f] = self._turn

            self._turn = next_turn

        # Check for game over
        my_moves = self._has_legal_moves(self._turn)
        opp_moves = self._has_legal_moves(-self._turn)

        if not my_moves and not opp_moves:
            x_count = np.sum(self.board == PLAYER_X)
            o_count = np.sum(self.board == PLAYER_O)
            if x_count > o_count:
                self.winner = PLAYER_X
            elif o_count > x_count:
                self.winner = PLAYER_O
            else:
                self.winner = 0

        return self

    @property
    def turn(self) -> int:
        return self._turn

    # ── Encoding for neural network ──────────────────────────────────────────

    def encode(self) -> np.ndarray:
        planes = np.zeros((3, ROWS, COLS), dtype=np.float32)
        board_2d = self.board.reshape(ROWS, COLS)
        planes[0] = (board_2d == self._turn).astype(np.float32)
        planes[1] = (board_2d == -self._turn).astype(np.float32)
        planes[2] = 1.0  # constant plane
        return planes

    # ── Value from perspective of a given player ─────────────────────────────

    def outcome(self, player: int) -> Optional[float]:
        if self.winner is None:
            return None
        if self.winner == 0:
            return 0.0
        return 1.0 if self.winner == player else -1.0

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _get_flipped(self, pos: int, player: int) -> List[int]:
        flipped = []
        opponent = -player

        row = pos // COLS
        col = pos % COLS

        for d in DIRECTIONS:
            r = row
            c = col
            current_dir_flipped = []

            while True:
                if d == -9: r -= 1; c -= 1
                elif d == -8: r -= 1
                elif d == -7: r -= 1; c += 1
                elif d == -1: c -= 1
                elif d == 1: c += 1
                elif d == 7: r += 1; c -= 1
                elif d == 8: r += 1
                elif d == 9: r += 1; c += 1

                if r < 0 or r >= ROWS or c < 0 or c >= COLS:
                    break

                idx = r * COLS + c
                cell = self.board[idx]

                if cell == opponent:
                    current_dir_flipped.append(idx)
                elif cell == player:
                    if len(current_dir_flipped) > 0:
                        flipped.extend(current_dir_flipped)
                    break
                else:
                    break

        return flipped

    def _has_legal_moves(self, player: int) -> bool:
        for i in range(TOTAL_CELLS):
            if self.board[i] == EMPTY and len(self._get_flipped(i, player)) > 0:
                return True
        return False

    def __repr__(self) -> str:
        symbols = {PLAYER_X: "X", PLAYER_O: "O", EMPTY: "."}
        rows = []
        for r in range(ROWS):
            rows.append(" ".join(symbols[int(self.board[r * COLS + c])] for c in range(COLS)))
        turn_str = "X" if self._turn == PLAYER_X else "O"
        return "\n".join(rows) + f"\n  Turn: {turn_str}  Winner: {self.winner}"
