import functools
import numpy as np
from gymnasium.spaces import Discrete, Box, Dict
from pettingzoo import AECEnv
from pettingzoo.utils import wrappers
from pettingzoo.utils.agent_selector import agent_selector
import sys
from pathlib import Path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from rl.games.grail_quest.engine import (
    GrailQuestState, PLAYER_X, PLAYER_O, NUM_ACTIONS,
    ALL_HEXES, PHASE_DEPLOY, PHASE_MOVE, PHASE_REACT,
    FARM_LAND, HILL, URBAN,
)

# ── Reward shaping constants ──────────────────────────────────────────────────
_SURVIVAL_PENALTY = -0.001   # per turn — breaks passive draw trap
_GRAIL_SCALE      =  0.002   # proportional closeness of Grail to own base
_TERRITORY_SCALE  =  0.0001  # per net FARM/HILL/URBAN tile held vs opponent
_PRESSURE_SCALE   =  0.0001  # per net hex adjacent to enemy base owned
_FACE_CARD_SCALE  =  0.015   # per net J/Q/K (value>=11) eliminated vs lost
_MAX_GRAIL_DIST   =  6       # max hex distance on this board (base to base)
_P0_BASE          = (0, -3)
_P1_BASE          = (0,  3)
_VALUED_TYPES     = (FARM_LAND, HILL, URBAN)

def _hex_dist(a: tuple, b: tuple) -> int:
    dq, dr = a[0] - b[0], a[1] - b[1]
    return max(abs(dq), abs(dr), abs(dq + dr))

def _hex_neighbors(q: int, r: int):
    return [(q+1,r),(q-1,r),(q,r+1),(q,r-1),(q+1,r-1),(q-1,r+1)]

def env():
    """
    The env function often wraps the environment in wrappers by default.
    """
    internal_env = GrailQuestPZEnv()
    internal_env = wrappers.TerminateIllegalWrapper(internal_env, illegal_reward=-1)
    internal_env = wrappers.AssertOutOfBoundsWrapper(internal_env)
    internal_env = wrappers.OrderEnforcingWrapper(internal_env)
    return internal_env

class GrailQuestPZEnv(AECEnv):
    """
    PettingZoo AEC environment for Grail Quest.
    """
    metadata = {
        "render_modes": ["human"],
        "name": "grail_quest_v0",
        "is_parallelizable": True
    }

    def __init__(self):
        super().__init__()
        self.render_mode = None
        self.game = GrailQuestState()
        self.agents = ["player_0", "player_1"]
        self.possible_agents = self.agents[:]
        
        # Action space: 336 discrete actions
        self.action_spaces = {agent: Discrete(NUM_ACTIONS) for agent in self.agents}
        
        # Observation space size calculation
        # Phase (3) + Hand (13) + Opp Hand (13) + Board (37 * 21 = 777) 
        # + OppHandSize (1) + DefendingMask (37) = 844
        self.obs_size = 844
        
        self.observation_spaces = {
            agent: Dict({
                "observation": Box(low=0.0, high=np.inf, shape=(self.obs_size,), dtype=np.float32),
                "action_mask": Box(low=0, high=1, shape=(NUM_ACTIONS,), dtype=np.int8)
            })
            for agent in self.agents
        }
        
        self.rewards = {agent: 0.0 for agent in self.agents}
        self.terminations = {agent: False for agent in self.agents}
        self.truncations = {agent: False for agent in self.agents}
        self.infos = {agent: {} for agent in self.agents}
        self._last_signals: dict = {}   # signal breakdown for the last step
        
        self._agent_selector = agent_selector(self.agents)
        self.agent_selection = self._agent_selector.reset()

    @functools.lru_cache(maxsize=None)
    def observation_space(self, agent):
        return self.observation_spaces[agent]

    @functools.lru_cache(maxsize=None)
    def action_space(self, agent):
        return self.action_spaces[agent]

    def render(self):
        pass

    def close(self):
        pass

    def reset(self, seed=None, options=None):
        self.game = GrailQuestState()
        if seed is not None:
            self.game._rng = np.random.RandomState(seed)
            
        self.agents = self.possible_agents[:]
        self.rewards = {agent: 0.0 for agent in self.agents}
        self._cumulative_rewards = {agent: 0.0 for agent in self.agents}
        self.terminations = {agent: False for agent in self.agents}
        self.truncations = {agent: False for agent in self.agents}
        self.infos = {agent: {} for agent in self.agents}
        self._potentials = {agent: {"s2": 0.0, "s3": 0.0, "s4": 0.0} for agent in self.agents}
        
        self._agent_selector = agent_selector(self.agents)
        # Setup first agent
        curr_player = self.game.turn
        self.agent_selection = self.agents[curr_player]

    def observe(self, agent):
        player_idx = self.agents.index(agent)
        opp_idx = 1 - player_idx
        
        # 1. Action Mask
        legal_actions = self.game.legal_actions()
        action_mask = np.zeros(NUM_ACTIONS, dtype=np.int8)
        if self.game.turn == player_idx and not self.game.is_terminal():
            for a in legal_actions:
                action_mask[a] = 1

        # 2. Observation Vector
        obs = np.zeros(self.obs_size, dtype=np.float32)
        idx = 0
        
        # Phase (3)
        obs[idx + (0 if self.game.phase == PHASE_DEPLOY else 1 if self.game.phase == PHASE_MOVE else 2)] = 1.0
        idx += 3
        
        # Hands (13 counts normalized)
        for c in self.game.hands[player_idx]:
            obs[idx + c.value - 1] += 0.25  # max 4 cards of same value
        idx += 13
        
        # Opponent revealed hands
        for c in self.game.hands[opp_idx]:
            if c.revealed:
                obs[idx + c.value - 1] += 0.25
        idx += 13
        
        # Board (37 hexes * 21 features = 777)
        for (q, r) in ALL_HEXES:
            cell = self.game.board[(q, r)]
            
            # Owner (3)
            if cell.owner == player_idx: obs[idx] = 1.0
            elif cell.owner == opp_idx: obs[idx + 1] = 1.0
            else: obs[idx + 2] = 1.0
            idx += 3
            
            # Soldiers (1)
            obs[idx] = min(len(cell.soldiers) / 10.0, 1.0)
            idx += 1
            
            # Top card revealed (1)
            top_revealed = len(cell.soldiers) > 0 and cell.soldiers[-1].revealed
            obs[idx] = 1.0 if top_revealed else 0.0
            idx += 1
            
            # Top card value (14)
            if top_revealed:
                val = cell.soldiers[-1].value
                obs[idx + val] = 1.0
            else:
                obs[idx] = 1.0  # unknown
            idx += 14
            
            # Grail presence (1)
            is_grail = (self.game.grail_key == (q, r))
            obs[idx] = 1.0 if is_grail else 0.0
            idx += 1
            
            # Radioactivity (1)
            idx += 1
            
        # Opp hand size (1)
        obs[idx] = len(self.game.hands[opp_idx]) / 54.0
        idx += 1
        
        # Pending combat defender mask (37)
        if self.game.phase == PHASE_REACT and self.game.pending_combats:
            combat = self.game.pending_combats[0]
            if combat.defender == player_idx:
                for hex_i, (q, r) in enumerate(ALL_HEXES):
                    if combat.cell_key == (q, r):
                        obs[idx + hex_i] = 1.0
        idx += 37
        
        return {"observation": obs, "action_mask": action_mask}

    def step(self, action):
        if self.truncations[self.agent_selection] or self.terminations[self.agent_selection]:
            self._was_dead_step(action)
            return

        agent = self.agent_selection
        player_idx = self.agents.index(agent)
        opp_idx = 1 - player_idx

        # ── Pre-action snapshot for Signal 5 (face card kills) ────────────────
        def _count_face(owner):
            return sum(
                1 for cell in self.game.board.values()
                if cell.owner == owner
                for s in cell.soldiers if s.value >= 11
            )
        opp_face_before = _count_face(opp_idx)
        own_face_before = _count_face(player_idx)

        self.game.apply_action(action)

        if self.game.is_terminal():
            # Outcome is 1 for win, 0 for draw, -1 for loss
            u0 = self.game.outcome(PLAYER_X)
            u1 = self.game.outcome(PLAYER_O)
            self.rewards[self.agents[PLAYER_X]] = u0
            self.rewards[self.agents[PLAYER_O]] = u1
            self.terminations = {a: True for a in self.agents}
            self._last_signals = {}
            
            # Record winner in info
            winner_idx = 0 if u0 > u1 else (1 if u1 > u0 else -1)
            for a in self.agents:
                self.infos[a]["winner"] = winner_idx
        else:
            # ── Reward shaping ────────────────────────────────────────────────
            my_base  = _P0_BASE if player_idx == 0 else _P1_BASE
            opp_base = _P1_BASE if player_idx == 0 else _P0_BASE

            # Signal 1: Survival penalty (breaks passive-draw equilibrium)
            s1 = _SURVIVAL_PENALTY

            # Signal 2: Grail proximity (zero-sum relative distance)
            dist_to_mine = _hex_dist(self.game.grail_key, my_base)
            dist_to_opp  = _hex_dist(self.game.grail_key, opp_base)
            s2 = ((dist_to_opp - dist_to_mine) / _MAX_GRAIL_DIST) * _GRAIL_SCALE

            # Signal 3: Territory differential (FARM / HILL / URBAN)
            my_terr  = sum(1 for c in self.game.board.values()
                           if c.owner == player_idx and c.cell_type in _VALUED_TYPES)
            opp_terr = sum(1 for c in self.game.board.values()
                           if c.owner == opp_idx   and c.cell_type in _VALUED_TYPES)
            s3 = (my_terr - opp_terr) * _TERRITORY_SCALE

            # Signal 4: Base pressure differential
            opp_nbrs = [n for n in _hex_neighbors(*opp_base) if n in self.game.board]
            my_nbrs  = [n for n in _hex_neighbors(*my_base)  if n in self.game.board]
            my_press  = sum(1 for n in opp_nbrs if self.game.board[n].owner == player_idx)
            opp_press = sum(1 for n in my_nbrs  if self.game.board[n].owner == opp_idx)
            s4 = (my_press - opp_press) * _PRESSURE_SCALE

            # Signal 5: Face card kill reward (J/Q/K = value >= 11) (Event reward, NOT potential)
            opp_face_after = _count_face(opp_idx)
            opp_killed = max(0, opp_face_before - opp_face_after)
            s5 = opp_killed * _FACE_CARD_SCALE

            # Only s2, s3, and s4 are state potentials
            current_potentials = {"s2": s2, "s3": s3, "s4": s4}
            prev_potentials = self._potentials.get(agent, {"s2": 0.0, "s3": 0.0, "s4": 0.0})
            
            delta_s2 = current_potentials["s2"] - prev_potentials["s2"]
            delta_s3 = current_potentials["s3"] - prev_potentials["s3"]
            delta_s4 = current_potentials["s4"] - prev_potentials["s4"]
            
            self._potentials[agent] = current_potentials

            self.rewards = {a: 0.0 for a in self.agents}
            self.rewards[agent] = s1 + s5 + delta_s2 + delta_s3 + delta_s4

            # Log the deltas for potentials, and raw values for events
            self._last_signals = {
                "s1_survival":  s1,
                "s2_grail":     delta_s2,
                "s3_territory": delta_s3,
                "s4_pressure":  delta_s4,
                "s5_facecard":  s5,
            }
            # Forward signals through PettingZoo's info dict so SuperSuit
            # and SB3 callbacks can read them via self.locals["infos"]
            self.infos[agent] = dict(self._last_signals)

        self._cumulative_rewards[agent] = 0

        # Next turn
        if not self.game.is_terminal():
            self.agent_selection = self.agents[self.game.turn]
        else:
            self.agent_selection = self._agent_selector.next()

        self._accumulate_rewards()
