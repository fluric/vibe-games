import assert from 'assert';
import { ConnectFourEngine } from './connectFourEngine';

async function runTests() {
  console.log('🧪 Starting Connect Four Engine Tests...\n');

  // 1. Test creation
  console.log('👉 Testing: createInitialState');
  const state = ConnectFourEngine.createInitialState();
  assert.strictEqual(state.turn, 'X');
  assert.strictEqual(state.winner, null);
  assert.strictEqual(state.board.length, 42);
  assert.ok(state.board.every(cell => cell === null));

  // 2. Test valid moves & column drops
  console.log('👉 Testing: Drop piece and turn alternation');
  let s1 = ConnectFourEngine.handleMove(state, { column: 3 }, 'X');
  assert.strictEqual(s1.board[5 * 7 + 3], 'X'); // Row 5 is bottom, column 3
  assert.strictEqual(s1.turn, 'O');

  let s2 = ConnectFourEngine.handleMove(s1, { column: 3 }, 'O');
  assert.strictEqual(s2.board[4 * 7 + 3], 'O'); // Row 4, column 3
  assert.strictEqual(s2.turn, 'X');

  // 3. Test column full validation
  console.log('👉 Testing: Column full error');
  let fullColState = s2;
  // Currently 2 pieces in col 3. Add 4 more.
  fullColState = ConnectFourEngine.handleMove(fullColState, { column: 3 }, 'X'); // 3
  fullColState = ConnectFourEngine.handleMove(fullColState, { column: 3 }, 'O'); // 4
  fullColState = ConnectFourEngine.handleMove(fullColState, { column: 3 }, 'X'); // 5
  fullColState = ConnectFourEngine.handleMove(fullColState, { column: 3 }, 'O'); // 6 (now full)
  
  assert.throws(() => {
    ConnectFourEngine.handleMove(fullColState, { column: 3 }, 'X');
  }, /Column is full/);

  // 4. Test horizontal win
  console.log('👉 Testing: Horizontal Win (X wins)');
  let horizState = ConnectFourEngine.createInitialState();
  // Turn sequence: X at 0, O at 0, X at 1, O at 1, X at 2, O at 2, X at 3
  horizState = ConnectFourEngine.handleMove(horizState, { column: 0 }, 'X');
  horizState = ConnectFourEngine.handleMove(horizState, { column: 0 }, 'O');
  horizState = ConnectFourEngine.handleMove(horizState, { column: 1 }, 'X');
  horizState = ConnectFourEngine.handleMove(horizState, { column: 1 }, 'O');
  horizState = ConnectFourEngine.handleMove(horizState, { column: 2 }, 'X');
  horizState = ConnectFourEngine.handleMove(horizState, { column: 2 }, 'O');
  horizState = ConnectFourEngine.handleMove(horizState, { column: 3 }, 'X');
  assert.strictEqual(horizState.winner, 'X');

  // 5. Test vertical win
  console.log('👉 Testing: Vertical Win (O wins)');
  let vertState = ConnectFourEngine.createInitialState();
  // Turn sequence: X at 0, O at 1, X at 0, O at 1, X at 0, O at 1, X at 2, O at 1
  vertState = ConnectFourEngine.handleMove(vertState, { column: 0 }, 'X');
  vertState = ConnectFourEngine.handleMove(vertState, { column: 1 }, 'O');
  vertState = ConnectFourEngine.handleMove(vertState, { column: 0 }, 'X');
  vertState = ConnectFourEngine.handleMove(vertState, { column: 1 }, 'O');
  vertState = ConnectFourEngine.handleMove(vertState, { column: 0 }, 'X');
  vertState = ConnectFourEngine.handleMove(vertState, { column: 1 }, 'O');
  vertState = ConnectFourEngine.handleMove(vertState, { column: 2 }, 'X');
  vertState = ConnectFourEngine.handleMove(vertState, { column: 1 }, 'O');
  assert.strictEqual(vertState.winner, 'O');

  // 6. Test diagonal win (bottom-left to top-right)
  console.log('👉 Testing: Diagonal Win (bottom-left to top-right)');
  let diagState1 = ConnectFourEngine.createInitialState();
  // Set up board for diagonal at:
  // (5,0) = X
  // (4,1) = X (needs O at (5,1) first)
  // (3,2) = X (needs X at (5,2), O at (4,2) first)
  // (2,3) = X (needs O at (5,3), X at (4,3), O at (3,3) first)
  // Sequence:
  diagState1 = ConnectFourEngine.handleMove(diagState1, { column: 0 }, 'X'); // (5,0)=X
  diagState1 = ConnectFourEngine.handleMove(diagState1, { column: 1 }, 'O'); // (5,1)=O
  diagState1 = ConnectFourEngine.handleMove(diagState1, { column: 1 }, 'X'); // (4,1)=X
  diagState1 = ConnectFourEngine.handleMove(diagState1, { column: 2 }, 'O'); // (5,2)=O
  diagState1 = ConnectFourEngine.handleMove(diagState1, { column: 2 }, 'X'); // (4,2)=X
  diagState1 = ConnectFourEngine.handleMove(diagState1, { column: 3 }, 'O'); // (5,3)=O
  diagState1 = ConnectFourEngine.handleMove(diagState1, { column: 2 }, 'X'); // (3,2)=X
  diagState1 = ConnectFourEngine.handleMove(diagState1, { column: 3 }, 'O'); // (4,3)=O
  diagState1 = ConnectFourEngine.handleMove(diagState1, { column: 3 }, 'X'); // (3,3)=X
  diagState1 = ConnectFourEngine.handleMove(diagState1, { column: 5 }, 'O'); // unrelated
  diagState1 = ConnectFourEngine.handleMove(diagState1, { column: 3 }, 'X'); // (2,3)=X (forms 4 diagonally from (5,0) to (2,3))
  assert.strictEqual(diagState1.winner, 'X');

  // 7. Test AI block
  console.log('👉 Testing: AI Blocks Opponent 3-in-a-row');
  let blockState = ConnectFourEngine.createInitialState();
  blockState = ConnectFourEngine.handleMove(blockState, { column: 0 }, 'X'); // X at bottom col 0
  blockState = ConnectFourEngine.handleMove(blockState, { column: 4 }, 'O'); // O at bottom col 4
  blockState = ConnectFourEngine.handleMove(blockState, { column: 1 }, 'X'); // X at bottom col 1
  blockState = ConnectFourEngine.handleMove(blockState, { column: 4 }, 'O'); // O at row 4 col 4
  blockState = ConnectFourEngine.handleMove(blockState, { column: 2 }, 'X'); // X at bottom col 2 (Forms 3-in-a-row for X)
  
  // Now it is O's turn (AI). AI must play in column 3 to block X's 4-in-a-row win.
  const aiAction = ConnectFourEngine.getAiAction(blockState, 'minimax', 3, null, 1000);
  assert.strictEqual(aiAction.column, 3);

  console.log('✅ All Connect Four Engine tests passed successfully!');
}

runTests().catch(error => {
  console.error('❌ Tests failed!');
  console.error(error);
  process.exit(1);
});
