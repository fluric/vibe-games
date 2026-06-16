import { PlayerPiece } from '@vibe-games/shared';

// The 24 board positions mapped as indexes 0 to 23.
// Consists of 3 concentric squares (Rings):
// Ring 0 (Outer): 0 to 7
// Ring 1 (Middle): 8 to 15
// Ring 2 (Inner): 16 to 23
// On each ring, position offsets are:
// 0: Top-Left, 1: Top-Mid, 2: Top-Right, 3: Mid-Right,
// 4: Bottom-Right, 5: Bottom-Mid, 6: Bottom-Left, 7: Mid-Left.

export const ADJACENCY_LIST: Record<number, number[]> = {
  0: [1, 7],
  1: [0, 2, 9],
  2: [1, 3],
  3: [2, 4, 11],
  4: [3, 5],
  5: [4, 6, 13],
  6: [5, 7],
  7: [6, 0, 15],
  8: [9, 15],
  9: [8, 10, 1, 17],
  10: [9, 11],
  11: [10, 12, 3, 19],
  12: [11, 13],
  13: [12, 14, 5, 21],
  14: [13, 15],
  15: [14, 8, 7, 23],
  16: [17, 23],
  17: [16, 18, 9],
  18: [17, 19],
  19: [18, 20, 11],
  20: [19, 21],
  21: [20, 22, 13],
  22: [21, 23],
  23: [22, 16, 15],
};

// The 16 possible mills (lines of 3) on the board.
export const MILLS: number[][] = [
  // Outer Ring
  [0, 1, 2],
  [2, 3, 4],
  [4, 5, 6],
  [6, 7, 0],
  // Middle Ring
  [8, 9, 10],
  [10, 11, 12],
  [12, 13, 14],
  [14, 15, 8],
  // Inner Ring
  [16, 17, 18],
  [18, 19, 20],
  [20, 21, 22],
  [22, 23, 16],
  // Cross-ring connectors
  [1, 9, 17],
  [3, 11, 19],
  [5, 13, 21],
  [7, 15, 23],
];

// Precomputed lookup map for which mills contain which node indices
export const POSITION_MILLS: Record<number, number[][]> = {};
for (let i = 0; i < 24; i++) {
  POSITION_MILLS[i] = MILLS.filter(line => line.includes(i));
}

/**
 * Checks if two positions are adjacent on the board.
 */
export function isAdjacent(from: number, to: number): boolean {
  const neighbors = ADJACENCY_LIST[from];
  return neighbors ? neighbors.includes(to) : false;
}

/**
 * Gets all mills currently occupied by a specific player on the board.
 */
export function getMillsForPlayer(board: (PlayerPiece | null)[], player: PlayerPiece): number[][] {
  return MILLS.filter((mill) =>
    mill.every((position) => board[position] === player)
  );
}

/**
 * Detects if a move formed a new mill.
 * A mill is newly formed if it is complete in the new board state but was not complete in the previous board state.
 */
export function didFormNewMill(
  boardBefore: (PlayerPiece | null)[],
  boardAfter: (PlayerPiece | null)[],
  player: PlayerPiece
): boolean {
  let filledPos = -1;
  for (let i = 0; i < boardAfter.length; i++) {
    if (boardBefore[i] !== player && boardAfter[i] === player) {
      filledPos = i;
      break;
    }
  }

  if (filledPos === -1) return false;

  const lines = POSITION_MILLS[filledPos] || [];
  for (const line of lines) {
    if (boardAfter[line[0]] === player && boardAfter[line[1]] === player && boardAfter[line[2]] === player) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a player has any valid moves available from their current positions.
 */
export function hasValidMoves(board: (PlayerPiece | null)[], player: PlayerPiece): boolean {
  for (let i = 0; i < board.length; i++) {
    if (board[i] === player) {
      const neighbors = ADJACENCY_LIST[i] || [];
      if (neighbors.some((neighbor) => board[neighbor] === null)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks if a piece is part of any active mill for that player.
 */
export function isPieceInMill(board: (PlayerPiece | null)[], position: number, player: PlayerPiece): boolean {
  const lines = POSITION_MILLS[position] || [];
  for (const line of lines) {
    if (board[line[0]] === player && board[line[1]] === player && board[line[2]] === player) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if all of a player's pieces on the board are currently part of mills.
 * This is used to determine if a player can remove a piece that is in a mill
 * (since standard rules state you cannot remove a piece in a mill unless only mill pieces exist).
 */
export function areAllPiecesInMills(board: (PlayerPiece | null)[], player: PlayerPiece): boolean {
  for (let i = 0; i < board.length; i++) {
    if (board[i] === player && !isPieceInMill(board, i, player)) {
      return false;
    }
  }
  return true;
}

