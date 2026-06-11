import assert from 'assert';
import {
  createInitialState,
  handlePlaceAction,
  handleMoveAction,
  handleRemoveAction,
} from './millEngine';
import { MillGameState } from '@vibe-games/shared';

function runTests() {
  console.log('🧪 Running Nine Men\'s Morris Engine unit tests...\n');

  testInitialState();
  testPlacementPhase();
  testMillAndRemovalRules();
  testMovementAndFlyingPhases();
  testWinConditionByPieceReduction();
  testWinConditionByBlocking();

  console.log('\n✅ All Nine Men\'s Morris Engine tests passed successfully!');
}

function testInitialState() {
  console.log('👉 Testing Initial State...');
  const state = createInitialState();
  assert.strictEqual(state.board.length, 24);
  assert.ok(state.board.every((cell) => cell === null));
  assert.strictEqual(state.phase, 'placement');
  assert.strictEqual(state.placementsRemaining.X, 9);
  assert.strictEqual(state.placementsRemaining.O, 9);
  assert.strictEqual(state.piecesOnBoard.X, 0);
  assert.strictEqual(state.piecesOnBoard.O, 0);
  assert.strictEqual(state.turn, 'X');
  assert.strictEqual(state.winner, null);
  assert.strictEqual(state.millFormedThisTurn, false);
}

function testPlacementPhase() {
  console.log('👉 Testing Placement Phase...');
  let state = createInitialState();

  // X places at 0
  state = handlePlaceAction(state, 0, 'X');
  assert.strictEqual(state.board[0], 'X');
  assert.strictEqual(state.placementsRemaining.X, 8);
  assert.strictEqual(state.piecesOnBoard.X, 1);
  assert.strictEqual(state.turn, 'O'); // Turn passed to O

  // O places at 1
  state = handlePlaceAction(state, 1, 'O');
  assert.strictEqual(state.board[1], 'O');
  assert.strictEqual(state.turn, 'X'); // Turn passed to X

  // Test invalid double-placement error
  assert.throws(() => {
    handlePlaceAction(state, 1, 'X'); // 1 is occupied
  }, /Position is already occupied/);

  // Test invalid turn error
  assert.throws(() => {
    handlePlaceAction(state, 2, 'O'); // X's turn
  }, /It is not player O's turn/);
}

function testMillAndRemovalRules() {
  console.log('👉 Testing Mill Formation & Piece Removal...');
  let state = createInitialState();

  // Set up X placing pieces at 0 and 1
  state = handlePlaceAction(state, 0, 'X'); // X turn -> O turn
  state = handlePlaceAction(state, 8, 'O'); // O turn -> X turn
  state = handlePlaceAction(state, 1, 'X'); // X turn -> O turn
  state = handlePlaceAction(state, 16, 'O'); // O turn -> X turn

  // X places at 2, forming a mill: [0, 1, 2]
  state = handlePlaceAction(state, 2, 'X');
  assert.strictEqual(state.millFormedThisTurn, true);
  assert.strictEqual(state.turn, 'X'); // Turn does NOT pass to O yet

  // Attempt standard move/place while mill removal is pending
  assert.throws(() => {
    handlePlaceAction(state, 3, 'X');
  }, /Player must remove an opponent piece first/);

  // Attempt invalid removal (removing a non-existent opponent piece)
  assert.throws(() => {
    handleRemoveAction(state, 3, 'X');
  }, /No opponent piece at position/);

  // Attempt invalid removal (removing own piece)
  assert.throws(() => {
    handleRemoveAction(state, 0, 'X');
  }, /No opponent piece at position/);

  // Remove O's piece at 8
  state = handleRemoveAction(state, 8, 'X');
  assert.strictEqual(state.board[8], null);
  assert.strictEqual(state.piecesOnBoard.O, 1);
  assert.strictEqual(state.millFormedThisTurn, false);
  assert.strictEqual(state.turn, 'O'); // Turn now passes to O
}

function testMovementAndFlyingPhases() {
  console.log('👉 Testing Movement & Flying Phases...');
  let state = createInitialState();

  // Fast forward placement phase by alternating placements
  // X: 0, 2, 4, 6, 8, 10, 12, 14, 16
  // O: 1, 3, 5, 7, 9, 11, 13, 15, 17
  const xPlacements = [0, 2, 4, 6, 8, 10, 12, 14, 18]; // avoiding mill [16,17,18]
  const oPlacements = [1, 3, 5, 7, 9, 11, 13, 15, 22];
  
  for (let i = 0; i < 9; i++) {
    state = handlePlaceAction(state, xPlacements[i], 'X');
    state = handlePlaceAction(state, oPlacements[i], 'O');
  }

  assert.strictEqual(state.phase, 'movement');
  assert.strictEqual(state.placementsRemaining.X, 0);
  assert.strictEqual(state.placementsRemaining.O, 0);

  // X's turn to move (since O placed last)
  // X moves from 18 to adjacent 19
  state = handleMoveAction(state, 18, 19, 'X');
  assert.strictEqual(state.board[18], null);
  assert.strictEqual(state.board[19], 'X');
  assert.strictEqual(state.turn, 'O');

  // Test invalid move (non-adjacent movement when pieces > 3)
  assert.throws(() => {
    handleMoveAction(state, 22, 17, 'O'); // 22 is not adjacent to 17, O has 9 pieces
  }, /Position 17 is not adjacent to position 22/);

  // Fast forward to flying phase by setting pieces on board to 3 for O
  state.piecesOnBoard.O = 3;
  
  // Since O has exactly 3 pieces, it is allowed to fly
  // O moves from 22 to non-adjacent 17
  state = handleMoveAction(state, 22, 17, 'O');
  assert.strictEqual(state.board[22], null);
  assert.strictEqual(state.board[17], 'O');
}

function testWinConditionByPieceReduction() {
  console.log('👉 Testing Win Condition (Opponent reduced to 2 pieces)...');
  let state = createInitialState();

  // Setup state just before final removal
  state.phase = 'movement';
  state.piecesOnBoard.X = 3;
  state.piecesOnBoard.O = 3;
  state.board[0] = 'X';
  state.board[1] = 'X';
  state.board[2] = 'X'; // Mill [0, 1, 2]
  state.board[5] = 'O';
  state.board[8] = 'O';
  state.board[16] = 'O';
  state.turn = 'X';
  state.millFormedThisTurn = true; // X forms mill

  // X removes O's piece at 5, reducing O to 2 pieces
  state = handleRemoveAction(state, 5, 'X');
  assert.strictEqual(state.winner, 'X');
}

function testWinConditionByBlocking() {
  console.log('👉 Testing Win Condition (Opponent has no valid moves)...');
  let state = createInitialState();

  // Setup state where O is blocked
  // Positions: 
  // 0 is connected only to 1 and 7
  // 7 is connected only to 0, 6, 15
  state.phase = 'movement';
  state.piecesOnBoard.X = 4;
  state.piecesOnBoard.O = 4;
  state.board[0] = 'O'; // O's piece
  state.board[1] = 'X'; // Blocks O
  state.board[7] = 'X'; // Blocks O
  state.board[15] = 'X'; // Blocks O
  state.board[14] = 'X'; // Extra X piece
  // Rest of O pieces are not blocked or block list is complete
  // To keep simple, let's block all O pieces:
  // For the sake of this test, let's place O's other pieces on isolated blocks
  state.board[2] = 'O'; // connected only to 1, 3
  state.board[3] = 'X'; // Blocks O
  // 1 is occupied by X, so 2 is blocked

  state.board[4] = 'O'; // connected only to 3, 5
  state.board[5] = 'X'; // Blocks O
  // 3 is occupied by X, so 4 is blocked

  state.board[6] = 'O'; // connected to 5, 7
  // 5 and 7 are occupied by X, so 6 is blocked

  // Current board state for O:
  // O pieces at 0, 2, 4, 6.
  // Adjacent spots for 0: [1, 7] (both occupied by X)
  // Adjacent spots for 2: [1, 3] (both occupied by X)
  // Adjacent spots for 4: [3, 5] (both occupied by X)
  // Adjacent spots for 6: [5, 7] (both occupied by X)
  // So all O pieces are blocked!

  state.turn = 'X';
  // X moves a piece from 14 to adjacent 13 (a dummy move that doesn't unblock O)
  state = handleMoveAction(state, 14, 13, 'X');

  // Since O is blocked and has no valid moves, X should be declared the winner
  assert.strictEqual(state.winner, 'X');
}

// Execute tests
try {
  runTests();
} catch (error) {
  console.error('❌ Assertion failed!');
  console.error(error);
  process.exit(1);
}
