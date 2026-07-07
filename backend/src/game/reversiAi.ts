import { PlayerPiece, ReversiGameState } from '@vibe-games/shared';
import { SearchAdapter, SearchEngine } from './ai/search';
import { getLegalMoves, getFlippedDiscs, determineWinner } from './reversiEngine';

export interface ReversiAiAction {
  type: 'place';
  position: number;
}

export interface ReversiWeights {
  corner: number;
  mobility: number;
  discCount: number;
  stability: number;
}

export const DEFAULT_WEIGHTS: ReversiWeights = {
  corner: 100,
  mobility: 10,
  discCount: 1, // Only really matters towards the very end
  stability: 30
};

// Static board evaluation map for Reversi
const POSITION_WEIGHTS = [
   100, -20,  10,   5,   5,  10, -20, 100,
   -20, -50,  -2,  -2,  -2,  -2, -50, -20,
    10,  -2,  -1,  -1,  -1,  -1,  -2,  10,
     5,  -2,  -1,  -1,  -1,  -1,  -2,   5,
     5,  -2,  -1,  -1,  -1,  -1,  -2,   5,
    10,  -2,  -1,  -1,  -1,  -1,  -2,  10,
   -20, -50,  -2,  -2,  -2,  -2, -50, -20,
   100, -20,  10,   5,   5,  10, -20, 100
];

export function getRandomAction(state: ReversiGameState): ReversiAiAction | null {
  const validMoves = getLegalMoves(state.board, state.turn);
  if (validMoves.length === 0) return { type: 'place', position: 64 };
  const pos = validMoves[Math.floor(Math.random() * validMoves.length)];
  return { type: 'place', position: pos };
}

export function getBestReversiMove(
  state: ReversiGameState,
  depth: number,
  weights: ReversiWeights = DEFAULT_WEIGHTS,
  timeLimitMs: number = 3000
): ReversiAiAction | null {
  // Let's create a custom adapter that uses { board, turn } instead of just board
  class ProperReversiSearchAdapter implements SearchAdapter<ReversiGameState, ReversiAiAction> {
    private aiPiece: PlayerPiece;
    private opponentPiece: PlayerPiece;
    private weights: ReversiWeights;

    constructor(aiPiece: PlayerPiece, weights: ReversiWeights) {
      this.aiPiece = aiPiece;
      this.opponentPiece = aiPiece === 'X' ? 'O' : 'X';
      this.weights = weights;
    }

    getValidActions(state: ReversiGameState): ReversiAiAction[] {
      const moves = getLegalMoves(state.board, state.turn);
      if (moves.length === 0) {
        return [{ type: 'place', position: 64 }];
      }
      return moves.map(pos => ({ type: 'place', position: pos }));
    }

    simulateAction(state: ReversiGameState, action: ReversiAiAction): ReversiGameState {
      const turn = state.turn;
      const nextTurn = turn === 'X' ? 'O' : 'X';

      if (action.position === 64) {
        return { ...state, turn: nextTurn };
      }

      const newBoard = [...state.board];
      newBoard[action.position] = turn;
      
      const flipped = getFlippedDiscs(state.board, action.position, turn);
      for (const flip of flipped) {
        newBoard[flip] = turn;
      }
      
      return { ...state, board: newBoard, turn: nextTurn };
    }

    evaluateState(state: ReversiGameState, depth: number): number {
      const xMoves = getLegalMoves(state.board, 'X').length;
      const oMoves = getLegalMoves(state.board, 'O').length;
      
      if (xMoves === 0 && oMoves === 0) {
        const winner = determineWinner(state.board);
        if (winner === this.aiPiece) return 100000 + depth;
        if (winner === this.opponentPiece) return -100000 - depth;
        if (winner === 'draw') return 0;
      }

      let score = 0;
      let aiPositions = 0;
      let oppPositions = 0;
      let aiCount = 0;
      let oppCount = 0;

      for (let i = 0; i < 64; i++) {
        if (state.board[i] === this.aiPiece) {
          aiPositions += POSITION_WEIGHTS[i];
          aiCount++;
        } else if (state.board[i] === this.opponentPiece) {
          oppPositions += POSITION_WEIGHTS[i];
          oppCount++;
        }
      }
      
      score += (aiPositions - oppPositions) * this.weights.stability;
      
      const aiMoves = state.turn === this.aiPiece ? xMoves : (this.aiPiece === 'X' ? xMoves : oMoves);
      const oppMoves = state.turn === this.opponentPiece ? oMoves : (this.opponentPiece === 'X' ? xMoves : oMoves);
      
      score += (aiMoves - oppMoves) * this.weights.mobility;
      score += (aiCount - oppCount) * this.weights.discCount;

      return score;
    }

    isGameOver(state: ReversiGameState): boolean {
      return getLegalMoves(state.board, 'X').length === 0 && getLegalMoves(state.board, 'O').length === 0;
    }

    getHash(state: ReversiGameState): string {
      return state.board.map(c => c || '.').join('') + state.turn;
    }

    orderActions(state: ReversiGameState, actions: ReversiAiAction[], ttBestAction?: ReversiAiAction): ReversiAiAction[] {
      const ordered = [...actions];
      if (ttBestAction) {
        const idx = ordered.findIndex(a => a.position === ttBestAction.position);
        if (idx !== -1) {
          ordered.splice(idx, 1);
          ordered.unshift(ttBestAction);
        }
      }
      return ordered;
    }

    getTurn(state: ReversiGameState): PlayerPiece {
      return state.turn;
    }
  }

  const adapter = new ProperReversiSearchAdapter(state.turn, weights);
  const engine = new SearchEngine(adapter);
  
  const { bestAction } = engine.iterativeDeepening(state, depth, timeLimitMs, state.turn);
  return bestAction || getRandomAction(state);
}

export function getReversiAiAction(
  state: ReversiGameState,
  type: 'random' | 'heuristic' | 'minimax' = 'minimax',
  depth: number = 6,
  weights?: ReversiWeights,
  timeLimitMs?: number
): ReversiAiAction | null {
  if (type === 'random') return getRandomAction(state);
  return getBestReversiMove(state, depth, weights || DEFAULT_WEIGHTS, timeLimitMs);
}
