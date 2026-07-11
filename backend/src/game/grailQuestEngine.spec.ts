import assert from 'assert';
import { GrailQuestEngine, createInitialState } from './grailQuestEngine';
import { getDistance, isValidHex, getCellType, getNeighborIndex, getFarmLandsCount } from './grailquest/gridUtils';
import { evaluateDuel, reassembleCellStack } from './grailquest/combatResolver';
import { drawRandomCard } from './grailquest/deckManager';
import { GrailQuestCard, GrailQuestGameState } from '@vibe-games/shared';

async function runTests() {
  console.log('🧪 Starting Grail Quest (Grail Quest) Engine Tests...\n');

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
  const state = GrailQuestEngine.createInitialState();
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
  let sDeploy = GrailQuestEngine.createInitialState();
  // Player X deploys King to (0, -3) [home_base]
  assert.strictEqual(sDeploy.phase, 'deploy');
  sDeploy = GrailQuestEngine.handleMove(sDeploy, { type: 'deploy', cellKey: '0,-3', cardValue: 13 }, 'X');
  assert.strictEqual(sDeploy.hands.X.length, 4);
  assert.strictEqual(sDeploy.board['0,-3'].soldiers.length, 1);
  assert.strictEqual(sDeploy.board['0,-3'].soldiers[0].value, 13); // King deployed

  // Set urban cell (-1,-2) as owned by X, but unoccupied (0 soldiers)
  sDeploy.board['-1,-2'].owner = 'X';
  sDeploy.board['-1,-2'].soldiers = [];

  // Deploying to empty owned urban cell should now succeed!
  sDeploy = GrailQuestEngine.handleMove(sDeploy, { type: 'deploy', cellKey: '-1,-2', cardValue: 12 }, 'X');
  assert.strictEqual(sDeploy.board['-1,-2'].soldiers.length, 1);
  assert.strictEqual(sDeploy.board['-1,-2'].soldiers[0].value, 12);

  // Deploying to non-owned or non-urban/non-base cell should fail
  assert.throws(() => {
    GrailQuestEngine.handleMove(sDeploy, { type: 'deploy', cellKey: '0,0', cardValue: 11 }, 'X');
  });

  // Verify farm land counting: X owns farm land (-2,0) but it is empty
  sDeploy.board['-2,0'].owner = 'X';
  sDeploy.board['-2,0'].soldiers = [];
  assert.strictEqual(getFarmLandsCount(sDeploy, 'X'), 1); // 1 because owned, even if unoccupied

  // Occupy it with 1 soldier
  sDeploy.board['-2,0'].soldiers = [{ value: 3, revealed: false }];
  assert.strictEqual(getFarmLandsCount(sDeploy, 'X'), 1); // still 1 when occupied

  // End deploy phase
  sDeploy = GrailQuestEngine.handleMove(sDeploy, { type: 'end_deploy' }, 'X');
  assert.strictEqual(sDeploy.phase, 'move');

  // 6. Move & Merging
  console.log('👉 Testing: Move stack & Clockwise merging');
  // Move King from (0,-3) to (0,-2) [adjacent]
  sDeploy = GrailQuestEngine.handleMove(sDeploy, { type: 'move', from: '0,-3', to: '0,-2', count: 1 }, 'X');
  assert.strictEqual(sDeploy.board['0,-3'].soldiers.length, 0);
  assert.strictEqual(sDeploy.board['0,-2'].soldiers.length, 0); // Not in destination yet (stays in transit on arrow)
  assert.strictEqual(sDeploy.board['0,-2'].owner, 'X');
  assert.strictEqual(sDeploy.movesThisTurn!.length, 1);

  // Move invalid coordinates / distance should fail
  assert.throws(() => {
    GrailQuestEngine.handleMove(sDeploy, { type: 'move', from: '0,-3', to: '0,0', count: 1 }, 'X');
  });

  // Trying to move a card from the transit destination should fail (since it is empty during the turn)
  assert.throws(() => {
    GrailQuestEngine.handleMove(sDeploy, { type: 'move', from: '0,-2', to: '0,-1', count: 1 }, 'X');
  });

  // End turn to finalize movement
  sDeploy = GrailQuestEngine.handleMove(sDeploy, { type: 'end_turn' }, 'X');
  assert.strictEqual(sDeploy.board['0,-2'].soldiers.length, 1);
  assert.strictEqual(sDeploy.board['0,-2'].soldiers[0].value, 13); // Finalized on destination cell!

  // 7. Auto Draw at deploy phase start
  console.log('👉 Testing: Deploy auto-draw mechanism & farm bonuses');
  let testDrawState = GrailQuestEngine.createInitialState();
  // Move to end deploy and move to end turn
  testDrawState = GrailQuestEngine.handleMove(testDrawState, { type: 'end_deploy' }, 'X');
  testDrawState = GrailQuestEngine.handleMove(testDrawState, { type: 'end_turn' }, 'X');
  // Turn is O, phase is deploy. Let's deploy all of O's hand to get more cards drawn
  testDrawState = GrailQuestEngine.handleMove(testDrawState, { type: 'deploy', cellKey: '0,3', cardValue: 13 }, 'O');
  testDrawState = GrailQuestEngine.handleMove(testDrawState, { type: 'deploy', cellKey: '0,3', cardValue: 12 }, 'O');
  testDrawState = GrailQuestEngine.handleMove(testDrawState, { type: 'deploy', cellKey: '0,3', cardValue: 11 }, 'O');
  testDrawState = GrailQuestEngine.handleMove(testDrawState, { type: 'end_deploy' }, 'O');
  testDrawState = GrailQuestEngine.handleMove(testDrawState, { type: 'end_turn' }, 'O');

  // Now turn is X, phase is deploy. Trigger auto-draw!
  // Wait, auto draw runs on first action in deploy phase (or is triggered automatically). Let's deploy a card to trigger it:
  testDrawState = GrailQuestEngine.handleMove(testDrawState, { type: 'deploy', cellKey: '0,-3', cardValue: 12 }, 'X');
  // Let's check X's hand. X should have drawn base cards (4 cards) since it is Round 2.
  // Wait, X started with 3 cards (K, Q, J) and 2 cards drawn in Round 1.
  // Deployed Queen (12). So hand was 4 cards before draw.
  // If we draw 4 cards (Round 2 base), hand should be 4 + 4 = 8 cards. Let's check:
  assert.strictEqual(testDrawState.hands.X.length, 8); // Correct: 3 starting + 2 (Round 1 auto-draw) + 4 (Round 2 auto-draw) - 1 deployed = 8.

  // 8. Combat & Retreat
  console.log('👉 Testing: Combat fights, Hill advantages, and Retreats');
  let sCombat = GrailQuestEngine.createInitialState();
  
  // Set up X King on (0,-3), and O Jack on (0,-2). (0,-2) is not owned by O, but let's place it.
  sCombat.board['0,-3'].owner = 'X';
  sCombat.board['0,-3'].soldiers = [{ value: 13, revealed: false }]; // King
  sCombat.board['0,-2'].owner = 'O';
  sCombat.board['0,-2'].soldiers = [{ value: 11, revealed: false }]; // Jack

  // Move X's turn to Move phase
  sCombat.phase = 'move';
  sCombat.turn = 'X';

  // X moves King from (0,-3) to (0,-2) to initiate combat
  sCombat = GrailQuestEngine.handleMove(sCombat, { type: 'move', from: '0,-3', to: '0,-2', count: 1 }, 'X');
  
  // Verify combat is registered
  assert.strictEqual(sCombat.pendingCombats.length, 1);
  const combat = sCombat.pendingCombats[0];
  assert.strictEqual(combat.cellKey, '0,-2');
  assert.strictEqual(combat.attacker, 'X');
  assert.strictEqual(combat.defender, 'O');
  
  // End turn so O can react
  sCombat = GrailQuestEngine.handleMove(sCombat, { type: 'end_turn' }, 'X');
  assert.strictEqual(sCombat.turn, 'O');
  assert.strictEqual(sCombat.phase, 'react');

  // Defender O decides to fight
  sCombat = GrailQuestEngine.handleMove(sCombat, { type: 'react', cellKey: '0,-2', reactType: 'fight' }, 'O');
  // King (13) vs Jack (11). King wins, Jack is destroyed.
  // King should survive and go to bottom of attacker stack. Cell is occupied by X.
  assert.strictEqual(sCombat.board['0,-2'].owner, 'X');
  assert.strictEqual(sCombat.board['0,-2'].soldiers.length, 1);
  assert.strictEqual(sCombat.board['0,-2'].soldiers[0].value, 13);
  assert.strictEqual(sCombat.board['0,-2'].soldiers[0].revealed, true); // Marked as revealed
  assert.strictEqual(sCombat.pendingCombats.length, 0); // Resolved!

  // Let's test Retreat option
  let sRetreat = GrailQuestEngine.createInitialState();
  sRetreat.board['0,-3'].owner = 'X';
  sRetreat.board['0,-3'].soldiers = [{ value: 9, revealed: false }];
  sRetreat.board['0,-2'].owner = 'O';
  sRetreat.board['0,-2'].soldiers = [{ value: 5, revealed: false }];
  // Friendly retreat destination for O
  sRetreat.board['0,-1'].owner = 'O';
  sRetreat.board['0,-1'].soldiers = [{ value: 7, revealed: false }];

  sRetreat.phase = 'move';
  sRetreat.turn = 'X';
  sRetreat = GrailQuestEngine.handleMove(sRetreat, { type: 'move', from: '0,-3', to: '0,-2', count: 1 }, 'X');
  sRetreat = GrailQuestEngine.handleMove(sRetreat, { type: 'end_turn' }, 'X');

  assert.strictEqual(sRetreat.phase, 'react');
  // O retreats to (0,-1)
  sRetreat = GrailQuestEngine.handleMove(sRetreat, { type: 'react', cellKey: '0,-2', reactType: 'retreat', retreatTo: '0,-1' }, 'O');
  
  // Kontests resolved, O's (5) is appended to bottom of (0,-1) stack
  assert.strictEqual(sRetreat.board['0,-2'].owner, 'X');
  assert.strictEqual(sRetreat.board['0,-2'].soldiers.length, 1);
  assert.strictEqual(sRetreat.board['0,-2'].soldiers[0].value, 9);
  
  assert.strictEqual(sRetreat.board['0,-1'].soldiers.length, 2);
  assert.strictEqual(sRetreat.board['0,-1'].soldiers[0].value, 7); // Original top
  assert.strictEqual(sRetreat.board['0,-1'].soldiers[1].value, 5); // Retreat card appended to bottom

  // 9. Hill Defense double-draw
  console.log('👉 Testing: Hill defense advantage');
  let sHill = GrailQuestEngine.createInitialState();
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
  sHill = GrailQuestEngine.handleMove(sHill, { type: 'move', from: '1,0', to: '1,1', count: 1 }, 'X');
  sHill = GrailQuestEngine.handleMove(sHill, { type: 'end_turn' }, 'X');

  // O fights on the Hill
  sHill = GrailQuestEngine.handleMove(sHill, { type: 'react', cellKey: '1,1', reactType: 'fight' }, 'O');
  
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

  // 9b. Hill Defense double-draw with Draw Result
  console.log('👉 Testing: Hill defense advantage with draw outcome (Q vs Q & K)');
  let sHillDraw = GrailQuestEngine.createInitialState();
  sHillDraw.board['1,0'].owner = 'X';
  sHillDraw.board['1,0'].soldiers = [{ value: 12, revealed: false }]; // Attacker Q (12)
  sHillDraw.board['1,1'].owner = 'O';
  sHillDraw.board['1,1'].soldiers = [
    { value: 12, revealed: false }, // Defender Q (12)
    { value: 13, revealed: false }  // Defender K (13)
  ];

  sHillDraw.phase = 'move';
  sHillDraw.turn = 'X';
  sHillDraw = GrailQuestEngine.handleMove(sHillDraw, { type: 'move', from: '1,0', to: '1,1', count: 1 }, 'X');
  sHillDraw = GrailQuestEngine.handleMove(sHillDraw, { type: 'end_turn' }, 'X');

  // O fights on the Hill
  sHillDraw = GrailQuestEngine.handleMove(sHillDraw, { type: 'react', cellKey: '1,1', reactType: 'fight' }, 'O');

  // Both Qs draw and are destroyed, and the unused K is also destroyed because the chosen card drew.
  assert.strictEqual(sHillDraw.board['1,1'].soldiers.length, 0);
  assert.strictEqual(sHillDraw.board['1,1'].owner, null);
  assert.strictEqual(sHillDraw.pendingCombats.length, 0);

  // 10. Grail Movement & Radioactivity
  console.log('👉 Testing: Grail movement & radioactivity');
  let sGrail = GrailQuestEngine.createInitialState();
  // Place King for X at (0,0) [Grail cell]
  sGrail.board['0,0'].owner = 'X';
  sGrail.board['0,0'].soldiers = [{ value: 13, revealed: false }]; // King

  sGrail.phase = 'move';
  sGrail.turn = 'X';
  
  // X moves King from (0,0) to (0,-1) carrying the Grail
  sGrail = GrailQuestEngine.handleMove(sGrail, { type: 'move', from: '0,0', to: '0,-1', count: 1 }, 'X');
  assert.strictEqual(sGrail.grailMovementCandidates?.includes('0,-1'), true);

  // End turn for X
  sGrail = GrailQuestEngine.handleMove(sGrail, { type: 'end_turn' }, 'X');
  // End turn for O to complete the round
  sGrail.phase = 'move';
  sGrail.turn = 'O';
  const originalRandomGrail = Math.random;
  Math.random = () => 0.1; // Ensure radioactivity kills the King (0.1 < 0.5)
  sGrail = GrailQuestEngine.handleMove(sGrail, { type: 'end_turn' }, 'O');
  Math.random = originalRandomGrail;

  // Round completed, Grail should have moved to (0,-1)
  assert.strictEqual(sGrail.grailCellKey, '0,-1');
  
  // Also radioactive kill should have executed at (0,-1) (the new Grail cell)
  // Let's verify King at (0,-1) was killed (since it was the only card there, stack should be empty)
  assert.strictEqual(sGrail.board['0,-1'].soldiers.length, 0);
  assert.strictEqual(sGrail.board['0,-1'].owner, null);

  // 11. Game ending & Base capture conditions
  console.log('👉 Testing: Victory / Defeat conditions');
  let sWin = GrailQuestEngine.createInitialState();
  // Move Grail to X Base (0,-3)
  sWin.grailCellKey = '0,-3';
  // End round
  sWin.roundTurnsCompleted = 1;
  sWin.turn = 'O';
  sWin = GrailQuestEngine.handleMove(sWin, { type: 'end_turn' }, 'O');
  assert.strictEqual(sWin.winner, 'X'); // X wins by bringing Grail to base

  // Base Capture: O captures X Base
  let sCapture = GrailQuestEngine.createInitialState();
  sCapture.board['0,-3'].owner = 'O'; // X base captured by O
  sCapture.board['0,-3'].soldiers = [{ value: 5, revealed: false }];
  
  // Trigger end-round check
  sCapture.roundTurnsCompleted = 1;
  sCapture.turn = 'O';
  sCapture = GrailQuestEngine.handleMove(sCapture, { type: 'end_turn' }, 'O');
  
  assert.strictEqual(sCapture.winner, 'O');
  assert.strictEqual(sCapture.hands.X.length, 0); // X hand discarded

  // 12. AI Behavior & Base Defense
  console.log('👉 Testing: AI base defense logic');
  let sAi = GrailQuestEngine.createInitialState();
  // Deploy phase: base is empty (since initial creation state doesn't place any cards on base)
  let aiAction = GrailQuestEngine.getAiAction(sAi, 'minimax', 3, null, 1000);
  assert.strictEqual(aiAction.type, 'deploy');
  assert.strictEqual(aiAction.cellKey, '0,-3'); // Must deploy to X base

  // Deploy to home base manually so it's not empty anymore
  sAi.board['0,-3'].soldiers = [{ value: 13, revealed: false }];
  sAi.board['0,-3'].owner = 'X';
  // Now deploy phase, hand has cards
  aiAction = GrailQuestEngine.getAiAction(sAi, 'minimax', 3, null, 1000);
  // It shouldn't be forced to deploy to base anymore (can deploy to base or urban)
  assert.ok(aiAction.type === 'deploy');

  // Move phase: base only has 1 card
  sAi.phase = 'move';
  sAi.turn = 'X';
  sAi.board['0,-3'].soldiers = [{ value: 13, revealed: false }]; // King at base
  sAi.board['0,-3'].owner = 'X';
  // No other cells have units, so only the base has units
  aiAction = GrailQuestEngine.getAiAction(sAi, 'minimax', 3, null, 1000);
  // Since the base only has 1 unit, the AI cannot move it (must leave at least 1 unit).
  // Thus, there are no valid moves, and it should end turn.
  assert.strictEqual(aiAction.type, 'end_turn');

  // If the base has 2 cards, it can move 1 card
  sAi.board['0,-3'].soldiers = [
    { value: 13, revealed: false },
    { value: 11, revealed: false }
  ];
  aiAction = GrailQuestEngine.getAiAction(sAi, 'minimax', 3, null, 1000);
  // Can move 1 card out
  assert.strictEqual(aiAction.type, 'move');
  assert.strictEqual(aiAction.count, 1);
  assert.strictEqual(aiAction.from, '0,-3');
  
  // React phase test: AI is defender
  let sAiReact = GrailQuestEngine.createInitialState();
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

  let reactAction = GrailQuestEngine.getAiAction(sAiReact, 'minimax', 3, null, 1000);
  assert.strictEqual(reactAction.type, 'react');
  assert.strictEqual(reactAction.reactType, 'retreat');
  assert.strictEqual(reactAction.retreatTo, '1,-1'); // Should choose the valid retreat cell

  // Execute reaction to verify it doesn't crash
  sAiReact = GrailQuestEngine.handleMove(sAiReact, reactAction, 'O');
  assert.strictEqual(sAiReact.pendingCombats.length, 0); // Resolved

  // ── Test Face Card Draw Limits ──
  console.log('  Testing card draw limits (max 1 King, 2 Queens, 3 Jacks)...');
  const sDraw = createInitialState(); // Has 1 King, 1 Queen, 1 Jack in X's hand.
  sDraw.hands.X = [
    { value: 13, revealed: false }, // 1 King
    { value: 12, revealed: false }, // 1 Queen
    { value: 11, revealed: false }  // 1 Jack
  ];
  sDraw.board = {};
  sDraw.pendingCombats = [];
  const originalRandom = Math.random;
  try {
    let callCount = 0;
    // Mock Math.random to return 0.95 (which yields 13) on first call, and 0.4 (which yields 5) on second call
    Math.random = () => {
      callCount++;
      if (callCount === 1) return 0.95; // yields 13 (King)
      return 0.4; // yields 5 (number card)
    };
    
    const kingDraw = drawRandomCard(sDraw, 'X');
    assert.strictEqual(kingDraw.value, 5); // Should redraw because 1 King is already in play

    // Reset mock for Queen test: first call yields 12 (Queen), second yields 5
    callCount = 0;
    Math.random = () => {
      callCount++;
      if (callCount === 1) return 0.85; // yields 12 (Queen)
      return 0.4;
    };
    const queenDraw1 = drawRandomCard(sDraw, 'X');
    assert.strictEqual(queenDraw1.value, 12); // Should allow 2nd Queen since max is 2 and we only have 1 in play

    // Now add another queen so we have 2 Queens in play
    sDraw.hands.X.push({ value: 12, revealed: false });
    callCount = 0;
    const queenDraw2 = drawRandomCard(sDraw, 'X');
    assert.strictEqual(queenDraw2.value, 5); // Should redraw to number card because 2 Queens are in play

    // Reset mock for Jack test: first call yields 11 (Jack), second yields 5
    callCount = 0;
    Math.random = () => {
      callCount++;
      if (callCount === 1) return 0.77; // yields 11 (Jack)
      return 0.4;
    };
    const jackDraw1 = drawRandomCard(sDraw, 'X');
    assert.strictEqual(jackDraw1.value, 11); // Should allow 2nd Jack
    
    sDraw.hands.X.push({ value: 11, revealed: false }); // Now 2 Jacks in play
    callCount = 0;
    const jackDraw2 = drawRandomCard(sDraw, 'X');
    assert.strictEqual(jackDraw2.value, 11); // Should allow 3rd Jack
    
    sDraw.hands.X.push({ value: 11, revealed: false }); // Now 3 Jacks in play
    callCount = 0;
    const jackDraw3 = drawRandomCard(sDraw, 'X');
    assert.strictEqual(jackDraw3.value, 5); // Should redraw because 3 Jacks are in play
  } finally {
    Math.random = originalRandom;
  }

  // ── Test Turn Limit Draw ──
  console.log('  Testing turn limit draw (draw at 400 turns)...');
  const sLimit = createInitialState();
  assert.strictEqual(sLimit.turnCount, 0);
  
  sLimit.turnCount = 399;
  sLimit.phase = 'move';
  sLimit.turn = 'X';
  
  const finalState = GrailQuestEngine.handleMove(sLimit, { type: 'end_turn' }, 'X');
  assert.strictEqual(finalState.turnCount, 400);
  assert.strictEqual(finalState.winner, 'draw');

  // ── Test Grail Lock and Locked Soldiers Rule ──
  console.log('  Testing Grail lock rules (cannot leave Grail without King, must move all)...');
  const sLock = createInitialState();
  sLock.board['0,0'].owner = 'X';
  sLock.board['0,0'].soldiers = [
    { value: 13, revealed: false }, // King
    { value: 5, revealed: false }   // Number card
  ];
  sLock.phase = 'move';
  sLock.turn = 'X';
  
  // Try to move only 1 soldier out of the Grail cell -> Should throw
  assert.throws(() => {
    GrailQuestEngine.handleMove(sLock, { type: 'move', from: '0,0', to: '0,-1', count: 1 }, 'X');
  }, /Must move all soldiers from the Grail cell together/);
  
  // Try to move all soldiers, but without a King
  sLock.board['0,0'].soldiers = [
    { value: 10, revealed: false },
    { value: 5, revealed: false }
  ];
  assert.throws(() => {
    GrailQuestEngine.handleMove(sLock, { type: 'move', from: '0,0', to: '0,-1', count: 2 }, 'X');
  }, /Must include the King in the moving stack/);

  // Clean move with all soldiers including King
  sLock.board['0,0'].soldiers = [
    { value: 13, revealed: false },
    { value: 5, revealed: false }
  ];
  const lockNextState = GrailQuestEngine.handleMove(sLock, { type: 'move', from: '0,0', to: '0,-1', count: 2 }, 'X');
  assert.strictEqual(lockNextState.board['0,0'].soldiers.length, 0);
  assert.strictEqual(lockNextState.movesThisTurn?.[0].cards.length, 2);

  // ── Test King Death Carry Retreat (No longer blocked by empty cell requirement) ──
  console.log('  Testing King death carry retreat to non-empty cell...');
  let sDeath = createInitialState();
  sDeath.board['0,0'].owner = 'X';
  sDeath.board['0,0'].soldiers = [
    { value: 13, revealed: false }, // King
    { value: 12, revealed: false }  // Queen
  ];
  
  sDeath.board['0,-1'].owner = 'O';
  sDeath.board['0,-1'].soldiers = [
    { value: 13, revealed: false }  // King
  ];
  
  sDeath.phase = 'move';
  sDeath.turn = 'X';
  
  // Try to move carrying Grail to (0,-1) -> Should succeed and initiate combat
  let sDeathAfter = GrailQuestEngine.handleMove(sDeath, { type: 'move', from: '0,0', to: '0,-1', count: 2 }, 'X');
  assert.strictEqual(sDeathAfter.grailCellKey, '0,-1');
  assert.strictEqual(sDeathAfter.pendingCombats.length, 1);
  const combatDeath = sDeathAfter.pendingCombats[0];
  assert.strictEqual(combatDeath.cellKey, '0,-1');
  assert.strictEqual(combatDeath.attacker, 'X');
  assert.strictEqual(combatDeath.carriesGrail, true);

  // ── Test King Death Carry Retreat on Merge (No longer blocked by empty cell requirement) ──
  console.log('  Testing King death carry retreat on merge...');
  let sMergeDeath = createInitialState();
  
  // Set up Grail cell (0,0) with King and Queen
  sMergeDeath.board['0,0'].owner = 'X';
  sMergeDeath.board['0,0'].soldiers = [
    { value: 13, revealed: false }, // King
    { value: 12, revealed: false }  // Queen
  ];
  
  // Set up another cell (1,-1) with a Jack
  sMergeDeath.board['1,-1'].owner = 'X';
  sMergeDeath.board['1,-1'].soldiers = [
    { value: 11, revealed: false }  // Jack
  ];
  
  // Set up destination cell (0,-1) owned by O
  sMergeDeath.board['0,-1'].owner = 'O';
  sMergeDeath.board['0,-1'].soldiers = [
    { value: 13, revealed: false }  // O's King
  ];
  
  sMergeDeath.phase = 'move';
  sMergeDeath.turn = 'X';
  
  // Move 1: Jack moves to (0,-1) -> initiates combat
  sMergeDeath = GrailQuestEngine.handleMove(sMergeDeath, { type: 'move', from: '1,-1', to: '0,-1', count: 1 }, 'X');
  
  // Move 2: King + Queen move carrying the Grail to (0,-1) -> Should succeed and merge into combat
  let sMergeDeathAfter = GrailQuestEngine.handleMove(sMergeDeath, { type: 'move', from: '0,0', to: '0,-1', count: 2 }, 'X');
  assert.strictEqual(sMergeDeathAfter.grailCellKey, '0,-1');
  assert.strictEqual(sMergeDeathAfter.pendingCombats.length, 1);
  const combatMerge = sMergeDeathAfter.pendingCombats[0];
  assert.strictEqual(combatMerge.carriesGrail, true);

  // 12. Neutral Soldiers / Empty-Refill Cell Owner Retention Bug Test

  console.log('👉 Testing: Empty-Refill Cell Owner Retention (preventing neutral soldiers)');
  // ── Regression Test: Duplication bug when Defender wins combat ──
  console.log('👉 Testing: Resolved Combats do not trigger move application at End Turn');
  let sRegress = createInitialState();
  // X attacks O at 0,1
  sRegress.board['0,1'].owner = 'O';
  sRegress.board['0,1'].soldiers = [{ value: 11, revealed: false }]; // O has Jack
  sRegress.board['1,0'].owner = 'X';
  sRegress.board['1,0'].soldiers = [{ value: 11, revealed: false }]; // X has Jack
  sRegress.turn = 'X';
  sRegress.phase = 'move';
  sRegress = GrailQuestEngine.handleMove(sRegress, { type: 'move', from: '1,0', to: '0,1', count: 1 }, 'X');
  assert.strictEqual(sRegress.pendingCombats.length, 1);
  assert.strictEqual(sRegress.movesThisTurn!.length, 1);
  
  // Resolve combat (Draw -> Both destroyed)
  sRegress.phase = 'react';
  sRegress.turn = 'X'; // React doesn't check turn, but let's keep it clean
  sRegress = GrailQuestEngine.handleMove(sRegress, { type: 'react', reactType: 'fight', cellKey: '0,1' }, 'O');
  
  // Both cards destroyed. Pending combat should be removed, and movesThisTurn should be cleared!
  assert.strictEqual(sRegress.pendingCombats.length, 0);
  assert.strictEqual(sRegress.movesThisTurn!.length, 0);
  
  // End turn for X
  sRegress = GrailQuestEngine.handleMove(sRegress, { type: 'end_turn' }, 'X');
  
  // O's cell should NOT be captured by X, and NO cards should be duplicated!
  assert.strictEqual(sRegress.board['0,1'].owner, null); // Both died, cell becomes neutral
  assert.strictEqual(sRegress.board['0,1'].soldiers.length, 0);
  let sEmptyRefill = GrailQuestEngine.createInitialState();
  sEmptyRefill.board['0,-3'].soldiers = [{ value: 10, revealed: false }, { value: 9, revealed: false }];
  sEmptyRefill.board['0,-2'].soldiers = [{ value: 8, revealed: false }, { value: 7, revealed: false }];
  sEmptyRefill.board['0,-2'].owner = 'X';
  
  sEmptyRefill = GrailQuestEngine.handleMove(sEmptyRefill, { type: 'end_deploy' }, 'X');
  
  sEmptyRefill = GrailQuestEngine.handleMove(sEmptyRefill, { type: 'move', from: '0,-2', to: '0,-1', count: 1 }, 'X');
  assert.strictEqual(sEmptyRefill.board['0,-2'].soldiers.length, 1);
  assert.strictEqual(sEmptyRefill.board['0,-2'].owner, 'X');
  
  sEmptyRefill = GrailQuestEngine.handleMove(sEmptyRefill, { type: 'move', from: '0,-3', to: '0,-2', count: 1 }, 'X');
  assert.strictEqual(sEmptyRefill.board['0,-3'].soldiers.length, 1);
  
  sEmptyRefill = GrailQuestEngine.handleMove(sEmptyRefill, { type: 'move', from: '0,-2', to: '0,-1', count: 1 }, 'X');
  assert.strictEqual(sEmptyRefill.board['0,-2'].soldiers.length, 0);
  assert.strictEqual(sEmptyRefill.board['0,-2'].owner, null);
  
  sEmptyRefill = GrailQuestEngine.handleMove(sEmptyRefill, { type: 'end_turn' }, 'X');
  
  assert.strictEqual(sEmptyRefill.board['0,-2'].soldiers.length, 1);
  assert.strictEqual(sEmptyRefill.board['0,-2'].owner, 'X');

  // 13. Radioactivity Combat Auto-Resolution Test
  console.log('👉 Testing: Radioactivity Combat Auto-Resolution');
  let sRadio = GrailQuestEngine.createInitialState();
  sRadio.board['0,0'].soldiers = [{ value: 5, revealed: false }];
  sRadio.board['0,0'].owner = 'O';
  sRadio.grailCellKey = '0,0';

  sRadio.phase = 'move';
  sRadio.turn = 'X';
  
  sRadio.board['0,-1'].soldiers = [{ value: 13, revealed: false }];
  sRadio.board['0,-1'].owner = 'X';
  sRadio = GrailQuestEngine.handleMove(sRadio, { type: 'move', from: '0,-1', to: '0,0', count: 1 }, 'X');

  assert.strictEqual(sRadio.pendingCombats.length, 1);
  assert.strictEqual(sRadio.pendingCombats[0].cellKey, '0,0');
  assert.strictEqual(sRadio.pendingCombats[0].attacker, 'X');
  assert.strictEqual(sRadio.pendingCombats[0].defender, 'O');

  sRadio.roundTurnsCompleted = 1;
  const originalRandomRadio = Math.random;
  Math.random = () => 0.1; // Ensure radioactivity kills the defender (0.1 < 0.5)
  sRadio = GrailQuestEngine.handleMove(sRadio, { type: 'end_turn' }, 'X');
  Math.random = originalRandomRadio;

  assert.strictEqual(sRadio.pendingCombats.length, 0);
  assert.strictEqual(sRadio.board['0,0'].owner, 'X');
  assert.strictEqual(sRadio.board['0,0'].soldiers.length, 1);
  assert.strictEqual(sRadio.board['0,0'].soldiers[0].value, 13);
  
  assert.ok((sRadio.history || []).some(log => typeof log === 'string' && log.includes('radioactivity')));
  assert.ok((sRadio.history || []).some(log => typeof log === 'string' && log.includes('resolved') && log.includes('radioactivity')));

  // 14. Grail Cell Entry & Movement Constraints Test
  console.log('👉 Testing: Grail cell entry & movement constraints');
  
  // Setup state where Grail is at (0,-1)
  let sConstraints = GrailQuestEngine.createInitialState();
  sConstraints.grailCellKey = '0,-1';
  
  // Cell (0,-2) owned by X, contains soldiers without King: [10, 5]
  sConstraints.board['0,-2'].owner = 'X';
  sConstraints.board['0,-2'].soldiers = [{ value: 10, revealed: false }, { value: 5, revealed: false }];
  sConstraints.phase = 'move';
  sConstraints.turn = 'X';
  
  // 1. Move stack from (0,-2) to Grail cell (0,-1) without King -> Should succeed
  let sConstraintsAfter = GrailQuestEngine.handleMove(sConstraints, { type: 'move', from: '0,-2', to: '0,-1', count: 2 }, 'X');
  
  // Verify units are in transit to (0,-1)
  assert.strictEqual(sConstraintsAfter.board['0,-2'].soldiers.length, 0);
  assert.strictEqual(sConstraintsAfter.movesThisTurn?.[0].to, '0,-1');
  
  // 3. Carrying Grail: destination does not need to be empty anymore
  // Reset state
  let sCarry = GrailQuestEngine.createInitialState();
  sCarry.grailCellKey = '0,0';
  
  // Grail cell (0,0) has King + number card
  sCarry.board['0,0'].owner = 'X';
  sCarry.board['0,0'].soldiers = [{ value: 13, revealed: false }, { value: 5, revealed: false }];
  sCarry.phase = 'move';
  sCarry.turn = 'X';
  
  // Adjacent cell (0,-1) is NOT empty (contains 1 soldier)
  sCarry.board['0,-1'].owner = 'O';
  sCarry.board['0,-1'].soldiers = [{ value: 6, revealed: false }];
  
  // Try to move carrying Grail to (0,-1) -> Should succeed and initiate combat
  let sCarryAfter = GrailQuestEngine.handleMove(sCarry, { type: 'move', from: '0,0', to: '0,-1', count: 2 }, 'X');
  assert.strictEqual(sCarryAfter.grailCellKey, '0,-1');
  assert.strictEqual(sCarryAfter.pendingCombats.length, 1);

  console.log('✅ All Grail Quest Engine tests passed successfully!');
}

runTests().catch(error => {
  console.error('❌ Tests failed!');
  console.error(error);
  process.exit(1);
});
