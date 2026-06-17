"""
Monte Carlo Tree Search (MCTS) for Connect Four — AlphaZero style.

Uses PUCT (Predictor + UCT) for selection, with the neural network providing
the prior policy and leaf value estimates.

Reference: "Mastering the Game of Go without Human Knowledge" (Silver et al., 2017)
"""
from __future__ import annotations

import math
from typing import Dict, List, Optional
import numpy as np
import torch

from games.connect_four.env import ConnectFourEnv, PLAYER_X, PLAYER_O
from games.connect_four.net import ConnectFourNet


# ─── Tree Node ────────────────────────────────────────────────────────────────

class MCTSNode:
    """A single node in the MCTS tree."""

    __slots__ = (
        "env",
        "parent",
        "action",       # action that led to this node from parent
        "prior",        # P(s, a) from the policy network
        "visit_count",  # N(s, a)
        "value_sum",    # W(s, a) — sum of all backed-up values
        "children",
        "is_expanded",
    )

    def __init__(
        self,
        env: ConnectFourEnv,
        parent: Optional["MCTSNode"] = None,
        action: Optional[int] = None,
        prior: float = 0.0,
    ) -> None:
        self.env = env
        self.parent = parent
        self.action = action
        self.prior = prior
        self.visit_count = 0
        self.value_sum = 0.0
        self.children: Dict[int, MCTSNode] = {}
        self.is_expanded = False

    @property
    def q_value(self) -> float:
        """Mean action value Q(s,a) = W(s,a) / N(s,a)."""
        if self.visit_count == 0:
            return 0.0
        return self.value_sum / self.visit_count

    def ucb_score(self, c_puct: float) -> float:
        """PUCT formula: Q + c_puct * P * sqrt(N_parent) / (1 + N)."""
        assert self.parent is not None
        u = c_puct * self.prior * math.sqrt(self.parent.visit_count) / (1 + self.visit_count)
        return self.q_value + u

    def best_child(self, c_puct: float) -> "MCTSNode":
        return max(self.children.values(), key=lambda n: n.ucb_score(c_puct))

    def is_leaf(self) -> bool:
        return not self.is_expanded


# ─── MCTS ─────────────────────────────────────────────────────────────────────

class MCTS:
    """
    AlphaZero MCTS.

    Each call to `run()` performs `num_simulations` MCTS simulations from the
    given root state and returns a visit-count policy vector over actions.
    """

    def __init__(
        self,
        net: ConnectFourNet,
        device: torch.device,
        c_puct: float = 1.5,
        dirichlet_alpha: float = 0.3,   # noise for exploration at root
        dirichlet_eps: float = 0.25,    # fraction of dirichlet noise at root
    ) -> None:
        self.net = net
        self.device = device
        self.c_puct = c_puct
        self.dirichlet_alpha = dirichlet_alpha
        self.dirichlet_eps = dirichlet_eps

    # ── Public API ────────────────────────────────────────────────────────────

    def run(
        self,
        env: ConnectFourEnv,
        num_simulations: int,
        temperature: float = 1.0,
        add_noise: bool = True,
    ) -> np.ndarray:
        """
        Run MCTS from the given state.

        Args:
            env: Current game state (will NOT be mutated).
            num_simulations: Number of MCTS simulations.
            temperature: Controls move selection randomness.
                         τ=1 → proportional to visit counts (exploration)
                         τ→0 → greedy (best move)
            add_noise: Add Dirichlet noise to root priors (for self-play exploration).

        Returns:
            policy: np.ndarray of shape (7,), probability distribution over columns.
        """
        root = MCTSNode(env=env.clone(), parent=None, action=None)
        self._expand(root, add_noise=add_noise)

        for _ in range(num_simulations):
            node = self._select(root)

            if node.env.is_terminal():
                # Terminal node: back-propagate actual outcome
                value = node.env.outcome(root.env.turn)
                if value is None:
                    value = 0.0
            else:
                # Expand and evaluate with NN
                value = self._expand(node)

            self._backpropagate(node, value, root.env.turn)

        # Build policy from visit counts
        visits = np.array(
            [root.children[a].visit_count if a in root.children else 0 for a in range(7)],
            dtype=np.float32,
        )

        if temperature == 0 or temperature < 1e-6:
            # Greedy: all probability on the most visited action
            policy = np.zeros(7, dtype=np.float32)
            policy[int(np.argmax(visits))] = 1.0
        else:
            # Temperature-scaled
            visits_t = visits ** (1.0 / temperature)
            total = visits_t.sum()
            policy = visits_t / total if total > 0 else visits_t

        return policy

    def best_action(self, env: ConnectFourEnv, num_simulations: int) -> int:
        """Return the best column index (greedy, no temperature)."""
        if num_simulations == 0:
            # Pure NN policy — no MCTS
            return self._policy_action(env)
        policy = self.run(env, num_simulations, temperature=0, add_noise=False)
        legal = env.legal_actions()
        # Mask illegal actions just in case
        masked = np.array([policy[a] if a in legal else 0.0 for a in range(7)])
        return int(np.argmax(masked))

    # ── Internal ──────────────────────────────────────────────────────────────

    def _policy_action(self, env: ConnectFourEnv) -> int:
        """Select action from pure NN policy (no MCTS), masking illegal columns."""
        encoded = torch.tensor(env.encode(), dtype=torch.float32, device=self.device)
        probs, _ = self.net.predict(encoded)
        probs_np = probs.cpu().numpy()
        legal = env.legal_actions()
        for a in range(7):
            if a not in legal:
                probs_np[a] = 0.0
        total = probs_np.sum()
        if total > 0:
            probs_np /= total
        else:
            # Fallback uniform over legal
            for a in legal:
                probs_np[a] = 1.0 / len(legal)
        return int(np.argmax(probs_np))

    def _expand(self, node: MCTSNode, add_noise: bool = False) -> float:
        """
        Expand a leaf node using the NN.
        Returns the NN value estimate from the current player's perspective.
        """
        env = node.env
        encoded = torch.tensor(env.encode(), dtype=torch.float32, device=self.device)
        probs, value = self.net.predict(encoded)
        probs_np = probs.cpu().numpy()

        legal = env.legal_actions()
        if not legal:
            node.is_expanded = True
            return float(value)

        # Add Dirichlet exploration noise at the root
        if add_noise:
            noise = np.random.dirichlet([self.dirichlet_alpha] * len(legal))
            for i, a in enumerate(legal):
                probs_np[a] = (
                    (1 - self.dirichlet_eps) * probs_np[a] + self.dirichlet_eps * noise[i]
                )

        # Mask and normalize to legal actions only
        legal_probs = np.array([probs_np[a] for a in legal], dtype=np.float32)
        total = legal_probs.sum()
        if total > 0:
            legal_probs /= total
        else:
            legal_probs = np.ones(len(legal), dtype=np.float32) / len(legal)

        for i, action in enumerate(legal):
            child_env = env.clone()
            child_env.step(action)
            node.children[action] = MCTSNode(
                env=child_env,
                parent=node,
                action=action,
                prior=float(legal_probs[i]),
            )

        node.is_expanded = True
        return float(value)

    def _select(self, node: MCTSNode) -> MCTSNode:
        """Traverse the tree from root to a leaf using PUCT."""
        while not node.is_leaf() and not node.env.is_terminal():
            node = node.best_child(self.c_puct)
        return node

    def _backpropagate(self, node: MCTSNode, value: float, root_player: int) -> None:
        """
        Propagate value back up the tree.
        Value is from root_player's perspective; flip sign at each level since
        the tree alternates between players.
        """
        current = node
        # Determine if we need to flip based on whose turn it is at the node
        # vs. whose turn it was at the root
        v = value
        while current is not None:
            current.visit_count += 1
            # If this node's turn is the same as root player, add value; otherwise subtract
            if current.env.turn == root_player:
                current.value_sum += v
            else:
                current.value_sum -= v
            current = current.parent
