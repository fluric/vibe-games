import { PlayerPiece } from '@vibe-games/shared';
import {
  ADJACENCY_LIST,
  didFormNewMill,
  isAdjacent,
  isPieceInMill,
  areAllPiecesInMills,
} from './millRules';

/**
 * Returns the best position to place a piece for the AI.
 */
export function getBestPlaceMove(board: (PlayerPiece | null)[]): number {
  const opponent: PlayerPiece = 'X';
  const ai: PlayerPiece = 'O';

  const emptyPositions: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) {
      emptyPositions.push(i);
    }
  }

  if (emptyPositions.length === 0) {
    throw new Error('No empty positions to place a piece');
  }

  // Heuristic 1: Can the AI form a mill on this turn?
  for (const pos of emptyPositions) {
    const simulatedBoard = [...board];
    simulatedBoard[pos] = ai;
    if (didFormNewMill(board, simulatedBoard, ai)) {
      return pos;
    }
  }

  // Heuristic 2: Can the opponent form a mill on their next turn? If yes, block it!
  for (const pos of emptyPositions) {
    const simulatedBoard = [...board];
    simulatedBoard[pos] = opponent;
    if (didFormNewMill(board, simulatedBoard, opponent)) {
      return pos;
    }
  }

  // Heuristic 3: Prefer cross-ring midpoint positions (they offer higher connectivity)
  const preferredMidpoints = [9, 11, 13, 15, 1, 3, 5, 7, 17, 19, 21, 23];
  for (const pos of preferredMidpoints) {
    if (emptyPositions.includes(pos)) {
      return pos;
    }
  }

  // Heuristic 4: Pick the first available empty position
  return emptyPositions[0];
}

/**
 * Returns the best movement action (from -> to) for the AI.
 */
export function getBestMove(
  board: (PlayerPiece | null)[],
  canFly: boolean
): { from: number; to: number } {
  const opponent: PlayerPiece = 'X';
  const ai: PlayerPiece = 'O';

  // Find all AI pieces
  const aiPieces: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === ai) {
      aiPieces.push(i);
    }
  }

  const validMoves: { from: number; to: number }[] = [];
  const emptyPositions: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) {
      emptyPositions.push(i);
    }
  }

  // Generate all valid moves
  for (const from of aiPieces) {
    if (canFly) {
      for (const to of emptyPositions) {
        validMoves.push({ from, to });
      }
    } else {
      const neighbors = ADJACENCY_LIST[from] || [];
      for (const to of neighbors) {
        if (board[to] === null) {
          validMoves.push({ from, to });
        }
      }
    }
  }

  if (validMoves.length === 0) {
    throw new Error('AI opponent has no valid moves');
  }

  // Heuristic 1: Can we form a mill? If yes, take it!
  for (const move of validMoves) {
    const simulatedBoard = [...board];
    simulatedBoard[move.from] = null;
    simulatedBoard[move.to] = ai;
    if (didFormNewMill(board, simulatedBoard, ai)) {
      return move;
    }
  }

  // Heuristic 2: Can we block the opponent from forming a mill?
  // First, find all empty spots where the opponent can move and form a mill
  const opponentPieces: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === opponent) {
      opponentPieces.push(i);
    }
  }
  const opponentCanFly = opponentPieces.length === 3;

  const opponentMillThreats: number[] = [];
  for (const from of opponentPieces) {
    const targets = opponentCanFly ? emptyPositions : (ADJACENCY_LIST[from] || []);
    for (const to of targets) {
      if (board[to] === null) {
        const simulatedBoard = [...board];
        simulatedBoard[from] = null;
        simulatedBoard[to] = opponent;
        if (didFormNewMill(board, simulatedBoard, opponent)) {
          opponentMillThreats.push(to);
        }
      }
    }
  }

  // If there are threats, check if any of our valid moves can block a threat spot
  if (opponentMillThreats.length > 0) {
    for (const move of validMoves) {
      if (opponentMillThreats.includes(move.to)) {
        return move;
      }
    }
  }

  // Heuristic 3: Default to a random valid move
  const randomIndex = Math.floor(Math.random() * validMoves.length);
  return validMoves[randomIndex];
}

/**
 * Returns the best opponent position for the AI to remove.
 */
export function getBestRemoval(board: (PlayerPiece | null)[]): number {
  const opponent: PlayerPiece = 'X';

  const opponentPieces: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === opponent) {
      opponentPieces.push(i);
    }
  }

  if (opponentPieces.length === 0) {
    throw new Error('No opponent pieces to remove');
  }

  const allInMills = areAllPiecesInMills(board, opponent);

  // Heuristic 1: Remove a piece that is not in a mill
  for (const pos of opponentPieces) {
    if (allInMills || !isPieceInMill(board, pos, opponent)) {
      return pos;
    }
  }

  // Heuristic 2: Fallback to the first opponent piece
  return opponentPieces[0];
}
