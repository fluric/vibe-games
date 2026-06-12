import { MillGameState, PlayerPiece } from '@vibe-games/shared';
import { handlePlaceAction, handleMoveAction, handleRemoveAction } from './millEngine';
import { ADJACENCY_LIST, isPieceInMill, areAllPiecesInMills } from './millRules';

export interface AiAction {
  type: 'place' | 'move' | 'remove';
  position?: number;
  from?: number;
  to?: number;
}

// Evaluation weights
const MATERIAL_WEIGHT = 200;
const MILL_WEIGHT = 80;
const BLOCKED_WEIGHT = -15;
const MILL_THREAT_WEIGHT = 30;

// List of the 16 mill combinations (lines of 3)
const MILL_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [9, 10, 11], [12, 13, 14], [15, 16, 17],
  [18, 19, 20], [21, 22, 23],
  [0, 9, 21], [3, 10, 18], [6, 11, 15],
  [1, 4, 7], [16, 19, 22],
  [8, 12, 17], [5, 13, 20], [2, 14, 23]
];

/**
 * Counts active mills for a player
 */
function countMills(board: (PlayerPiece | null)[], player: PlayerPiece): number {
  let count = 0;
  for (const line of MILL_LINES) {
    if (board[line[0]] === player && board[line[1]] === player && board[line[2]] === player) {
      count++;
    }
  }
  return count;
}

/**
 * Counts open mill threats (2 pieces of player, 1 empty spot)
 */
function countMillThreats(board: (PlayerPiece | null)[], player: PlayerPiece): number {
  let count = 0;
  for (const line of MILL_LINES) {
    const p1 = board[line[0]];
    const p2 = board[line[1]];
    const p3 = board[line[2]];
    
    if (p1 === player && p2 === player && p3 === null) count++;
    else if (p1 === player && p3 === player && p2 === null) count++;
    else if (p2 === player && p3 === player && p1 === null) count++;
  }
  return count;
}

/**
 * Evaluates the board state from maximizing player O's perspective
 */
export function evaluateBoard(state: MillGameState): number {
  if (state.winner === 'O') return 10000;
  if (state.winner === 'X') return -10000;
  if (state.winner === 'draw') return 0;

  const board = state.board;

  // 1. Material score
  const oMaterial = state.piecesOnBoard.O + state.placementsRemaining.O;
  const xMaterial = state.piecesOnBoard.X + state.placementsRemaining.X;
  const materialScore = (oMaterial - xMaterial) * MATERIAL_WEIGHT;

  // 2. Active mills
  const oMills = countMills(board, 'O');
  const xMills = countMills(board, 'X');
  const millScore = (oMills - xMills) * MILL_WEIGHT;

  // 3. Blocked pieces
  let oBlocked = 0;
  let xBlocked = 0;
  
  // Only check blocking if we are out of placement phase
  if (state.phase !== 'placement') {
    for (let i = 0; i < board.length; i++) {
      const piece = board[i];
      if (piece === null) continue;
      
      const neighbors = ADJACENCY_LIST[i] || [];
      const hasFreeNeighbor = neighbors.some(n => board[n] === null);
      if (!hasFreeNeighbor) {
        if (piece === 'O') oBlocked++;
        else xBlocked++;
      }
    }
  }
  const blockedScore = (oBlocked - xBlocked) * BLOCKED_WEIGHT;

  // 4. Mill threats (placing setups)
  const oThreats = countMillThreats(board, 'O');
  const xThreats = countMillThreats(board, 'X');
  const threatScore = (oThreats - xThreats) * MILL_THREAT_WEIGHT;

  return materialScore + millScore + blockedScore + threatScore;
}

/**
 * Generates all valid actions for the active player in a state
 */
export function getValidActions(state: MillGameState): AiAction[] {
  const player = state.turn;
  const opponent = player === 'X' ? 'O' : 'X';
  const actions: AiAction[] = [];

  if (state.millFormedThisTurn) {
    // Removal phase
    const opponentPieces: number[] = [];
    for (let i = 0; i < state.board.length; i++) {
      if (state.board[i] === opponent) {
        opponentPieces.push(i);
      }
    }
    const allInMills = areAllPiecesInMills(state.board, opponent);
    for (const pos of opponentPieces) {
      if (allInMills || !isPieceInMill(state.board, pos, opponent)) {
        actions.push({ type: 'remove', position: pos });
      }
    }
    return actions;
  }

  if (state.phase === 'placement') {
    // Placement phase
    for (let i = 0; i < state.board.length; i++) {
      if (state.board[i] === null) {
        actions.push({ type: 'place', position: i });
      }
    }
    return actions;
  }

  // Movement or flying phase
  const playerPieces: number[] = [];
  for (let i = 0; i < state.board.length; i++) {
    if (state.board[i] === player) {
      playerPieces.push(i);
    }
  }

  const canFly = playerPieces.length === 3;
  const emptyPositions: number[] = [];
  for (let i = 0; i < state.board.length; i++) {
    if (state.board[i] === null) {
      emptyPositions.push(i);
    }
  }

  for (const from of playerPieces) {
    if (canFly) {
      for (const to of emptyPositions) {
        actions.push({ type: 'move', from, to });
      }
    } else {
      const neighbors = ADJACENCY_LIST[from] || [];
      for (const to of neighbors) {
        if (state.board[to] === null) {
          actions.push({ type: 'move', from, to });
        }
      }
    }
  }

  return actions;
}

/**
 * Simulates executing an action
 */
function simulateAction(state: MillGameState, action: AiAction, player: PlayerPiece): MillGameState {
  if (action.type === 'place') {
    return handlePlaceAction(state, action.position!, player);
  } else if (action.type === 'move') {
    return handleMoveAction(state, action.from!, action.to!, player);
  } else {
    return handleRemoveAction(state, action.position!, player);
  }
}

/**
 * Minimax with Alpha-Beta Pruning
 */
function minimax(
  state: MillGameState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): number {
  if (depth === 0 || state.winner) {
    return evaluateBoard(state);
  }

  const actions = getValidActions(state);
  if (actions.length === 0) {
    // No moves means the other player wins
    return isMaximizing ? -9000 : 9000;
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const action of actions) {
      try {
        const nextState = simulateAction(state, action, state.turn);
        const evaluation = minimax(nextState, depth - 1, alpha, beta, nextState.turn === 'O');
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break; // Beta cut-off
      } catch (err) {
        // Skip invalid simulations
        continue;
      }
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const action of actions) {
      try {
        const nextState = simulateAction(state, action, state.turn);
        const evaluation = minimax(nextState, depth - 1, alpha, beta, nextState.turn === 'O');
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break; // Alpha cut-off
      } catch (err) {
        // Skip invalid simulations
        continue;
      }
    }
    return minEval;
  }
}

/**
 * Returns the best action for player O using Minimax Search
 */
export function getBestMinimaxMove(state: MillGameState, depth: number = 3): AiAction {
  const actions = getValidActions(state);
  if (actions.length === 0) {
    throw new Error('AI opponent has no valid actions');
  }

  let bestAction = actions[0];
  let bestValue = -Infinity;

  for (const action of actions) {
    try {
      const nextState = simulateAction(state, action, 'O');
      const value = minimax(nextState, depth - 1, -Infinity, Infinity, nextState.turn === 'O');
      
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    } catch (err) {
      // Skip invalid moves
      continue;
    }
  }

  return bestAction;
}
