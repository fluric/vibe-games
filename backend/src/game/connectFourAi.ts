import { PlayerPiece, ConnectFourGameState } from '@vibe-games/shared';
import { SearchAdapter, SearchEngine } from './ai/search';
import { getValidColumns, makeVirtualMove, checkWin, evaluateBoard, COLUMN_ORDER } from './ai/connectFourHeuristics';

export interface ConnectFourAiAction {
  type: 'place';
  column: number;
  position: number;
}

export interface ConnectFourWeights {
  centerColumn?: number;
  twoInARow?: number;
  threeInARow?: number;
  oppTwoInARow?: number;
  oppThreeInARow?: number;
}

export const DEFAULT_WEIGHTS: ConnectFourWeights = {
  centerColumn: 3,
  twoInARow: 2,
  threeInARow: 5,
  oppTwoInARow: 0,
  oppThreeInARow: 40
};

class ConnectFourSearchAdapter implements SearchAdapter<(PlayerPiece | null)[], ConnectFourAiAction> {
  private aiPiece: PlayerPiece;
  private opponentPiece: PlayerPiece;
  private weights: ConnectFourWeights;

  constructor(aiPiece: PlayerPiece, weights: ConnectFourWeights) {
    this.aiPiece = aiPiece;
    this.opponentPiece = aiPiece === 'X' ? 'O' : 'X';
    this.weights = weights;
  }

  getValidActions(state: (PlayerPiece | null)[]): ConnectFourAiAction[] {
    return getValidColumns(state).map(col => {
      // Find the row it would land in
      let pos = -1;
      for (let r = 5; r >= 0; r--) {
        if (state[r * 7 + col] === null) {
          pos = r * 7 + col;
          break;
        }
      }
      return { type: 'place', column: col, position: pos };
    });
  }

  simulateAction(state: (PlayerPiece | null)[], action: ConnectFourAiAction): (PlayerPiece | null)[] {
    return makeVirtualMove(state, action.column, this.getTurn(state));
  }

  evaluateState(state: (PlayerPiece | null)[], depth: number): number {
    if (checkWin(state, this.aiPiece)) return 100000 + depth;
    if (checkWin(state, this.opponentPiece)) return -100000 - depth;
    return evaluateBoard(state, this.aiPiece, this.opponentPiece, this.weights);
  }

  isGameOver(state: (PlayerPiece | null)[]): boolean {
    if (checkWin(state, this.aiPiece) || checkWin(state, this.opponentPiece)) return true;
    return getValidColumns(state).length === 0;
  }

  getHash(state: (PlayerPiece | null)[]): string {
    return state.map(c => c || '.').join('') + this.getTurn(state);
  }

  orderActions(state: (PlayerPiece | null)[], actions: ConnectFourAiAction[], ttBestAction?: ConnectFourAiAction): ConnectFourAiAction[] {
    const ordered = [...actions];
    if (ttBestAction) {
      const idx = ordered.findIndex(a => a.column === ttBestAction.column);
      if (idx !== -1) {
        ordered.splice(idx, 1);
        ordered.unshift(ttBestAction);
      }
    }
    return ordered;
  }

  getTurn(state: (PlayerPiece | null)[]): PlayerPiece {
    let xCount = 0;
    let oCount = 0;
    for (const cell of state) {
      if (cell === 'X') xCount++;
      else if (cell === 'O') oCount++;
    }
    return xCount <= oCount ? 'X' : 'O';
  }
}

export function getRandomAction(state: ConnectFourGameState): ConnectFourAiAction | null {
  const validCols = getValidColumns(state.board);
  if (validCols.length === 0) return null;
  const col = validCols[Math.floor(Math.random() * validCols.length)];
  let pos = -1;
  for (let r = 5; r >= 0; r--) {
    if (state.board[r * 7 + col] === null) {
      pos = r * 7 + col;
      break;
    }
  }
  return { type: 'place', column: col, position: pos };
}

export function getBestConnectFourMove(
  state: ConnectFourGameState,
  depth: number,
  weights: ConnectFourWeights = DEFAULT_WEIGHTS,
  timeLimitMs: number = 3000
): ConnectFourAiAction | null {
  const adapter = new ConnectFourSearchAdapter(state.turn, weights);
  const engine = new SearchEngine(adapter);
  
  const { bestAction } = engine.iterativeDeepening(state.board, depth, timeLimitMs, state.turn);
  return bestAction || getRandomAction(state);
}

export function getConnectFourAiAction(
  state: ConnectFourGameState,
  type: 'random' | 'heuristic' | 'minimax' = 'minimax',
  depth: number = 6,
  weights?: ConnectFourWeights,
  timeLimitMs?: number
): ConnectFourAiAction | null {
  if (type === 'random') return getRandomAction(state);
  return getBestConnectFourMove(state, depth, weights || DEFAULT_WEIGHTS, timeLimitMs);
}
