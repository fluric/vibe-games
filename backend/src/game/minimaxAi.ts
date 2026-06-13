import { MillGameState, PlayerPiece } from '@vibe-games/shared';
import { handlePlaceAction, handleMoveAction, handleRemoveAction } from './millEngine';
import { ADJACENCY_LIST, isPieceInMill, areAllPiecesInMills, MILLS } from './millRules';

export interface AiAction {
  type: 'place' | 'move' | 'remove';
  position?: number;
  from?: number;
  to?: number;
}

// Evaluation weights
const MATERIAL_WEIGHT = 200;
const MILL_WEIGHT = 150; // Increased to prioritize active mills
const BLOCKED_WEIGHT = -20;
const MILL_THREAT_WEIGHT = 60; // Increased to prioritize block/setup of threats

/**
 * Counts active mills for a player
 */
function countMills(board: (PlayerPiece | null)[], player: PlayerPiece): number {
  let count = 0;
  for (const line of MILLS) {
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
  for (const line of MILLS) {
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
 * Gets positions where the opponent has an active mill threat (2 pieces, 1 empty)
 */
function getOpponentThreats(board: (PlayerPiece | null)[], opponent: PlayerPiece): number[] {
  const threats: number[] = [];
  for (const line of MILLS) {
    const p1 = board[line[0]];
    const p2 = board[line[1]];
    const p3 = board[line[2]];
    
    if (p1 === opponent && p2 === opponent && p3 === null) threats.push(line[2]);
    else if (p1 === opponent && p3 === opponent && p2 === null) threats.push(line[1]);
    else if (p2 === opponent && p3 === opponent && p1 === null) threats.push(line[0]);
  }
  return threats;
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
 * Heuristically orders actions to optimize Alpha-Beta Pruning cutoffs
 */
function orderActions(state: MillGameState, actions: AiAction[]): AiAction[] {
  const player = state.turn;
  const opponent = player === 'X' ? 'O' : 'X';
  const board = state.board;

  // Get opponent threats to prioritize blocking them
  const threats = getOpponentThreats(board, opponent);

  const getActionScore = (action: AiAction): number => {
    let score = 0;

    // 1. Simulate to check if it forms a mill (highest priority)
    try {
      const nextState = simulateAction(state, action, player);
      if (nextState.millFormedThisTurn) {
        score += 1000;
      }
    } catch (err) {
      // Ignore invalid simulation
    }

    if (action.type === 'place') {
      const pos = action.position!;
      // 2. Blocking an opponent threat
      if (threats.includes(pos)) {
        score += 500;
      }
      // 3. Connection degree weight (prefer center-middle and midpoints)
      const degree = (ADJACENCY_LIST[pos] || []).length;
      score += degree * 10;
    } else if (action.type === 'move') {
      const to = action.to!;
      // 2. Blocking an opponent threat
      if (threats.includes(to)) {
        score += 500;
      }
      // 3. Prefer moving to high connection degree points
      const degree = (ADJACENCY_LIST[to] || []).length;
      score += degree * 10;
    } else if (action.type === 'remove') {
      const pos = action.position!;
      // Removing opponent's threat components
      if (threats.includes(pos)) {
        score += 300;
      }
    }

    return score;
  };

  return actions
    .map(action => ({ action, score: getActionScore(action) }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.action);
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

  const actions = orderActions(state, getValidActions(state));
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
  const actions = orderActions(state, getValidActions(state));
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
