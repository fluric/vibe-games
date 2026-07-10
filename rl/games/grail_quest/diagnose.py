"""
diagnose.py — run trained model vs random player and report reward signals.

Usage:
    PYTHONPATH=. rl/.venv/bin/python rl/games/grail_quest/diagnose.py \
        --model rl/service/models/grail_quest/ppo/grail_quest_ppo_400024576_steps.zip \
        --games 20
"""
import argparse
import numpy as np
from stable_baselines3 import PPO
from rl.games.grail_quest.env_pz import env as make_env

SIGNAL_KEYS = ["s1_survival", "s2_grail", "s3_territory", "s4_pressure", "s5_facecard"]

def run_game(pz_env, model, model_is_p0: bool):
    """Play one game. Returns (outcome_model, signals_dict, illegal_count, steps)."""
    pz_env.reset()

    # Unwrap to the raw GrailQuestPZEnv for outcome + signal access
    inner = pz_env
    while hasattr(inner, "env"):
        inner = inner.env

    totals = {k: 0.0 for k in SIGNAL_KEYS}
    illegal = 0
    step_count = 0

    for agent in pz_env.agent_iter():
        step_count += 1
        if step_count > 900:           # safety cap
            break

        obs, reward, terminated, truncated, info = pz_env.last()

        if terminated or truncated:
            action = None
        else:
            action_mask = obs["action_mask"]
            is_model = (agent == "player_0" and model_is_p0) or \
                       (agent == "player_1" and not model_is_p0)

            if is_model:
                action, _ = model.predict(obs, deterministic=True)
                if action_mask[action] == 0:
                    legal = np.where(action_mask == 1)[0]
                    action = int(np.random.choice(legal)) if len(legal) > 0 else 0
                    illegal += 1
            else:
                # Pure random legal action
                legal = np.where(action_mask == 1)[0]
                action = int(np.random.choice(legal)) if len(legal) > 0 else 0

        pz_env.step(action)

        # Accumulate signals from the env's _last_signals
        for k in SIGNAL_KEYS:
            totals[k] += inner._last_signals.get(k, 0.0)

    player_idx = 0 if model_is_p0 else 1
    outcome = inner.game.outcome(player_idx)
    return outcome, totals, illegal, step_count


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="Path to .zip checkpoint")
    parser.add_argument("--games", type=int, default=20)
    args = parser.parse_args()

    model = PPO.load(args.model, device="cpu")
    pz_env = make_env()

    print(f"\nLoaded: {args.model}")
    print(f"Games:  {args.games} ({args.games//2} as P0, {args.games//2} as P1)\n")

    header = (
        f"{'G':>3} {'Side':>4} {'Result':>6} | "
        f"{'Surv':>8} {'Grail':>8} {'Territ':>8} {'Press':>8} {'FaceK':>8} | "
        f"{'Illegal':>7} {'Steps':>6}"
    )
    print(header)
    print("-" * len(header))

    wins = draws = losses = 0
    agg = {k: 0.0 for k in SIGNAL_KEYS}

    for g in range(args.games):
        model_is_p0 = (g % 2 == 0)
        outcome, totals, illegal, steps = run_game(pz_env, model, model_is_p0)

        if outcome > 0:
            result, wins = "WIN", wins + 1
        elif outcome == 0:
            result, draws = "DRAW", draws + 1
        else:
            result, losses = "LOSS", losses + 1

        for k in SIGNAL_KEYS:
            agg[k] += totals[k]

        side = "P0" if model_is_p0 else "P1"
        print(
            f"{g+1:>3} {side:>4} {result:>6} | "
            f"{totals['s1_survival']:>+8.4f} "
            f"{totals['s2_grail']:>+8.4f} "
            f"{totals['s3_territory']:>+8.4f} "
            f"{totals['s4_pressure']:>+8.4f} "
            f"{totals['s5_facecard']:>+8.4f} | "
            f"{illegal:>7} {steps:>6}"
        )

    print("-" * len(header))
    n = args.games
    print(
        f"{'AVG':>8} "
        f"{'':>6} | "
        f"{agg['s1_survival']/n:>+8.4f} "
        f"{agg['s2_grail']/n:>+8.4f} "
        f"{agg['s3_territory']/n:>+8.4f} "
        f"{agg['s4_pressure']/n:>+8.4f} "
        f"{agg['s5_facecard']/n:>+8.4f}"
    )
    print(f"\nResults: {wins}W / {draws}D / {losses}L  "
          f"(Win%: {wins/n:.0%}, Draw%: {draws/n:.0%}, Loss%: {losses/n:.0%})\n")


if __name__ == "__main__":
    main()
