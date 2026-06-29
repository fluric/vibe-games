import { MillGameState, PlayerPiece } from '@vibe-games/shared';
import { AiAction, StrategyWeights, evaluateBoard, getValidActions, simulateAction, getTTKey, orderActions } from './ai/millHeuristics';
import { SearchAdapter, SearchEngine } from './ai/search';

export { AiAction, StrategyWeights, getValidActions, evaluateBoard };

export class MillSearchAdapter implements SearchAdapter<MillGameState, AiAction> {
  private weights: StrategyWeights;
  private aiPlayer: 'X' | 'O';

  constructor(weights: StrategyWeights, aiPlayer: 'X' | 'O') {
    this.weights = weights;
    this.aiPlayer = aiPlayer;
  }

  getValidActions(state: MillGameState): AiAction[] {
    return getValidActions(state);
  }

  simulateAction(state: MillGameState, action: AiAction): MillGameState {
    return simulateAction(state, action, this.getTurn(state));
  }

  evaluateState(state: MillGameState, depth: number): number {
    return evaluateBoard(state, this.weights);
  }

  isGameOver(state: MillGameState): boolean {
    return state.winner !== undefined && state.winner !== null;
  }

  getHash(state: MillGameState): string {
    return getTTKey(state);
  }

  orderActions(state: MillGameState, actions: AiAction[], ttBestAction?: AiAction): AiAction[] {
    return orderActions(state, actions, ttBestAction);
  }

  getTurn(state: MillGameState): 'X' | 'O' {
    return state.turn;
  }
}

export function getBestMinimaxMove(
  state: MillGameState,
  maxDepth: number,
  weights: StrategyWeights,
  timeLimitMs: number = 3000
): AiAction | null {
  const adapter = new MillSearchAdapter(weights, state.turn);
  const engine = new SearchEngine(adapter);
  
  const { bestAction } = engine.iterativeDeepening(state, maxDepth, timeLimitMs, state.turn);
  return bestAction;
}
