import { MillGameState, PlayerPiece } from '@vibe-games/shared';
import { handlePlaceAction, handleMoveAction, handleRemoveAction } from './millEngine';
import { ADJACENCY_LIST, isPieceInMill, areAllPiecesInMills, MILLS } from './millRules';

export interface AiAction {
  type: 'place' | 'move' | 'remove';
  position?: number;
  from?: number;
  to?: number;
}

export interface StrategyWeights {
  material: number;
  mill: number;
  blocked: number;
  threat: number;
  positional?: number;
  fork?: number;
  mobility?: number;
}

const DEFAULT_WEIGHTS: StrategyWeights = {
  material: 200,
  mill: 150,
  blocked: -80,
  threat: 60,
  positional: 15,
  fork: 100,
  mobility: 5
};

// ─── Board Position Values ────────────────────────────────────────────────────
// How many distinct mills each position participates in:
//
//   Board layout (indices):
//    0 ---- 1 ---- 2
//    |  8 - 9 -10  |
//    |  | 16-17-18 |  |
//    7 15 23   19 11  3
//    |  | 22-21-20 |  |
//    |  14-13-12  |
//    6 ---- 5 ---- 4
//
// Outer ring corners (0,2,4,6): 2 mills each
// Outer ring midpoints (1,3,5,7): 2 mills each (ring + spoke)
// Middle ring corners (8,10,12,14): 2 mills each
// Middle ring cross-points (9,11,13,15): 3 mills each (ring + ring + spoke) ← BEST
// Inner ring corners (16,18,20,22): 2 mills each
// Inner ring midpoints (17,19,21,23): 2 mills each (ring + spoke)
const POSITION_VALUES: number[] = [
//  0   1   2   3   4   5   6   7
    2,  2,  2,  2,  2,  2,  2,  2,   // Outer ring (all 2-mill)
//  8   9  10  11  12  13  14  15
    2,  3,  2,  3,  2,  3,  2,  3,   // Middle ring (cross-points are 3-mill)
// 16  17  18  19  20  21  22  23
    2,  2,  2,  2,  2,  2,  2,  2,   // Inner ring (all 2-mill)
];

// ─── Opening Book ─────────────────────────────────────────────────────────────
// Based on expert Nine Men's Morris theory:
// - The 4-way junction points (9, 11, 13, 15) are the strongest on the board.
//   Each connects to 3 separate mills (two ring segments + one spoke).
// - Corner points are weaker because they only participate in 2 mills.
// - The optimal opening goal is to achieve a "double mill" (seesaw) setup:
//   two overlapping mills where one piece rocks back and forth capturing every turn.
// - Per Gasser's analysis: do NOT greedily rush to close a mill early — positional
//   control and fork setup outperform early captures in the long run.
//
// Key: compact board string (e.g. "...O.X...") for the board state when it's O's turn.
// Value: the index O should play.
//
// The board string is 24 chars: '.' = empty, 'O' = O's piece, 'X' = X's piece.
// Note: we only book opening positions (early placement, <6 pieces total on board).
const OPENING_BOOK: Map<string, number> = new Map([
  // ── Move 1: O plays second (X has placed 1 piece) ───────────────────────────
  // Always grab a middle cross-point (9, 11, 13, or 15). If X took one, take adjacent.
  // X at corner → take 9 (best cross-point)
  ['X.......................', 9],
  ['.X......................', 9],
  ['..X.....................', 9],
  ['...X....................', 9],
  ['....X...................', 9],
  ['.....X..................', 9],
  ['......X.................', 9],
  ['.......X................', 9],
  // X took inner ring → take 9
  ['................X.......', 9],
  ['..................X.....', 9],
  ['....................X...', 9],
  ['......................X.', 9],
  // X took an inner ring midpoint (spoke) → take the same spoke's cross-point
  ['.................X......', 9],   // X at 17 → O takes 9 (same spoke: 1-9-17)
  ['...................X....', 9],   // X at 19 → O takes 11 (spoke: 3-11-19)
  ['.....................X..', 13],  // X at 21 → O takes 13 (spoke: 5-13-21)
  ['.......................X', 15],  // X at 23 → O takes 15 (spoke: 7-15-23)
  // X took a middle cross-point → take the opposite cross-point
  ['........X...............', 15], // X at 8  → O takes 15 (diagonal)
  ['..........X.............', 9],  // X at 10 → O takes 9
  ['............X...........', 15], // X at 12 → O takes 15
  ['..............X.........', 9],  // X at 14 → O takes 9
  // X took cross-point 9 → take 13 (opposite, forces two-front control)
  ['.........X..............', 13],
  // X took cross-point 11 → take 15
  ['...........X............', 15],
  // X took cross-point 13 → take 9
  ['.............X..........', 9],
  // X took cross-point 15 → take 11
  ['...............X........', 11],

  // ── Move 2: O plays 4th overall (3 pieces on board) ─────────────────────────
  // After O has claimed one cross-point, go for a second cross-point to prepare
  // a double-mill fork. Aim for two adjacent cross-points on the middle ring.
  // If O has 9 and 11 available, take 11; if O has 9, take 13 for fork potential.
  // These are approximations — we rely on minimax for positions not in the book.
]);

/**
 * Creates a compact board key for the opening book lookup.
 */
function getBoardKey(board: (PlayerPiece | null)[]): string {
  return board.map(c => c === null ? '.' : c).join('');
}

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
 * Counts double-mill threats (forks) for a player.
 * A fork is an empty position where placing would complete TWO different mills simultaneously.
 */
function countForks(board: (PlayerPiece | null)[], player: PlayerPiece): number {
  let forks = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) {
      let millsFormed = 0;
      for (const line of MILLS) {
        if (line.includes(i)) {
          const otherPos = line.filter(p => p !== i);
          if (board[otherPos[0]] === player && board[otherPos[1]] === player) {
            millsFormed++;
          }
        }
      }
      if (millsFormed >= 2) {
        forks++;
      }
    }
  }
  return forks;
}

/**
 * Counts blocked pieces (pieces with no free adjacent position)
 */
function countBlocked(board: (PlayerPiece | null)[], player: PlayerPiece): number {
  let blocked = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === player) {
      const neighbors = ADJACENCY_LIST[i] || [];
      const hasFreeNeighbor = neighbors.some(n => board[n] === null);
      if (!hasFreeNeighbor) {
        blocked++;
      }
    }
  }
  return blocked;
}

/**
 * Counts seesaw (double-mill) configurations for a player.
 * A seesaw exists when:
 *   1. A player has two complete, ACTIVE mills (all 3 squares of each mill occupied)
 *   2. The two mills share exactly one piece (the "pivot")
 *   3. The pivot piece has at least one free adjacent square to slide into and back
 *
 * This is the dominant winning pattern in Nine Men's Morris. A seesaw means the
 * player captures one opponent piece every turn indefinitely until they win.
 */
function countSeesaws(board: (PlayerPiece | null)[], player: PlayerPiece): number {
  let seesaws = 0;

  // Find all active mills for the player
  const activeMills: number[][] = [];
  for (const line of MILLS) {
    if (board[line[0]] === player && board[line[1]] === player && board[line[2]] === player) {
      activeMills.push(line);
    }
  }

  // Check all pairs of active mills for seesaw configuration
  for (let i = 0; i < activeMills.length; i++) {
    for (let j = i + 1; j < activeMills.length; j++) {
      const millA = activeMills[i];
      const millB = activeMills[j];

      // Find the shared piece (pivot)
      const shared = millA.filter(pos => millB.includes(pos));
      if (shared.length !== 1) continue; // Must share exactly one piece

      const pivot = shared[0];

      // Check if the pivot can slide to an adjacent empty square
      const neighbors = ADJACENCY_LIST[pivot] || [];
      const hasEscape = neighbors.some(n => board[n] === null);

      if (hasEscape) {
        seesaws++;
      }
    }
  }

  return seesaws;
}

/**
 * Evaluates the board state from maximizing player O's perspective.
 *
 * Phase-specific weights:
 * - Placement: Focus on threats, position, and forks (mills not fully formed yet)
 * - Movement: Material + mills + blocked + threats + forks
 * - Flying: Material + mills (endgame tactics dominate)
 */
export function evaluateBoard(state: MillGameState, weights: StrategyWeights = DEFAULT_WEIGHTS): number {
  if (state.winner === 'O') return 100000;
  if (state.winner === 'X') return -100000;
  if (state.winner === 'draw') return 0;

  const board = state.board;
  const oCount = state.piecesOnBoard.O + state.placementsRemaining.O;
  const xCount = state.piecesOnBoard.X + state.placementsRemaining.X;

  // ── 1. Material (total pieces) ────────────────────────────────────────────
  const materialScore = (oCount - xCount) * weights.material;

  // ── 2. Active mills ───────────────────────────────────────────────────────
  const oMills = countMills(board, 'O');
  const xMills = countMills(board, 'X');
  const millScore = (oMills - xMills) * weights.mill;

  // ── 3. Mill threats (2-in-a-row with empty) ───────────────────────────────
  const oThreats = countMillThreats(board, 'O');
  const xThreats = countMillThreats(board, 'X');
  const threatScore = (oThreats - xThreats) * weights.threat;

  // ── 4. Blocked pieces (pieces with no moves) ──────────────────────────────
  let blockedScore = 0;
  if (state.phase !== 'placement') {
    const oBlocked = countBlocked(board, 'O');
    const xBlocked = countBlocked(board, 'X');
    blockedScore = (oBlocked - xBlocked) * weights.blocked;
  }

  // ── 5. Positional value (placement phase only) ───────────────────────────
  let positionalScore = 0;
  const positionalWeight = weights.positional ?? 15;
  if (positionalWeight > 0 && state.phase === 'placement') {
    let oPosVal = 0;
    let xPosVal = 0;
    for (let i = 0; i < board.length; i++) {
      if (board[i] === 'O') oPosVal += POSITION_VALUES[i];
      else if (board[i] === 'X') xPosVal += POSITION_VALUES[i];
    }
    positionalScore = (oPosVal - xPosVal) * positionalWeight;
  }

  // ── 6. Fork detection (double-mill / seesaw opportunities) ────────────────
  // A fork is an empty position where placing would complete ≥2 mills.
  // This is the decisive tactical pattern in NMM — detect it in all phases.
  let forkScore = 0;
  const forkWeight = weights.fork ?? 0;
  if (forkWeight > 0) {
    const oForks = countForks(board, 'O');
    const xForks = countForks(board, 'X');
    forkScore = (oForks - xForks) * forkWeight;
  }

  // ── 7. Double-mill (seesaw) detection ────────────────────────────────────
  // A seesaw exists when a player has two ACTIVE mills sharing a piece that
  // is adjacent to an empty square — moving it out and back captures every turn.
  // This is the dominant winning pattern in NMM. Reward it heavily.
  let seesawScore = 0;
  if (state.phase !== 'placement') {
    const oSeesaw = countSeesaws(board, 'O');
    const xSeesaw = countSeesaws(board, 'X');
    seesawScore = (oSeesaw - xSeesaw) * 300;
  }

  return materialScore + millScore + threatScore + blockedScore + positionalScore + forkScore + seesawScore;
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
 * Scores a single action for move ordering (higher = search first).
 * Good move ordering is the single most important factor in alpha-beta efficiency.
 */
function scoreActionForOrdering(
  state: MillGameState,
  action: AiAction,
  player: PlayerPiece,
  opponentThreats: number[],
): number {
  let score = 0;

  // Simulate to detect mill formation
  try {
    const nextState = simulateAction(state, action, player);
    if (nextState.millFormedThisTurn) {
      score += 2000; // Best: form a mill (get to remove a piece)
    }
  } catch (_) {
    // skip
  }

  if (action.type === 'place') {
    const pos = action.position!;
    // Block opponent threat
    if (opponentThreats.includes(pos)) score += 1000;
    // Positional value
    score += POSITION_VALUES[pos] * 20;
  } else if (action.type === 'move') {
    const to = action.to!;
    // Block opponent threat
    if (opponentThreats.includes(to)) score += 1000;
    // Positional value of destination
    score += POSITION_VALUES[to] * 20;
  } else if (action.type === 'remove') {
    const pos = action.position!;
    const opponent = player === 'X' ? 'O' : 'X';
    // Prefer removing pieces that are part of opponent threats
    if (opponentThreats.includes(pos)) score += 800;
    // Prefer removing pieces that are NOT in mills (already handled by rules, but still rank by position)
    if (!isPieceInMill(state.board, pos, opponent)) score += 200;
    // Prefer removing high-value opponent pieces
    score += POSITION_VALUES[pos] * 15;
  }

  return score;
}

/**
 * Heuristically orders actions to optimize Alpha-Beta Pruning cutoffs
 */
function orderActions(state: MillGameState, actions: AiAction[], ttBestAction?: AiAction): AiAction[] {
  const player = state.turn;
  const opponent = player === 'X' ? 'O' : 'X';
  const opponentThreats = getOpponentThreats(state.board, opponent);

  const scored = actions.map(action => ({
    action,
    score: scoreActionForOrdering(state, action, player, opponentThreats),
  }));

  scored.sort((a, b) => b.score - a.score);
  const ordered = scored.map(s => s.action);

  // Put the TT best action first if we have one
  if (ttBestAction) {
    const bestIdx = ordered.findIndex(a =>
      a.type === ttBestAction.type &&
      a.position === ttBestAction.position &&
      a.from === ttBestAction.from &&
      a.to === ttBestAction.to
    );
    if (bestIdx > 0) {
      const [best] = ordered.splice(bestIdx, 1);
      ordered.unshift(best);
    }
  }

  return ordered;
}

// ─── Transposition Table ──────────────────────────────────────────────────────
interface TranspositionEntry {
  depth: number;
  value: number;
  flag: 'exact' | 'lower' | 'upper';
  bestAction?: AiAction;
}

const tt = new Map<string, TranspositionEntry>();
const MAX_TT_SIZE = 500_000;

function getTTKey(state: MillGameState): string {
  return `${state.board.join(',')}|${state.phase}|${state.turn}|${state.piecesOnBoard.O}|${state.piecesOnBoard.X}|${state.placementsRemaining.O}|${state.placementsRemaining.X}|${state.millFormedThisTurn ? 1 : 0}|${state.movesSinceLastCapture}`;
}

// ─── Minimax with Alpha-Beta + TT ─────────────────────────────────────────────

function minimax(
  state: MillGameState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  weights: StrategyWeights,
): number {
  const alphaOrig = alpha;
  const betaOrig = beta;

  if (depth === 0 || state.winner) {
    return evaluateBoard(state, weights);
  }

  const cacheKey = getTTKey(state);
  const ttEntry = tt.get(cacheKey);

  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.flag === 'exact') return ttEntry.value;
    if (ttEntry.flag === 'lower') alpha = Math.max(alpha, ttEntry.value);
    if (ttEntry.flag === 'upper') beta = Math.min(beta, ttEntry.value);
    if (alpha >= beta) return ttEntry.value;
  }

  const actions = orderActions(state, getValidActions(state), ttEntry?.bestAction);
  if (actions.length === 0) {
    return isMaximizing ? -90000 : 90000;
  }

  let bestValue = isMaximizing ? -Infinity : Infinity;
  let bestAction: AiAction | undefined;

  for (const action of actions) {
    let nextState: MillGameState;
    try {
      nextState = simulateAction(state, action, state.turn);
    } catch (_) {
      continue;
    }

    const evaluation = minimax(nextState, depth - 1, alpha, beta, nextState.turn === 'O', weights);

    if (isMaximizing) {
      if (evaluation > bestValue) {
        bestValue = evaluation;
        bestAction = action;
      }
      alpha = Math.max(alpha, evaluation);
    } else {
      if (evaluation < bestValue) {
        bestValue = evaluation;
        bestAction = action;
      }
      beta = Math.min(beta, evaluation);
    }

    if (beta <= alpha) break;
  }

  // Determine TT flag
  let flag: 'exact' | 'lower' | 'upper' = 'exact';
  if (bestValue <= alphaOrig) flag = 'upper';
  else if (bestValue >= betaOrig) flag = 'lower';

  // Evict old entries if TT is getting large (simple strategy: just clear half)
  if (tt.size >= MAX_TT_SIZE) {
    let toDelete = Math.floor(MAX_TT_SIZE / 2);
    for (const key of tt.keys()) {
      tt.delete(key);
      if (--toDelete <= 0) break;
    }
  }

  tt.set(cacheKey, { depth, value: bestValue, flag, bestAction });

  return bestValue;
}

/**
 * Iterative Deepening Minimax Search.
 *
 * Searches depth 1, 2, 3, ... up to maxDepth, stopping if the time budget runs out.
 * Returns the best move found at the deepest completed depth.
 * This ensures we always have a valid move even if deeper search is cut short.
 *
 * Default timeLimitMs is 1500ms — fast enough for tournaments while still reaching
 * depth 6 in most positions thanks to TT pruning. Human-facing callers can pass a
 * higher limit (e.g. 4000ms) for more thinking time.
 */
function iterativeDeepening(
  state: MillGameState,
  maxDepth: number,
  weights: StrategyWeights,
  timeLimitMs: number = 1500,
): AiAction {
  const actions = orderActions(state, getValidActions(state));
  if (actions.length === 0) throw new Error('AI opponent has no valid actions');
  if (actions.length === 1) return actions[0];

  const startTime = Date.now();
  let bestAction = actions[0];

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (Date.now() - startTime > timeLimitMs) break;

    let depthBestAction = actions[0];
    let depthBestValue = -Infinity;

    for (const action of actions) {
      if (Date.now() - startTime > timeLimitMs) break;

      let nextState: MillGameState;
      try {
        nextState = simulateAction(state, action, 'O');
      } catch (_) {
        continue;
      }

      const value = minimax(nextState, depth - 1, -Infinity, Infinity, nextState.turn === 'O', weights);

      if (value > depthBestValue) {
        depthBestValue = value;
        depthBestAction = action;
      }
    }

    bestAction = depthBestAction;
  }

  return bestAction;
}

/**
 * Returns the best action for player O using opening book + iterative deepening minimax.
 */
export function getBestMinimaxMove(
  state: MillGameState,
  depth: number = 6,
  weights: StrategyWeights = DEFAULT_WEIGHTS
): AiAction {
  // ── Opening Book ────────────────────────────────────────────────────────────
  // Only use the book during the placement phase and for the first few moves.
  // After 6 pieces are on the board, the game tree is specific enough that
  // minimax outperforms any hand-coded book.
  if (state.phase === 'placement') {
    const totalPieces = state.board.filter(c => c !== null).length;

    if (totalPieces <= 4) {
      // Try to find a book entry for this exact position
      const boardKey = getBoardKey(state.board);
      const bookMove = OPENING_BOOK.get(boardKey);

      if (bookMove !== undefined && state.board[bookMove] === null) {
        return { type: 'place', position: bookMove };
      }

      // Fallback: always prefer a free middle-ring cross-point (9, 11, 13, 15).
      // These are the best positions on the board — 3-mill junctions.
      // Priority: take one that shares a mill line with our existing pieces (to build threats).
      const crossPoints = [9, 11, 13, 15];

      // Find which cross-points O already owns
      const oOwnedCross = crossPoints.filter(p => state.board[p] === 'O');

      if (oOwnedCross.length > 0) {
        // We have at least one cross-point. Look for an adjacent (same mill line) free cross-point.
        for (const ours of oOwnedCross) {
          for (const candidate of crossPoints) {
            if (state.board[candidate] === null) {
              // Check if they share a mill line (would create a 2-in-line threat)
              const sharesMill = MILLS.some(line =>
                line.includes(ours) && line.includes(candidate)
              );
              if (sharesMill) {
                return { type: 'place', position: candidate };
              }
            }
          }
        }
      }

      // No adjacent cross-point available — take any free cross-point
      for (const p of crossPoints) {
        if (state.board[p] === null) {
          return { type: 'place', position: p };
        }
      }
    }
  }

  tt.clear();

  // 4000ms for human-facing games (feels responsive while thinking deeply).
  // Tournament scripts benefit from the faster 1500ms default.
  return iterativeDeepening(state, depth, weights, 4000);
}
