"""
FastAPI sidecar for RL/ML bot inference.

Runs on localhost:8765. The Fastify backend calls this service to get
move suggestions from trained neural network bots.

Start:
    cd rl
    source .venv/bin/activate
    python -m uvicorn service.main:app --port 8765 --reload

Endpoints:
    GET  /health          → loaded models, device info
    POST /predict         → get best action for a given state + bot level
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Make sure we can import from the rl/ package root ─────────────────────────
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from rl.games.connect_four.env import ConnectFourEnv
from rl.games.connect_four.net import ConnectFourNet, get_device
from rl.games.connect_four.net import load_checkpoint as load_c4_checkpoint
from rl.games.mill.env import MillEnv
from rl.games.mill.net import MillNet
from rl.games.mill.net import load_checkpoint as load_mill_checkpoint
from rl.games.reversi.env import ReversiEnv
from rl.games.reversi.net import ReversiNet
from rl.games.reversi.net import load_checkpoint as load_reversi_checkpoint
from rl.core.mcts import MCTS

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Vibe Games RL Sidecar",
    description="RL/ML bot inference service (AlphaZero-style)",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── State ────────────────────────────────────────────────────────────────────

MODELS_DIR = PROJECT_ROOT / "rl" / "service" / "models"
device = get_device()

# { "connect_four": { "rl_novice": (net, num_sims), ... } }
loaded_models: Dict[str, Dict[str, tuple[Any, int]]] = {}


def _load_game_models(game_type: str) -> None:
    registry_path = MODELS_DIR / game_type / "models_registry.json"
    if not registry_path.exists():
        print(f"  No registry found for {game_type}, skipping.")
        return

    with open(registry_path) as f:
        registry = json.load(f)

    loaded_models[game_type] = {}
    models_base = MODELS_DIR / game_type

    for bot_level, entry in registry.items():
        checkpoint = entry.get("checkpoint")
        num_sims = entry.get("num_simulations", 0)

        if not checkpoint:
            print(f"  [{game_type}/{bot_level}] No checkpoint yet — skipping.")
            continue

        ckpt_path = models_base / checkpoint
        if not ckpt_path.exists():
            print(f"  [{game_type}/{bot_level}] Checkpoint not found: {ckpt_path} — skipping.")
            continue

        try:
            if game_type == "connect_four":
                net = load_c4_checkpoint(str(ckpt_path), device)
            elif game_type == "mill":
                net = load_mill_checkpoint(str(ckpt_path), device)
            elif game_type == "reversi":
                net = load_reversi_checkpoint(str(ckpt_path), device)
            else:
                print(f"  [{game_type}/{bot_level}] Unknown game type — skipping.")
                continue

            loaded_models[game_type][bot_level] = (net, num_sims)
            elo = entry.get("elo", "?")
            print(f"  ✓ [{game_type}/{bot_level}] Loaded {checkpoint} (ELO ~{elo}, {num_sims} sims)")
        except Exception as e:
            print(f"  ✗ [{game_type}/{bot_level}] Failed to load: {e}")


@app.on_event("startup")
async def startup_event() -> None:
    print(f"\nRL Sidecar starting up — device: {device}")
    print(f"Loading models from: {MODELS_DIR}")
    _load_game_models("connect_four")
    _load_game_models("mill")
    _load_game_models("reversi")
    print(f"\nLoaded {sum(len(v) for v in loaded_models.values())} models total.\n")


# ─── Request / Response models ────────────────────────────────────────────────

class PredictRequest(BaseModel):
    game_type: str           # "connect_four"
    state: Dict[str, Any]   # JSON state matching TypeScript game state shape
    bot_level: str           # "rl_novice" | "rl_intermediate" | "rl_strong" | "rl_master"
    num_simulations: Optional[int] = None  # override registry value if provided


class PredictResponse(BaseModel):
    action: Dict[str, Any]   # e.g. {"action": "place", "column": 3}
    bot_level: str
    num_simulations: int
    device: str


class HealthResponse(BaseModel):
    status: str
    device: str
    loaded_models: Dict[str, list]


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        device=str(device),
        loaded_models={
            game: list(bots.keys())
            for game, bots in loaded_models.items()
        },
    )


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    game_type = req.game_type
    bot_level = req.bot_level

    if game_type not in loaded_models:
        raise HTTPException(
            status_code=404,
            detail=f"Game '{game_type}' not supported. Available: {list(loaded_models.keys())}",
        )

    game_bots = loaded_models[game_type]
    if bot_level not in game_bots:
        raise HTTPException(
            status_code=404,
            detail=f"Bot level '{bot_level}' not loaded for '{game_type}'. Available: {list(game_bots.keys())}",
        )

    net, registry_sims = game_bots[bot_level]
    num_sims = req.num_simulations if req.num_simulations is not None else registry_sims

    if game_type == "connect_four":
        action, sims_used = _predict_connect_four(net, req.state, num_sims)
    elif game_type == "mill":
        action, sims_used = _predict_mill(net, req.state, num_sims)
    elif game_type == "reversi":
        action, sims_used = _predict_reversi(net, req.state, num_sims)
    else:
        raise HTTPException(status_code=501, detail=f"Game '{game_type}' not yet implemented")

    return PredictResponse(
        action=action,
        bot_level=bot_level,
        num_simulations=sims_used,
        device=str(device),
    )


@app.post("/reload")
async def reload_models() -> dict:
    """Reload all models from disk — useful after training completes a new checkpoint."""
    loaded_models.clear()
    _load_game_models("connect_four")
    _load_game_models("mill")
    _load_game_models("reversi")
    return {"reloaded": sum(len(v) for v in loaded_models.values())}


# ─── Game-specific prediction logic ──────────────────────────────────────────

def _predict_connect_four(net: ConnectFourNet, state: dict, num_sims: int) -> tuple[dict, int]:
    """Convert state dict → action dict for Connect Four."""
    try:
        env = ConnectFourEnv.from_state_dict(state)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid state: {e}")

    if env.is_terminal():
        raise HTTPException(status_code=400, detail="Game is already terminal")

    legal = env.legal_actions()
    if not legal:
        raise HTTPException(status_code=400, detail="No legal actions available")

    mcts = MCTS(net, device, ConnectFourNet.NUM_ACTIONS)
    column = mcts.best_action(env, num_sims)

    return {"action": "place", "column": column}, num_sims


def _predict_mill(net: MillNet, state: dict, num_sims: int) -> tuple[dict, int]:
    """Convert state dict → action dict for Mill."""
    try:
        env = MillEnv.from_state_dict(state)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid state: {e}")

    if env.is_terminal():
        raise HTTPException(status_code=400, detail="Game is already terminal")

    legal = env.legal_actions()
    if not legal:
        raise HTTPException(status_code=400, detail="No legal actions available")

    mcts = MCTS(net, device, MillNet.NUM_ACTIONS)
    action_idx = mcts.best_action(env, num_sims)

    if env.mill_formed_this_turn:
        action = {"action": "remove", "position": action_idx}
    elif env.phase == "placement":
        action = {"action": "place", "position": action_idx}
    else:
        # Move
        move_idx = action_idx - 24
        from_pos = move_idx // 24
        to_pos = move_idx % 24
        action = {"action": "move", "from": from_pos, "to": to_pos}

    return action, num_sims

def _predict_reversi(net: ReversiNet, state: dict, num_sims: int) -> tuple[dict, int]:
    """Convert state dict → action dict for Reversi."""
    try:
        env = ReversiEnv.from_state_dict(state)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid state: {e}")

    if env.is_terminal():
        raise HTTPException(status_code=400, detail="Game is already terminal")

    legal = env.legal_actions()
    if not legal:
        raise HTTPException(status_code=400, detail="No legal actions available")

    mcts = MCTS(net, device, ReversiNet.NUM_ACTIONS)
    action_idx = mcts.best_action(env, num_sims)

    return {"action": "place", "position": action_idx}, num_sims
