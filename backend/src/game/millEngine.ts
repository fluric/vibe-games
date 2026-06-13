import { MillGameState, PlayerPiece } from '@vibe-games/shared';
import {
  isAdjacent,
  didFormNewMill,
  hasValidMoves,
  isPieceInMill,
  areAllPiecesInMills,
} from './millRules';

/**
 * Creates the default initial state for a new Nine Men's Morris game.
 */
export function createInitialState(): MillGameState {
  return {
    board: Array(24).fill(null),
    phase: 'placement',
    placementsRemaining: {
      X: 9,
      O: 9,
    },
    piecesOnBoard: {
      X: 0,
      O: 0,
    },
    turn: 'X',
    winner: null,
    millFormedThisTurn: false,
    movesSinceLastCapture: 0,
  };
}

function getNextPhase(
  placementsRemaining: { X: number; O: number },
  piecesOnBoard: { X: number; O: number },
  nextTurn: PlayerPiece
): 'placement' | 'movement' | 'flying' {
  if (placementsRemaining.X > 0 || placementsRemaining.O > 0) {
    return 'placement';
  }
  if (piecesOnBoard[nextTurn] === 3) {
    return 'flying';
  }
  return 'movement';
}

/**
 * Executes a placing action.
 */
export function handlePlaceAction(
  state: MillGameState,
  position: number,
  player: PlayerPiece
): MillGameState {
  // 1. Validation
  if (state.winner) {
    throw new Error('Game is already finished');
  }
  if (state.turn !== player) {
    throw new Error(`It is not player ${player}'s turn`);
  }
  if (state.millFormedThisTurn) {
    throw new Error('Player must remove an opponent piece first');
  }
  if (state.phase !== 'placement') {
    throw new Error('Placing phase is over');
  }
  if (state.placementsRemaining[player] <= 0) {
    throw new Error(`Player ${player} has no placements remaining`);
  }
  if (position < 0 || position >= 24) {
    throw new Error('Invalid board position');
  }
  if (state.board[position] !== null) {
    throw new Error('Position is already occupied');
  }

  // 2. State Modifications
  const newBoard = [...state.board];
  newBoard[position] = player;

  const newPlacements = { ...state.placementsRemaining };
  newPlacements[player] -= 1;

  const newPiecesOnBoard = { ...state.piecesOnBoard };
  newPiecesOnBoard[player] += 1;

  // Check if a mill is formed
  const millCreated = didFormNewMill(state.board, newBoard, player);

  let nextTurn: PlayerPiece = state.turn;
  let millPending: boolean = state.millFormedThisTurn;
  const currentCount = state.movesSinceLastCapture ?? 0;
  let nextMovesSinceLastCapture = currentCount;

  if (millCreated) {
    millPending = true;
  } else {
    nextTurn = player === 'X' ? 'O' : 'X';
    nextMovesSinceLastCapture = currentCount + 1;
  }

  const nextPhase = getNextPhase(newPlacements, newPiecesOnBoard, nextTurn);

  let nextWinner: PlayerPiece | 'draw' | null = state.winner;
  if (nextWinner === null) {
    if (nextPhase === 'movement' && !millCreated && !hasValidMoves(newBoard, nextTurn)) {
      nextWinner = player;
    } else if (nextMovesSinceLastCapture >= 50) {
      nextWinner = 'draw';
    }
  }

  return {
    ...state,
    board: newBoard,
    phase: nextPhase,
    placementsRemaining: newPlacements,
    piecesOnBoard: newPiecesOnBoard,
    turn: nextTurn,
    millFormedThisTurn: millPending,
    movesSinceLastCapture: nextMovesSinceLastCapture,
    winner: nextWinner,
  };
}

/**
 * Executes a moving action (includes standard movement and flying).
 */
export function handleMoveAction(
  state: MillGameState,
  from: number,
  to: number,
  player: PlayerPiece
): MillGameState {
  // 1. Validation
  if (state.winner) {
    throw new Error('Game is already finished');
  }
  if (state.turn !== player) {
    throw new Error(`It is not player ${player}'s turn`);
  }
  if (state.millFormedThisTurn) {
    throw new Error('Player must remove an opponent piece first');
  }
  if (state.phase === 'placement') {
    throw new Error('Placing phase is still active');
  }
  if (from < 0 || from >= 24 || to < 0 || to >= 24) {
    throw new Error('Invalid board positions');
  }
  if (state.board[from] !== player) {
    throw new Error(`Player ${player} does not have a piece at position ${from}`);
  }
  if (state.board[to] !== null) {
    throw new Error(`Position ${to} is already occupied`);
  }

  const isFlying = state.piecesOnBoard[player] === 3;
  if (!isFlying && !isAdjacent(from, to)) {
    throw new Error(`Position ${to} is not adjacent to position ${from}`);
  }

  // 2. State Modifications
  const newBoard = [...state.board];
  newBoard[from] = null;
  newBoard[to] = player;

  // Check if a mill is formed
  const millCreated = didFormNewMill(state.board, newBoard, player);

  let nextTurn: PlayerPiece = state.turn;
  let millPending: boolean = state.millFormedThisTurn;
  const currentCount = state.movesSinceLastCapture ?? 0;
  let nextMovesSinceLastCapture = currentCount;

  if (millCreated) {
    millPending = true;
  } else {
    nextTurn = player === 'X' ? 'O' : 'X';
    nextMovesSinceLastCapture = currentCount + 1;
  }

  const nextPhase = getNextPhase(state.placementsRemaining, state.piecesOnBoard, nextTurn);

  let nextState: MillGameState = {
    ...state,
    board: newBoard,
    phase: nextPhase,
    turn: nextTurn,
    millFormedThisTurn: millPending,
    movesSinceLastCapture: nextMovesSinceLastCapture,
  };

  // 3. Post-move checks (e.g. check if opponent is blocked)
  if (!millCreated) {
    const opponent = nextTurn;
    const opponentCanFly = nextState.piecesOnBoard[opponent] === 3;
    // Opponent is blocked if they cannot fly and have no valid moves left
    if (!opponentCanFly && !hasValidMoves(newBoard, opponent)) {
      nextState.winner = player;
      nextState.phase = 'movement'; // Keep stable
    }
  }

  if (nextState.winner === null && nextMovesSinceLastCapture >= 50) {
    nextState.winner = 'draw';
  }

  return nextState;
}

/**
 * Executes a piece removal action after forming a mill.
 */
export function handleRemoveAction(
  state: MillGameState,
  position: number,
  player: PlayerPiece
): MillGameState {
  // 1. Validation
  if (state.winner) {
    throw new Error('Game is already finished');
  }
  if (state.turn !== player) {
    throw new Error(`It is not player ${player}'s turn`);
  }
  if (!state.millFormedThisTurn) {
    throw new Error('No mill was formed this turn; cannot remove piece');
  }
  if (position < 0 || position >= 24) {
    throw new Error('Invalid board position');
  }

  const opponent = player === 'X' ? 'O' : 'X';
  if (state.board[position] !== opponent) {
    throw new Error(`No opponent piece at position ${position}`);
  }

  // Enforce the rule: Cannot remove a piece in a mill unless all opponent's pieces are in mills
  if (isPieceInMill(state.board, position, opponent) && !areAllPiecesInMills(state.board, opponent)) {
    throw new Error('Cannot remove a piece that is part of a mill unless all opponent pieces are in mills');
  }

  // 2. State Modifications
  const newBoard = [...state.board];
  newBoard[position] = null;

  const newPiecesOnBoard = { ...state.piecesOnBoard };
  newPiecesOnBoard[opponent] -= 1;

  let nextWinner: PlayerPiece | 'draw' | null = state.winner;
  let nextTurn: PlayerPiece = player === 'X' ? 'O' : 'X'; // Pass turn after removal is complete

  // 3. Check for Win/Loss Condition
  const opponentPlacements = state.placementsRemaining[opponent];
  // If opponent is reduced to less than 3 pieces on the board and has no placements remaining, current player wins
  if (newPiecesOnBoard[opponent] < 3 && opponentPlacements === 0) {
    nextWinner = player;
  } else {
    // If opponent has no placements left and is blocked, current player wins
    if (opponentPlacements === 0 && newPiecesOnBoard[opponent] > 3 && !hasValidMoves(newBoard, opponent)) {
      nextWinner = player;
    }
  }

  const nextPhase = getNextPhase(state.placementsRemaining, newPiecesOnBoard, nextTurn);

  return {
    ...state,
    board: newBoard,
    phase: nextPhase,
    piecesOnBoard: newPiecesOnBoard,
    turn: nextTurn,
    millFormedThisTurn: false, // Reset removal flag
    winner: nextWinner,
    movesSinceLastCapture: 0, // Reset draw counter on capture
  };
}
