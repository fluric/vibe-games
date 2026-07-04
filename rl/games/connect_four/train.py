import argparse
from pathlib import Path
import torch

from rl.core.train import run_training_loop
from rl.games.connect_four.env import ConnectFourEnv
from rl.games.connect_four.net import ConnectFourNet, create_net, load_checkpoint, save_checkpoint, get_device

SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent.parent.parent
MODELS_DIR = REPO_ROOT / "rl" / "service" / "models" / "connect_four"

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
    parser.add_argument("--promotion-threshold", type=float, default=0.55, help="Win rate needed to replace champion")

    args = parser.parse_args()

    if args.device:
        device = torch.device(args.device)
    else:
        device = get_device()

    run_training_loop(
        env_cls=ConnectFourEnv,
        net_cls=ConnectFourNet,
        create_net_fn=create_net,
        load_checkpoint_fn=load_checkpoint,
        save_checkpoint_fn=save_checkpoint,
        game_name="connect_four",
        action_space_size=ConnectFourNet.NUM_ACTIONS,
        models_dir=MODELS_DIR,
        device=device,
        num_iterations=args.iterations,
        games_per_iter=args.games_per_iter,
        batch_size=args.batch_size,
        num_train_steps=args.train_steps,
        num_simulations=args.num_simulations,
        eval_every=args.eval_every,
        eval_games=args.eval_games,
        eval_sims=args.eval_sims,
        resume=not args.no_resume,
        milestone_interval=200,
        promotion_threshold=args.promotion_threshold,
    )
