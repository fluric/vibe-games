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
from rl.games.grail_quest.engine import GrailQuestState, PLAYER_X, PLAYER_O
from rl.games.grail_quest.train_cfr import CFRPolicy
from sb3_contrib import MaskablePPO
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

# CFR policies for imperfect-info games (no neural net — pure strategy table)
# { "grail_quest": { "cfr_novice": CFRPolicy, ... } }
cfr_policies: Dict[str, Dict[str, CFRPolicy]] = {}


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
        if not bot_level.startswith("rl_"):
            continue
            
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
            elif game_type == "grail_quest":
                net = MaskablePPO.load(str(ckpt_path), device=device, custom_objects={"env": None})
            else:
                print(f"  [{game_type}/{bot_level}] Unknown game type — skipping.")
                continue

            loaded_models[game_type][bot_level] = (net, num_sims)
            elo = entry.get("elo", "?")
            print(f"  ✓ [{game_type}/{bot_level}] Loaded {checkpoint} (ELO ~{elo}, {num_sims} sims)")
        except Exception as e:
            print(f"  ✗ [{game_type}/{bot_level}] Failed to load: {e}")


def _load_cfr_policies(game_type: str) -> None:
    """Load serialized CFR policy files for imperfect-info games."""
    registry_path = MODELS_DIR / game_type / "models_registry.json"
    if not registry_path.exists():
        print(f"  No registry found for {game_type}, skipping.")
        return

    with open(registry_path) as f:
        registry = json.load(f)

    cfr_policies[game_type] = {}
    models_base = MODELS_DIR / game_type

    for bot_level, entry in registry.items():
        if not bot_level.startswith("cfr_"):
            continue
            
        checkpoint = entry.get("checkpoint")
        if not checkpoint:
            print(f"  [{game_type}/{bot_level}] No checkpoint yet — skipping.")
            continue
            
        ckpt_path = models_base / checkpoint
        if not ckpt_path.exists():
            print(f"  [{game_type}/{bot_level}] Checkpoint not found: {ckpt_path} — skipping.")
            continue

        try:
            policy = CFRPolicy.load(ckpt_path)
            cfr_policies[game_type][bot_level] = policy
            elo = entry.get("elo", "?")
            info_sets = len(policy.regret_sum)
            print(f"  ✓ [{game_type}/{bot_level}] Loaded {checkpoint} "
                  f"(ELO ~{elo}, {policy.iterations} iters, {info_sets:,} info-sets)")
        except Exception as e:
            print(f"  ✗ [{game_type}/{bot_level}] Failed to load: {e}")


@app.on_event("startup")
async def startup_event() -> None:
    print(f"\nRL Sidecar starting up — device: {device}")
    print(f"Loading models from: {MODELS_DIR}")
    _load_game_models("connect_four")
    _load_game_models("mill")
    _load_game_models("reversi")
    _load_game_models("grail_quest")
    _load_cfr_policies("grail_quest")
    total_nn = sum(len(v) for v in loaded_models.values())
    total_cfr = sum(len(v) for v in cfr_policies.values())
    print(f"\nLoaded {total_nn} NN models + {total_cfr} CFR policies.\n")


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
async def predict(req: PredictRequest) -> PredictResponse:
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
    elif game_type == "grail_quest":
        return _predict_grail_quest(req)
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
    """Reload all models from disk — useful after training completes a new checkpoint without restarting the sidecar."""
    loaded_models.clear()
    cfr_policies.clear()
    _load_game_models("connect_four")
    _load_game_models("mill")
    _load_game_models("reversi")
    _load_game_models("grail_quest")
    _load_cfr_policies("grail_quest")
    total_nn = sum(len(v) for v in loaded_models.values())
    total_cfr = sum(len(v) for v in cfr_policies.values())
    return {"reloaded_nn": total_nn, "reloaded_cfr": total_cfr}


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


def _predict_grail_quest(req: PredictRequest) -> PredictResponse:
    """CFR-based and PPO-based prediction for Grail Quest."""
    game_type = "grail_quest"
    bot_level = req.bot_level

    # Determine which player is making the request
    # The state's 'turn' field tells us whose perspective to use
    raw_state = req.state
    turn_str = raw_state.get("turn", "X")
    player_perspective = PLAYER_X if turn_str == "X" else PLAYER_O

    try:
        state = GrailQuestState.from_state_dict(raw_state, player_perspective)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid grail_quest state: {e}")

    if state.is_terminal():
        raise HTTPException(status_code=400, detail="Game is already terminal")

    legal = state.legal_actions()
    if not legal:
        raise HTTPException(status_code=400, detail="No legal actions available")

    best_action_int = None

    if bot_level.startswith("cfr_"):
        if game_type not in cfr_policies:
            raise HTTPException(
                status_code=503,
                detail=f"No CFR policies loaded for grail_quest."
            )
        game_bots = cfr_policies[game_type]
        if bot_level not in game_bots:
            raise HTTPException(
                status_code=404,
                detail=f"CFR bot '{bot_level}' not loaded for grail_quest. "
                       f"Available: {list(game_bots.keys())}"
            )
        policy = game_bots[bot_level]
        # Query CFR policy using the player's information state (enforces hidden info)
        info_state = state.information_state_string(player_perspective)
        best_action_int = policy.best_action(info_state, legal)
    elif bot_level.startswith("rl_"):
        if game_type not in loaded_models:
            raise HTTPException(
                status_code=503,
                detail=f"No PPO policies loaded for grail_quest."
            )
        game_bots = loaded_models[game_type]
        if bot_level not in game_bots:
            raise HTTPException(
                status_code=404,
                detail=f"PPO bot '{bot_level}' not loaded for grail_quest. "
                       f"Available: {list(game_bots.keys())}"
            )
        net, _ = game_bots[bot_level]
        # Use PZ Env directly to get the observation and mask
        from rl.games.grail_quest.env_pz import GrailQuestPZEnv
        env = GrailQuestPZEnv()
        env.game = state
        agent_id = "player_0" if player_perspective == PLAYER_X else "player_1"
        obs_dict = env.observe(agent_id)
        
        # SB3 predict auto-vectorizes single observations (including Dict spaces)
        action, _ = net.predict(obs_dict, action_masks=obs_dict["action_mask"], deterministic=True)
        # action is usually a scalar numpy array or int here
        best_action_int = int(action.item() if hasattr(action, 'item') else action)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown bot level format: {bot_level}")

    # Convert internal int action → TypeScript-compatible dict
    ts_action = state.action_to_ts_format(best_action_int)

    return PredictResponse(
        action=ts_action,
        bot_level=bot_level,
        num_simulations=0,  # CFR doesn't use simulations
        device="cpu",
    )
