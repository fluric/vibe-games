import { PlayerPiece, GrailQuestGameState, GrailQuestCard, PendingCombat } from '@vibe-games/shared';
import { getDistance, getCellType } from './gridUtils';
import { getCardLabel, runDeployDraw } from './deckManager';
import { evaluateDuel, reassembleCellStack, reassembleCombatAttackerStack } from './combatResolver';
import { checkGameEnd, endRound } from './roundResolver';

export function handleReactAction(state: GrailQuestGameState, action: any, player: PlayerPiece): GrailQuestGameState {
  if (state.phase !== 'react') {
    throw new Error('Not in reaction phase');
  }

  const combatIdx = state.pendingCombats.findIndex(c => c.cellKey === action.cellKey && c.defender === player);
  if (combatIdx === -1) {
    throw new Error('No pending combat found for this cell');
  }

  const combat = state.pendingCombats[combatIdx];
  const cell = state.board[combat.cellKey];
  const attackerStack = combat.attackerStack || [];
  const defenderStack = cell.soldiers;

  if (action.reactType === 'fight') {
    if (attackerStack.length === 0 || defenderStack.length === 0) {
      state.pendingCombats.splice(combatIdx, 1);
      state.movesThisTurn = (state.movesThisTurn || []).filter(m => m.to !== combat.cellKey);
      const remainingDefenses = state.pendingCombats.some(c => c.defender === player);
      if (!remainingDefenses) {
        state.phase = 'deploy';
        if (!state.drawnThisTurn) {
          const drawn = runDeployDraw(state, player);
          state.hands[player] = [...(state.hands[player] || []), ...drawn];
          state.drawnThisTurn = true;
        }
      }
      checkGameEnd(state);
      return state;
    }

    const attackerCard = attackerStack[0];
    const defenderCard = defenderStack[0];

    // Mark both cards as revealed
    attackerCard.revealed = true;
    defenderCard.revealed = true;

    const isHill = cell.cellType === 'hill';
    if (isHill && defenderStack.length >= 2) {
      // Hill defense draw 2: select best
      const c1 = defenderStack[0];
      const c2 = defenderStack[1];
      c1.revealed = true;
      c2.revealed = true;

      const res1 = evaluateDuel(attackerCard.value, c1.value);
      const res2 = evaluateDuel(attackerCard.value, c2.value);

      let bestCardIdx = 0;
      let worstCardIdx = 1;
      let bestResult = res1;

      // Defender prefers 'defender' (win) > 'draw' (draw) > 'attacker' (loss)
      const scoreResult = (res: any) => {
        if (res.winner === 'defender') return 3;
        if (res.winner === 'draw') return 2;
        return 1;
      };

      if (scoreResult(res2) > scoreResult(res1)) {
        bestCardIdx = 1;
        worstCardIdx = 0;
        bestResult = res2;
      } else if (scoreResult(res1) === scoreResult(res2)) {
        // Tie-breaker: choose higher value
        if (c2.value > c1.value) {
          bestCardIdx = 1;
          worstCardIdx = 0;
          bestResult = res2;
        }
      }

      const bestCard = defenderStack[bestCardIdx];
      const worstCard = defenderStack[worstCardIdx];

      const attackerName = getCardLabel(attackerCard.value);
      const bestName = getCardLabel(bestCard.value);
      const worstName = getCardLabel(worstCard.value);
      const cellName = getCellType(cell.q, cell.r) === 'grail_center' ? 'Grail Center' : `${cell.q},${cell.r}`;

      if (bestResult.winner === 'attacker') {
        // Both are worse, both destroyed!
        defenderStack.splice(0, 2);
        attackerStack.shift();
        // Winner goes to bottom
        attackerCard.value = bestResult.newAttackerVal;
        attackerStack.push(attackerCard);

        if (!state.history) state.history = [];
        state.history.push(`⚔️ Hill Combat at ${cellName}: Attacker (${combat.attacker})'s ${attackerName} vs Defender (${combat.defender})'s [${bestName}, ${worstName}]. Attacker wins! Defender's cards destroyed. Attacker degrades to ${getCardLabel(bestResult.newAttackerVal)}.`);
      } else if (bestResult.winner === 'defender') {
        // Defender wins
        attackerStack.shift();
        defenderStack.splice(bestCardIdx, 1);
        bestCard.value = bestResult.newDefenderVal;
        // Best goes to bottom, worst stays in stack and goes to bottom too
        defenderStack.push(bestCard);
        
        // Move worst card to bottom
        const wCard = defenderStack.splice(defenderStack.indexOf(worstCard), 1)[0];
        defenderStack.push(wCard);

        if (!state.history) state.history = [];
        state.history.push(`⚔️ Hill Combat at ${cellName}: Attacker (${combat.attacker})'s ${attackerName} vs Defender (${combat.defender})'s [${bestName}, ${worstName}]. Defender chooses ${bestName} and wins! Attacker's card destroyed. Defender degrades to ${getCardLabel(bestResult.newDefenderVal)}.`);
      } else {
        // Draw: Both attacker and both drawn defender cards are destroyed
        attackerStack.shift();
        defenderStack.splice(0, 2);

        if (!state.history) state.history = [];
        state.history.push(`⚔️ Hill Combat at ${cellName}: Attacker (${combat.attacker})'s ${attackerName} vs Defender (${combat.defender})'s [${bestName}, ${worstName}]. Draw! Defender's cards [${bestName}, ${worstName}] and Attacker's card are all destroyed.`);
      }

    } else {
      // Normal duel
      const duelRes = evaluateDuel(attackerCard.value, defenderCard.value);
      const attackerName = getCardLabel(attackerCard.value);
      const defenderName = getCardLabel(defenderCard.value);
      const cellName = getCellType(cell.q, cell.r) === 'grail_center' ? 'Grail Center' : `${cell.q},${cell.r}`;

      if (duelRes.winner === 'attacker') {
        defenderStack.shift(); // defender card destroyed
        attackerStack.shift();
        attackerCard.value = duelRes.newAttackerVal;
        attackerStack.push(attackerCard);

        if (!state.history) state.history = [];
        state.history.push(`⚔️ Combat at ${cellName}: Attacker (${combat.attacker})'s ${attackerName} vs Defender (${combat.defender})'s ${defenderName}. Attacker wins! Defender's card destroyed.${duelRes.newAttackerVal !== attackerCard.value ? ` Attacker degrades to ${getCardLabel(duelRes.newAttackerVal)}.` : ''}`);
      } else if (duelRes.winner === 'defender') {
        attackerStack.shift(); // attacker card destroyed
        defenderStack.shift();
        defenderCard.value = duelRes.newDefenderVal;
        defenderStack.push(defenderCard);

        if (!state.history) state.history = [];
        state.history.push(`⚔️ Combat at ${cellName}: Attacker (${combat.attacker})'s ${attackerName} vs Defender (${combat.defender})'s ${defenderName}. Defender wins! Attacker's card destroyed.${duelRes.newDefenderVal !== defenderCard.value ? ` Defender degrades to ${getCardLabel(duelRes.newDefenderVal)}.` : ''}`);
      } else {
        // Draw: both destroyed
        attackerStack.shift();
        defenderStack.shift();

        if (!state.history) state.history = [];
        state.history.push(`⚔️ Combat at ${cellName}: Attacker (${combat.attacker})'s ${attackerName} vs Defender (${combat.defender})'s ${defenderName}. Draw! Both cards are destroyed.`);
      }
    }

    // Update counts
    combat.attackerRemainingCount = attackerStack.length;
    combat.defenderRemainingCount = defenderStack.length;
    combat.attackerTopCard = attackerStack[0] || null;
    combat.defenderTopCard = defenderStack[0] || null;

    // Check if King died carrying the Grail
    const isGrailCombat = !!combat.carriesGrail;
    const hasKing = attackerStack.some(c => c.value === 13);

    if (isGrailCombat && !hasKing) {
      // King died carrying the Grail! Abort move, return survivors and Grail to origin
      const originKey = combat.originKey;
      if (originKey) {
        const originCell = state.board[originKey];
        if (originCell) {
          originCell.owner = combat.attacker;
          originCell.soldiers = [...originCell.soldiers, ...attackerStack];
        }
        state.grailCellKey = originKey;
      }

      // Combat is aborted
      state.pendingCombats.splice(combatIdx, 1);

      // Clear moving cards from movesThisTurn so they don't get merged at end_turn
      state.movesThisTurn = (state.movesThisTurn || []).filter(m => m.to !== combat.cellKey);

      // Log to history
      if (!state.history) state.history = [];
      state.history.push(`⚠️ Grail Transport Interrupted: King died in combat. Grail and surviving units retreated to ${originKey || 'origin'}.`);

      // Update defender cell state since combat resolved
      if (defenderStack.length === 0) {
        if (cell.cellType !== 'home_base' && cell.cellType !== 'urban') {
          cell.owner = null;
        }
        cell.soldiers = [];
      } else {
        cell.soldiers = defenderStack;
      }

      const remainingDefenses = state.pendingCombats.some(c => c.defender === player);
      if (!remainingDefenses) {
        state.phase = 'deploy';
        if (!state.drawnThisTurn) {
          const drawn = runDeployDraw(state, player);
          state.hands[player] = [...(state.hands[player] || []), ...drawn];
          state.drawnThisTurn = true;
        }
      }
      checkGameEnd(state);
      return state;
    }

    // Resolve combat check
    if (attackerStack.length === 0) {
      state.pendingCombats.splice(combatIdx, 1);
      if (defenderStack.length === 0 && cell.cellType !== 'home_base' && cell.cellType !== 'urban') {
        cell.owner = null;
      }
      state.movesThisTurn = (state.movesThisTurn || []).filter(m => m.to !== combat.cellKey);
    } else if (defenderStack.length === 0) {
      // Attacker wins and captures cell
      cell.owner = combat.attacker;
      cell.soldiers = attackerStack;
      state.pendingCombats.splice(combatIdx, 1);
      state.movesThisTurn = (state.movesThisTurn || []).filter(m => m.to !== combat.cellKey);
    }

  } else if (action.reactType === 'retreat') {
    const destKey = action.retreatTo;
    if (!destKey) throw new Error('Missing retreat destination cell');
    
    const destCell = state.board[destKey];
    if (!destCell || destCell.owner !== player) {
      throw new Error('Retreat destination must be a friendly owned cell');
    }
    if (getDistance(cell.q, cell.r, destCell.q, destCell.r) !== 1) {
      throw new Error('Retreat destination must be adjacent');
    }

    // Move defender stack to bottom of destination stack
    destCell.soldiers = [...destCell.soldiers, ...defenderStack];
    
    // Attacker occupies contested cell
    cell.owner = combat.attacker;
    cell.soldiers = attackerStack;

    const cellName = getCellType(cell.q, cell.r) === 'grail_center' ? 'Grail Center' : `${cell.q},${cell.r}`;
    if (!state.history) state.history = [];
    state.history.push(`🏃 Retreat at ${cellName}: Defender (${combat.defender}) retreated to ${destKey} with ${defenderStack.length} unit(s). Attacker (${combat.attacker}) captures ${cellName} with ${attackerStack.length} unit(s).`);

    // Resolve combat
    state.pendingCombats.splice(combatIdx, 1);
    state.movesThisTurn = (state.movesThisTurn || []).filter(m => m.to !== combat.cellKey);
  }

  // Check if more reactions are needed, otherwise transition to deploy
  const remainingDefenses = state.pendingCombats.some(c => c.defender === player);
  if (!remainingDefenses) {
    state.phase = 'deploy';
    // Auto-draw for deploy phase
    if (!state.drawnThisTurn) {
      const drawn = runDeployDraw(state, player);
      state.hands[player] = [...(state.hands[player] || []), ...drawn];
      state.drawnThisTurn = true;
    }
  }

  // Check for immediate game end (e.g. base captured or defender defeated)
  checkGameEnd(state);

  return state;
}

export function handleDeployAction(state: GrailQuestGameState, action: any, player: PlayerPiece): GrailQuestGameState {
  const type = action.action || action.type;

  if (type === 'deploy_all') {
    if (state.phase !== 'deploy') {
      throw new Error('Not in deployment phase');
    }

    const cellKey = action.cellKey;
    const cell = state.board[cellKey];
    if (!cell || cell.owner !== player) {
      throw new Error('Can only deploy to cells you own');
    }
    if (cell.cellType !== 'urban' && cell.cellType !== 'home_base') {
      throw new Error('Can only deploy to Urban housing cells or your Home Base');
    }

    const hand = state.hands[player] || [];
    if (hand.length === 0) {
      return state;
    }

    cell.soldiers.push(...hand);
    state.hands[player] = [];

    return state;
  }

  if (type === 'deploy') {
    if (state.phase !== 'deploy') {
      throw new Error('Not in deployment phase');
    }

    const cellKey = action.cellKey;
    const cell = state.board[cellKey];
    if (!cell || cell.owner !== player) {
      throw new Error('Can only deploy to cells you own');
    }
    if (cell.cellType !== 'urban' && cell.cellType !== 'home_base') {
      throw new Error('Can only deploy to Urban housing cells or your Home Base');
    }

    const cardValue = action.cardValue;
    const hand = state.hands[player] || [];
    const cardIdx = hand.findIndex(c => c.value === cardValue);
    if (cardIdx === -1) {
      throw new Error('Card value not found in hand');
    }

    const cardToDeploy = hand.splice(cardIdx, 1)[0];
    cell.soldiers.push(cardToDeploy); // Deploys to bottom of stack

    return state;
  }

  if (type === 'end_deploy') {
    if (state.phase !== 'deploy') {
      throw new Error('Not in deployment phase');
    }
    state.phase = 'move';
    return state;
  }

  return state;
}

export function handleMoveAction(state: GrailQuestGameState, action: any, player: PlayerPiece): GrailQuestGameState {
  if (state.phase !== 'move') {
    throw new Error('Not in movement phase');
  }

  const fromKey = action.from;
  const toKey = action.to;
  const count = action.count;

  const fromCell = state.board[fromKey];
  const toCell = state.board[toKey];

  if (!fromCell || !toCell) {
    throw new Error('Invalid from/to cells');
  }
  if (fromCell.owner !== player) {
    throw new Error('Can only move from cells you own');
  }
  if (count <= 0 || count > fromCell.soldiers.length) {
    throw new Error('Invalid move count');
  }
  if (getDistance(fromCell.q, fromCell.r, toCell.q, toCell.r) !== 1) {
    throw new Error('Can only move to adjacent cells');
  }

  // Check Grail transport King requirement
  const isGrailMove = state.grailCellKey === fromKey;
  if (isGrailMove) {
    if (count !== fromCell.soldiers.length) {
      throw new Error('Must move all soldiers from the Grail cell together');
    }
    const hasKing = fromCell.soldiers.some(c => c.value === 13);
    if (!hasKing) {
      throw new Error('Must include the King in the moving stack to carry the Grail');
    }
  }

  const movingStack = fromCell.soldiers.slice(0, count);

  // Prevent moving cards that have already moved this turn
  const hasMovedCard = movingStack.some(c => c.moved === true);
  if (hasMovedCard) {
    throw new Error('Some soldiers in this stack have already moved this turn');
  }

  // Mark moving cards as moved
  for (const card of movingStack) {
    card.moved = true;
  }

  // Slice cards from origin cell
  fromCell.soldiers.splice(0, count);
  if (fromCell.soldiers.length === 0 && fromCell.cellType !== 'home_base' && fromCell.cellType !== 'urban' && fromCell.cellType !== 'farm_land') {
    fromCell.owner = null; // Cell becomes neutral/unoccupied
  }

  // Grail transport intent
  if (isGrailMove) {
    state.grailMovementCandidates = [...(state.grailMovementCandidates || []), toKey];
    state.grailCellKey = toKey; // Grail moves with the King immediately
  }

  // Record this move to resolve clockwise merges
  state.movesThisTurn = [...(state.movesThisTurn || []), {
    from: fromKey,
    to: toKey,
    cards: movingStack,
    carriesGrail: isGrailMove
  }];

  // Check destination ownership
  const isOccupiedByEnemy = toCell.owner !== null && toCell.owner !== player;
  const hasPendingCombat = state.pendingCombats.some(c => c.cellKey === toKey);

  if (isOccupiedByEnemy || hasPendingCombat) {
    // Combat attack initiated!
    const defender = toCell.owner || 'neutral';
    const existingCombatIdx = state.pendingCombats.findIndex(c => c.cellKey === toKey && c.attacker === player);

    if (existingCombatIdx !== -1) {
      // Merge this incoming stack into the existing pending attack stack (respecting clockwise offset)
      const combat = state.pendingCombats[existingCombatIdx];
      combat.attackerStack = reassembleCombatAttackerStack(state, toKey);
      combat.attackerRemainingCount = combat.attackerStack.length;
      combat.attackerTopCard = combat.attackerStack[0] || null;
      if (isGrailMove) {
        combat.carriesGrail = true;
        combat.originKey = fromKey;
      }
    } else {
      // Create new PendingCombat
      const newCombat: PendingCombat = {
        cellKey: toKey,
        attacker: player,
        defender,
        attackerStack: movingStack,
        attackerRemainingCount: count,
        defenderRemainingCount: toCell.soldiers.length,
        attackerTopCard: movingStack[0],
        defenderTopCard: toCell.soldiers[0] || null,
        originKey: fromKey,
        carriesGrail: isGrailMove
      };
      state.pendingCombats.push(newCombat);
    }
  } else {
    // Friendly movement: claim the cell owner immediately, but do NOT merge soldiers yet (stays in transit on the arrow)
    toCell.owner = player;
  }
  
  // Check for immediate game end (e.g. base captured if unoccupied)
  checkGameEnd(state);

  return state;
}

export function handleEndTurnAction(state: GrailQuestGameState, player: PlayerPiece): GrailQuestGameState {
  // 1. Finalize friendly movements by placing the in-transit cards on their destination cells
  const friendlyTargets = new Set<string>();
  for (const move of state.movesThisTurn || []) {
    const hasCombat = state.pendingCombats.some(c => c.cellKey === move.to);
    if (!hasCombat) {
      friendlyTargets.add(move.to);
    }
  }
  for (const toKey of friendlyTargets) {
    const toCell = state.board[toKey];
    if (toCell) {
      toCell.soldiers = reassembleCellStack(state, toKey, toCell.soldiers);
      toCell.owner = player;
    }
  }

  state.movesThisTurn = [];
  state.drawnThisTurn = false;
  
  const opponent: PlayerPiece = player === 'X' ? 'O' : 'X';
  state.turn = opponent;
  
  // Increment turn count
  state.turnCount = (state.turnCount || 0) + 1;
  
  // Determine next player phase (React if under attack, else Deploy)
  const hasDefenses = state.pendingCombats.some(c => c.defender === opponent);
  state.phase = hasDefenses ? 'react' : 'deploy';

  // Increment turns completed in round
  state.roundTurnsCompleted = (state.roundTurnsCompleted || 0) + 1;
  
  if (state.roundTurnsCompleted >= 2) {
    endRound(state);
    state.roundTurnsCompleted = 0;
    
    // Re-evaluate next player phase after endRound resolution in case state changed
    const reHasDefenses = state.pendingCombats.some(c => c.defender === opponent);
    state.phase = reHasDefenses ? 'react' : 'deploy';
  }

  // Draw cards immediately if the opponent starts their turn in the deploy phase
  if (state.phase === 'deploy' && !state.winner) {
    const drawn = runDeployDraw(state, opponent);
    state.hands[opponent] = [...(state.hands[opponent] || []), ...drawn];
    state.drawnThisTurn = true;
  }

  // Reset moved flags for all cards on the board and in hands
  for (const cell of Object.values(state.board)) {
    for (const card of cell.soldiers) {
      delete card.moved;
    }
  }
  for (const p of ['X', 'O'] as const) {
    for (const card of state.hands[p] || []) {
      delete card.moved;
    }
  }

  // Check for turn-limit draw
  checkGameEnd(state);

  return state;
}
