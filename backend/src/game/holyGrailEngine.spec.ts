import assert from 'assert';
import { HolyGrailEngine, getDistance, isValidHex, getCellType, evaluateDuel, getNeighborIndex, reassembleCellStack, getFarmLandsCount } from './holyGrailEngine';
import { HolyGrailCard, HolyGrailGameState } from '@vibe-games/shared';

async function runTests() {
  console.log('🧪 Starting Holy Grail (Grail Quest) Engine Tests...\n');

  // 1. Grid Coordinates & Types
  console.log('👉 Testing: Coordinate calculations and hex types');
  assert.strictEqual(getDistance(0, 0, 0, 0), 0);
  assert.strictEqual(getDistance(0, 0, 1, 0), 1);
  assert.strictEqual(getDistance(0, 0, -3, 3), 3); // Boundary of radius 3
  assert.ok(isValidHex(0, 0));
  assert.ok(isValidHex(0, -3));
  assert.ok(isValidHex(2, -1));
  assert.ok(!isValidHex(4, 0)); // Radius 4 is invalid

  assert.strictEqual(getCellType(0, 0), 'grail_center');
  assert.strictEqual(getCellType(0, -3), 'home_base'); // Player X
  assert.strictEqual(getCellType(0, 3), 'home_base');  // Player O
  assert.strictEqual(getCellType(2, -2), 'urban');     // Player X urban
  assert.strictEqual(getCellType(-2, 0), 'farm_land'); // Farm Land
  assert.strictEqual(getCellType(1, 2), 'urban');      // Player O urban
  assert.strictEqual(getCellType(1, 1), 'hill');       // Hill

  // 2. Initial State Setup
  console.log('👉 Testing: createInitialState');
  const state = HolyGrailEngine.createInitialState();
  assert.strictEqual(state.turn, 'X');
  assert.strictEqual(state.phase, 'deploy');
  assert.strictEqual(state.winner, null);
  assert.strictEqual(state.grailCellKey, '0,0');
  assert.strictEqual(state.hands.X.length, 5);
  assert.strictEqual(state.hands.O.length, 3);
  // Initial hand must have King (13), Queen (12), Jack (11)
  assert.ok(state.hands.X.some(c => c.value === 13));
  assert.ok(state.hands.X.some(c => c.value === 12));
  assert.ok(state.hands.X.some(c => c.value === 11));

  // 3. Combat Evaluation (Evaluate Duel)
  console.log('👉 Testing: Card duel resolution & Rock-Paper-Scissors face cards');
  // Face card cycles (King 13, Queen 12, Jack 11)
  // King beats Jack
  let d1 = evaluateDuel(13, 11);
  assert.strictEqual(d1.winner, 'attacker');
  // Jack beats Queen
  let d2 = evaluateDuel(11, 12);
  assert.strictEqual(d2.winner, 'attacker');
  // Queen beats King
  let d3 = evaluateDuel(12, 13);
  assert.strictEqual(d3.winner, 'attacker');
  // Opponent cycles
  assert.strictEqual(evaluateDuel(11, 13).winner, 'defender'); // Jack loses to King
  assert.strictEqual(evaluateDuel(13, 12).winner, 'defender'); // King loses to Queen
  assert.strictEqual(evaluateDuel(12, 11).winner, 'defender'); // Queen loses to Jack
  assert.strictEqual(evaluateDuel(13, 13).winner, 'draw');

  // Face beats numbers
  assert.strictEqual(evaluateDuel(11, 10).winner, 'attacker'); // Jack beats 10
  assert.strictEqual(evaluateDuel(13, 1).winner, 'attacker');  // King beats 1
  assert.strictEqual(evaluateDuel(5, 12).winner, 'defender');  // 5 loses to Queen

  // Numbers degradation: Winner card is reduced by defeated card's value. Minimum value is 1.
  let numDuel1 = evaluateDuel(10, 3);
  assert.strictEqual(numDuel1.winner, 'attacker');
  assert.strictEqual(numDuel1.newAttackerVal, 7); // 10 - 3 = 7

  let numDuel2 = evaluateDuel(4, 9);
  assert.strictEqual(numDuel2.winner, 'defender');
  assert.strictEqual(numDuel2.newDefenderVal, 5); // 9 - 4 = 5

  let numDuel3 = evaluateDuel(3, 3);
  assert.strictEqual(numDuel3.winner, 'draw');

  let numDuel4 = evaluateDuel(5, 5);
  assert.strictEqual(numDuel4.winner, 'draw');

  let numDuelMin = evaluateDuel(4, 4);
  assert.strictEqual(evaluateDuel(5, 6).newDefenderVal, 1); // 6 - 5 = 1

  // 4. Clockwise Neighbor Sorting for Merges
  console.log('👉 Testing: Clockwise neighbor index lookup');
  // Destination: (0,0)
  // East (1,0) should be index 0
  assert.strictEqual(getNeighborIndex(0, 0, 1, 0), 0);
  // Southeast (0,1) should be index 1
  assert.strictEqual(getNeighborIndex(0, 0, 0, 1), 1);
  // Southwest (-1,1) should be index 2
  assert.strictEqual(getNeighborIndex(0, 0, -1, 1), 2);
  // West (-1,0) should be index 3
  assert.strictEqual(getNeighborIndex(0, 0, -1, 0), 3);
  // Northwest (0,-1) should be index 4
  assert.strictEqual(getNeighborIndex(0, 0, 0, -1), 4);
  // Northeast (1,-1) should be index 5
  assert.strictEqual(getNeighborIndex(0, 0, 1, -1), 5);

  // 5. Deploy & Face Card Limits
  console.log('👉 Testing: Deploy actions and limits');
  let sDeploy = HolyGrailEngine.createInitialState();
  // Player X deploys King to (0, -3) [home_base]
  assert.strictEqual(sDeploy.phase, 'deploy');
  sDeploy = HolyGrailEngine.handleMove(sDeploy, { type: 'deploy', cellKey: '0,-3', cardValue: 13 }, 'X');
  assert.strictEqual(sDeploy.hands.X.length, 4);
  assert.strictEqual(sDeploy.board['0,-3'].soldiers.length, 1);
  assert.strictEqual(sDeploy.board['0,-3'].soldiers[0].value, 13); // King deployed

  // Set urban cell (-1,-2) as owned by X, but unoccupied (0 soldiers)
  sDeploy.board['-1,-2'].owner = 'X';
  sDeploy.board['-1,-2'].soldiers = [];

  // Deploying to empty urban cell should fail
  assert.throws(() => {
    HolyGrailEngine.handleMove(sDeploy, { type: 'deploy', cellKey: '-1,-2', cardValue: 12 }, 'X');
  });

  // Add a card to make it occupied, now deploying should succeed
  sDeploy.board['-1,-2'].soldiers = [{ value: 5, revealed: false }];
  sDeploy = HolyGrailEngine.handleMove(sDeploy, { type: 'deploy', cellKey: '-1,-2', cardValue: 12 }, 'X');
  assert.strictEqual(sDeploy.board['-1,-2'].soldiers.length, 2);

  // Deploying to non-owned or non-urban/non-base cell should fail
  assert.throws(() => {
    HolyGrailEngine.handleMove(sDeploy, { type: 'deploy', cellKey: '0,0', cardValue: 11 }, 'X');
  });

  // Verify farm land counting: X owns farm land (-2,0) but it is empty
  sDeploy.board['-2,0'].owner = 'X';
  sDeploy.board['-2,0'].soldiers = [];
  assert.strictEqual(getFarmLandsCount(sDeploy, 'X'), 0); // 0 because unoccupied

  // Occupy it with 1 soldier
  sDeploy.board['-2,0'].soldiers = [{ value: 3, revealed: false }];
  assert.strictEqual(getFarmLandsCount(sDeploy, 'X'), 1); // 1 because occupied

  // End deploy phase
  sDeploy = HolyGrailEngine.handleMove(sDeploy, { type: 'end_deploy' }, 'X');
  assert.strictEqual(sDeploy.phase, 'move');

  // 6. Move & Merging
  console.log('👉 Testing: Move stack & Clockwise merging');
  // Move King from (0,-3) to (0,-2) [adjacent]
  sDeploy = HolyGrailEngine.handleMove(sDeploy, { type: 'move', from: '0,-3', to: '0,-2', count: 1 }, 'X');
  assert.strictEqual(sDeploy.board['0,-3'].soldiers.length, 0);
  assert.strictEqual(sDeploy.board['0,-2'].soldiers.length, 0); // Not in destination yet (stays in transit on arrow)
  assert.strictEqual(sDeploy.board['0,-2'].owner, 'X');
  assert.strictEqual(sDeploy.movesThisTurn!.length, 1);

  // Move invalid coordinates / distance should fail
  assert.throws(() => {
    HolyGrailEngine.handleMove(sDeploy, { type: 'move', from: '0,-3', to: '0,0', count: 1 }, 'X');
  });

  // Trying to move a card from the transit destination should fail (since it is empty during the turn)
  assert.throws(() => {
    HolyGrailEngine.handleMove(sDeploy, { type: 'move', from: '0,-2', to: '0,-1', count: 1 }, 'X');
  });

  // End turn to finalize movement
  sDeploy = HolyGrailEngine.handleMove(sDeploy, { type: 'end_turn' }, 'X');
  assert.strictEqual(sDeploy.board['0,-2'].soldiers.length, 1);
  assert.strictEqual(sDeploy.board['0,-2'].soldiers[0].value, 13); // Finalized on destination cell!

  // 7. Auto Draw at deploy phase start
  console.log('👉 Testing: Deploy auto-draw mechanism & farm bonuses');
  let testDrawState = HolyGrailEngine.createInitialState();
  // Move to end deploy and move to end turn
  testDrawState = HolyGrailEngine.handleMove(testDrawState, { type: 'end_deploy' }, 'X');
  testDrawState = HolyGrailEngine.handleMove(testDrawState, { type: 'end_turn' }, 'X');
  // Turn is O, phase is deploy. Let's deploy all of O's hand to get more cards drawn
  testDrawState = HolyGrailEngine.handleMove(testDrawState, { type: 'deploy', cellKey: '0,3', cardValue: 13 }, 'O');
  testDrawState = HolyGrailEngine.handleMove(testDrawState, { type: 'deploy', cellKey: '0,3', cardValue: 12 }, 'O');
  testDrawState = HolyGrailEngine.handleMove(testDrawState, { type: 'deploy', cellKey: '0,3', cardValue: 11 }, 'O');
  testDrawState = HolyGrailEngine.handleMove(testDrawState, { type: 'end_deploy' }, 'O');
  testDrawState = HolyGrailEngine.handleMove(testDrawState, { type: 'end_turn' }, 'O');

  // Now turn is X, phase is deploy. Trigger auto-draw!
  // Wait, auto draw runs on first action in deploy phase (or is triggered automatically). Let's deploy a card to trigger it:
  testDrawState = HolyGrailEngine.handleMove(testDrawState, { type: 'deploy', cellKey: '0,-3', cardValue: 12 }, 'X');
  // Let's check X's hand. X should have drawn base cards (4 cards) since it is Round 2.
  // Wait, X started with 3 cards (K, Q, J) and 2 cards drawn in Round 1.
  // Deployed Queen (12). So hand was 4 cards before draw.
  // If we draw 4 cards (Round 2 base), hand should be 4 + 4 = 8 cards. Let's check:
  assert.strictEqual(testDrawState.hands.X.length, 8); // Correct: 3 starting + 2 (Round 1 auto-draw) + 4 (Round 2 auto-draw) - 1 deployed = 8.

  // 8. Combat & Retreat
  console.log('👉 Testing: Combat fights, Hill advantages, and Retreats');
  let sCombat = HolyGrailEngine.createInitialState();
  
  // Set up X King on (0,-3), and O Jack on (0,-2). (0,-2) is not owned by O, but let's place it.
  sCombat.board['0,-3'].owner = 'X';
  sCombat.board['0,-3'].soldiers = [{ value: 13, revealed: false }]; // King
  sCombat.board['0,-2'].owner = 'O';
  sCombat.board['0,-2'].soldiers = [{ value: 11, revealed: false }]; // Jack

  // Move X's turn to Move phase
  sCombat.phase = 'move';
  sCombat.turn = 'X';

  // X moves King from (0,-3) to (0,-2) to initiate combat
  sCombat = HolyGrailEngine.handleMove(sCombat, { type: 'move', from: '0,-3', to: '0,-2', count: 1 }, 'X');
  
  // Verify combat is registered
  assert.strictEqual(sCombat.pendingCombats.length, 1);
  const combat = sCombat.pendingCombats[0];
  assert.strictEqual(combat.cellKey, '0,-2');
  assert.strictEqual(combat.attacker, 'X');
  assert.strictEqual(combat.defender, 'O');
  
  // End turn so O can react
  sCombat = HolyGrailEngine.handleMove(sCombat, { type: 'end_turn' }, 'X');
  assert.strictEqual(sCombat.turn, 'O');
  assert.strictEqual(sCombat.phase, 'react');

  // Defender O decides to fight
  sCombat = HolyGrailEngine.handleMove(sCombat, { type: 'react', cellKey: '0,-2', reactType: 'fight' }, 'O');
  // King (13) vs Jack (11). King wins, Jack is destroyed.
  // King should survive and go to bottom of attacker stack. Cell is occupied by X.
  assert.strictEqual(sCombat.board['0,-2'].owner, 'X');
  assert.strictEqual(sCombat.board['0,-2'].soldiers.length, 1);
  assert.strictEqual(sCombat.board['0,-2'].soldiers[0].value, 13);
  assert.strictEqual(sCombat.board['0,-2'].soldiers[0].revealed, true); // Marked as revealed
  assert.strictEqual(sCombat.pendingCombats.length, 0); // Resolved!

  // Let's test Retreat option
  let sRetreat = HolyGrailEngine.createInitialState();
  sRetreat.board['0,-3'].owner = 'X';
  sRetreat.board['0,-3'].soldiers = [{ value: 9, revealed: false }];
  sRetreat.board['0,-2'].owner = 'O';
  sRetreat.board['0,-2'].soldiers = [{ value: 5, revealed: false }];
  // Friendly retreat destination for O
  sRetreat.board['0,-1'].owner = 'O';
  sRetreat.board['0,-1'].soldiers = [{ value: 7, revealed: false }];

  sRetreat.phase = 'move';
  sRetreat.turn = 'X';
  sRetreat = HolyGrailEngine.handleMove(sRetreat, { type: 'move', from: '0,-3', to: '0,-2', count: 1 }, 'X');
  sRetreat = HolyGrailEngine.handleMove(sRetreat, { type: 'end_turn' }, 'X');

  assert.strictEqual(sRetreat.phase, 'react');
  // O retreats to (0,-1)
  sRetreat = HolyGrailEngine.handleMove(sRetreat, { type: 'react', cellKey: '0,-2', reactType: 'retreat', retreatTo: '0,-1' }, 'O');
  
  // Kontests resolved, O's (5) is appended to bottom of (0,-1) stack
  assert.strictEqual(sRetreat.board['0,-2'].owner, 'X');
  assert.strictEqual(sRetreat.board['0,-2'].soldiers.length, 1);
  assert.strictEqual(sRetreat.board['0,-2'].soldiers[0].value, 9);
  
  assert.strictEqual(sRetreat.board['0,-1'].soldiers.length, 2);
  assert.strictEqual(sRetreat.board['0,-1'].soldiers[0].value, 7); // Original top
  assert.strictEqual(sRetreat.board['0,-1'].soldiers[1].value, 5); // Retreat card appended to bottom

  // 9. Hill Defense double-draw
  console.log('👉 Testing: Hill defense advantage');
  let sHill = HolyGrailEngine.createInitialState();
  // Contested cell (1,1) is a Hill
  assert.strictEqual(getCellType(1, 1), 'hill');
  sHill.board['1,0'].owner = 'X';
  sHill.board['1,0'].soldiers = [{ value: 8, revealed: false }]; // Attacker 8
  sHill.board['1,1'].owner = 'O';
  sHill.board['1,1'].soldiers = [
    { value: 6, revealed: false }, // Defender top
    { value: 9, revealed: false }  // Defender second (best card!)
  ];

  sHill.phase = 'move';
  sHill.turn = 'X';
  sHill = HolyGrailEngine.handleMove(sHill, { type: 'move', from: '1,0', to: '1,1', count: 1 }, 'X');
  sHill = HolyGrailEngine.handleMove(sHill, { type: 'end_turn' }, 'X');

  // O fights on the Hill
  sHill = HolyGrailEngine.handleMove(sHill, { type: 'react', cellKey: '1,1', reactType: 'fight' }, 'O');
  
  // Defender has [6, 9]. Attacker has [8].
  // Hill compares 8 vs 6 (result: Attacker wins, 8 becomes 2) and 8 vs 9 (result: Defender wins, 9 becomes 1).
  // Best result for Defender is 9 vs 8 (defender wins), so Defender uses 9.
  // Defender wins, 8 is destroyed. 9 becomes 1 and goes to bottom of stack.
  // The unused card (6) is moved to bottom of stack.
  // Wait, let's verify defender cell soldiers after combat.
  assert.strictEqual(sHill.board['1,1'].owner, 'O');
  assert.strictEqual(sHill.board['1,1'].soldiers.length, 2);
  // Best card (9) degraded to (9 - 8 = 1) and went to bottom.
  // Unused card (6) survived and went to bottom (actually, we put bestCard at bottom, then worstCard at bottom, so 9 is first, 6 is second).
  // Let's verify values in soldiers stack.
  assert.strictEqual(sHill.board['1,1'].soldiers[0].value, 1); // Best card (9 -> 1)
  assert.strictEqual(sHill.board['1,1'].soldiers[1].value, 6); // Unused card (6)

  // 10. Grail Movement & Radioactivity
  console.log('👉 Testing: Grail movement & radioactivity');
  let sGrail = HolyGrailEngine.createInitialState();
  // Place King for X at (0,0) [Grail cell]
  sGrail.board['0,0'].owner = 'X';
  sGrail.board['0,0'].soldiers = [{ value: 13, revealed: false }]; // King

  sGrail.phase = 'move';
  sGrail.turn = 'X';
  
  // X moves King from (0,0) to (0,-1) carrying the Grail
  sGrail = HolyGrailEngine.handleMove(sGrail, { type: 'move', from: '0,0', to: '0,-1', count: 1 }, 'X');
  assert.strictEqual(sGrail.grailMovementCandidates?.includes('0,-1'), true);

  // End turn for X
  sGrail = HolyGrailEngine.handleMove(sGrail, { type: 'end_turn' }, 'X');
  // End turn for O to complete the round
  sGrail.phase = 'move';
  sGrail.turn = 'O';
  sGrail = HolyGrailEngine.handleMove(sGrail, { type: 'end_turn' }, 'O');

  // Round completed, Grail should have moved to (0,-1)
  assert.strictEqual(sGrail.grailCellKey, '0,-1');
  
  // Also radioactive kill should have executed at (0,-1) (the new Grail cell)
  // Let's verify King at (0,-1) was killed (since it was the only card there, stack should be empty)
  assert.strictEqual(sGrail.board['0,-1'].soldiers.length, 0);
  assert.strictEqual(sGrail.board['0,-1'].owner, null);

  // 11. Game ending & Base capture conditions
  console.log('👉 Testing: Victory / Defeat conditions');
  let sWin = HolyGrailEngine.createInitialState();
  // Move Grail to X Base (0,-3)
  sWin.grailCellKey = '0,-3';
  // End round
  sWin.roundTurnsCompleted = 1;
  sWin.turn = 'O';
  sWin = HolyGrailEngine.handleMove(sWin, { type: 'end_turn' }, 'O');
  assert.strictEqual(sWin.winner, 'X'); // X wins by bringing Grail to base

  // Base Capture: O captures X Base
  let sCapture = HolyGrailEngine.createInitialState();
  sCapture.board['0,-3'].owner = 'O'; // X base captured by O
  sCapture.board['0,-3'].soldiers = [{ value: 5, revealed: false }];
  
  // Trigger end-round check
  sCapture.roundTurnsCompleted = 1;
  sCapture.turn = 'O';
  sCapture = HolyGrailEngine.handleMove(sCapture, { type: 'end_turn' }, 'O');
  
  assert.strictEqual(sCapture.winner, 'O');
  assert.strictEqual(sCapture.hands.X.length, 0); // X hand discarded

  // 12. AI Behavior & Base Defense
  console.log('👉 Testing: AI base defense logic');
  let sAi = HolyGrailEngine.createInitialState();
  // Deploy phase: base is empty (since initial creation state doesn't place any cards on base)
  let aiAction = HolyGrailEngine.getAiAction(sAi, 'minimax', 3, null, 1000);
  assert.strictEqual(aiAction.type, 'deploy');
  assert.strictEqual(aiAction.cellKey, '0,-3'); // Must deploy to X base

  // Deploy to home base manually so it's not empty anymore
  sAi.board['0,-3'].soldiers = [{ value: 13, revealed: false }];
  sAi.board['0,-3'].owner = 'X';
  // Now deploy phase, hand has cards
  aiAction = HolyGrailEngine.getAiAction(sAi, 'minimax', 3, null, 1000);
  // It shouldn't be forced to deploy to base anymore (can deploy to base or urban)
  assert.ok(aiAction.type === 'deploy');

  // Move phase: base only has 1 card
  sAi.phase = 'move';
  sAi.turn = 'X';
  sAi.board['0,-3'].soldiers = [{ value: 13, revealed: false }]; // King at base
  sAi.board['0,-3'].owner = 'X';
  // No other cells have units, so only the base has units
  aiAction = HolyGrailEngine.getAiAction(sAi, 'minimax', 3, null, 1000);
  // Since the base only has 1 unit, the AI cannot move it (must leave at least 1 unit).
  // Thus, there are no valid moves, and it should end turn.
  assert.strictEqual(aiAction.type, 'end_turn');

  // If the base has 2 cards, it can move 1 card
  sAi.board['0,-3'].soldiers = [
    { value: 13, revealed: false },
    { value: 11, revealed: false }
  ];
  aiAction = HolyGrailEngine.getAiAction(sAi, 'minimax', 3, null, 1000);
  // Can move 1 card out
  assert.strictEqual(aiAction.type, 'move');
  assert.strictEqual(aiAction.count, 1);
  assert.strictEqual(aiAction.from, '0,-3');
  
  // React phase test: AI is defender
  let sAiReact = HolyGrailEngine.createInitialState();
  sAiReact.phase = 'react';
  sAiReact.turn = 'O'; // O's turn to react
  sAiReact.board['1,0'].owner = 'O';
  sAiReact.board['1,0'].soldiers = [{ value: 3, revealed: false }]; // Defender has 3
  sAiReact.board['1,-1'].owner = 'O'; // Valid retreat option
  sAiReact.board['1,-1'].soldiers = [{ value: 5, revealed: false }];
  sAiReact.pendingCombats = [{
    cellKey: '1,0',
    attacker: 'X',
    defender: 'O',
    attackerTopCard: { value: 8, revealed: true }, // Attacker has 8
    defenderTopCard: { value: 3, revealed: true },
    attackerRemainingCount: 1,
    defenderRemainingCount: 1,
    attackerStack: [{ value: 8, revealed: true }]
  }];

  let reactAction = HolyGrailEngine.getAiAction(sAiReact, 'minimax', 3, null, 1000);
  assert.strictEqual(reactAction.type, 'react');
  assert.strictEqual(reactAction.reactType, 'retreat');
  assert.strictEqual(reactAction.retreatTo, '1,-1'); // Should choose the valid retreat cell

  // Execute reaction to verify it doesn't crash
  sAiReact = HolyGrailEngine.handleMove(sAiReact, reactAction, 'O');
  assert.strictEqual(sAiReact.pendingCombats.length, 0); // Resolved

  console.log('✅ All Holy Grail Engine tests passed successfully!');
}

runTests().catch(error => {
  console.error('❌ Tests failed!');
  console.error(error);
  process.exit(1);
});
