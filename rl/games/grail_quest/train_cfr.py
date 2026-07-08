"""
Outcome-Sampling MCCFR for Grail Quest.

Does NOT require OpenSpiel as a dependency — implements OS-MCCFR directly
on top of our GrailQuestState engine. This avoids the OpenSpiel compilation
complexity while still being the correct algorithm for imperfect-info games.

References:
  - Lanctot et al., "Monte Carlo Sampling for Regret Minimization in Extensive Games"
    (NeurIPS 2009) — Section 4.2, Outcome Sampling
  - Marc Lanctot's open_spiel Python MCCFR implementation (reference)

Usage:
    python -m rl.games.grail_quest.train_cfr [--iterations N] [--save-every K]
                                              [--output-dir path] [--resume path]
"""

from __future__ import annotations

import argparse
import math
import os
import pickle
import random
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Ensure rl/ root is on path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from rl.games.grail_quest.engine import (
    GrailQuestState, PLAYER_X, PLAYER_O, NUM_ACTIONS,
    ACTION_END_TURN, ACTION_END_DEPLOY, ACTION_FIGHT
)

# ─── CFR Policy Store ─────────────────────────────────────────────────────────

class CFRPolicy:
    """
    Stores cumulative regrets and strategy sums keyed by information state string.
    After training, average_strategy() gives the Nash equilibrium approximation.
    """

    def __init__(self) -> None:
        # { info_state_str: { action_int: cumulative_regret } }
        self.regret_sum: Dict[str, Dict[int, float]] = defaultdict(lambda: defaultdict(float))
        # { info_state_str: { action_int: cumulative_strategy } }
        self.strategy_sum: Dict[str, Dict[int, float]] = defaultdict(lambda: defaultdict(float))
        self.iterations: int = 0

    def get_strategy(self, info_state: str, legal_actions: List[int]) -> Dict[int, float]:
        """Current strategy via regret-matching."""
        regrets = self.regret_sum[info_state]
        positive_regrets = {a: max(0.0, regrets[a]) for a in legal_actions}
        total = sum(positive_regrets.values())
        if total > 0:
            return {a: positive_regrets[a] / total for a in legal_actions}
        # Uniform fallback
        n = len(legal_actions)
        return {a: 1.0 / n for a in legal_actions}

    def get_average_strategy(self, info_state: str, legal_actions: List[int]) -> Dict[int, float]:
        """Average strategy — the Nash approximation."""
        sums = self.strategy_sum[info_state]
        total = sum(sums.get(a, 0.0) for a in legal_actions)
        if total > 0:
            return {a: sums.get(a, 0.0) / total for a in legal_actions}
        n = len(legal_actions)
        return {a: 1.0 / n for a in legal_actions}

    def best_action(self, info_state: str, legal_actions: List[int]) -> int:
        """Pick highest-probability action from average strategy."""
        if not legal_actions:
            return ACTION_END_TURN
        strategy = self.get_average_strategy(info_state, legal_actions)
        return max(legal_actions, key=lambda a: strategy.get(a, 0.0))

    def save(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump({
                "regret_sum": dict(self.regret_sum),
                "strategy_sum": dict(self.strategy_sum),
                "iterations": self.iterations,
            }, f)
        print(f"  ✓ Saved policy ({self.iterations} iters) → {path}")

    @classmethod
    def load(cls, path: str | Path) -> "CFRPolicy":
        with open(path, "rb") as f:
            data = pickle.load(f)
        policy = cls()
        policy.regret_sum = defaultdict(lambda: defaultdict(float), {
            k: defaultdict(float, v) for k, v in data["regret_sum"].items()
        })
        policy.strategy_sum = defaultdict(lambda: defaultdict(float), {
            k: defaultdict(float, v) for k, v in data["strategy_sum"].items()
        })
        policy.iterations = data["iterations"]
        print(f"  ✓ Loaded policy ({policy.iterations} iters) ← {path}")
        return policy


# ─── Outcome-Sampling MCCFR ───────────────────────────────────────────────────

class GrailQuestMCCFR:
    """
    Outcome-Sampling MCCFR trainer for Grail Quest.

    Outcome sampling traverses ONE trajectory per iteration (fast!), making it
    tractable for games with large state spaces. The algorithm maintains
    correctness because importance weights compensate for sampling bias.
    """

    def __init__(self, policy: Optional[CFRPolicy] = None) -> None:
        self.policy = policy or CFRPolicy()
        self._rng = random.Random()

    def run_iteration(self, update_player: int) -> float:
        """
        Run one OS-MCCFR iteration for `update_player`.
        Returns the sampled utility for update_player at the root.
        """
        state = GrailQuestState()
        # Randomize the RNG seed slightly per iteration for diverse sampling
        state._rng = random.Random(self._rng.randint(0, 2**32))
        return self._traverse_iterative(state, update_player)

    # Maximum number of actions per game trajectory to prevent infinite loops
    MAX_DEPTH = 600

    def _traverse_iterative(self, root_state: GrailQuestState, update_player: int) -> float:
        """
        Iterative OS-MCCFR traversal (replaces recursive version).

        Simulates the recursive call stack explicitly to avoid Python's 1000-frame
        limit. Grail Quest games can be 400 turns × 10+ actions = 4000+ steps deep.

        Each 'frame' on the stack stores everything needed to compute the regret
        update once the sampled child returns its utility.
        """
        # Stack frames: list of dicts with fields:
        #   info_state, player, legal, action, strategy,
        #   my_reach, opp_reach, sample_prob
        stack: list = []

        state = root_state
        reach_p0 = 1.0
        reach_p1 = 1.0
        sample_prob = 1.0

        # ── Forward pass: walk down the sampled trajectory ──────────────────
        for _ in range(self.MAX_DEPTH):
            if state.is_terminal():
                break

            player = state.turn
            legal = state.legal_actions()
            if not legal:
                break

            info_state = state.information_state_string(player)
            strategy = self.policy.get_strategy(info_state, legal)

            action = self._sample_action(strategy, legal)
            action_prob = strategy.get(action, 1.0 / max(len(legal), 1))

            if player == PLAYER_X:
                my_reach  = reach_p0
                opp_reach = reach_p1
                child_reach_p0 = reach_p0 * action_prob
                child_reach_p1 = reach_p1
            else:
                my_reach  = reach_p1
                opp_reach = reach_p0
                child_reach_p0 = reach_p0
                child_reach_p1 = reach_p1 * action_prob

            # Push frame for backward pass
            stack.append({
                "info_state": info_state,
                "player":     player,
                "legal":      legal,
                "action":     action,
                "strategy":   strategy,
                "my_reach":   my_reach,
                "opp_reach":  opp_reach,
                "sample_prob": sample_prob,
            })

            # Advance state (in-place mutation on a fresh clone)
            next_state = state.clone()
            next_state.apply_action(action)
            state = next_state

            reach_p0   = child_reach_p0
            reach_p1   = child_reach_p1
            sample_prob = sample_prob * action_prob

        # ── Leaf utility ─────────────────────────────────────────────────────
        # Avoid division by zero
        sp = sample_prob if sample_prob > 1e-300 else 1e-300
        util = state.outcome(update_player) / sp

        # ── Backward pass: propagate utility and update regrets ───────────────
        for frame in reversed(stack):
            player    = frame["player"]
            info_state = frame["info_state"]
            legal     = frame["legal"]
            action    = frame["action"]
            strategy  = frame["strategy"]
            opp_reach = frame["opp_reach"]
            sp_frame  = frame["sample_prob"] if frame["sample_prob"] > 1e-300 else 1e-300

            if player == update_player:
                # Counterfactual reach weight
                cf_reach = opp_reach / sp_frame

                # Baseline-free OS-MCCFR update:
                # Only the sampled action gets regret = cf_reach * util
                # All unsampled actions get regret = 0 (implicit, no update needed)
                self.policy.regret_sum[info_state][action] += cf_reach * util

                # Strategy sum accumulation (for average policy / Nash approx)
                my_reach = frame["my_reach"]
                for a in legal:
                    self.policy.strategy_sum[info_state][a] += my_reach * strategy.get(a, 0.0)

        return util



    def _sample_action(self, strategy: Dict[int, float], legal: List[int]) -> int:
        r = self._rng.random()
        cumulative = 0.0
        for a in legal:
            cumulative += strategy.get(a, 0.0)
            if r <= cumulative:
                return a
        return legal[-1]

    def train(
        self,
        total_iterations: int,
        save_every: int = 1000,
        output_dir: Optional[Path] = None,
        log_every: int = 100,
    ) -> CFRPolicy:
        output_dir = output_dir or Path("rl/service/models/grail_quest")
        output_dir.mkdir(parents=True, exist_ok=True)
        policy_path = output_dir / "cfr_policy.pkl"

        print(f"\n{'='*60}")
        print(f"Grail Quest OS-MCCFR Training")
        print(f"  Iterations: {total_iterations}")
        print(f"  Save every: {save_every}")
        print(f"  Output dir: {output_dir}")
        print(f"{'='*60}\n")

        start = time.time()
        for i in range(1, total_iterations + 1):
            # Alternate update player each iteration
            update_player = (i - 1) % 2
            self.run_iteration(update_player)
            self.policy.iterations += 1

            if i % log_every == 0:
                elapsed = time.time() - start
                its_per_sec = i / elapsed
                info_sets = len(self.policy.regret_sum)
                print(f"  Iter {i:>8,} | {its_per_sec:>6.1f} it/s | "
                      f"info-sets: {info_sets:>8,}")

            if i % save_every == 0:
                # Save checkpoint with iteration number
                ckpt_path = output_dir / f"cfr_policy_iter_{i}.pkl"
                self.policy.save(ckpt_path)
                self.policy.save(policy_path)

        # Final save
        self.policy.save(policy_path)
        elapsed = time.time() - start
        print(f"\nTraining complete! {total_iterations} iterations in {elapsed:.1f}s")
        print(f"  Info-sets explored: {len(self.policy.regret_sum):,}")
        print(f"  Policy saved to: {policy_path}")
        return self.policy


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train OS-MCCFR policy for Grail Quest"
    )
    parser.add_argument("--iterations", type=int, default=10_000,
                        help="Total OS-MCCFR iterations (default: 10,000)")
    parser.add_argument("--save-every", type=int, default=1_000,
                        help="Save checkpoint every N iterations (default: 1,000)")
    parser.add_argument("--log-every", type=int, default=100,
                        help="Log progress every N iterations (default: 100)")
    parser.add_argument("--output-dir", type=str,
                        default=str(PROJECT_ROOT / "rl" / "service" / "models" / "grail_quest"),
                        help="Directory to save policy checkpoints")
    parser.add_argument("--resume", type=str, default=None,
                        help="Path to existing policy .pkl to resume from")
    args = parser.parse_args()

    policy: Optional[CFRPolicy] = None
    if args.resume:
        resume_path = Path(args.resume)
        if resume_path.exists():
            policy = CFRPolicy.load(resume_path)
            print(f"Resuming from iteration {policy.iterations}")
        else:
            print(f"WARNING: --resume path not found: {resume_path}")

    trainer = GrailQuestMCCFR(policy)
    trainer.train(
        total_iterations=args.iterations,
        save_every=args.save_every,
        log_every=args.log_every,
        output_dir=Path(args.output_dir),
    )


if __name__ == "__main__":
    main()
