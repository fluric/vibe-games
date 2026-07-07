import { PlayerPiece, ReversiGameState } from '@vibe-games/shared';
import { getReversiAiAction } from './reversiAi';

export const ReversiEngine = {
  createInitialState(): ReversiGameState {
    const board = Array(64).fill(null);
    board[27] = 'O'; // 3*8 + 3
    board[28] = 'X'; // 3*8 + 4
    board[35] = 'X'; // 4*8 + 3
    board[36] = 'O'; // 4*8 + 4

    return {
      board,
      turn: 'X', // Standard Reversi: Black (X) goes first
      winner: null,
    };
  },

  handleMove(state: ReversiGameState, action: any, player: PlayerPiece): ReversiGameState {
    if (state.winner) {
      throw new Error('Game is already finished');
    }
    if (state.turn !== player) {
      throw new Error(`It is not player ${player}'s turn`);
    }

    const pos = action.position;
    if (pos === undefined || pos < 0 || pos > 64) {
      throw new Error('Invalid position');
    }

    let newBoard = [...state.board];
    let nextTurn = player === 'X' ? 'O' : 'X';
    let lastMoveIndex: number | undefined = undefined;

    // 64 represents a "pass" action when no valid moves exist
    if (pos === 64) {
      const legalMoves = getLegalMoves(state.board, player);
      if (legalMoves.length > 0) {
        throw new Error('Cannot pass when legal moves are available');
      }
      // Pass action accepted
    } else {
      if (state.board[pos] !== null) {
        throw new Error('Position is already occupied');
      }

      const flipped = getFlippedDiscs(state.board, pos, player);
      if (flipped.length === 0) {
        throw new Error('Invalid move: must flip at least one opponent disc');
      }

      newBoard[pos] = player;
      for (const flip of flipped) {
        newBoard[flip] = player;
      }
      lastMoveIndex = pos;
    }

    // Determine the next turn and check if the game is over
    let nextWinner = null;
    const opponent = player === 'X' ? 'O' : 'X';
    const opponentMoves = getLegalMoves(newBoard, opponent);

    if (opponentMoves.length === 0) {
      const playerMoves = getLegalMoves(newBoard, player);
      if (playerMoves.length === 0) {
        // Neither player can move. Game is over.
        nextWinner = determineWinner(newBoard);
      } else {
        // Opponent has no moves, but player does. Turn skips back to player.
        nextTurn = player;
      }
    }

    return {
      board: newBoard,
      turn: nextTurn as PlayerPiece,
      winner: nextWinner,
      lastMoveIndex,
    };
  },

  getAiAction(state: ReversiGameState, botType: string, depth: number, weights: any, timeLimitMs: number): any {
    return getReversiAiAction(state, botType as any, depth, weights, timeLimitMs);
  }
};

export const DIRECTIONS = [
  -9, -8, -7,
  -1,      1,
   7,  8,  9
];

/**
 * Returns an array of indices that would be flipped if `player` placed a piece at `pos`.
 */
export function getFlippedDiscs(board: (PlayerPiece | null)[], pos: number, player: PlayerPiece): number[] {
  const flipped: number[] = [];
  const opponent = player === 'X' ? 'O' : 'X';

  const row = Math.floor(pos / 8);
  const col = pos % 8;

  for (const dir of DIRECTIONS) {
    let r = row;
    let c = col;
    let currentDirFlipped: number[] = [];

    while (true) {
      // Step in direction
      if (dir === -9) { r--; c--; }
      else if (dir === -8) { r--; }
      else if (dir === -7) { r--; c++; }
      else if (dir === -1) { c--; }
      else if (dir === 1) { c++; }
      else if (dir === 7) { r++; c--; }
      else if (dir === 8) { r++; }
      else if (dir === 9) { r++; c++; }

      if (r < 0 || r >= 8 || c < 0 || c >= 8) break; // Off board

      const idx = r * 8 + c;
      const cell = board[idx];

      if (cell === opponent) {
        currentDirFlipped.push(idx);
      } else if (cell === player) {
        if (currentDirFlipped.length > 0) {
          flipped.push(...currentDirFlipped);
        }
        break; // Reached own piece, this direction is valid
      } else {
        break; // Empty cell, this direction is invalid
      }
    }
  }

  return flipped;
}

/**
 * Returns a list of all legal placement indices for the given player.
 */
export function getLegalMoves(board: (PlayerPiece | null)[], player: PlayerPiece): number[] {
  const moves: number[] = [];
  for (let i = 0; i < 64; i++) {
    if (board[i] === null && getFlippedDiscs(board, i, player).length > 0) {
      moves.push(i);
    }
  }
  return moves;
}

export function determineWinner(board: (PlayerPiece | null)[]): PlayerPiece | 'draw' {
  let xCount = 0;
  let oCount = 0;
  for (let i = 0; i < 64; i++) {
    if (board[i] === 'X') xCount++;
    else if (board[i] === 'O') oCount++;
  }

  if (xCount > oCount) return 'X';
  if (oCount > xCount) return 'O';
  return 'draw';
}
