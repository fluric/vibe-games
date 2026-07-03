/**
 * HTTP client for the Python RL sidecar (localhost:8765).
 *
 * The sidecar serves RL/ML bot predictions from trained AlphaZero models.
 * If the sidecar is not running, calls fall back gracefully (throws a clear error).
 *
 * Usage in gameRegistry.ts:
 *   import { getRLAction } from './rlClient';
 *   const action = await getRLAction('connect_four', state, 'rl_strong');
 */

import type { ConnectFourGameState, MillGameState } from '@vibe-games/shared';

const SIDECAR_URL = process.env.RL_SIDECAR_URL ?? 'http://localhost:8765';
const SIDECAR_TIMEOUT_MS = 30_000; // 30s — generous for cold starts (model loading)

export interface RLPredictRequest {
  game_type: 'connect_four' | 'mill';
  state: ConnectFourGameState | MillGameState;
  bot_level: string;
  num_simulations?: number; // optional override of registry value
}

export interface RLPredictResponse {
  action: {
    action: string;
    column?: number; // connect_four
    position?: number; // mill place/remove
    from?: number; // mill move
    to?: number; // mill move
  };
  bot_level: string;
  num_simulations: number;
  device: string;
}

export interface SidecarHealthResponse {
  status: 'ok' | 'error';
  device: string;
  loaded_models: Record<string, string[]>;
}

/**
 * Check if the sidecar is running and which models are loaded.
 */
export async function checkSidecarHealth(): Promise<SidecarHealthResponse | null> {
  try {
    const res = await fetch(`${SIDECAR_URL}/health`, {
      headers: { 'Connection': 'close' },
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<SidecarHealthResponse>;
  } catch {
    return null;
  }
}

/**
 * Get the best action from a trained RL bot.
 *
 * @throws Error if the sidecar is unreachable or returns an error.
 */
export async function getRLAction(
  gameType: 'connect_four' | 'mill',
  state: ConnectFourGameState | MillGameState,
  botLevel: string,
  numSimulations?: number,
): Promise<RLPredictResponse['action']> {
  const body: RLPredictRequest = {
    game_type: gameType,
    state,
    bot_level: botLevel,
    ...(numSimulations !== undefined && { num_simulations: numSimulations }),
  };

  let res: Response;
  try {
    res = await fetch(`${SIDECAR_URL}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'close',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SIDECAR_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(
      `RL sidecar is not reachable at ${SIDECAR_URL}. ` +
        `Start it with: cd rl && python -m uvicorn service.main:app --port 8765\n${err}`,
    );
  }

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`RL sidecar returned ${res.status}: ${detail}`);
  }

  const data = (await res.json()) as RLPredictResponse;
  return data.action;
}

/**
 * Reload all models in the sidecar (call this after a training run completes
 * a new checkpoint without restarting the sidecar).
 */
export async function reloadSidecarModels(): Promise<void> {
  const res = await fetch(`${SIDECAR_URL}/reload`, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Failed to reload sidecar models: ${res.status}`);
  }
}
