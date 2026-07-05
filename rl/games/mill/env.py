from __future__ import annotations

import copy
import numpy as np
from typing import List, Optional

from rl.core.interfaces import BaseEnv

PLAYER_X = 1
PLAYER_O = -1
EMPTY = 0

ADJACENCY_LIST = {
    0: [1, 7], 1: [0, 2, 9], 2: [1, 3], 3: [2, 4, 11],
    4: [3, 5], 5: [4, 6, 13], 6: [5, 7], 7: [6, 0, 15],
    8: [9, 15], 9: [8, 10, 1, 17], 10: [9, 11], 11: [10, 12, 3, 19],
    12: [11, 13], 13: [12, 14, 5, 21], 14: [13, 15], 15: [14, 8, 7, 23],
    16: [17, 23], 17: [16, 18, 9], 18: [17, 19], 19: [18, 20, 11],
    20: [19, 21], 21: [20, 22, 13], 22: [21, 23], 23: [22, 16, 15],
}

MILLS = [
    [0, 1, 2], [2, 3, 4], [4, 5, 6], [6, 7, 0],
    [8, 9, 10], [10, 11, 12], [12, 13, 14], [14, 15, 8],
    [16, 17, 18], [18, 19, 20], [20, 21, 22], [22, 23, 16],
    [1, 9, 17], [3, 11, 19], [5, 13, 21], [7, 15, 23],
]

POSITION_MILLS = {i: [m for m in MILLS if i in m] for i in range(24)}

# Map 24 nodes to a 7x7 grid for spatial 2D convs
# (row, col)
NODE_TO_SPATIAL = {
    0: (0, 0), 1: (0, 3), 2: (0, 6),
    7: (3, 0),             3: (3, 6),
    6: (6, 0), 5: (6, 3), 4: (6, 6),
    
    8: (1, 1), 9: (1, 3), 10: (1, 5),
    15: (3, 1),            11: (3, 5),
    14: (5, 1), 13: (5, 3), 12: (5, 5),
    
    16: (2, 2), 17: (2, 3), 18: (2, 4),
    23: (3, 2),             19: (3, 4),
    22: (4, 2), 21: (4, 3), 20: (4, 4),
}


class MillEnv(BaseEnv):
    def __init__(self) -> None:
        self.board = np.zeros(24, dtype=np.int8)
        self.phase: str = "placement"
        self.placements_remaining = {PLAYER_X: 9, PLAYER_O: 9}
        self.pieces_on_board = {PLAYER_X: 0, PLAYER_O: 0}
        self._turn: int = PLAYER_X
        self.winner: Optional[int] = None
        self.mill_formed_this_turn: bool = False
        self.moves_since_last_capture: int = 0
        self.position_history: List[str] = ["........................X"]

    @classmethod
    def from_state_dict(cls, state: dict) -> "MillEnv":
        env = cls()
        for i, cell in enumerate(state["board"]):
            if cell == "X":
                env.board[i] = PLAYER_X
            elif cell == "O":
                env.board[i] = PLAYER_O
            else:
                env.board[i] = EMPTY
        
        env.phase = state["phase"]
        env.placements_remaining[PLAYER_X] = state["placementsRemaining"]["X"]
        env.placements_remaining[PLAYER_O] = state["placementsRemaining"]["O"]
        env.pieces_on_board[PLAYER_X] = state["piecesOnBoard"]["X"]
        env.pieces_on_board[PLAYER_O] = state["piecesOnBoard"]["O"]
        env._turn = PLAYER_X if state["turn"] == "X" else PLAYER_O
        env.mill_formed_this_turn = state["millFormedThisTurn"]
        env.moves_since_last_capture = state["movesSinceLastCapture"]
        env.position_history = list(state.get("positionHistory", []))
        
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
            "phase": self.phase,
            "placementsRemaining": {
                "X": self.placements_remaining[PLAYER_X],
                "O": self.placements_remaining[PLAYER_O],
            },
            "piecesOnBoard": {
                "X": self.pieces_on_board[PLAYER_X],
                "O": self.pieces_on_board[PLAYER_O],
            },
            "turn": "X" if self._turn == PLAYER_X else "O",
            "winner": winner_map[self.winner],
            "millFormedThisTurn": self.mill_formed_this_turn,
            "movesSinceLastCapture": self.moves_since_last_capture,
            "positionHistory": self.position_history,
        }

    def reset(self) -> "MillEnv":
        self.__init__()
        return self

    def clone(self) -> "MillEnv":
        env = MillEnv()
        env.board = self.board.copy()
        env.phase = self.phase
        env.placements_remaining = self.placements_remaining.copy()
        env.pieces_on_board = self.pieces_on_board.copy()
        env._turn = self._turn
        env.winner = self.winner
        env.mill_formed_this_turn = self.mill_formed_this_turn
        env.moves_since_last_capture = self.moves_since_last_capture
        env.position_history = list(self.position_history)
        return env

    @property
    def turn(self) -> int:
        return self._turn

    def is_terminal(self) -> bool:
        return self.winner is not None

    def _is_piece_in_mill(self, position: int, player: int) -> bool:
        for line in POSITION_MILLS[position]:
            if self.board[line[0]] == player and self.board[line[1]] == player and self.board[line[2]] == player:
                return True
        return False

    def _are_all_pieces_in_mills(self, player: int) -> bool:
        for i in range(24):
            if self.board[i] == player and not self._is_piece_in_mill(i, player):
                return False
        return True

    def legal_actions(self) -> List[int]:
        if self.winner is not None:
            return []
            
        actions = []
        if self.mill_formed_this_turn:
            opponent = -self._turn
            all_in_mills = self._are_all_pieces_in_mills(opponent)
            for i in range(24):
                if self.board[i] == opponent:
                    if all_in_mills or not self._is_piece_in_mill(i, opponent):
                        actions.append(i)
            return actions

        if self.phase == "placement":
            for i in range(24):
                if self.board[i] == EMPTY:
                    actions.append(i)
        else:
            is_flying = self.pieces_on_board[self._turn] == 3
            for i in range(24):
                if self.board[i] == self._turn:
                    targets = range(24) if is_flying else ADJACENCY_LIST[i]
                    for t in targets:
                        if self.board[t] == EMPTY:
                            actions.append(24 + i * 24 + t)
        return actions

    def _did_form_new_mill(self, board_before: np.ndarray, player: int) -> bool:
        filled_pos = -1
        for i in range(24):
            if board_before[i] != player and self.board[i] == player:
                filled_pos = i
                break
        if filled_pos == -1:
            return False
        return self._is_piece_in_mill(filled_pos, player)

    def _get_next_phase(self, n_turn: int) -> str:
        if self.placements_remaining[PLAYER_X] > 0 or self.placements_remaining[PLAYER_O] > 0:
            return "placement"
        if self.pieces_on_board[n_turn] == 3:
            return "flying"
        return "movement"

    def _has_valid_moves(self, player: int) -> bool:
        for i in range(24):
            if self.board[i] == player:
                for neighbor in ADJACENCY_LIST[i]:
                    if self.board[neighbor] == EMPTY:
                        return True
        return False

    def _get_position_key(self, n_turn: int) -> str:
        s = "".join("X" if c == PLAYER_X else ("O" if c == PLAYER_O else ".") for c in self.board)
        return s + ("X" if n_turn == PLAYER_X else "O")

    def step(self, action: int) -> "MillEnv":
        if self.winner is not None:
            raise ValueError("Game is already finished")

        if self.mill_formed_this_turn:
            if action < 0 or action >= 24:
                raise ValueError("Must provide removal position 0-23")
            opp = -self._turn
            if self.board[action] != opp:
                raise ValueError("No opponent piece there")
            if self._is_piece_in_mill(action, opp) and not self._are_all_pieces_in_mills(opp):
                raise ValueError("Cannot remove piece in mill")
                
            self.board[action] = EMPTY
            self.pieces_on_board[opp] -= 1
            
            opp_placements = self.placements_remaining[opp]
            next_turn = opp
            
            if self.pieces_on_board[opp] < 3 and opp_placements == 0:
                self.winner = self._turn
            elif opp_placements == 0 and self.pieces_on_board[opp] > 3 and not self._has_valid_moves(opp):
                self.winner = self._turn
                
            self.phase = self._get_next_phase(next_turn)
            self._turn = next_turn
            self.mill_formed_this_turn = False
            self.moves_since_last_capture = 0
            
            next_key = self._get_position_key(self._turn)
            self.position_history.append(next_key)
            if self.winner is None and self.position_history.count(next_key) >= 3:
                self.winner = 0
                
            return self

        board_before = self.board.copy()

        if self.phase == "placement":
            if action < 0 or action >= 24:
                raise ValueError("Invalid placement")
            if self.board[action] != EMPTY:
                raise ValueError("Occupied")
                
            self.board[action] = self._turn
            self.placements_remaining[self._turn] -= 1
            self.pieces_on_board[self._turn] += 1
            
        else:
            if action < 24 or action >= 600:
                raise ValueError("Invalid move action")
            move_idx = action - 24
            from_pos = move_idx // 24
            to_pos = move_idx % 24
            
            if self.board[from_pos] != self._turn:
                raise ValueError("Not your piece")
            if self.board[to_pos] != EMPTY:
                raise ValueError("Occupied")
            is_flying = self.pieces_on_board[self._turn] == 3
            if not is_flying and to_pos not in ADJACENCY_LIST[from_pos]:
                raise ValueError("Not adjacent")
                
            self.board[from_pos] = EMPTY
            self.board[to_pos] = self._turn

        mill_created = self._did_form_new_mill(board_before, self._turn)
        
        if mill_created:
            self.mill_formed_this_turn = True
        else:
            self._turn = -self._turn
            self.moves_since_last_capture += 1
            
        self.phase = self._get_next_phase(self._turn)
        next_key = self._get_position_key(self._turn)
        self.position_history.append(next_key)
        
        if self.winner is None:
            if not mill_created and self.phase == "movement":
                opp = self._turn
                opp_can_fly = self.pieces_on_board[opp] == 3
                if not opp_can_fly and not self._has_valid_moves(opp):
                    self.winner = -self._turn
                    self.phase = "movement"
                    
            if self.winner is None:
                if self.position_history.count(next_key) >= 3:
                    self.winner = 0
                elif self.moves_since_last_capture >= 50:
                    self.winner = 0
                    
        return self

    def outcome(self, player: int) -> Optional[float]:
        if self.winner is None:
            return None
        if self.winner == 0:
            # Tie-breaker based on pieces remaining to guide the network towards captures
            pieces_self = self.pieces_on_board[player]
            pieces_opp = self.pieces_on_board[-player]
            reward = (pieces_self - pieces_opp) * 0.1
            return max(-0.9, min(0.9, float(reward)))
        return 1.0 if self.winner == player else -1.0

    def encode(self) -> np.ndarray:
        """
        Encode 7x7 spatial representation for Mill.
        Channels:
        0: Player's pieces
        1: Opponent's pieces
        2: Valid nodes mask
        3: Constant 1s
        4: Normalized moves since capture
        5: Phase flag (1 if placement, 0 else)
        6: Mill formed flag
        """
        planes = np.zeros((7, 7, 7), dtype=np.float32)
        
        # Valid nodes mask
        for i in range(24):
            r, c = NODE_TO_SPATIAL[i]
            planes[2, r, c] = 1.0
            
            if self.board[i] == self._turn:
                planes[0, r, c] = 1.0
            elif self.board[i] == -self._turn:
                planes[1, r, c] = 1.0
                
        planes[3] = 1.0
        planes[4] = self.moves_since_last_capture / 50.0
        planes[5] = 1.0 if self.phase == "placement" else 0.0
        planes[6] = 1.0 if self.mill_formed_this_turn else 0.0
        
        return planes
