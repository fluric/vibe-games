# Vibe Games — AI Training & Inference Service

This package contains the AlphaZero-style RL/ML bot training infrastructure for Vibe Games.

## Structure

```
ai/
├── games/
│   └── connect_four/
│       ├── env.py      # Python game environment (mirrors connectFourEngine.ts)
│       ├── net.py      # Dual-head neural network (policy + value heads)
│       ├── mcts.py     # Monte Carlo Tree Search
│       └── train.py    # Self-play training loop
├── service/
│   ├── main.py         # FastAPI sidecar (runs on localhost:8765)
│   └── models/
│       └── connect_four/
│           └── models_registry.json  # maps bot levels → checkpoints
├── eval/
│   └── tournament.py   # ELO evaluation vs. existing minimax bots
└── tests/              # Unit tests
```

## Quick Start

### 1. Create virtual environment and install dependencies

```bash
cd ai
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Train a Connect Four model

```bash
# Quick smoke test (~1 min, 5 iterations)
python -m games.connect_four.train --iterations 5 --games-per-iter 20

# Full training run (~2–4h on M4)
python -m games.connect_four.train --iterations 500 --games-per-iter 100 --num-simulations 100
```

Training output:
- Checkpoints saved to `service/models/connect_four/`
- `champion.pt` always points to the current best model
- Milestone checkpoints saved when ELO crosses 200, 400, 600, 800, 1000, 1200
- `models_registry.json` updated automatically

### 3. Start the inference sidecar

```bash
# From the ai/ directory, with .venv active
python -m uvicorn service.main:app --port 8765 --reload
```

### 4. Test the sidecar

```bash
curl -s -X POST http://localhost:8765/predict \
  -H "Content-Type: application/json" \
  -d '{"game_type":"connect_four","state":{"board":["X",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],"turn":"O","winner":null},"bot_level":"rl_novice"}'
```

### 5. Evaluate strength vs. minimax bots

```bash
python -m eval.tournament --game connect_four --games 200
```

## Hardware

The training script automatically selects the best available device:
- **Apple Silicon (M1–M4)**: Uses MPS backend (~5–10× faster than CPU)
- **CUDA GPU**: Uses CUDA if available
- **Fallback**: CPU

## Model Milestones

Each time a model surpasses an ELO threshold during training, a named checkpoint is saved.
These checkpoints become the backing models for bot levels in `models_registry.json`.

After a full training run you'll have approximately:
| Bot Level | Checkpoint | MCTS Sims | Approx ELO |
|---|---|---|---|
| `rl_novice` | `connect_four_elo_200.pt` | 0 | ~200 |
| `rl_intermediate` | `connect_four_elo_600.pt` | 50 | ~600 |
| `rl_strong` | `connect_four_elo_900.pt` | 200 | ~900 |
| `rl_master` | `champion.pt` | 800 | ~1200+ |

Edit `service/models/connect_four/models_registry.json` to remap any checkpoint to any bot level.
