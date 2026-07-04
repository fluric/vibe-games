"""
Connect Four game environment — mirrors connectFourEngine.ts exactly.

Board layout: 42 cells, row-major (row 0 = top, row 5 = bottom).
Position = row * 7 + col.
"""
from __future__ import annotations

import copy
import numpy as np
from typing import List, Optional

from rl.core.interfaces import BaseEnv

ROWS = 6
COLS = 7

# Mirrors PlayerPiece = 'X' | 'O'
PLAYER_X = 1   # internal representation
PLAYER_O = -1
EMPTY = 0


class ConnectFourEnv(BaseEnv):
    """
    Pure Python Connect Four environment.

    All state is stored in self.board (np.array of shape (42,), dtype int8).
    Values: 1 = X, -1 = O, 0 = empty.
    """

    def __init__(self) -> None:
        self.board = np.zeros(42, dtype=np.int8)
        self._turn: int = PLAYER_X   # X goes first
        self.winner: Optional[int] = None  # PLAYER_X, PLAYER_O, 0 (draw), None (ongoing)

    # ── Factory ──────────────────────────────────────────────────────────────

    @classmethod
    def from_state_dict(cls, state: dict) -> "ConnectFourEnv":
        """Create from the JSON state shape used by the TypeScript backend."""
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
        """Convert back to the TypeScript-compatible JSON shape."""
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
            "winner": winner_map[self.winner],
        }

    # ── Core interface ────────────────────────────────────────────────────────

    def reset(self) -> "ConnectFourEnv":
        self.board = np.zeros(42, dtype=np.int8)
        self._turn = PLAYER_X
        self.winner = None
        return self

    def clone(self) -> "ConnectFourEnv":
        env = ConnectFourEnv()
        env.board = self.board.copy()
        env._turn = self._turn
        env.winner = self.winner
        return env

    def legal_actions(self) -> List[int]:
        """Returns list of valid column indices (0–6)."""
        if self.winner is not None:
            return []
        return [col for col in range(COLS) if self.board[col] == EMPTY]

    def is_terminal(self) -> bool:
        return self.winner is not None

    def step(self, column: int) -> "ConnectFourEnv":
        """
        Apply a move (drop piece into given column).
        Returns self (mutates in-place). Raises ValueError on illegal moves.
        """
        if self.winner is not None:
            raise ValueError("Game is already finished")
        if column < 0 or column >= COLS:
            raise ValueError(f"Invalid column {column}")

        # Find lowest empty slot in this column (bottom = row 5)
        target_row = -1
        for r in range(ROWS - 1, -1, -1):
            if self.board[r * COLS + column] == EMPTY:
                target_row = r
                break
        if target_row == -1:
            raise ValueError(f"Column {column} is full")

        self.board[target_row * COLS + column] = self._turn

        # Check win / draw
        if self._check_win(self._turn):
            self.winner = self._turn
        elif np.all(self.board != EMPTY):
            self.winner = 0  # draw
        else:
            self._turn = PLAYER_O if self._turn == PLAYER_X else PLAYER_X

        return self

    @property
    def turn(self) -> int:
        return self._turn

    # ── Encoding for neural network ──────────────────────────────────────────

    def encode(self) -> np.ndarray:
        """
        Encode the board as a (3, 6, 7) float32 tensor:
          Plane 0: cells occupied by the current player
          Plane 1: cells occupied by the opponent
          Plane 2: all-ones (constant plane — lets the NN learn whose turn it is)
        """
        planes = np.zeros((3, ROWS, COLS), dtype=np.float32)
        board_2d = self.board.reshape(ROWS, COLS)
        planes[0] = (board_2d == self._turn).astype(np.float32)
        planes[1] = (board_2d == -self._turn).astype(np.float32)
        planes[2] = 1.0  # constant plane
        return planes

    # ── Value from perspective of a given player ─────────────────────────────

    def outcome(self, player: int) -> Optional[float]:
        """
        Returns the game outcome from `player`'s perspective once terminal:
          +1 = win, -1 = loss, 0 = draw, None = not terminal.
        """
        if self.winner is None:
            return None
        if self.winner == 0:
            return 0.0
        return 1.0 if self.winner == player else -1.0

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _check_win(self, player: int) -> bool:
        b = self.board
        # Horizontal
        for r in range(ROWS):
            for c in range(COLS - 3):
                idx = r * COLS + c
                if b[idx] == player and b[idx+1] == player and b[idx+2] == player and b[idx+3] == player:
                    return True
        # Vertical
        for r in range(ROWS - 3):
            for c in range(COLS):
                idx = r * COLS + c
                if b[idx] == player and b[idx+COLS] == player and b[idx+2*COLS] == player and b[idx+3*COLS] == player:
                    return True
        # Diagonal top-left → bottom-right
        for r in range(ROWS - 3):
            for c in range(COLS - 3):
                idx = r * COLS + c
                if b[idx] == player and b[idx+COLS+1] == player and b[idx+2*COLS+2] == player and b[idx+3*COLS+3] == player:
                    return True
        # Diagonal bottom-left → top-right
        for r in range(3, ROWS):
            for c in range(COLS - 3):
                idx = r * COLS + c
                if b[idx] == player and b[idx-COLS+1] == player and b[idx-2*COLS+2] == player and b[idx-3*COLS+3] == player:
                    return True
        return False

    def __repr__(self) -> str:
        symbols = {PLAYER_X: "X", PLAYER_O: "O", EMPTY: "."}
        rows = []
        for r in range(ROWS):
            rows.append(" ".join(symbols[int(self.board[r * COLS + c])] for c in range(COLS)))
        turn_str = "X" if self._turn == PLAYER_X else "O"
        return "\n".join(rows) + f"\n  Turn: {turn_str}  Winner: {self.winner}"
