"""
Grail Quest — Pure-Python game engine port.

Faithfully replicates the TypeScript engine (grailQuestEngine.ts + helpers)
so MCCFR can run full self-play without touching Node.js.

Card values: 1-10 = number cards, 11=Jack, 12=Queen, 13=King
Hex grid: axial coordinates, radius-3 board (37 hexes)
Players: PLAYER_X = 0, PLAYER_O = 1  (internal ints)
"""

from __future__ import annotations

import copy
import random
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any

# ─── Constants ────────────────────────────────────────────────────────────────

PLAYER_X = 0
PLAYER_O = 1

# Axial neighbor offsets (clockwise from East)
AXIAL_NEIGHBORS = [
    (1, 0),   # 0: East
    (0, 1),   # 1: Southeast
    (-1, 1),  # 2: Southwest
    (-1, 0),  # 3: West
    (0, -1),  # 4: Northwest
    (1, -1),  # 5: Northeast
]

# Cell types
HOME_BASE   = "home_base"
URBAN       = "urban"
FARM_LAND   = "farm_land"
HILL        = "hill"
GRAIL_CENTER = "grail_center"
NORMAL      = "normal"

# Phases
PHASE_REACT  = "react"
PHASE_DEPLOY = "deploy"
PHASE_MOVE   = "move"

MAX_TURNS = 400  # draw after this many turns


# ─── Hex grid helpers ─────────────────────────────────────────────────────────

def hex_distance(q1: int, r1: int, q2: int, r2: int) -> int:
    return (abs(q1 - q2) + abs(r1 - r2) + abs((q1 + r1) - (q2 + r2))) // 2


def is_valid_hex(q: int, r: int) -> bool:
    return hex_distance(0, 0, q, r) <= 3


def get_cell_type(q: int, r: int) -> str:
    if q == 0 and r == 0:   return GRAIL_CENTER
    if q == 0 and r == -3:  return HOME_BASE
    if q == 0 and r == 3:   return HOME_BASE
    if (q == -1 and r == -2) or (q == 2 and r == -2): return URBAN
    if (q == -2 and r == 2) or (q == 1 and r == 2):   return URBAN
    if (q == -2 and r == 0) or (q == 2 and r == 0):   return FARM_LAND
    if (q, r) in {(-1,-1), (1,-1), (1,1), (-1,1)}:    return HILL
    return NORMAL


def get_initial_owner(q: int, r: int) -> Optional[int]:
    t = get_cell_type(q, r)
    if t == HOME_BASE:
        return PLAYER_X if r < 0 else PLAYER_O
    return None


def get_neighbor_index(q_dest: int, r_dest: int, q_start: int, r_start: int) -> int:
    dq = q_start - q_dest
    dr = r_start - r_dest
    for i, (nq, nr) in enumerate(AXIAL_NEIGHBORS):
        if nq == dq and nr == dr:
            return i
    return -1


# ─── Build hex index map ──────────────────────────────────────────────────────

ALL_HEXES: List[Tuple[int, int]] = []
HEX_TO_IDX: Dict[Tuple[int,int], int] = {}
for _q in range(-3, 4):
    for _r in range(-3, 4):
        if is_valid_hex(_q, _r):
            HEX_TO_IDX[(_q, _r)] = len(ALL_HEXES)
            ALL_HEXES.append((_q, _r))

NUM_HEXES = len(ALL_HEXES)  # 37

# Home/urban keys per player (int player index)
HOME_KEY   = {PLAYER_X: (0, -3), PLAYER_O: (0, 3)}
ENEMY_BASE = {PLAYER_X: (0,  3), PLAYER_O: (0, -3)}


# ─── Action encoding ──────────────────────────────────────────────────────────
#
# We encode actions as flat integers:
#   0  .. NUM_HEXES-1          : deploy card to hex[i]  (37 slots)
#   NUM_HEXES .. NUM_HEXES + NUM_HEXES*6 - 1 : move stack from hex[a] direction d
#                                              encoded as NUM_HEXES + a*6 + d
#   DEPLOY_ALL_START .. DEPLOY_ALL_START+NUM_HEXES-1 : deploy_all to hex[i]
#   ACTION_END_DEPLOY                          : end_deploy
#   ACTION_END_TURN                            : end_turn
#   ACTION_FIGHT                               : react fight
#   ACTION_RETREAT_START .. +NUM_HEXES-1       : retreat to hex[i]
#
# Total: 37 + 37*6 + 37 + 1 + 1 + 1 + 37 = 336

DEPLOY_START       = 0
DEPLOY_END         = NUM_HEXES - 1                        # 0..36
MOVE_START         = NUM_HEXES                            # 37
MOVE_END           = NUM_HEXES + NUM_HEXES * 6 - 1       # 37..258
DEPLOY_ALL_START   = MOVE_END + 1                         # 259
DEPLOY_ALL_END     = DEPLOY_ALL_START + NUM_HEXES - 1    # 259..295
ACTION_END_DEPLOY  = DEPLOY_ALL_END + 1                   # 296
ACTION_END_TURN    = ACTION_END_DEPLOY + 1                # 297
ACTION_FIGHT       = ACTION_END_TURN + 1                  # 298
RETREAT_START      = ACTION_FIGHT + 1                     # 299
RETREAT_END        = RETREAT_START + NUM_HEXES - 1        # 299..335
NUM_ACTIONS        = RETREAT_END + 1                      # 336


def encode_deploy(hex_idx: int) -> int:
    return DEPLOY_START + hex_idx


def encode_move(from_idx: int, direction: int) -> int:
    return MOVE_START + from_idx * 6 + direction


def encode_deploy_all(hex_idx: int) -> int:
    return DEPLOY_ALL_START + hex_idx


def decode_action(action: int) -> dict:
    if DEPLOY_START <= action <= DEPLOY_END:
        return {"type": "deploy", "hex_idx": action - DEPLOY_START}
    elif MOVE_START <= action <= MOVE_END:
        offset = action - MOVE_START
        from_idx = offset // 6
        direction = offset % 6
        return {"type": "move", "from_idx": from_idx, "direction": direction}
    elif DEPLOY_ALL_START <= action <= DEPLOY_ALL_END:
        return {"type": "deploy_all", "hex_idx": action - DEPLOY_ALL_START}
    elif action == ACTION_END_DEPLOY:
        return {"type": "end_deploy"}
    elif action == ACTION_END_TURN:
        return {"type": "end_turn"}
    elif action == ACTION_FIGHT:
        return {"type": "fight"}
    elif RETREAT_START <= action <= RETREAT_END:
        return {"type": "retreat", "hex_idx": action - RETREAT_START}
    raise ValueError(f"Unknown action {action}")


# ─── Card ─────────────────────────────────────────────────────────────────────

@dataclass
class Card:
    value: int          # 1-13
    revealed: bool = False
    moved: bool = False

    def clone(self) -> "Card":
        return Card(self.value, self.revealed, self.moved)

    def to_dict(self) -> dict:
        return {"value": self.value, "revealed": self.revealed}


# ─── Cell ─────────────────────────────────────────────────────────────────────

@dataclass
class Cell:
    q: int
    r: int
    cell_type: str
    owner: Optional[int]       # PLAYER_X / PLAYER_O / None
    soldiers: List[Card] = field(default_factory=list)

    def clone(self) -> "Cell":
        return Cell(self.q, self.r, self.cell_type, self.owner,
                    [c.clone() for c in self.soldiers])


# ─── PendingCombat ────────────────────────────────────────────────────────────

@dataclass
class PendingCombat:
    cell_key: Tuple[int, int]  # (q, r)
    attacker: int
    defender: int              # PLAYER_X / PLAYER_O
    attacker_stack: List[Card] = field(default_factory=list)
    defender_stack_ref: Optional[List[Card]] = None  # points into cell.soldiers
    carries_grail: bool = False
    origin_key: Optional[Tuple[int, int]] = None

    def clone(self) -> "PendingCombat":
        return PendingCombat(
            self.cell_key, self.attacker, self.defender,
            [c.clone() for c in self.attacker_stack],
            None,  # will be re-linked after cell clone
            self.carries_grail, self.origin_key
        )


# ─── Move record ──────────────────────────────────────────────────────────────

@dataclass
class MoveRecord:
    from_key: Tuple[int, int]
    to_key: Tuple[int, int]
    cards: List[Card]
    carries_grail: bool = False

    def clone(self) -> "MoveRecord":
        return MoveRecord(self.from_key, self.to_key,
                          [c.clone() for c in self.cards], self.carries_grail)


# ─── Game State ───────────────────────────────────────────────────────────────

class GrailQuestState:
    """
    Mutable game state for self-play and OpenSpiel integration.
    Uses integer player IDs (PLAYER_X=0, PLAYER_O=1) internally.
    """

    def __init__(self) -> None:
        # Board: hex key → Cell
        self.board: Dict[Tuple[int, int], Cell] = {}
        for (q, r) in ALL_HEXES:
            self.board[(q, r)] = Cell(q, r, get_cell_type(q, r), get_initial_owner(q, r))

        # Hands (private)
        self.hands: Dict[int, List[Card]] = {
            PLAYER_X: [Card(13), Card(12), Card(11)],
            PLAYER_O: [Card(13), Card(12), Card(11)],
        }

        self.phase: str = PHASE_DEPLOY
        self.turn: int = PLAYER_X
        self.winner: Optional[int] = None   # PLAYER_X / PLAYER_O / -1 (draw)
        self.pending_combats: List[PendingCombat] = []
        self.grail_key: Tuple[int, int] = (0, 0)
        self.grail_movement_candidates: List[Tuple[int, int]] = []
        self.drawn_this_turn: bool = False
        self.moves_this_turn: List[MoveRecord] = []
        self.round_turns_completed: int = 0
        self.turn_count: int = 0

        # Chance nodes tracking for OpenSpiel interface
        # (chance outcomes are resolved greedily with random draws here)
        self._rng = random.Random()

        # Perform initial deploy draw for X
        drawn = self._run_deploy_draw(PLAYER_X)
        self.hands[PLAYER_X].extend(drawn)
        self.drawn_this_turn = True


    def clone(self) -> "GrailQuestState":
        s = GrailQuestState.__new__(GrailQuestState)
        s.board = {k: v.clone() for k, v in self.board.items()}
        s.hands = {p: [c.clone() for c in cards] for p, cards in self.hands.items()}
        s.phase = self.phase
        s.turn = self.turn
        s.winner = self.winner
        s.grail_key = self.grail_key
        s.grail_movement_candidates = list(self.grail_movement_candidates)
        s.drawn_this_turn = self.drawn_this_turn
        s.moves_this_turn = [m.clone() for m in self.moves_this_turn]
        s.round_turns_completed = self.round_turns_completed
        s.turn_count = self.turn_count
        s._rng = copy.deepcopy(self._rng)

        # Clone pending combats, re-link defender stack references
        s.pending_combats = []
        for pc in self.pending_combats:
            new_pc = pc.clone()
            # Re-link defender_stack_ref to the cloned cell's soldiers list
            cell_clone = s.board[pc.cell_key]
            new_pc.defender_stack_ref = cell_clone.soldiers
            s.pending_combats.append(new_pc)

        return s

    # ─── Face card limit helpers ──────────────────────────────────────────────

    def _count_face_cards(self, player: int, temp_drawn: List[Card] = []) -> dict:
        all_cards: List[Card] = list(self.hands[player]) + list(temp_drawn)
        for cell in self.board.values():
            if cell.owner == player:
                all_cards.extend(cell.soldiers)
        for pc in self.pending_combats:
            if pc.attacker == player:
                all_cards.extend(pc.attacker_stack)
        return {
            "kings":  sum(1 for c in all_cards if c.value == 13),
            "queens": sum(1 for c in all_cards if c.value == 12),
            "jacks":  sum(1 for c in all_cards if c.value == 11),
        }

    def _draw_random_card(self, player: int, temp_drawn: List[Card] = []) -> Card:
        value = self._rng.randint(1, 13)
        fc = self._count_face_cards(player, temp_drawn)
        if value == 13 and fc["kings"] >= 1:
            value = self._rng.randint(1, 10)
        elif value == 12 and fc["queens"] >= 2:
            value = self._rng.randint(1, 10)
        elif value == 11 and fc["jacks"] >= 3:
            value = self._rng.randint(1, 10)
        return Card(value, revealed=False)

    def _get_farm_lands_count(self, player: int) -> int:
        return sum(1 for c in self.board.values()
                   if c.cell_type == FARM_LAND and c.owner == player)

    def _run_deploy_draw(self, player: int) -> List[Card]:
        is_round1_x = (player == PLAYER_X and self.turn_count == 0
                       and self.round_turns_completed == 0)
        base_cards = 2 if is_round1_x else 4
        farm_bonus = self._get_farm_lands_count(player)
        total = base_cards + farm_bonus
        drawn: List[Card] = []
        for _ in range(total):
            drawn.append(self._draw_random_card(player, drawn))
        return drawn

    # ─── Combat resolution ────────────────────────────────────────────────────

    @staticmethod
    def _evaluate_duel(a_val: int, d_val: int) -> Tuple[str, int, int]:
        """Returns (winner: 'attacker'|'defender'|'draw', new_a_val, new_d_val)"""
        a_face = a_val >= 11
        d_face = d_val >= 11
        if a_face and d_face:
            if a_val == d_val:
                return "draw", a_val, d_val
            # King(13) > Jack(11); Jack(11) > Queen(12); Queen(12) > King(13)
            if (a_val == 13 and d_val == 11) or \
               (a_val == 11 and d_val == 12) or \
               (a_val == 12 and d_val == 13):
                return "attacker", a_val, d_val
            return "defender", a_val, d_val
        if a_face and not d_face:
            return "attacker", a_val, d_val
        if not a_face and d_face:
            return "defender", a_val, d_val
        # Numbers
        if a_val == d_val:
            return "draw", a_val, d_val
        if a_val > d_val:
            return "attacker", max(1, a_val - d_val), d_val
        return "defender", a_val, max(1, d_val - a_val)

    # ─── Legal actions ────────────────────────────────────────────────────────

    def legal_actions(self) -> List[int]:
        if self.winner is not None:
            return []
        p = self.turn
        actions: List[int] = []

        if self.phase == PHASE_REACT:
            return self._legal_react_actions(p)
        elif self.phase == PHASE_DEPLOY:
            return self._legal_deploy_actions(p)
        elif self.phase == PHASE_MOVE:
            return self._legal_move_actions(p)
        return actions

    def _legal_react_actions(self, player: int) -> List[int]:
        actions: List[int] = []
        # Find pending combat where this player is defender
        pc = next((c for c in self.pending_combats if c.defender == player), None)
        if pc is None:
            return [ACTION_FIGHT]  # fallback

        # Fight always available
        actions.append(ACTION_FIGHT)

        # Retreat: adjacent friendly cells without active combat
        cq, cr = pc.cell_key
        for nq, nr in [(cq + dq, cr + dr) for dq, dr in AXIAL_NEIGHBORS]:
            nk = (nq, nr)
            if nk not in self.board:
                continue
            ncell = self.board[nk]
            if ncell.owner == player:
                has_combat = any(c.cell_key == nk for c in self.pending_combats)
                if not has_combat:
                    actions.append(RETREAT_START + HEX_TO_IDX[nk])
        return actions

    def _legal_deploy_actions(self, player: int) -> List[int]:
        actions: List[int] = []
        hand = self.hands[player]
        if not hand:
            actions.append(ACTION_END_DEPLOY)
            return actions

        valid_cells = [
            k for k, c in self.board.items()
            if c.owner == player and c.cell_type in (URBAN, HOME_BASE)
        ]
        if not valid_cells:
            actions.append(ACTION_END_DEPLOY)
            return actions

        for hk in valid_cells:
            idx = HEX_TO_IDX[hk]
            # deploy one card (we always have at least one)
            actions.append(encode_deploy(idx))
            # deploy_all
            if len(hand) > 1:
                actions.append(encode_deploy_all(idx))

        actions.append(ACTION_END_DEPLOY)
        return list(set(actions))

    def _legal_move_actions(self, player: int) -> List[int]:
        actions: List[int] = []
        # Check per-turn move limit (same as TS engine)
        if len(self.moves_this_turn) >= 4:
            return [ACTION_END_TURN]

        for (q, r), cell in self.board.items():
            if cell.owner != player or not cell.soldiers:
                continue
            is_home = (q, r) == HOME_KEY[player]
            is_grail = (q, r) == self.grail_key
            max_movable = len(cell.soldiers) - (1 if is_home else 0)
            if max_movable <= 0:
                continue

            # Can't move already-moved cards
            unmoved = sum(1 for c in cell.soldiers[:max_movable] if not c.moved)
            if unmoved == 0:
                continue

            from_idx = HEX_TO_IDX[(q, r)]
            for d, (dq, dr) in enumerate(AXIAL_NEIGHBORS):
                nq, nr = q + dq, r + dr
                nk = (nq, nr)
                if nk not in self.board:
                    continue
                if is_grail:
                    # Must move all soldiers, must have King
                    has_king = any(c.value == 13 for c in cell.soldiers)
                    if not has_king:
                        continue
                    # Only allow count == len(soldiers)
                    actions.append(encode_move(from_idx, d))
                else:
                    actions.append(encode_move(from_idx, d))

        actions.append(ACTION_END_TURN)
        return list(set(actions))

    # ─── Apply action ─────────────────────────────────────────────────────────

    def apply_action(self, action: int) -> None:
        """Mutate state in-place."""
        decoded = decode_action(action)
        t = decoded["type"]
        p = self.turn

        if t == "fight":
            self._apply_fight(p)
        elif t == "retreat":
            dest_key = ALL_HEXES[decoded["hex_idx"]]
            self._apply_retreat(p, dest_key)
        elif t == "deploy":
            hex_key = ALL_HEXES[decoded["hex_idx"]]
            self._apply_deploy_one(p, hex_key)
        elif t == "deploy_all":
            hex_key = ALL_HEXES[decoded["hex_idx"]]
            self._apply_deploy_all(p, hex_key)
        elif t == "end_deploy":
            self._apply_end_deploy()
        elif t == "move":
            from_key = ALL_HEXES[decoded["from_idx"]]
            direction = decoded["direction"]
            dq, dr = AXIAL_NEIGHBORS[direction]
            fq, fr = from_key
            to_key = (fq + dq, fr + dr)
            self._apply_move(p, from_key, to_key)
        elif t == "end_turn":
            self._apply_end_turn(p)

    # ─── Action handlers (mirrors actionHandlers.ts) ──────────────────────────

    def _apply_fight(self, player: int) -> None:
        pc = next((c for c in self.pending_combats if c.defender == player), None)
        if pc is None:
            return

        cell = self.board[pc.cell_key]
        a_stack = pc.attacker_stack
        d_stack = cell.soldiers

        if not a_stack or not d_stack:
            return

        a_card = a_stack[0]
        d_card = d_stack[0]
        a_card.revealed = True
        d_card.revealed = True

        is_hill = cell.cell_type == HILL
        if is_hill and len(d_stack) >= 2:
            # Hill defense: pick best of top-2
            c1, c2 = d_stack[0], d_stack[1]
            c1.revealed = True; c2.revealed = True
            r1 = self._evaluate_duel(a_card.value, c1.value)
            r2 = self._evaluate_duel(a_card.value, c2.value)
            score = lambda res: 3 if res[0] == "defender" else (2 if res[0] == "draw" else 1)
            if score(r2) > score(r1) or (score(r1) == score(r2) and c2.value > c1.value):
                best_r, best_c, worst_c = r2, c2, c1
            else:
                best_r, best_c, worst_c = r1, c1, c2

            if best_r[0] == "attacker":
                d_stack.pop(0); d_stack.pop(0) if len(d_stack) > 0 else None
                a_card2 = a_stack.pop(0)
                a_card2.value = best_r[1]
                a_stack.append(a_card2)
            elif best_r[0] == "defender":
                a_stack.pop(0)
                best_c.value = best_r[2]
                d_stack.remove(best_c)
                d_stack.append(best_c)
                d_stack.remove(worst_c)
                d_stack.append(worst_c)
            else:  # draw
                a_stack.pop(0)
                if best_c in d_stack: d_stack.remove(best_c)
                if worst_c in d_stack: d_stack.remove(worst_c)
        else:
            winner, new_a, new_d = self._evaluate_duel(a_card.value, d_card.value)
            if winner == "attacker":
                d_stack.pop(0)
                ac = a_stack.pop(0)
                ac.value = new_a
                a_stack.append(ac)
            elif winner == "defender":
                a_stack.pop(0)
                dc = d_stack.pop(0)
                dc.value = new_d
                d_stack.append(dc)
            else:  # draw
                a_stack.pop(0)
                d_stack.pop(0)

        # Grail transport King check
        if pc.carries_grail and not any(c.value == 13 for c in a_stack):
            if pc.origin_key:
                oc = self.board[pc.origin_key]
                oc.owner = pc.attacker
                oc.soldiers.extend(a_stack)
                self.grail_key = pc.origin_key
            self._finalize_cell_after_combat(cell, d_stack, pc)
            self.pending_combats.remove(pc)
            self.moves_this_turn = [m for m in self.moves_this_turn
                                    if m.to_key != pc.cell_key]
            return

        # Resolve combat outcome
        if not a_stack:
            self.pending_combats.remove(pc)
            if not d_stack and cell.cell_type not in (HOME_BASE, URBAN):
                cell.owner = None
        elif not d_stack:
            cell.owner = pc.attacker
            cell.soldiers = list(a_stack)
            self.pending_combats.remove(pc)

        self._check_game_end()

        # Transition: if no more combats for this player, go to deploy
        remaining = [c for c in self.pending_combats if c.defender == player]
        if not remaining:
            self.phase = PHASE_DEPLOY
            if not self.drawn_this_turn:
                drawn = self._run_deploy_draw(player)
                self.hands[player].extend(drawn)
                self.drawn_this_turn = True

    def _finalize_cell_after_combat(self, cell: Cell, d_stack: List[Card],
                                    pc: PendingCombat) -> None:
        if not d_stack and cell.cell_type not in (HOME_BASE, URBAN):
            cell.owner = None
        cell.soldiers = d_stack

    def _apply_retreat(self, player: int, dest_key: Tuple[int, int]) -> None:
        pc = next((c for c in self.pending_combats if c.defender == player), None)
        if pc is None:
            return

        cell = self.board[pc.cell_key]
        d_stack = cell.soldiers
        dest_cell = self.board[dest_key]

        dest_cell.soldiers.extend(d_stack)
        cell.owner = pc.attacker
        cell.soldiers = list(pc.attacker_stack)
        self.pending_combats.remove(pc)

        remaining = [c for c in self.pending_combats if c.defender == player]
        if not remaining:
            self.phase = PHASE_DEPLOY
            if not self.drawn_this_turn:
                drawn = self._run_deploy_draw(player)
                self.hands[player].extend(drawn)
                self.drawn_this_turn = True

        self._check_game_end()

    def _apply_deploy_one(self, player: int, hex_key: Tuple[int, int]) -> None:
        hand = self.hands[player]
        if not hand:
            return
        cell = self.board[hex_key]
        # Deploy highest card (consistent with TS engine heuristic, but agent picks hex)
        # Here: agent picks hex; we deploy the highest available card (greedy selection)
        # The action encoding doesn't include which card — we always deploy the top card
        # (hand is ordered by value descending in _run_deploy_draw)
        card = hand.pop(0)
        cell.soldiers.append(card)

    def _apply_deploy_all(self, player: int, hex_key: Tuple[int, int]) -> None:
        hand = self.hands[player]
        cell = self.board[hex_key]
        cell.soldiers.extend(hand)
        self.hands[player] = []

    def _apply_end_deploy(self) -> None:
        self.phase = PHASE_MOVE

    def _apply_move(self, player: int, from_key: Tuple[int, int],
                    to_key: Tuple[int, int]) -> None:
        from_cell = self.board[from_key]
        to_cell   = self.board[to_key]

        is_grail = from_key == self.grail_key
        is_home  = from_key == HOME_KEY[player]
        max_count = len(from_cell.soldiers) - (1 if is_home else 0)

        # Count unmoved top cards
        unmoved_count = sum(1 for c in from_cell.soldiers[:max_count] if not c.moved)
        if unmoved_count == 0:
            return

        if is_grail:
            count = len(from_cell.soldiers)
        else:
            count = unmoved_count  # move all unmoved (simplified; agent controls from_hex)

        moving_stack = from_cell.soldiers[:count]
        for c in moving_stack:
            c.moved = True

        from_cell.soldiers = from_cell.soldiers[count:]
        if not from_cell.soldiers and from_cell.cell_type not in (HOME_BASE, URBAN, FARM_LAND):
            from_cell.owner = None

        if is_grail:
            self.grail_movement_candidates.append(to_key)
            self.grail_key = to_key

        self.moves_this_turn.append(
            MoveRecord(from_key, to_key, list(moving_stack), is_grail)
        )

        # Check enemy occupation
        is_enemy = to_cell.owner is not None and to_cell.owner != player
        has_existing_combat = any(c.cell_key == to_key for c in self.pending_combats)

        if is_enemy or has_existing_combat:
            defender = to_cell.owner if to_cell.owner is not None else (1 - player)
            existing = next((c for c in self.pending_combats
                             if c.cell_key == to_key and c.attacker == player), None)
            if existing:
                existing.attacker_stack.extend(moving_stack)
                if is_grail:
                    existing.carries_grail = True
                    existing.origin_key = from_key
            else:
                pc = PendingCombat(
                    cell_key=to_key,
                    attacker=player,
                    defender=defender,
                    attacker_stack=list(moving_stack),
                    carries_grail=is_grail,
                    origin_key=from_key,
                )
                pc.defender_stack_ref = to_cell.soldiers
                self.pending_combats.append(pc)
        else:
            to_cell.owner = player

        self._check_game_end()

    def _apply_end_turn(self, player: int) -> None:
        # Finalize friendly moves
        friendly_targets = {
            m.to_key for m in self.moves_this_turn
            if not any(c.cell_key == m.to_key for c in self.pending_combats)
        }
        for tk in friendly_targets:
            tc = self.board[tk]
            # Merge incoming stacks (clockwise)
            incoming = [m for m in self.moves_this_turn if m.to_key == tk]
            incoming.sort(key=lambda m: get_neighbor_index(tk[0], tk[1], m.from_key[0], m.from_key[1]))
            extra = [c for m in incoming for c in m.cards]
            tc.soldiers = list(tc.soldiers) + extra
            tc.owner = player

        self.moves_this_turn = []
        self.drawn_this_turn = False

        opponent = 1 - player
        self.turn = opponent
        self.turn_count += 1
        self.round_turns_completed += 1

        has_defenses = any(c.defender == opponent for c in self.pending_combats)
        self.phase = PHASE_REACT if has_defenses else PHASE_DEPLOY

        if self.round_turns_completed >= 2:
            self._end_round()
            self.round_turns_completed = 0
            has_defenses = any(c.defender == opponent for c in self.pending_combats)
            self.phase = PHASE_REACT if has_defenses else PHASE_DEPLOY

        # Draw for opponent if starting in deploy
        if self.phase == PHASE_DEPLOY and self.winner is None:
            drawn = self._run_deploy_draw(opponent)
            self.hands[opponent].extend(drawn)
            self.drawn_this_turn = True

        # Reset moved flags
        for cell in self.board.values():
            for c in cell.soldiers:
                c.moved = False
        for p in (PLAYER_X, PLAYER_O):
            for c in self.hands[p]:
                c.moved = False

        self._check_game_end()

    def _end_round(self) -> None:
        """End-of-round: grail movement + radioactivity."""
        # Grail movement
        valid_dest = [
            k for k in self.grail_movement_candidates
            if any(c.value == 13 for c in self.board[k].soldiers)
        ]
        if valid_dest:
            chosen = self._rng.choice(valid_dest)
            self.grail_key = chosen
        self.grail_movement_candidates = []

        # Radioactivity at grail cell
        grail_cell = self.board.get(self.grail_key)
        if grail_cell and grail_cell.soldiers:
            survivors = [c for c in grail_cell.soldiers
                         if self._rng.random() >= 0.5]
            grail_cell.soldiers = survivors
            if not survivors and grail_cell.cell_type not in (HOME_BASE, URBAN):
                grail_cell.owner = None

            # If combat at grail cell, check for auto-capture
            combat_idx = next((i for i, c in enumerate(self.pending_combats)
                                if c.cell_key == self.grail_key), -1)
            if combat_idx != -1:
                pc = self.pending_combats[combat_idx]
                if not grail_cell.soldiers:
                    grail_cell.owner = pc.attacker
                    grail_cell.soldiers = list(pc.attacker_stack)
                    self.pending_combats.pop(combat_idx)
                    self.moves_this_turn = [m for m in self.moves_this_turn
                                            if m.to_key != self.grail_key]

    def _check_game_end(self) -> None:
        """Mirrors roundResolver.ts::checkGameEnd"""
        # Grail at home base
        if self.grail_key == (0, -3):
            self.winner = PLAYER_X
            return
        if self.grail_key == (0, 3):
            self.winner = PLAYER_O
            return

        # Base captured
        x_base_owner = self.board[(0, -3)].owner
        o_base_owner = self.board[(0,  3)].owner
        x_defeated = x_base_owner == PLAYER_O
        o_defeated = o_base_owner == PLAYER_X

        if x_defeated and o_defeated:
            self.winner = -1  # draw
            return
        if x_defeated:
            self.winner = PLAYER_O
            return
        if o_defeated:
            self.winner = PLAYER_X
            return

        # Turn limit
        if self.turn_count >= MAX_TURNS:
            self.winner = -1

    def is_terminal(self) -> bool:
        return self.winner is not None

    def outcome(self, player: int) -> float:
        if self.winner is None:
            return 0.0
        if self.winner == -1:
            return 0.0  # draw
        return 1.0 if self.winner == player else -1.0

    # ─── Information state (the key for MCCFR) ───────────────────────────────

    def information_state_string(self, player: int) -> str:
        """
        Encode only what `player` can observe — true hidden info.
        Own hand: full values.
        Opponent hand: unknown (encoded as '?').
        Board: all visible (ownership + soldiers), but opponent
               un-revealed cards are shown as '?' for their value.
        """
        parts = []
        parts.append(f"turn={self.turn}")
        parts.append(f"phase={self.phase}")
        parts.append(f"tc={self.turn_count}")
        parts.append(f"grail={self.grail_key}")

        # Own hand (fully visible)
        hand = self.hands[player]
        parts.append(f"hand=[{','.join(str(c.value) for c in hand)}]")

        # Opponent hand size (we know the count but not the values)
        opp = 1 - player
        parts.append(f"opp_hand_size={len(self.hands[opp])}")

        # Board: for each hex, include owner, revealed cards, hidden count
        board_parts = []
        for (q, r) in ALL_HEXES:
            cell = self.board[(q, r)]
            soldiers_str = []
            for c in cell.soldiers:
                if cell.owner == player or c.revealed:
                    soldiers_str.append(str(c.value))
                else:
                    soldiers_str.append("?")
            owner_str = "X" if cell.owner == PLAYER_X else ("O" if cell.owner == PLAYER_O else "N")
            board_parts.append(f"{q},{r}:{owner_str}:[{','.join(soldiers_str)}]")
        parts.append("board=[" + "|".join(board_parts) + "]")

        # Pending combats (cell key + attacker/defender counts)
        for pc in self.pending_combats:
            cq, cr = pc.cell_key
            a_str = str(len(pc.attacker_stack))
            d_str = str(len(self.board[pc.cell_key].soldiers))
            parts.append(f"combat:{cq},{cr}:a={a_str}:d={d_str}")

        return "|".join(parts)

    def observation_tensor(self, player: int) -> list:
        """
        Returns a flat float list representing the observation for `player`.
        Shape: (NUM_HEXES * N_CHANNELS,) where channels encode:
          ch0: own soldiers (count / 10, capped at 1)
          ch1: own top card value / 13 (0 if no soldiers / not owner)
          ch2: opponent soldiers count (know count but not values)
          ch3: opponent top card value IF revealed, else 0
          ch4: is grail cell
          ch5: is home_base
          ch6: is urban
          ch7: is farm_land
          ch8: is hill
          ch9: is grail_center
          ch10: current phase react=1,deploy=2,move=3 normalized /3
          ch11: turn count / MAX_TURNS
          ch12: own hand size / 10
          ch13: opp hand size / 10
        """
        N_CH = 14
        tensor = [0.0] * (NUM_HEXES * N_CH)
        opp = 1 - player

        phase_val = {"react": 1, "deploy": 2, "move": 3}.get(self.phase, 0) / 3.0
        tc_norm = min(1.0, self.turn_count / MAX_TURNS)
        own_hand_n = min(1.0, len(self.hands[player]) / 10.0)
        opp_hand_n = min(1.0, len(self.hands[opp]) / 10.0)

        for i, (q, r) in enumerate(ALL_HEXES):
            cell = self.board[(q, r)]
            base = i * N_CH
            is_own  = cell.owner == player
            is_opp  = cell.owner == opp
            n_own   = len(cell.soldiers) if is_own else 0
            n_opp   = len(cell.soldiers) if is_opp else 0

            tensor[base + 0] = min(1.0, n_own / 10.0)
            if is_own and cell.soldiers:
                tensor[base + 1] = cell.soldiers[0].value / 13.0
            tensor[base + 2] = min(1.0, n_opp / 10.0)
            if is_opp and cell.soldiers and cell.soldiers[0].revealed:
                tensor[base + 3] = cell.soldiers[0].value / 13.0
            tensor[base + 4] = 1.0 if (q, r) == self.grail_key else 0.0
            tensor[base + 5] = 1.0 if cell.cell_type == HOME_BASE else 0.0
            tensor[base + 6] = 1.0 if cell.cell_type == URBAN else 0.0
            tensor[base + 7] = 1.0 if cell.cell_type == FARM_LAND else 0.0
            tensor[base + 8] = 1.0 if cell.cell_type == HILL else 0.0
            tensor[base + 9] = 1.0 if cell.cell_type == GRAIL_CENTER else 0.0
            tensor[base + 10] = phase_val
            tensor[base + 11] = tc_norm
            tensor[base + 12] = own_hand_n
            tensor[base + 13] = opp_hand_n

        return tensor

    # ─── Serialization (for backend API) ─────────────────────────────────────

    @classmethod
    def from_state_dict(cls, state: dict, player_perspective: int) -> "GrailQuestState":
        """
        Reconstruct from the JSON payload sent by the TypeScript backend.
        `player_perspective`: which player is making the request (0=X, 1=O).
        Hidden cards from the opponent are obscured in the returned state.
        """
        s = cls.__new__(cls)
        s._rng = random.Random()

        # Board
        s.board = {}
        for key_str, cell_data in state["board"].items():
            q, r = map(int, key_str.split(","))
            owner_str = cell_data.get("owner")
            owner: Optional[int]
            if owner_str == "X":
                owner = PLAYER_X
            elif owner_str == "O":
                owner = PLAYER_O
            else:
                owner = None
            soldiers = [
                Card(c["value"], c.get("revealed", False))
                for c in cell_data.get("soldiers", [])
            ]
            s.board[(q, r)] = Cell(q, r, cell_data["cellType"], owner, soldiers)

        # Hands — apply hidden-info filter
        raw_hands = state.get("hands", {"X": [], "O": []})

        def parse_hand(cards_data: list, is_own: bool) -> List[Card]:
            result = []
            for cd in cards_data:
                if is_own or cd.get("revealed", False):
                    result.append(Card(cd["value"], cd.get("revealed", False)))
                else:
                    # Hidden: we know the card exists but not its value
                    result.append(Card(0, False))  # 0 = unknown
            return result

        s.hands = {
            PLAYER_X: parse_hand(raw_hands.get("X", []), player_perspective == PLAYER_X),
            PLAYER_O: parse_hand(raw_hands.get("O", []), player_perspective == PLAYER_O),
        }

        phase_map = {"react": PHASE_REACT, "deploy": PHASE_DEPLOY, "move": PHASE_MOVE}
        s.phase = phase_map.get(state.get("phase", "deploy"), PHASE_DEPLOY)
        s.turn = PLAYER_X if state.get("turn") == "X" else PLAYER_O
        winner = state.get("winner")
        if winner == "X":    s.winner = PLAYER_X
        elif winner == "O":  s.winner = PLAYER_O
        elif winner == "draw": s.winner = -1
        else:                s.winner = None

        grail_str = state.get("grailCellKey", "0,0")
        gq, gr = map(int, grail_str.split(","))
        s.grail_key = (gq, gr)

        s.grail_movement_candidates = []
        s.drawn_this_turn = state.get("drawnThisTurn", False)
        s.moves_this_turn = []  # not needed for prediction
        s.round_turns_completed = state.get("roundTurnsCompleted", 0)
        s.turn_count = state.get("turnCount", 0)

        # Pending combats
        s.pending_combats = []
        for pc_data in state.get("pendingCombats", []):
            cq, cr = map(int, pc_data["cellKey"].split(","))
            attacker = PLAYER_X if pc_data["attacker"] == "X" else PLAYER_O
            defender = PLAYER_X if pc_data["defender"] == "X" else PLAYER_O
            a_stack = [Card(c["value"], c.get("revealed", False))
                       for c in pc_data.get("attackerStack", [])]
            pc = PendingCombat(
                cell_key=(cq, cr),
                attacker=attacker,
                defender=defender,
                attacker_stack=a_stack,
            )
            pc.defender_stack_ref = s.board[(cq, cr)].soldiers
            s.pending_combats.append(pc)

        return s

    def best_action_greedy(self) -> int:
        """Simple greedy fallback (mirrors TS engine heuristic)."""
        actions = self.legal_actions()
        if not actions:
            return ACTION_END_TURN
        # For now: pick first legal non-end action
        non_end = [a for a in actions if a not in (ACTION_END_TURN, ACTION_END_DEPLOY)]
        return non_end[0] if non_end else actions[0]

    def action_to_ts_format(self, action: int) -> dict:
        """
        Convert our flat action int → the dict format the TypeScript engine expects.
        This is called by the backend after getting a prediction.
        """
        decoded = decode_action(action)
        t = decoded["type"]

        if t == "deploy":
            q, r = ALL_HEXES[decoded["hex_idx"]]
            # We need to include cardValue. Use the top hand card.
            hand = self.hands[self.turn]
            card_val = hand[0].value if hand else 1
            return {"type": "deploy", "cellKey": f"{q},{r}", "cardValue": card_val}
        elif t == "deploy_all":
            q, r = ALL_HEXES[decoded["hex_idx"]]
            return {"type": "deploy_all", "cellKey": f"{q},{r}"}
        elif t == "end_deploy":
            return {"type": "end_deploy"}
        elif t == "move":
            from_key = ALL_HEXES[decoded["from_idx"]]
            dq, dr = AXIAL_NEIGHBORS[decoded["direction"]]
            to_key = (from_key[0] + dq, from_key[1] + dr)
            fq, fr = from_key
            tq, tr = to_key
            # Count how many soldiers to move
            cell = self.board[from_key]
            is_home = from_key == HOME_KEY[self.turn]
            max_m = len(cell.soldiers) - (1 if is_home else 0)
            count = len(cell.soldiers) if from_key == self.grail_key else max(1, max_m)
            return {"type": "move", "from": f"{fq},{fr}", "to": f"{tq},{tr}", "count": count}
        elif t == "end_turn":
            return {"type": "end_turn"}
        elif t == "fight":
            # Find the pending combat cell
            pc = next((c for c in self.pending_combats if c.defender == self.turn), None)
            cell_key = f"{pc.cell_key[0]},{pc.cell_key[1]}" if pc else "0,0"
            return {"type": "react", "cellKey": cell_key, "reactType": "fight"}
        elif t == "retreat":
            q, r = ALL_HEXES[decoded["hex_idx"]]
            pc = next((c for c in self.pending_combats if c.defender == self.turn), None)
            cell_key = f"{pc.cell_key[0]},{pc.cell_key[1]}" if pc else "0,0"
            return {"type": "react", "cellKey": cell_key, "reactType": "retreat",
                    "retreatTo": f"{q},{r}"}
        return {"type": "end_turn"}
