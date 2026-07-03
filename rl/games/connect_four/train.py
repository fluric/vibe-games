"""
AlphaZero self-play training loop for Connect Four.

Usage:
    # Quick smoke test
    python -m games.connect_four.train --iterations 5 --games-per-iter 20

    # Full training run (~2-4h on M4)
    python -m games.connect_four.train --iterations 500 --games-per-iter 100 --num-simulations 100

Milestone checkpoints are saved in service/models/connect_four/ whenever the
model's estimated ELO crosses a threshold.
"""
from __future__ import annotations

import argparse
import copy
import json
import os
import random
import time
from collections import deque
from pathlib import Path
from typing import Deque, List, Optional, Tuple

import numpy as np
import torch
import torch.nn.functional as F
import torch.optim as optim

from games.connect_four.env import ConnectFourEnv, PLAYER_X, PLAYER_O
from games.connect_four.net import ConnectFourNet, get_device, create_net, save_checkpoint, load_checkpoint
from games.connect_four.mcts import MCTS

# ─── Paths ────────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent.parent.parent  # vibe-games/
MODELS_DIR = REPO_ROOT / "rl" / "service" / "models" / "connect_four"
REGISTRY_PATH = MODELS_DIR / "models_registry.json"
CHAMPION_PATH = MODELS_DIR / "champion.pt"

# ─── Config ───────────────────────────────────────────────────────────────────

# Save a milestone checkpoint every N ELO points automatically.
MILESTONE_INTERVAL = 200

# ELO computation baseline: these are the approximate ELO ratings of the
# existing TypeScript minimax bots. We compute RL bot ELO by win rate vs. these.
BASELINE_BOTS = [
    # (name, approximate_elo)
    ("random", 0),
    ("easy", 100),
    ("medium", 400),
    ("hard", 700),
    ("expert", 1000),
]

# ─── Replay Buffer ─────────────────────────────────────────────────────────────

TrainSample = Tuple[np.ndarray, np.ndarray, float]  # (encoded_state, mcts_policy, outcome)


class ReplayBuffer:
    def __init__(self, max_size: int = 50_000) -> None:
        self.buffer: Deque[TrainSample] = deque(maxlen=max_size)

    def add_game(self, samples: List[TrainSample]) -> None:
        self.buffer.extend(samples)

    def sample(self, batch_size: int) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        batch = random.sample(self.buffer, min(batch_size, len(self.buffer)))
        states, policies, values = zip(*batch)
        return np.stack(states), np.stack(policies), np.array(values, dtype=np.float32)

    def __len__(self) -> int:
        return len(self.buffer)


# ─── Self-Play ────────────────────────────────────────────────────────────────

def self_play_game(
    mcts: MCTS,
    num_simulations: int,
    temp_threshold: int = 20,
) -> List[TrainSample]:
    """
    Play one complete game against itself using MCTS.

    Returns a list of (encoded_state, mcts_policy, outcome) triples —
    one per move, with outcomes filled in at the end.
    """
    env = ConnectFourEnv()
    game_history: List[Tuple[np.ndarray, np.ndarray, int]] = []  # (state, policy, turn)

    move_number = 0
    while not env.is_terminal():
        # Temperature: high early (exploration), low later (exploitation)
        temperature = 1.0 if move_number < temp_threshold else 0.1

        policy = mcts.run(env, num_simulations, temperature=temperature, add_noise=True)
        encoded = env.encode()

        # Sample action from MCTS policy
        legal = env.legal_actions()
        masked_policy = np.array([policy[a] if a in legal else 0.0 for a in range(7)])
        total = masked_policy.sum()
        if total > 0:
            masked_policy /= total
        else:
            for a in legal:
                masked_policy[a] = 1.0 / len(legal)

        action = int(np.random.choice(7, p=masked_policy))
        game_history.append((encoded, masked_policy, env.turn))
        env.step(action)
        move_number += 1

    # Fill in outcomes from each player's perspective
    final_winner = env.winner  # PLAYER_X, PLAYER_O, or 0 (draw)
    samples: List[TrainSample] = []
    for encoded, policy, turn in game_history:
        if final_winner == 0:
            outcome = 0.0
        elif final_winner == turn:
            outcome = 1.0
        else:
            outcome = -1.0
        samples.append((encoded, policy, outcome))

    return samples


# ─── Training ─────────────────────────────────────────────────────────────────

def train_step(
    net: ConnectFourNet,
    optimizer: optim.Optimizer,
    buffer: ReplayBuffer,
    batch_size: int,
    device: torch.device,
) -> Tuple[float, float]:
    """
    One gradient update step.

    Returns:
        (policy_loss, value_loss)
    """
    if len(buffer) < batch_size:
        return 0.0, 0.0

    net.train()
    states, policies, values = buffer.sample(batch_size)

    states_t = torch.tensor(states, dtype=torch.float32, device=device)
    policies_t = torch.tensor(policies, dtype=torch.float32, device=device)
    values_t = torch.tensor(values, dtype=torch.float32, device=device).unsqueeze(1)

    policy_logits, value_pred = net(states_t)

    # Policy loss: cross-entropy (MCTS policy is the target)
    policy_loss = -(policies_t * F.log_softmax(policy_logits, dim=1)).sum(dim=1).mean()

    # Value loss: MSE
    value_loss = F.mse_loss(value_pred, values_t)

    total_loss = policy_loss + value_loss

    optimizer.zero_grad()
    total_loss.backward()
    # Gradient clipping for stability
    torch.nn.utils.clip_grad_norm_(net.parameters(), max_norm=1.0)
    optimizer.step()

    return policy_loss.item(), value_loss.item()


# ─── Champion Evaluation ──────────────────────────────────────────────────────

def evaluate_champion(
    challenger: ConnectFourNet,
    champion: ConnectFourNet,
    device: torch.device,
    num_games: int = 100,
    num_simulations: int = 50,
) -> float:
    """
    Pit challenger vs. champion for num_games games.
    Returns challenger's win rate (0–1). Draw = 0.5 points.
    """
    challenger_mcts = MCTS(challenger, device)
    champion_mcts = MCTS(champion, device)

    challenger_score = 0.0

    for game_idx in range(num_games):
        env = ConnectFourEnv()
        # Alternate who plays first
        challenger_is_x = (game_idx % 2 == 0)

        while not env.is_terminal():
            is_challenger_turn = (
                (env.turn == PLAYER_X and challenger_is_x) or
                (env.turn == PLAYER_O and not challenger_is_x)
            )
            if is_challenger_turn:
                action = challenger_mcts.best_action(env, num_simulations)
            else:
                action = champion_mcts.best_action(env, num_simulations)
            env.step(action)

        winner = env.winner
        if winner == 0:
            challenger_score += 0.5
        elif (winner == PLAYER_X and challenger_is_x) or (winner == PLAYER_O and not challenger_is_x):
            challenger_score += 1.0

    return challenger_score / num_games


# ─── Milestone Management ─────────────────────────────────────────────────────

def load_registry() -> dict:
    if REGISTRY_PATH.exists():
        with open(REGISTRY_PATH) as f:
            return json.load(f)
    return {}


def save_registry(registry: dict) -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    with open(REGISTRY_PATH, "w") as f:
        json.dump(registry, f, indent=2)


def save_milestone(net: ConnectFourNet, elo: int, registry: dict) -> None:
    """Save a milestone checkpoint and update models_registry.json."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"connect_four_elo_{elo}.pt"
    path = MODELS_DIR / filename
    save_checkpoint(net, str(path))
    print(f"  → Milestone saved: {filename}")

    # Update registry — map this milestone to the appropriate bot level
    bot_level = _elo_to_bot_level(elo)
    if bot_level:
        registry[bot_level] = {
            "checkpoint": filename,
            "num_simulations": _bot_level_sims(bot_level),
            "elo": elo,
        }
        save_registry(registry)
        print(f"  → Registry updated: {bot_level} → {filename}")


def _elo_to_bot_level(elo: int) -> Optional[str]:
    """Map an ELO threshold to a bot level name."""
    if elo <= 300:
        return "rl_novice"
    if elo <= 700:
        return "rl_intermediate"
    if elo <= 1000:
        return "rl_strong"
    return "rl_master"


def _bot_level_sims(level: str) -> int:
    """Default MCTS simulations for each bot level."""
    return {"rl_novice": 0, "rl_intermediate": 50, "rl_strong": 200, "rl_master": 800}.get(level, 50)


# ─── Main Training Loop ───────────────────────────────────────────────────────

def train(
    num_iterations: int = 200,
    games_per_iter: int = 50,
    batch_size: int = 256,
    num_train_steps: int = 200,
    num_simulations: int = 100,
    eval_every: int = 20,
    eval_games: int = 100,
    eval_sims: int = 50,
    resume: bool = True,
    device: Optional[torch.device] = None,
) -> None:
    if device is None:
        device = get_device()
    print(f"Device: {device}")
    print(f"Models dir: {MODELS_DIR}")
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # Load or create champion
    if resume and CHAMPION_PATH.exists():
        print(f"Resuming from champion: {CHAMPION_PATH}")
        champion = load_checkpoint(str(CHAMPION_PATH), device)
    else:
        print("Starting from scratch (random network)")
        champion = create_net(device)
        save_checkpoint(champion, str(CHAMPION_PATH))

    # Challenger starts as a copy of champion
    challenger = copy.deepcopy(champion)
    optimizer = optim.Adam(challenger.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=num_iterations, eta_min=1e-5)

    buffer = ReplayBuffer(max_size=100_000)
    mcts = MCTS(challenger, device)

    champion_elo = 0.0

    registry = load_registry()
    milestone_saved: set = set()

    # Track which milestones have already been saved (from existing registry)
    for entry in registry.values():
        if "elo" in entry:
            milestone_saved.add(entry["elo"])

    # Load starting champion ELO from registry if it exists
    if resume and "rl_master" in registry and "elo" in registry["rl_master"]:
        champion_elo = float(registry["rl_master"]["elo"])
        print(f"Loaded champion ELO from registry: {champion_elo:.0f}")

        # Mark all past milestones as completed so we don't retrospectively save them
        max_past_threshold = int(champion_elo // MILESTONE_INTERVAL) * MILESTONE_INTERVAL
        for threshold in range(MILESTONE_INTERVAL, max_past_threshold + MILESTONE_INTERVAL, MILESTONE_INTERVAL):
            milestone_saved.add(threshold)

    print(f"\n{'='*60}")
    print(f"Training: {num_iterations} iterations × {games_per_iter} games/iter")
    print(f"MCTS sims: {num_simulations} | Batch: {batch_size} | Eval every: {eval_every}")
    print(f"{'='*60}\n")

    for iteration in range(1, num_iterations + 1):
        iter_start = time.time()

        # ── 1. Self-play ───────────────────────────────────────────────────────
        mcts.net = challenger
        game_samples = []
        for _ in range(games_per_iter):
            samples = self_play_game(mcts, num_simulations)
            game_samples.extend(samples)
        buffer.add_game(game_samples)

        # ── 2. Train ───────────────────────────────────────────────────────────
        total_p_loss = 0.0
        total_v_loss = 0.0
        for _ in range(num_train_steps):
            p_loss, v_loss = train_step(challenger, optimizer, buffer, batch_size, device)
            total_p_loss += p_loss
            total_v_loss += v_loss
        # Step scheduler AFTER optimizer.step() calls (PyTorch 1.1+ requirement)
        scheduler.step()

        iter_time = time.time() - iter_start
        print(
            f"[Iter {iteration:>4}/{num_iterations}] "
            f"Games: {games_per_iter} | "
            f"Buffer: {len(buffer):>6} | "
            f"P-loss: {total_p_loss/num_train_steps:.4f} | "
            f"V-loss: {total_v_loss/num_train_steps:.4f} | "
            f"Time: {iter_time:.1f}s"
        )

        # ── 3. Champion evaluation ─────────────────────────────────────────────
        if iteration % eval_every == 0:
            print(f"\n  Evaluating challenger vs. champion ({eval_games} games)...")
            win_rate = evaluate_champion(challenger, champion, device, eval_games, eval_sims)
            print(f"  Challenger win rate: {win_rate:.1%}")

            if win_rate >= 0.55:
                print(f"  ✓ Challenger promoted to champion!")
                champion = copy.deepcopy(challenger)
                save_checkpoint(champion, str(CHAMPION_PATH))

                # Calculate ELO gain based on win rate vs previous champion
                # Clamp win_rate strictly for math safety, though it should be >= 0.55 here
                clamped_win_rate = max(0.01, min(0.99, win_rate))
                elo_gain = 400 * np.log10(clamped_win_rate / (1 - clamped_win_rate))
                champion_elo += float(elo_gain)
                rounded_elo = int(round(champion_elo / 50) * 50)
                print(f"  ELO gain: +{elo_gain:.0f} → New ELO: ~{champion_elo:.0f} (rounded: {rounded_elo})")

                # Save milestone if we've crossed a new threshold (dynamic)
                max_threshold = int(champion_elo // MILESTONE_INTERVAL) * MILESTONE_INTERVAL
                for threshold in range(MILESTONE_INTERVAL, max_threshold + MILESTONE_INTERVAL, MILESTONE_INTERVAL):
                    if threshold not in milestone_saved:
                        save_milestone(champion, threshold, registry)
                        milestone_saved.add(threshold)

                # Always update registry champion entry
                registry["rl_master"] = {
                    "checkpoint": "champion.pt",
                    "num_simulations": 800,
                    "elo": int(champion_elo),
                }
                save_registry(registry)
            else:
                print(f"  ✗ Champion retained (win rate {win_rate:.1%} < 55%)")
            print()

    print("\nTraining complete!")
    print(f"Final champion saved to: {CHAMPION_PATH}")
    print(f"Registry: {REGISTRY_PATH}")


# ─── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train AlphaZero Connect Four bot")
    parser.add_argument("--iterations", type=int, default=200, help="Number of training iterations")
    parser.add_argument("--games-per-iter", type=int, default=50, help="Self-play games per iteration")
    parser.add_argument("--num-simulations", type=int, default=100, help="MCTS simulations per move")
    parser.add_argument("--batch-size", type=int, default=256, help="Training batch size")
    parser.add_argument("--train-steps", type=int, default=200, help="Gradient steps per iteration")
    parser.add_argument("--eval-every", type=int, default=20, help="Evaluate vs. champion every N iterations")
    parser.add_argument("--eval-games", type=int, default=100, help="Games in champion evaluation")
    parser.add_argument("--eval-sims", type=int, default=50, help="MCTS sims during evaluation")
    parser.add_argument("--no-resume", action="store_true", help="Start from scratch even if champion.pt exists")
    parser.add_argument("--device", type=str, default=None, choices=["mps", "cuda", "cpu"], help="Force device")

    args = parser.parse_args()

    if args.device:
        device = torch.device(args.device)
    else:
        device = get_device()

    train(
        num_iterations=args.iterations,
        games_per_iter=args.games_per_iter,
        batch_size=args.batch_size,
        num_train_steps=args.train_steps,
        num_simulations=args.num_simulations,
        eval_every=args.eval_every,
        eval_games=args.eval_games,
        eval_sims=args.eval_sims,
        resume=not args.no_resume,
        device=device,
    )
