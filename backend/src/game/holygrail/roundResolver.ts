import { HolyGrailGameState, HolyGrailCard } from '@vibe-games/shared';
import { getCellType } from './gridUtils';
import { getCardLabel } from './deckManager';

// Check for victory/defeat at end of round
export function checkGameEnd(state: HolyGrailGameState): void {
  // 1. Grail at Home Base
  if (state.grailCellKey === '0,-3') {
    state.winner = 'X';
    return;
  }
  if (state.grailCellKey === '0,3') {
    state.winner = 'O';
    return;
  }

  // 2. Base Captured
  const xBaseOwner = state.board['0,-3']?.owner;
  const oBaseOwner = state.board['0,3']?.owner;

  let xDefeated = xBaseOwner === 'O';
  let oDefeated = oBaseOwner === 'X';

  if (xDefeated && oDefeated) {
    state.winner = 'draw';
    return;
  }

  if (xDefeated) {
    state.winner = 'O';
    state.hands.X = [];
    for (const cell of Object.values(state.board)) {
      if (cell.owner === 'X') {
        cell.owner = 'neutral';
      }
    }
    return;
  }

  if (oDefeated) {
    state.winner = 'X';
    state.hands.O = [];
    for (const cell of Object.values(state.board)) {
      if (cell.owner === 'O') {
        cell.owner = 'neutral';
      }
    }
    return;
  }

  // 3. Turn limit (Draw after 400 turns)
  if ((state.turnCount || 0) >= 400) {
    state.winner = 'draw';
    return;
  }
}

// End of Round Resolution
export function endRound(state: HolyGrailGameState): void {
  // 1. Grail Movement Resolution
  const candidates = state.grailMovementCandidates || [];
  const validDestinations: string[] = [];

  for (const destKey of candidates) {
    const destCell = state.board[destKey];
    if (destCell && destCell.soldiers.some(c => c.value === 13)) { // King present
      validDestinations.push(destKey);
    }
  }

  if (validDestinations.length > 0) {
    // If multiple Kings carried the Grail to different cells, pick one at random
    const chosen = validDestinations[Math.floor(Math.random() * validDestinations.length)];
    state.grailCellKey = chosen;
  }

  state.grailMovementCandidates = [];

  // 2. Radioactivity: each soldier in the Grail's cell is killed with 50% chance
  const grailCell = state.board[state.grailCellKey || '0,0'];
  if (grailCell && grailCell.soldiers.length > 0) {
    const killedCards: HolyGrailCard[] = [];
    const remainingSoldiers: HolyGrailCard[] = [];
    for (const soldier of grailCell.soldiers) {
      if (Math.random() < 0.5) {
        killedCards.push(soldier);
      } else {
        remainingSoldiers.push(soldier);
      }
    }
    grailCell.soldiers = remainingSoldiers;

    if (killedCards.length > 0) {
      const cellName = getCellType(grailCell.q, grailCell.r) === 'grail_center' ? 'Grail Center' : `${grailCell.q},${grailCell.r}`;
      const ownerName = grailCell.owner || 'neutral';

      if (!state.history) state.history = [];
      for (const killedCard of killedCards) {
        const cardName = getCardLabel(killedCard.value);
        state.history.push(JSON.stringify({
          type: 'radioactivity',
          cell: cellName,
          player: ownerName,
          card: cardName
        }));
      }

      if (grailCell.soldiers.length === 0) {
        if (grailCell.cellType !== 'home_base' && grailCell.cellType !== 'urban') {
          grailCell.owner = null;
        }
      }

      const combatIdx = state.pendingCombats.findIndex(c => c.cellKey === (state.grailCellKey || '0,0'));
      if (combatIdx !== -1) {
        const combat = state.pendingCombats[combatIdx];
        if (grailCell.soldiers.length === 0) {
          // Defender has no units left! Attacker captures the cell automatically
          grailCell.owner = combat.attacker;
          grailCell.soldiers = combat.attackerStack || [];
          
          state.pendingCombats.splice(combatIdx, 1);
          
          // Clear moving cards from movesThisTurn so they don't get merged at end_turn
          state.movesThisTurn = (state.movesThisTurn || []).filter(m => m.to !== combat.cellKey);

          state.history.push(`⚔️ Combat at ${cellName} resolved: Defender (${combat.defender}) has no units left due to radioactivity. Attacker (${combat.attacker}) captures the cell with ${combat.attackerStack?.length || 0} unit(s).`);
        } else {
          // Just update the pending combat defender counts
          combat.defenderRemainingCount = grailCell.soldiers.length;
          combat.defenderTopCard = grailCell.soldiers[0] || null;
        }
      }
    }
  }
}
