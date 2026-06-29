import { MillGameState, PlayerPiece } from '@vibe-games/shared';
import { handlePlaceAction, handleMoveAction, handleRemoveAction } from '../millEngine';
import { ADJACENCY_LIST, isPieceInMill, areAllPiecesInMills, MILLS, POSITION_MILLS } from '../millRules';

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

  // ── Move 2 is intentionally not in the book. ──────────────────────────────
  // After O's first cross-point move, minimax + positional values handle
  // the second placement better than hardcoded rules.
  // NOTE: No two cross-points (9,11,13,15) share a mill line, so any
  // "adjacency" heuristic would always fall through to cross-point fallback.
]);

// ── X-Side Opening Book (for the first player) ────────────────────────────────
// When the Oracle plays as X (first player) in tournament inversion, the engine
// inverts the board so X always looks like O. BUT for self-play analysis, we need
// to understand: when Oracle takes 9 first and opponent mirrors with 13, then X
// needs a non-cross-point 3rd move to avoid the symmetric 2-2 split.
//
// Strategy for X's 3rd move (after X:9, O:13, X:?):
// Instead of taking another cross-point (11 or 15, which O mirrors perfectly),
// take a spoke that extends 9 → builds a 2-in-a-row.
// Best choices: 17 (inner spoke 1-9-17), or 1 (outer spoke 1-9-17 other end),
// or 8 (middle ring 8-9-10, connects 9 to the ring).
const X_OPENING_BOOK: Map<string, number> = new Map([
  // X's 1st move (board is empty): always take 9 (best cross-point)
  ['........................', 9],

  // X's 2nd move: board has X@9 + O's response
  // O took 13 (opposite) → X extends 9 via spoke: take 17 (inner) or 1 (outer)
  // 17 connects to 9 via the 1-9-17 mill line (taking 1 later completes it)
  ['.........O...X..........', 17],  // X@9, O@13 → X takes 17 (O is bot, X is opponent)
  // O took 11 (adjacent) → X takes 13 to control two opposite cross-points
  ['.........OX.............', 13],  // X@9, O@11 → X takes 13
  // O took 15 (adjacent other side) → X takes 11
  ['.........O.....X........', 11],  // X@9, O@15 → X takes 11
  // O took non-cross-point → X takes 13 (second cross-point)
  ['X........O..............', 13],  // X@9, O@0 → X takes 13
  ['.X.......O..............', 13],  // X@9, O@1 → X takes 13
  ['..X......O..............', 13],  // X@9, O@2 → X takes 13

  // X's 3rd move: after X@9 + X@17, O has two pieces
  // Now X wants to complete the 1-9-17 mill → take 1
  ['.O.......O.....X.X......', 1],   // X:9,17 O:11,15 → take 1 (threatens mill)
  ['.........O.X...X.O......', 1],   // variation → take 1
]);


/**
 * Creates a compact board key for the opening book lookup.
 */
function getBoardKey(board: (PlayerPiece | null)[]): string {
  return board.map(c => c === null ? '.' : c).join('');
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
      const lines = POSITION_MILLS[i] || [];
      for (const line of lines) {
        const other0 = line[0] === i ? line[1] : line[0];
        const other1 = line[2] === i ? line[1] : line[2];
        if (board[other0] === player && board[other1] === player) {
          millsFormed++;
        }
      }
      if (millsFormed >= 2) {
        forks++;
      }
    }
  }
  return forks;
}

// Precomputed seesaw configurations in Nine Men's Morris.
// A seesaw consists of two parallel mills connected by a midpoint spoke slider path (posA <-> posB).
// millA and millB contain the OTHER two positions that must be occupied by the player for each mill.
const SEESAWS = [
  { posA: 1, posB: 9, millA: [0, 2], millB: [8, 10] },
  { posA: 3, posB: 11, millA: [2, 4], millB: [10, 12] },
  { posA: 5, posB: 13, millA: [4, 6], millB: [12, 14] },
  { posA: 7, posB: 15, millA: [6, 0], millB: [14, 8] },
  { posA: 9, posB: 17, millA: [8, 10], millB: [16, 18] },
  { posA: 11, posB: 19, millA: [10, 12], millB: [18, 20] },
  { posA: 13, posB: 21, millA: [12, 14], millB: [20, 22] },
  { posA: 15, posB: 23, millA: [14, 8], millB: [22, 16] },
];

/**
 * Counts seesaw (double-mill) configurations for a player.
 * A seesaw exists when a player has two parallel mills connected by a spoke, and
 * a single piece (the slider) can move back and forth along the spoke to alternately
 * close one mill (while opening the other) on every turn.
 */
function countSeesaws(board: (PlayerPiece | null)[], player: PlayerPiece): number {
  let seesaws = 0;
  for (const config of SEESAWS) {
    const ownerA = board[config.posA];
    const ownerB = board[config.posB];
    if ((ownerA === player && ownerB === null) || (ownerB === player && ownerA === null)) {
      if (board[config.millA[0]] === player && board[config.millA[1]] === player &&
          board[config.millB[0]] === player && board[config.millB[1]] === player) {
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
  const oOnBoard = state.piecesOnBoard.O;
  const xOnBoard = state.piecesOnBoard.X;
  const oCount = oOnBoard + state.placementsRemaining.O;
  const xCount = xOnBoard + state.placementsRemaining.X;
  const isPlacement = state.phase === 'placement';

  // ── 1. Material (total pieces) ────────────────────────────────────────────
  const materialScore = (oCount - xCount) * weights.material;

  // ── 2. Active mills + 3. Mill threats (2-in-a-row with empty) ────────────────
  let oMills = 0;
  let xMills = 0;
  let oThreats = 0;
  let xThreats = 0;

  for (const line of MILLS) {
    const p1 = board[line[0]];
    const p2 = board[line[1]];
    const p3 = board[line[2]];

    if (p1 === 'O' && p2 === 'O' && p3 === 'O') {
      oMills++;
    } else if (p1 === 'X' && p2 === 'X' && p3 === 'X') {
      xMills++;
    } else {
      let oPieces = 0;
      let xPieces = 0;
      let nullCount = 0;

      if (p1 === 'O') oPieces++; else if (p1 === 'X') xPieces++; else nullCount++;
      if (p2 === 'O') oPieces++; else if (p2 === 'X') xPieces++; else nullCount++;
      if (p3 === 'O') oPieces++; else if (p3 === 'X') xPieces++; else nullCount++;

      if (nullCount === 1) {
        if (oPieces === 2) oThreats++;
        else if (xPieces === 2) xThreats++;
      }
    }
  }

  const millScore = (oMills - xMills) * weights.mill;
  const threatScore = (oThreats - xThreats) * weights.threat;

  // ── 4. Blocked pieces + Mobility (movement phase only) ───────────────────
  let blockedScore = 0;
  let mobilityScore = 0;
  if (!isPlacement) {
    let oBlocked = 0;
    let xBlocked = 0;
    let oMoves = 0;
    let xMoves = 0;

    const canOFly = oOnBoard === 3;
    const canXFly = xOnBoard === 3;
    const emptyCount = board.filter(c => c === null).length;

    for (let i = 0; i < board.length; i++) {
      const cell = board[i];
      if (cell === 'O') {
        if (canOFly) {
          oMoves += emptyCount;
        } else {
          const neighbors = ADJACENCY_LIST[i] || [];
          let freeNeighbors = 0;
          for (const n of neighbors) {
            if (board[n] === null) freeNeighbors++;
          }
          if (freeNeighbors === 0) oBlocked++;
          oMoves += freeNeighbors;
        }
      } else if (cell === 'X') {
        if (canXFly) {
          xMoves += emptyCount;
        } else {
          const neighbors = ADJACENCY_LIST[i] || [];
          let freeNeighbors = 0;
          for (const n of neighbors) {
            if (board[n] === null) freeNeighbors++;
          }
          if (freeNeighbors === 0) xBlocked++;
          xMoves += freeNeighbors;
        }
      }
    }
    blockedScore = (oBlocked - xBlocked) * weights.blocked;
    mobilityScore = (oMoves - xMoves) * (weights.mobility ?? 0);
  }

  // ── 5. Positional value (placement phase only) ───────────────────────────
  let positionalScore = 0;
  const positionalWeight = weights.positional ?? 15;
  if (positionalWeight > 0 && isPlacement) {
    let oPosVal = 0;
    let xPosVal = 0;
    for (let i = 0; i < board.length; i++) {
      if (board[i] === 'O') oPosVal += POSITION_VALUES[i];
      else if (board[i] === 'X') xPosVal += POSITION_VALUES[i];
    }
    positionalScore = (oPosVal - xPosVal) * positionalWeight;
  }

  // ── 6. Fork detection ────────────────────────────────────────────────────
  let forkScore = 0;
  const forkWeight = weights.fork ?? 0;
  if (forkWeight > 0) {
    const oForks = countForks(board, 'O');
    const xForks = countForks(board, 'X');
    forkScore = (oForks - xForks) * forkWeight;
  }

  // ── 7. Double-mill (seesaw) detection ────────────────────────────────────
  let seesawScore = 0;
  if (!isPlacement) {
    const oSeesaw = countSeesaws(board, 'O');
    const xSeesaw = countSeesaws(board, 'X');
    seesawScore = (oSeesaw - xSeesaw) * 300;
  }

  return materialScore + millScore + threatScore + blockedScore + mobilityScore + positionalScore + forkScore + seesawScore;
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
export function simulateAction(state: MillGameState, action: AiAction, player: PlayerPiece): MillGameState {
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

  let formsMill = false;
  const board = state.board;
  if (action.type === 'place') {
    const pos = action.position!;
    const lines = POSITION_MILLS[pos] || [];
    for (const line of lines) {
      const other0 = line[0] === pos ? line[1] : line[0];
      const other1 = line[2] === pos ? line[1] : line[2];
      if (board[other0] === player && board[other1] === player) {
        formsMill = true;
        break;
      }
    }
  } else if (action.type === 'move') {
    const from = action.from!;
    const to = action.to!;
    const lines = POSITION_MILLS[to] || [];
    for (const line of lines) {
      const other0 = line[0] === to ? line[1] : line[0];
      const other1 = line[2] === to ? line[1] : line[2];
      if (other0 !== from && other1 !== from && board[other0] === player && board[other1] === player) {
        formsMill = true;
        break;
      }
    }
  }

  if (formsMill) {
    score += 2000;
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
export function orderActions(state: MillGameState, actions: AiAction[], ttBestAction?: AiAction): AiAction[] {
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

export function getTTKey(state: MillGameState): string {
  return `${state.board.join(',')}|${state.phase}|${state.turn}|${state.piecesOnBoard.O}|${state.piecesOnBoard.X}|${state.placementsRemaining.O}|${state.placementsRemaining.X}|${state.millFormedThisTurn ? 1 : 0}|${state.movesSinceLastCapture}`;
}

// ─── Minimax with Alpha-Beta + TT ─────────────────────────────────────────────

