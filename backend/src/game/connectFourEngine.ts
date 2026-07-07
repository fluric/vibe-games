import { PlayerPiece, ConnectFourGameState } from '@vibe-games/shared';
import { getConnectFourAiAction } from './connectFourAi';

export const ConnectFourEngine = {
  createInitialState(): ConnectFourGameState {
    return {
      board: Array(42).fill(null),
      turn: 'X',
      winner: null,
    };
  },

  handleMove(state: ConnectFourGameState, action: any, player: PlayerPiece): ConnectFourGameState {
    // Action is: { action: 'place', column: number }
    if (state.winner) {
      throw new Error('Game is already finished');
    }
    if (state.turn !== player) {
      throw new Error(`It is not player ${player}'s turn`);
    }
    const column = action.column !== undefined ? action.column : action.position;
    if (column === undefined || column < 0 || column > 6) {
      throw new Error('Invalid column choice');
    }

    // Find lowest empty slot in that column
    // Columns are 0-6. Rows are 0-5. Position = row * 7 + col.
    let targetRow = -1;
    for (let r = 5; r >= 0; r--) {
      if (state.board[r * 7 + column] === null) {
        targetRow = r;
        break;
      }
    }

    if (targetRow === -1) {
      throw new Error('Column is full');
    }

    const newBoard = [...state.board];
    newBoard[targetRow * 7 + column] = player;

    // Check for win
    let nextWinner: PlayerPiece | 'draw' | null = null;
    if (checkWinCondition(newBoard, player)) {
      nextWinner = player;
    } else if (newBoard.every(cell => cell !== null)) {
      nextWinner = 'draw';
    }

    return {
      board: newBoard,
      turn: player === 'X' ? 'O' : 'X',
      winner: nextWinner,
      lastMoveIndex: targetRow * 7 + column,
    };
  },

  getAiAction(state: ConnectFourGameState, botType: string, depth: number, weights: any, timeLimitMs: number): any {
    return getConnectFourAiAction(state, botType as any, depth, weights, timeLimitMs);
  }
};

function checkWinCondition(board: (PlayerPiece | null)[], player: PlayerPiece): boolean {
  // Check horizontal
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

  // Check vertical
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

  // Check diagonal (top-left to bottom-right)
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

  // Check diagonal (bottom-left to top-right)
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
