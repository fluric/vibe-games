from __future__ import annotations

import math
from typing import Dict, List, Optional
import numpy as np

# PyTorch import might not be available everywhere, but we expect to use it
import torch

from rl.core.interfaces import BaseEnv, BaseNet


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
        env: BaseEnv,
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
    Generic AlphaZero MCTS for any game implementing BaseEnv and BaseNet.
    """

    def __init__(
        self,
        net: BaseNet,
        device: torch.device,
        action_space_size: int,
        c_puct: float = 1.5,
        dirichlet_alpha: float = 0.3,   # noise for exploration at root
        dirichlet_eps: float = 0.25,    # fraction of dirichlet noise at root
    ) -> None:
        self.net = net
        self.device = device
        self.action_space_size = action_space_size
        self.c_puct = c_puct
        self.dirichlet_alpha = dirichlet_alpha
        self.dirichlet_eps = dirichlet_eps

    def run(
        self,
        env: BaseEnv,
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
            add_noise: Add Dirichlet noise to root priors (for self-play exploration).

        Returns:
            policy: np.ndarray over actions (probability distribution).
        """
        root = MCTSNode(env=env.clone(), parent=None, action=None)
        self._expand(root, add_noise=add_noise)

        for _ in range(num_simulations):
            node = self._select(root)

            if node.env.is_terminal():
                parent_turn = node.parent.env.turn if node.parent else node.env.turn
                value_for_parent = node.env.outcome(parent_turn)
                if value_for_parent is None:
                    value_for_parent = 0.0
            else:
                value_from_child = self._expand(node)
                value_for_parent = -value_from_child

            self._backpropagate(node, value_for_parent)

        visits = np.array(
            [root.children[a].visit_count if a in root.children else 0 for a in range(self.action_space_size)],
            dtype=np.float32,
        )

        if temperature == 0 or temperature < 1e-6:
            policy = np.zeros(self.action_space_size, dtype=np.float32)
            policy[int(np.argmax(visits))] = 1.0
        else:
            visits_t = visits ** (1.0 / temperature)
            total = visits_t.sum()
            policy = visits_t / total if total > 0 else visits_t

        return policy

    def best_action(self, env: BaseEnv, num_simulations: int) -> int:
        if num_simulations == 0:
            return self._policy_action(env)
        policy = self.run(env, num_simulations, temperature=0, add_noise=False)
        legal = env.legal_actions()
        masked = np.array([policy[a] if a in legal else 0.0 for a in range(self.action_space_size)])
        return int(np.argmax(masked))

    def _policy_action(self, env: BaseEnv) -> int:
        encoded = torch.tensor(env.encode(), dtype=torch.float32, device=self.device)
        # Use unsqueeze to mock batch=1
        probs, _ = self.net.predict(encoded)
        if isinstance(probs, torch.Tensor):
            probs_np = probs.cpu().numpy()
        else:
            probs_np = probs

        legal = env.legal_actions()
        for a in range(self.action_space_size):
            if a not in legal:
                probs_np[a] = 0.0
        total = probs_np.sum()
        if total > 0:
            probs_np /= total
        else:
            for a in legal:
                probs_np[a] = 1.0 / len(legal)
        return int(np.argmax(probs_np))

    def _expand(self, node: MCTSNode, add_noise: bool = False) -> float:
        env = node.env
        encoded = torch.tensor(env.encode(), dtype=torch.float32, device=self.device)
        probs, value = self.net.predict(encoded)
        if isinstance(probs, torch.Tensor):
            probs_np = probs.cpu().numpy()
        else:
            probs_np = probs

        if isinstance(value, torch.Tensor):
            value_float = float(value.item())
        else:
            value_float = float(value)

        legal = env.legal_actions()
        if not legal:
            node.is_expanded = True
            return value_float

        if add_noise:
            noise = np.random.dirichlet([self.dirichlet_alpha] * len(legal))
            for i, a in enumerate(legal):
                probs_np[a] = (
                    (1 - self.dirichlet_eps) * probs_np[a] + self.dirichlet_eps * noise[i]
                )

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
        return value_float

    def _select(self, node: MCTSNode) -> MCTSNode:
        while not node.is_leaf() and not node.env.is_terminal():
            node = node.best_child(self.c_puct)
        return node

    def _backpropagate(self, node: MCTSNode, value_for_parent: float) -> None:
        current = node
        v = value_for_parent
        while current is not None:
            current.visit_count += 1
            current.value_sum += v
            v = -v
            current = current.parent
