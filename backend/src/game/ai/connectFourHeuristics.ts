import { PlayerPiece } from '@vibe-games/shared';
import { ConnectFourAiAction, ConnectFourWeights } from '../connectFourAi';

export const COLUMN_ORDER = [3, 2, 4, 1, 5, 0, 6];

export function getValidColumns(board: (PlayerPiece | null)[]): number[] {
  const validColumns: number[] = [];
  for (const col of COLUMN_ORDER) {
    if (board[col] === null) {
      validColumns.push(col);
    }
  }
  return validColumns;
}

export function makeVirtualMove(board: (PlayerPiece | null)[], col: number, player: PlayerPiece): (PlayerPiece | null)[] {
  const newBoard = [...board];
  for (let r = 5; r >= 0; r--) {
    const idx = r * 7 + col;
    if (newBoard[idx] === null) {
      newBoard[idx] = player;
      break;
    }
  }
  return newBoard;
}

export function checkWin(board: (PlayerPiece | null)[], player: PlayerPiece): boolean {
  // Horizontal
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      if (
        board[r * 7 + c] === player &&
        board[r * 7 + c + 1] === player &&
        board[r * 7 + c + 2] === player &&
        board[r * 7 + c + 3] === player
      ) return true;
    }
  }
  // Vertical
  for (let c = 0; c < 7; c++) {
    for (let r = 0; r < 3; r++) {
      if (
        board[r * 7 + c] === player &&
        board[(r + 1) * 7 + c] === player &&
        board[(r + 2) * 7 + c] === player &&
        board[(r + 3) * 7 + c] === player
      ) return true;
    }
  }
  // Diagonal (positive slope)
  for (let r = 3; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      if (
        board[r * 7 + c] === player &&
        board[(r - 1) * 7 + c + 1] === player &&
        board[(r - 2) * 7 + c + 2] === player &&
        board[(r - 3) * 7 + c + 3] === player
      ) return true;
    }
  }
  // Diagonal (negative slope)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      if (
        board[r * 7 + c] === player &&
        board[(r + 1) * 7 + c + 1] === player &&
        board[(r + 2) * 7 + c + 2] === player &&
        board[(r + 3) * 7 + c + 3] === player
      ) return true;
    }
  }
  return false;
}

export function evaluateBoard(
  board: (PlayerPiece | null)[],
  aiPiece: PlayerPiece,
  opponentPiece: PlayerPiece,
  weights: ConnectFourWeights
): number {
  let score = 0;
  let centerCount = 0;
  for (let r = 0; r < 6; r++) {
    if (board[r * 7 + 3] === aiPiece) centerCount++;
  }
  score += centerCount * (weights.centerColumn || 3);

  // Horizontal
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const window = [board[r * 7 + c], board[r * 7 + c + 1], board[r * 7 + c + 2], board[r * 7 + c + 3]];
      score += evaluateWindow(window, aiPiece, opponentPiece, weights);
    }
  }

  // Vertical
  for (let c = 0; c < 7; c++) {
    for (let r = 0; r < 3; r++) {
      const window = [board[r * 7 + c], board[(r + 1) * 7 + c], board[(r + 2) * 7 + c], board[(r + 3) * 7 + c]];
      score += evaluateWindow(window, aiPiece, opponentPiece, weights);
    }
  }

  // Positive Diagonal
  for (let r = 3; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const window = [board[r * 7 + c], board[(r - 1) * 7 + c + 1], board[(r - 2) * 7 + c + 2], board[(r - 3) * 7 + c + 3]];
      score += evaluateWindow(window, aiPiece, opponentPiece, weights);
    }
  }

  // Negative Diagonal
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const window = [board[r * 7 + c], board[(r + 1) * 7 + c + 1], board[(r + 2) * 7 + c + 2], board[(r + 3) * 7 + c + 3]];
      score += evaluateWindow(window, aiPiece, opponentPiece, weights);
    }
  }
  return score;
}

export function evaluateWindow(
  window: (PlayerPiece | null)[],
  aiPiece: PlayerPiece,
  opponentPiece: PlayerPiece,
  weights: ConnectFourWeights
): number {
  let score = 0;
  let aiCount = 0;
  let oppCount = 0;
  let emptyCount = 0;

  for (const cell of window) {
    if (cell === aiPiece) aiCount++;
    else if (cell === opponentPiece) oppCount++;
    else emptyCount++;
  }

  if (aiCount === 4) {
    score += 10000;
  } else if (aiCount === 3 && emptyCount === 1) {
    score += (weights.threeInARow || 5);
  } else if (aiCount === 2 && emptyCount === 2) {
    score += (weights.twoInARow || 2);
  }

  if (oppCount === 3 && emptyCount === 1) {
    score -= (weights.oppThreeInARow || 40);
  } else if (oppCount === 2 && emptyCount === 2) {
    score -= (weights.oppTwoInARow || 0); // Default ignores
  }

  return score;
}
