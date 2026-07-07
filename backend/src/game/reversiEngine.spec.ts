import assert from 'assert';
import { ReversiEngine, getFlippedDiscs, getLegalMoves } from './reversiEngine';
import { ReversiGameState } from '@vibe-games/shared';

async function runTests() {
  console.log('🧪 Starting Reversi Engine Tests...\n');

  console.log('👉 Testing: createInitialState');
  const state = ReversiEngine.createInitialState();
  assert.strictEqual(state.board.length, 64);
  assert.strictEqual(state.turn, 'X');
  assert.strictEqual(state.winner, null);
  assert.strictEqual(state.board[27], 'O');
  assert.strictEqual(state.board[28], 'X');
  assert.strictEqual(state.board[35], 'X');
  assert.strictEqual(state.board[36], 'O');
  assert.strictEqual(state.board.filter((c: any) => c === null).length, 60);

  console.log('👉 Testing: getFlippedDiscs');
  assert.deepStrictEqual(getFlippedDiscs(state.board, 0, 'X'), []);
  assert.deepStrictEqual(getFlippedDiscs(state.board, 19, 'X'), [27]);

  const testBoard = Array(64).fill(null);
  testBoard[27] = 'X';
  testBoard[28] = 'O';
  testBoard[29] = 'O';
  testBoard[30] = 'O';
  const flippedMulti = getFlippedDiscs(testBoard, 31, 'X');
  assert.deepStrictEqual(flippedMulti.sort(), [28, 29, 30].sort());

  console.log('👉 Testing: getLegalMoves');
  const movesX = getLegalMoves(state.board, 'X');
  assert.deepStrictEqual(movesX.sort(), [19, 26, 37, 44].sort());
  const movesO = getLegalMoves(state.board, 'O');
  assert.deepStrictEqual(movesO.sort(), [20, 29, 34, 43].sort());

  console.log('👉 Testing: handleMove');
  const nextState = ReversiEngine.handleMove(state, { position: 19 }, 'X');
  assert.strictEqual(nextState.board[19], 'X');
  assert.strictEqual(nextState.board[27], 'X'); // flipped
  assert.strictEqual(nextState.board[28], 'X');
  assert.strictEqual(nextState.turn, 'O');
  assert.strictEqual(nextState.lastMoveIndex, 19);
  assert.strictEqual(nextState.winner, null);

  assert.throws(() => ReversiEngine.handleMove(state, { position: -1 }, 'X'), /Invalid position/);
  assert.throws(() => ReversiEngine.handleMove(state, { position: 65 }, 'X'), /Invalid position/);
  assert.throws(() => ReversiEngine.handleMove(state, { position: 20 }, 'O'), /It is not player O's turn/);
  assert.throws(() => ReversiEngine.handleMove(state, { position: 27 }, 'X'), /Position is already occupied/);
  assert.throws(() => ReversiEngine.handleMove(state, { position: 0 }, 'X'), /must flip at least one opponent disc/);
  assert.throws(() => ReversiEngine.handleMove(state, { position: 64 }, 'X'), /Cannot pass when legal moves are available/);

  console.log('👉 Testing: Skip opponent turn (auto-pass)');
  const skipBoard = Array(64).fill(null);
  skipBoard[0] = 'X';
  skipBoard[1] = 'O';
  const skipState: ReversiGameState = { board: skipBoard, turn: 'X', winner: null };
  const skipNextState = ReversiEngine.handleMove(skipState, { position: 2 }, 'X');
  // board[1] flipped to X. Board is X,X,X. Neither has moves. Game is over.
  assert.strictEqual(skipNextState.board[1], 'X');
  assert.strictEqual(skipNextState.winner, 'X');

  console.log('👉 Testing: Explicit pass action');
  const passState: ReversiGameState = { board: Array(64).fill('O'), turn: 'X', winner: null };
  passState.board[0] = null; // one empty spot, but X can't flip anything
  const passNextState = ReversiEngine.handleMove(passState, { position: 64 }, 'X');
  assert.strictEqual(passNextState.turn, 'O');
  assert.strictEqual(passNextState.lastMoveIndex, undefined);

  console.log('✅ All Reversi Engine tests passed successfully!');
}

runTests().catch(error => {
  console.error('❌ Tests failed!');
  console.error(error);
  process.exit(1);
});
