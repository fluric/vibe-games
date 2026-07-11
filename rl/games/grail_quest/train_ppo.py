import argparse
from pathlib import Path
import os
import numpy as np
import supersuit as ss
from pettingzoo.utils.conversions import aec_to_parallel
from stable_baselines3.common.callbacks import CheckpointCallback

import sys
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from rl.games.grail_quest.env_pz import env

import gymnasium as gym
from stable_baselines3.common.vec_env import DummyVecEnv
from stable_baselines3.common.callbacks import BaseCallback
from sb3_contrib import MaskablePPO


# Suppress the verbose PettingZoo illegal move warnings
from pettingzoo.utils.env_logger import EnvLogger
EnvLogger.warn_on_illegal_move = lambda: None

from stable_baselines3.common.logger import KVWriter, Logger

class TableOutputFormat(KVWriter):
    def __init__(self):
        self.header_printed = False

    def write(self, key_values, key_excluded, step=0):
        if not self.header_printed:
            print(f"{'Timesteps':<10} | {'FPS':<6} | {'Value Loss':<10} | {'Entropy':<8} | {'Variance':<8} | {'Approx KL':<10} | {'Clip Frac':<10} | {'PG Loss':<10} | {'Loss':<10} | {'Champ WR':<10} | {'Illegal':<10}")
            print("-" * 135)
            self.header_printed = True
            
        fps = int(key_values.get("time/fps", 0))
        v_loss = key_values.get("train/value_loss", 0.0)
        ent = key_values.get("train/entropy_loss", 0.0)
        var = key_values.get("train/explained_variance", 0.0)
        kl = key_values.get("train/approx_kl", 0.0)
        clip = key_values.get("train/clip_fraction", 0.0)
        pg_loss = key_values.get("train/policy_gradient_loss", 0.0)
        loss = key_values.get("train/loss", 0.0)
        
        ill = int(key_values.get("custom/total_illegal_moves", 0))
        champ_wr = key_values.get("custom/champion_winrate", 0.0)
        
        ts = int(key_values.get("time/total_timesteps", step))
        
        # Format the line
        print(f"{ts:<10} | {fps:<6} | {v_loss:<10.5f} | {ent:<8.3f} | {var:<8.5f} | {kl:<10.5f} | {clip:<10.4f} | {pg_loss:<10.5f} | {loss:<10.5f} | {champ_wr:<10.2%} | {ill:<10}")

    def close(self):
        pass

class IllegalMoveLoggerCallback(BaseCallback):
    """Counts episodes that ended immediately due to illegal moves."""
    def __init__(self, verbose=0):
        super().__init__(verbose)
        self.illegal_moves = 0

    def _on_rollout_start(self) -> None:
        self.illegal_moves = 0

    def _on_step(self) -> bool:
        for info in self.locals.get("infos", []):
            if info.get("illegal_move"):
                self.illegal_moves += 1
        self.logger.record("custom/total_illegal_moves", self.illegal_moves)
        return True


class RewardSignalCallback(BaseCallback):
    """Accumulates shaped reward signals per rollout and prints a breakdown
    line immediately after each table row (at the start of the next rollout)."""
    def __init__(self, ent_coef: float = 0.05, verbose=0):
        super().__init__(verbose)
        self.ent_coef = ent_coef
        self._pending: dict | None = None
        self._reset()

    def _reset(self):
        self._s = {k: 0.0 for k in ("s1", "s2", "s3", "s4", "s5")}
        self._episodes = 0
        self._active_wins = 0
        self._champ_wins = 0
        self._draws = 0

    def _on_rollout_start(self) -> None:
        # Print the breakdown line for the rollout that just finished
        if self._pending is not None:
            p = self._pending
            ent = self.ent_coef * abs(p["ent_loss"])
            
            n = max(self._episodes, 1)
            act_wr = self._active_wins / n
            chmp_wr = self._champ_wins / n
            draw_r = self._draws / n
            
            print(
                f"  Signals (per game) │ "
                f"Surv:{p['s1']:+.5f} │ "
                f"Grail:{p['s2']:+.5f} │ "
                f"Territ:{p['s3']:+.5f} │ "
                f"Press:{p['s4']:+.5f} │ "
                f"FaceK:{p['s5']:+.5f} │ "
                f"Ent:{ent:+.5f} │ "
                f"Train-WinRate (Act:{act_wr:.0%} Chmp:{chmp_wr:.0%} D:{draw_r:.0%})"
            )
        self._reset()

    def _on_step(self) -> bool:
        infos = self.locals.get("infos", [])
        for info in infos:
            for i, k in enumerate(("s1_survival", "s2_grail", "s3_territory", "s4_pressure", "s5_facecard"), 1):
                self._s[f"s{i}"] += info.get(k, 0.0)
            
            if "active_won" in info:
                res = info["active_won"]
                if res == 1:
                    self._active_wins += 1
                elif res == 0:
                    self._champ_wins += 1
                else:
                    self._draws += 1
        
        # Count completed episodes in this step across the vec env
        dones = self.locals.get("dones", [])
        self._episodes += sum(dones)
        return True

    def _on_rollout_end(self) -> None:
        n = max(self._episodes, 1)
        ent_loss = self.model.logger.name_to_value.get("train/entropy_loss", 0.0)
        self._pending = {
            **{f"s{i}": self._s[f"s{i}"] / n for i in range(1, 6)},
            "ent_loss": ent_loss,
        }

import os

class ChampionChallengeCallback(BaseCallback):
    def __init__(self, eval_env, eval_freq=50000, eval_games=50, threshold=0.55, champion_path="champion.zip", device="auto", verbose=0):
        super().__init__(verbose)
        self.eval_env = eval_env
        self.eval_freq = eval_freq
        self.eval_games = eval_games
        self.threshold = threshold
        self.champion_path = champion_path
        self.device = device
        self.last_eval_step = 0
        self.champion_wr = 0.0

    def _on_step(self) -> bool:
        # PPO runs multiple envs, so self.num_timesteps advances by num_envs each step.
        if self.num_timesteps - self.last_eval_step >= self.eval_freq:
            self.last_eval_step = self.num_timesteps
            self._run_evaluation()
            
        self.logger.record("custom/champion_winrate", self.champion_wr)
        return True

    def _run_evaluation(self):
        if not os.path.exists(self.champion_path):
            self.model.save(self.champion_path)
            self.champion_wr = 1.0
            return
        current_wins = 0
        current_draws = 0
        
        champion_model = self.model.__class__.load(self.champion_path, device=self.device)
        
        for g in range(self.eval_games):
            self.eval_env.reset()
            current_is_p0 = (g % 2 == 0)
            
            # Hard cap: allow up to 10,000 AEC steps to let a full 400-turn game play out naturally.
            # If it exceeds this, it is counted as a draw (to prevent hangs).
            step_count = 0
            timed_out = False
            
            for agent in self.eval_env.agent_iter():
                step_count += 1
                if step_count > 10000:
                    timed_out = True
                    break

                    
                obs, reward, terminated, truncated, info = self.eval_env.last()
                    
                if terminated or truncated:
                    action = None
                else:
                    action_mask = obs["action_mask"]
                    is_current = (agent == "player_0" and current_is_p0) or (agent == "player_1" and not current_is_p0)
                    active_model = self.model if is_current else champion_model
                    action, _ = active_model.predict(
                        obs,
                        action_masks=action_mask.astype(bool),
                        deterministic=True
                    )
                
                self.eval_env.step(action)
            
            if timed_out:
                current_draws += 1
                continue
            
            # Read outcome directly from the engine — not from accumulated rewards,
            # which are now polluted by per-step shaping signals and are never equal
            # even in true draws.
            inner = self.eval_env
            while hasattr(inner, "env"):
                inner = inner.env
            current_player_idx = 0 if current_is_p0 else 1
            outcome_current  = inner.game.outcome(current_player_idx)
            outcome_opponent = inner.game.outcome(1 - current_player_idx)
            
            if outcome_current > outcome_opponent:
                current_wins += 1
            elif outcome_current == outcome_opponent:
                current_draws += 1

                
        wr = current_wins / self.eval_games
        dr = current_draws / self.eval_games
        # Score = win×1 + draw×0.5 (standard chess-style metric for draw-heavy games)
        score = (current_wins + 0.5 * current_draws) / self.eval_games
        self.champion_wr = score
        
        print(f"Challenge Results: Win Rate: {wr:.2%} | Draw Rate: {dr:.2%} | Score: {score:.2%} (Threshold: {self.threshold:.2%})")
        if score >= self.threshold:
            print(f">>> NEW CHAMPION CROWNED AT TIMESTEP {self.num_timesteps}! <<<")
            
            # Save a historical copy of the new champion
            history_path = self.champion_path.replace(".zip", f"_ts{self.num_timesteps}.zip")
            self.model.save(history_path)
            
            # Overwrite the active champion
            self.model.save(self.champion_path)
        else:
            print("Champion defends title.")
            
        print("-" * 135)
        # We also need to print the header again because the challenge text interrupted the table
        self.model.logger.output_formats[0].header_printed = False

class SingleAgentGrailQuestEnv(gym.Env):
    """
    Exposes a standard single-agent Gymnasium interface for Grail Quest.
    When the training player steps, the opponent's turns are played automatically
    using the current champion model (or random actions if no champion exists).
    This completely avoids the turn-alternating value function sign-inversion bug
    and allows seamless training using standard single-agent PPO.
    """
    def __init__(self, opponent_model_path=None):
        super().__init__()
        self.pz_env = env()
        self.observation_space = self.pz_env.observation_space("player_0")
        self.action_space = self.pz_env.action_space("player_0")
        self.opponent_model_path = opponent_model_path
        self.opponent_model = None
        self.last_mtime = 0
        self.training_player = None

    def action_masks(self) -> np.ndarray:
        obs, _, _, _, _ = self.pz_env.last()
        return obs["action_mask"] == 1

    def _reload_opponent_model(self):
        if self.opponent_model_path and os.path.exists(self.opponent_model_path):
            mtime = os.path.getmtime(self.opponent_model_path)
            if self.opponent_model is None or mtime > self.last_mtime:
                try:
                    self.opponent_model = MaskablePPO.load(self.opponent_model_path, device="cpu")
                    self.last_mtime = mtime
                except Exception:
                    pass  # Retry on next reset if file is locked

    def _play_opponent_turns(self):
        accumulated_reward = 0.0
        while not self.pz_env.game.is_terminal():
            current_agent = self.pz_env.agent_selection
            if current_agent == self.training_player:
                break

            obs, reward, terminated, truncated, info = self.pz_env.last()
            
            if terminated or truncated:
                action = None
            else:
                action_mask = obs["action_mask"]
                if self.opponent_model is not None:
                    action, _ = self.opponent_model.predict(
                        obs,
                        action_masks=action_mask.astype(bool),
                        deterministic=True
                    )
                else:
                    legal_actions = np.where(action_mask == 1)[0]
                    action = int(np.random.choice(legal_actions)) if len(legal_actions) > 0 else 0

            self.pz_env.step(action)
            accumulated_reward += self.pz_env.rewards[self.training_player]
        return accumulated_reward


    def reset(self, seed=None, options=None):
        self._reload_opponent_model()
        self.pz_env.reset(seed=seed)
        self.training_player = np.random.choice(["player_0", "player_1"])
        self._play_opponent_turns()
        obs, _, _, _, _ = self.pz_env.last()
        return obs, {}

    def step(self, action):
        self.pz_env._clear_rewards()
        self.pz_env.step(action)
        reward = self.pz_env.rewards[self.training_player]

        opp_reward = self._play_opponent_turns()
        reward += opp_reward

        obs, _, _, _, _ = self.pz_env.last()
        terminated = self.pz_env.terminations[self.training_player]
        truncated = self.pz_env.truncations[self.training_player]

        inner = self.pz_env
        while hasattr(inner, "env"):
            inner = inner.env
        info = dict(getattr(inner, "_last_signals", {}))

        is_natural = inner.game.is_terminal()
        if is_natural:
            u0 = inner.game.outcome(0)
            u1 = inner.game.outcome(1)
            winner_idx = 0 if u0 > u1 else (1 if u1 > u0 else -1)
            
            if winner_idx == -1:
                info["active_won"] = -1
            else:
                active_idx = 0 if self.training_player == "player_0" else 1
                info["active_won"] = 1 if winner_idx == active_idx else 0
                
            info["winner"] = winner_idx
            
        if reward <= -0.9 and not is_natural:
            info["illegal_move"] = True

        return obs, reward, terminated, truncated, info


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--timesteps", type=int, default=1_000_000)
    parser.add_argument("--device", type=str, default="auto")
    parser.add_argument("--num-envs", type=int, default=4)
    parser.add_argument("--eval-freq", type=int, default=5_000_000, help="Timesteps between champion evaluations")
    parser.add_argument("--eval-games", type=int, default=100, help="Number of evaluation games")
    parser.add_argument("--promotion-threshold", type=float, default=0.55, help="Win rate needed to become champion")
    parser.add_argument("--resume", action="store_true", help="Resume from the final model if it exists")
    args = parser.parse_args()

    output_dir = Path("rl/service/models/grail_quest/ppo")
    output_dir.mkdir(parents=True, exist_ok=True)
    final_path = output_dir / "grail_quest_ppo_final.zip"
    champion_path = output_dir / "grail_quest_ppo_champion.zip"

    print(f"Initializing Grail Quest PPO Training...")
    print(f"Total timesteps: {args.timesteps}")
    print(f"Parallel envs: {args.num_envs}")
    
    from stable_baselines3.common.vec_env import SubprocVecEnv

    def make_env():
        return SingleAgentGrailQuestEnv(opponent_model_path=str(champion_path))

    # Create vectorized environment with spawn to avoid macOS fork deadlock
    vec_env = SubprocVecEnv([make_env for _ in range(args.num_envs)], start_method="spawn")


    # Checkpoint callback (save_freq is divided by num_envs because it's called every env step)
    # 5,000,000 total steps = ~10 minutes
    save_freq_steps = max(5_000_000 // args.num_envs, 1)
    
    checkpoint_callback = CheckpointCallback(
        save_freq=save_freq_steps,
        save_path=str(output_dir),
        name_prefix="grail_quest_ppo"
    )

    if args.resume:
        import glob
        checkpoints = glob.glob(str(output_dir / "*.zip"))
        if checkpoints:
            latest_checkpoint = max(checkpoints, key=os.path.getmtime)
            print(f"Resuming training from {latest_checkpoint}...")
            model = MaskablePPO.load(latest_checkpoint, env=vec_env, device=args.device)
        else:
            print("No existing model found to resume from. Starting from scratch...")
            model = MaskablePPO(
                "MultiInputPolicy",
                vec_env,
                verbose=0,
                device=args.device,
                batch_size=512,
                n_steps=2048,
                ent_coef=0.015,
                learning_rate=3e-4,
            )
    else:
        model = MaskablePPO(
            "MultiInputPolicy",
            vec_env,
            verbose=0,
            device=args.device,
            batch_size=512,
            n_steps=2048,
            ent_coef=0.015,
            learning_rate=3e-4,
        )

    
    # Attach our custom tabular logger
    custom_logger = Logger(folder=None, output_formats=[TableOutputFormat()])
    model.set_logger(custom_logger)

    # Setup Champion Challenge
    champion_callback = ChampionChallengeCallback(
        eval_env=env(), 
        eval_freq=args.eval_freq, 
        eval_games=args.eval_games, 
        threshold=args.promotion_threshold,
        champion_path=str(champion_path),
        device=args.device
    )

    # 5. Train
    from stable_baselines3.common.callbacks import CallbackList
    callbacks = CallbackList([checkpoint_callback, IllegalMoveLoggerCallback(), RewardSignalCallback(ent_coef=0.05), champion_callback])

    model.learn(total_timesteps=args.timesteps, callback=callbacks, reset_num_timesteps=not args.resume)

    # 6. Save final model
    model.save(str(final_path))
    print(f"Training complete! Saved final model to {final_path}")

if __name__ == "__main__":
    main()
