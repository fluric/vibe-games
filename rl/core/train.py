from __future__ import annotations

import copy
import json
import random
import time
from collections import deque
from pathlib import Path
from typing import Callable, Deque, List, Optional, Tuple, Type

import numpy as np
import torch
import torch.nn.functional as F
import torch.optim as optim

from rl.core.interfaces import BaseEnv, BaseNet
from rl.core.mcts import MCTS


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
    env_cls: Type[BaseEnv],
    mcts: MCTS,
    num_simulations: int,
    temp_threshold: int = 20,
) -> List[TrainSample]:
    """
    Play one complete game against itself using MCTS.
    Returns a list of (encoded_state, mcts_policy, outcome) triples.
    """
    env = env_cls()
    game_history: List[Tuple[np.ndarray, np.ndarray, int]] = []  # (state, policy, turn)

    move_number = 0
    while not env.is_terminal():
        temperature = 1.0 if move_number < temp_threshold else 0.1

        policy = mcts.run(env, num_simulations, temperature=temperature, add_noise=True)
        encoded = env.encode()

        legal = env.legal_actions()
        masked_policy = np.array([policy[a] if a in legal else 0.0 for a in range(mcts.action_space_size)])
        total = masked_policy.sum()
        if total > 0:
            masked_policy /= total
        else:
            for a in legal:
                masked_policy[a] = 1.0 / len(legal)

        action = int(np.random.choice(mcts.action_space_size, p=masked_policy))
        game_history.append((encoded, masked_policy, env.turn))
        env.step(action)
        move_number += 1

    samples: List[TrainSample] = []
    for encoded, policy, turn in game_history:
        outcome = env.outcome(turn)
        if outcome is None:
            outcome = 0.0
        samples.append((encoded, policy, outcome))

    return samples


# ─── Training ─────────────────────────────────────────────────────────────────

def train_step(
    net: BaseNet,
    optimizer: optim.Optimizer,
    buffer: ReplayBuffer,
    batch_size: int,
    device: torch.device,
) -> Tuple[float, float]:
    """
    One gradient update step.
    Returns: (policy_loss, value_loss)
    """
    if len(buffer) < batch_size:
        return 0.0, 0.0

    if hasattr(net, "train"):
        net.train()
    
    states, policies, values = buffer.sample(batch_size)

    states_t = torch.tensor(states, dtype=torch.float32, device=device)
    policies_t = torch.tensor(policies, dtype=torch.float32, device=device)
    values_t = torch.tensor(values, dtype=torch.float32, device=device).unsqueeze(1)

    # Calling __call__ on PyTorch models
    policy_logits, value_pred = net(states_t)

    policy_loss = -(policies_t * F.log_softmax(policy_logits, dim=1)).sum(dim=1).mean()
    value_loss = F.mse_loss(value_pred, values_t)

    total_loss = policy_loss + value_loss

    optimizer.zero_grad()
    total_loss.backward()
    if hasattr(net, "parameters"):
        torch.nn.utils.clip_grad_norm_(net.parameters(), max_norm=1.0)
    optimizer.step()

    return policy_loss.item(), value_loss.item()


# ─── Champion Evaluation ──────────────────────────────────────────────────────

def evaluate_champion(
    env_cls: Type[BaseEnv],
    challenger: BaseNet,
    champion: BaseNet,
    device: torch.device,
    action_space_size: int,
    num_games: int = 100,
    num_simulations: int = 50,
) -> float:
    """
    Pit challenger vs. champion for num_games games.
    Returns challenger's win rate (0-1). Draw = 0.5 points.
    """
    challenger_mcts = MCTS(challenger, device, action_space_size)
    champion_mcts = MCTS(champion, device, action_space_size)

    challenger_score = 0.0

    for game_idx in range(num_games):
        env = env_cls()
        # Alternate who plays first
        challenger_starts = (game_idx % 2 == 0)

        # Assuming player 1 starts by definition
        challenger_is_p1 = challenger_starts

        while not env.is_terminal():
            is_challenger_turn = (
                (env.turn == 1 and challenger_is_p1) or
                (env.turn == -1 and not challenger_is_p1)
            )
            if is_challenger_turn:
                action = challenger_mcts.best_action(env, num_simulations)
            else:
                action = champion_mcts.best_action(env, num_simulations)
            env.step(action)

        # Get outcome from Player 1's perspective
        p1_outcome = env.outcome(1)
        if p1_outcome is None:
            p1_outcome = 0.0

        if p1_outcome == 0.0:
            challenger_score += 0.5
        elif (p1_outcome == 1.0 and challenger_is_p1) or (p1_outcome == -1.0 and not challenger_is_p1):
            challenger_score += 1.0

    return challenger_score / num_games


# ─── Milestone Management ─────────────────────────────────────────────────────

def load_registry(registry_path: Path) -> dict:
    if registry_path.exists():
        with open(registry_path) as f:
            return json.load(f)
    return {}

def save_registry(registry_path: Path, registry: dict) -> None:
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    with open(registry_path, "w") as f:
        json.dump(registry, f, indent=2)

def _elo_to_bot_level(elo: int) -> Optional[str]:
    if elo <= 300:
        return "rl_novice"
    if elo <= 700:
        return "rl_intermediate"
    if elo <= 1000:
        return "rl_strong"
    return "rl_master"

def _bot_level_sims(level: str) -> int:
    return {"rl_novice": 0, "rl_intermediate": 50, "rl_strong": 200, "rl_master": 800}.get(level, 50)

def save_milestone(
    net: BaseNet, 
    elo: int, 
    registry: dict, 
    registry_path: Path, 
    models_dir: Path, 
    game_name: str,
    save_checkpoint_fn: Callable[[BaseNet, str], None]
) -> None:
    models_dir.mkdir(parents=True, exist_ok=True)
    
    base_filename = f"{game_name}_elo_{elo}"
    filename = f"{base_filename}.pt"
    path = models_dir / filename
    
    counter = 2
    while path.exists():
        filename = f"{base_filename}_v{counter}.pt"
        path = models_dir / filename
        counter += 1

    save_checkpoint_fn(net, str(path))
    print(f"  → Milestone saved: {filename}")

    bot_level = _elo_to_bot_level(elo)
    if bot_level:
        # Don't overwrite if the user has manually set a custom bot level
        # We will just write to the standard bot_level, but with the new file
        registry[bot_level] = {
            "checkpoint": filename,
            "num_simulations": _bot_level_sims(bot_level),
            "elo": elo,
        }
        save_registry(registry_path, registry)
        print(f"  → Registry updated: {bot_level} → {filename}")


# ─── Main Training Loop ───────────────────────────────────────────────────────

def run_training_loop(
    env_cls: Type[BaseEnv],
    net_cls: Type[BaseNet],
    create_net_fn: Callable[[torch.device], BaseNet],
    load_checkpoint_fn: Callable[[str, torch.device], BaseNet],
    save_checkpoint_fn: Callable[[BaseNet, str], None],
    game_name: str,
    action_space_size: int,
    models_dir: Path,
    device: torch.device,
    num_iterations: int = 200,
    games_per_iter: int = 50,
    batch_size: int = 256,
    num_train_steps: int = 200,
    num_simulations: int = 100,
    eval_every: int = 20,
    eval_games: int = 100,
    eval_sims: int = 50,
    resume: bool = True,
    milestone_interval: int = 200,
    promotion_threshold: float = 0.55,
) -> None:
    print(f"Device: {device}")
    print(f"Models dir: {models_dir}")
    models_dir.mkdir(parents=True, exist_ok=True)

    registry_path = models_dir / "models_registry.json"
    champion_path = models_dir / "champion.pt"

    if resume and champion_path.exists():
        print(f"Resuming from champion: {champion_path}")
        champion = load_checkpoint_fn(str(champion_path), device)
    else:
        print("Starting from scratch (random network)")
        champion = create_net_fn(device)
        save_checkpoint_fn(champion, str(champion_path))

    challenger = copy.deepcopy(champion)
    if hasattr(challenger, "parameters"):
        optimizer = optim.Adam(challenger.parameters(), lr=1e-3, weight_decay=1e-4)
        scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=num_iterations, eta_min=1e-5)
    else:
        # Dummy fallback
        optimizer = None
        scheduler = None

    buffer = ReplayBuffer(max_size=100_000)
    mcts = MCTS(challenger, device, action_space_size)

    champion_elo = 0.0
    registry = load_registry(registry_path)
    milestone_saved: set = set()

    for entry in registry.values():
        if "elo" in entry:
            milestone_saved.add(float(entry["elo"]))

    if resume:
        if "rl_master" in registry and "elo" in registry["rl_master"]:
            champion_elo = float(registry["rl_master"]["elo"])
            print(f"Loaded champion ELO from registry (rl_master): {champion_elo:.0f}")
        elif milestone_saved:
            champion_elo = max(milestone_saved)
            print(f"Loaded champion ELO from highest milestone: {champion_elo:.0f}")

        max_past_threshold = int(champion_elo // milestone_interval) * milestone_interval
        for threshold in range(milestone_interval, max_past_threshold + milestone_interval, milestone_interval):
            milestone_saved.add(threshold)

    print(f"\n{'='*60}")
    print(f"Training: {num_iterations} iterations × {games_per_iter} games/iter")
    print(f"MCTS sims: {num_simulations} | Batch: {batch_size} | Eval every: {eval_every}")
    print(f"{'='*60}\n")

    for iteration in range(1, num_iterations + 1):
        iter_start = time.time()

        # 1. Self-play
        mcts.net = challenger
        game_samples = []
        for _ in range(games_per_iter):
            samples = self_play_game(env_cls, mcts, num_simulations)
            game_samples.extend(samples)
        buffer.add_game(game_samples)

        # 2. Train
        total_p_loss = 0.0
        total_v_loss = 0.0
        if optimizer is not None:
            for _ in range(num_train_steps):
                p_loss, v_loss = train_step(challenger, optimizer, buffer, batch_size, device)
                total_p_loss += p_loss
                total_v_loss += v_loss
            if scheduler is not None:
                scheduler.step()

        iter_time = time.time() - iter_start
        print(
            f"[Iter {iteration:>4}/{num_iterations}] "
            f"Games: {games_per_iter} | "
            f"Buffer: {len(buffer):>6} | "
            f"P-loss: {total_p_loss/num_train_steps if num_train_steps > 0 else 0:.4f} | "
            f"V-loss: {total_v_loss/num_train_steps if num_train_steps > 0 else 0:.4f} | "
            f"Time: {iter_time:.1f}s"
        )

        # 3. Champion evaluation
        if iteration % eval_every == 0:
            print(f"\n  Evaluating challenger vs. champion ({eval_games} games)...")
            win_rate = evaluate_champion(env_cls, challenger, champion, device, action_space_size, eval_games, eval_sims)
            print(f"  Challenger win rate: {win_rate:.1%}")

            if win_rate >= promotion_threshold:
                print(f"  ✓ Challenger promoted to champion!")
                champion = copy.deepcopy(challenger)
                save_checkpoint_fn(champion, str(champion_path))

                clamped_win_rate = max(0.01, min(0.99, win_rate))
                elo_gain = 400 * np.log10(clamped_win_rate / (1 - clamped_win_rate))
                champion_elo += float(elo_gain)
                rounded_elo = int(round(champion_elo / 50) * 50)
                print(f"  ELO gain: +{elo_gain:.0f} → New ELO: ~{champion_elo:.0f} (rounded: {rounded_elo})")

                max_threshold = int(champion_elo // milestone_interval) * milestone_interval
                for threshold in range(milestone_interval, max_threshold + milestone_interval, milestone_interval):
                    if threshold not in milestone_saved:
                        save_milestone(champion, threshold, registry, registry_path, models_dir, game_name, save_checkpoint_fn)
                        milestone_saved.add(threshold)

                registry["rl_master"] = {
                    "checkpoint": "champion.pt",
                    "num_simulations": 800,
                    "elo": int(champion_elo),
                }
                save_registry(registry_path, registry)
            else:
                print(f"  ✗ Champion retained (win rate {win_rate:.1%} < {promotion_threshold:.1%})")
            print()

    print("\nTraining complete!")
    print(f"Final champion saved to: {champion_path}")
    print(f"Registry: {registry_path}")

