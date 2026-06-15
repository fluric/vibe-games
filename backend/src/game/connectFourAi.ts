import { PlayerPiece, ConnectFourGameState } from '@vibe-games/shared';

// Column search priority order (center-outwards) to maximize alpha-beta pruning efficiency
const COLUMN_ORDER = [3, 2, 4, 1, 5, 0, 6];

interface TranspositionEntry {
  depth: number;
  score: number;
  flag: 'exact' | 'lower' | 'upper';
}

const memoTable = new Map<string, TranspositionEntry>();

export interface ConnectFourAiAction {
  type: 'place';
  column: number;
  position: number;
}

/**
 * Connect Four AI Action Dispatcher
 */
export function getConnectFourAiAction(
  state: ConnectFourGameState,
  botType: string,
  depth: number = 4,
  weights?: any,
  timeLimitMs: number = 1500
): ConnectFourAiAction {
  if (botType === 'random') {
    const valid = getValidColumns(state.board);
    if (valid.length === 0) {
      throw new Error('AI opponent has no valid actions');
    }
    const randomCol = valid[Math.floor(Math.random() * valid.length)];
    return { type: 'place', column: randomCol, position: randomCol };
  }

  // Clear memoization table before a new search to keep memory fresh
  memoTable.clear();

  const aiPiece = state.turn;
  const opponentPiece = aiPiece === 'X' ? 'O' : 'X';

  let bestScore = -Infinity;
  let bestCol = -1;

  const validCols = getValidColumns(state.board);
  if (validCols.length === 0) {
    throw new Error('AI opponent has no valid actions');
  }

  // Quick opening move: if the board is completely empty, grab the center column immediately
  if (state.board.every(cell => cell === null)) {
    return { type: 'place', column: 3, position: 3 };
  }

  // Order columns for the root search
  const orderedCols = COLUMN_ORDER.filter(c => validCols.includes(c));

  // Determine actual search depth based on game state occupancy (search deeper in end-game)
  const piecesPlaced = state.board.filter(cell => cell !== null).length;
  let actualDepth = depth;
  if (piecesPlaced > 30) {
    actualDepth = depth + 3; // search deeper when board is near full
  } else if (piecesPlaced > 20) {
    actualDepth = depth + 1;
  }

  for (const col of orderedCols) {
    const nextBoard = makeVirtualMove(state.board, col, aiPiece);
    const score = minimax(nextBoard, actualDepth - 1, false, -Infinity, Infinity, aiPiece, opponentPiece);

    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }

  // Fallback if no column selected
  if (bestCol === -1) {
    bestCol = validCols[0];
  }

  return { type: 'place', column: bestCol, position: bestCol };
}

function getValidColumns(board: (PlayerPiece | null)[]): number[] {
  const valid: number[] = [];
  for (let c = 0; c < 7; c++) {
    // Top row (row 0) must be empty
    if (board[c] === null) {
      valid.push(c);
    }
  }
  return valid;
}

function makeVirtualMove(board: (PlayerPiece | null)[], col: number, player: PlayerPiece): (PlayerPiece | null)[] {
  const newBoard = [...board];
  for (let r = 5; r >= 0; r--) {
    if (newBoard[r * 7 + col] === null) {
      newBoard[r * 7 + col] = player;
      break;
    }
  }
  return newBoard;
}

function checkWin(board: (PlayerPiece | null)[], player: PlayerPiece): boolean {
  // Horizontal
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const idx = r * 7 + c;
      if (
        board[idx] === player &&
        board[idx + 1] === player &&
        board[idx + 2] === player &&
        board[idx + 3] === player
      ) {
        return true;
      }
    }
  }

  // Vertical
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 7; c++) {
      const idx = r * 7 + c;
      if (
        board[idx] === player &&
        board[idx + 7] === player &&
        board[idx + 14] === player &&
        board[idx + 21] === player
      ) {
        return true;
      }
    }
  }

  // Diagonal (down-right)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const idx = r * 7 + c;
      if (
        board[idx] === player &&
        board[idx + 8] === player &&
        board[idx + 16] === player &&
        board[idx + 24] === player
      ) {
        return true;
      }
    }
  }

  // Diagonal (up-right)
  for (let r = 3; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const idx = r * 7 + c;
      if (
        board[idx] === player &&
        board[idx - 6] === player &&
        board[idx - 12] === player &&
        board[idx - 18] === player
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Minimax with Alpha-Beta Pruning and Transposition Table
 */
function minimax(
  board: (PlayerPiece | null)[],
  depth: number,
  isMaximizing: boolean,
  alpha: number,
  beta: number,
  aiPiece: PlayerPiece,
  opponentPiece: PlayerPiece
): number {
  const boardHash = board.map(c => c || '.').join('') + (isMaximizing ? 'M' : 'm');
  const cached = memoTable.get(boardHash);
  if (cached && cached.depth >= depth) {
    if (cached.flag === 'exact') return cached.score;
    if (cached.flag === 'lower') alpha = Math.max(alpha, cached.score);
    if (cached.flag === 'upper') beta = Math.min(beta, cached.score);
    if (alpha >= beta) return cached.score;
  }

  if (checkWin(board, aiPiece)) {
    return 100000 + depth; // reward faster wins
  }
  if (checkWin(board, opponentPiece)) {
    return -100000 - depth; // penalize faster losses
  }

  const validCols = getValidColumns(board);
  if (depth === 0 || validCols.length === 0) {
    const score = evaluateBoard(board, aiPiece, opponentPiece);
    memoTable.set(boardHash, { depth, score, flag: 'exact' });
    return score;
  }

  const orderedCols = COLUMN_ORDER.filter(c => validCols.includes(c));
  const alphaOrig = alpha;
  const betaOrig = beta;

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const col of orderedCols) {
      const nextBoard = makeVirtualMove(board, col, aiPiece);
      const evaluation = minimax(nextBoard, depth - 1, false, alpha, beta, aiPiece, opponentPiece);
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) {
        break; // beta prune
      }
    }
    let flag: 'exact' | 'lower' | 'upper' = 'exact';
    if (maxEval <= alphaOrig) flag = 'upper';
    else if (maxEval >= betaOrig) flag = 'lower';
    memoTable.set(boardHash, { depth, score: maxEval, flag });
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const col of orderedCols) {
      const nextBoard = makeVirtualMove(board, col, opponentPiece);
      const evaluation = minimax(nextBoard, depth - 1, true, alpha, beta, aiPiece, opponentPiece);
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) {
        break; // alpha prune
      }
    }
    let flag: 'exact' | 'lower' | 'upper' = 'exact';
    if (minEval <= alphaOrig) flag = 'upper';
    else if (minEval >= betaOrig) flag = 'lower';
    memoTable.set(boardHash, { depth, score: minEval, flag });
    return minEval;
  }
}

/**
 * Positional evaluation based on center column occupancy and sliding windows of 4.
 */
function evaluateBoard(board: (PlayerPiece | null)[], aiPiece: PlayerPiece, opponentPiece: PlayerPiece): number {
  let score = 0;

  // 1. Center column priority (column 3)
  for (let r = 0; r < 6; r++) {
    const cell = board[r * 7 + 3];
    if (cell === aiPiece) {
      score += 4;
    } else if (cell === opponentPiece) {
      score -= 4;
    }
  }

  // 2. Sliding windows of 4 evaluation
  // Horizontal windows
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const idx = r * 7 + c;
      const window = [board[idx], board[idx + 1], board[idx + 2], board[idx + 3]];
      score += evaluateWindow(window, aiPiece, opponentPiece);
    }
  }

  // Vertical windows
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 7; c++) {
      const idx = r * 7 + c;
      const window = [board[idx], board[idx + 7], board[idx + 14], board[idx + 21]];
      score += evaluateWindow(window, aiPiece, opponentPiece);
    }
  }

  // Diagonals (down-right)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const idx = r * 7 + c;
      const window = [board[idx], board[idx + 8], board[idx + 16], board[idx + 24]];
      score += evaluateWindow(window, aiPiece, opponentPiece);
    }
  }

  // Diagonals (up-right)
  for (let r = 3; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const idx = r * 7 + c;
      const window = [board[idx], board[idx - 6], board[idx - 12], board[idx - 18]];
      score += evaluateWindow(window, aiPiece, opponentPiece);
    }
  }

  return score;
}

function evaluateWindow(window: (PlayerPiece | null)[], aiPiece: PlayerPiece, opponentPiece: PlayerPiece): number {
  let aiCount = 0;
  let oppCount = 0;
  let emptyCount = 0;

  for (const cell of window) {
    if (cell === aiPiece) aiCount++;
    else if (cell === opponentPiece) oppCount++;
    else emptyCount++;
  }

  if (aiCount === 4) return 100000;
  if (oppCount === 4) return -100000;

  if (aiCount === 3 && emptyCount === 1) return 500;
  if (oppCount === 3 && emptyCount === 1) return -800; // block opponent very aggressively!

  if (aiCount === 2 && emptyCount === 2) return 10;
  if (oppCount === 2 && emptyCount === 2) return -10;

  return 0;
}
