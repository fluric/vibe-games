import { PlayerPiece, HolyGrailGameState, HolyGrailCard } from '@vibe-games/shared';
import { getDistance, getCellType, AXIAL_NEIGHBORS } from './gridUtils';
import { evaluateDuel } from './combatResolver';
import { getCardLabel } from './deckManager';

// Evaluate the board state from the perspective of the active player
export function evaluateBoard(state: HolyGrailGameState, player: PlayerPiece): number {
  const opponent: PlayerPiece = player === 'X' ? 'O' : 'X';
  let score = 0;

  // 1. Victory / Defeat
  if (state.winner === player) return 100000;
  if (state.winner === opponent) return -100000;

  // 2. Base ownership
  const homeBaseKey = player === 'X' ? '0,-3' : '0,3';
  const enemyBaseKey = player === 'X' ? '0,3' : '0,-3';
  
  const homeBase = state.board[homeBaseKey];
  const enemyBase = state.board[enemyBaseKey];

  if (homeBase && homeBase.owner === opponent) score -= 5000;
  if (enemyBase && enemyBase.owner === player) score += 5000;

  // 3. Grail location and carrier
  const [hq, hr] = homeBaseKey.split(',').map(Number);
  const [eq, er] = enemyBaseKey.split(',').map(Number);
  const [gq, gr] = (state.grailCellKey || '0,0').split(',').map(Number);

  const grailCell = state.board[state.grailCellKey || '0,0'];
  if (grailCell) {
    if (grailCell.owner === player) {
      // We carry the Grail!
      score += 3000;
      const dist = getDistance(gq, gr, hq, hr);
      score += (6 - dist) * 1000; // closer to home is better
    } else if (grailCell.owner === opponent) {
      // Opponent carries the Grail!
      score -= 3000;
      const dist = getDistance(gq, gr, eq, er);
      score -= (6 - dist) * 1000; // closer to their base is worse
    } else {
      // Grail is neutral
      const ourDist = getDistance(gq, gr, hq, hr);
      const oppDist = getDistance(gq, gr, eq, er);
      score += (oppDist - ourDist) * 150; // getting closer to neutral Grail is good
    }
  }

  // 4. Cell ownership, card values & positional heuristics
  for (const [key, cell] of Object.entries(state.board)) {
    const [cq, cr] = key.split(',').map(Number);
    const distToGrail = getDistance(cq, cr, gq, gr);
    const distToEnemyBase = getDistance(cq, cr, eq, er);
    const distToHomeBase = getDistance(cq, cr, hq, hr);

    if (cell.owner === player) {
      if (cell.cellType === 'farm_land') score += 200;
      else if (cell.cellType === 'urban') score += 150;
      else score += 40;

      // Positional rewards for friendly units in this cell
      if (cell.soldiers.length > 0) {
        const carriesGrail = state.grailCellKey === key;
        if (!carriesGrail) {
          // General friendly units should push towards the Grail (to capture/protect it)
          score += (6 - distToGrail) * 80;

          // King is the only one who can carry the Grail, so King should be pulled strongly to it
          const hasKing = cell.soldiers.some(c => c.value === 13);
          if (hasKing) {
            score += (6 - distToGrail) * 250;
          }
        }

        // Also push towards the enemy base to apply pressure / attack
        score += (6 - distToEnemyBase) * 40;
      }

      // Card values
      for (const card of cell.soldiers) {
        score += card.value * 10;
        if (card.value === 13) score += 300; // King
        if (card.value === 12) score += 200; // Queen
        if (card.value === 11) score += 150; // Jack
      }
    } else if (cell.owner === opponent) {
      if (cell.cellType === 'farm_land') score -= 200;
      else if (cell.cellType === 'urban') score -= 150;
      else score -= 40;

      // Penalize opponent units being close to the Grail / our base
      if (cell.soldiers.length > 0) {
        score -= (6 - distToGrail) * 80;
        const hasEnemyKing = cell.soldiers.some(c => c.value === 13);
        if (hasEnemyKing) {
          score -= (6 - distToGrail) * 250;
        }

        score -= (6 - distToHomeBase) * 40;
      }

      // Card values
      for (const card of cell.soldiers) {
        score -= card.value * 10;
        if (card.value === 13) score -= 300;
        if (card.value === 12) score -= 200;
        if (card.value === 11) score -= 150;
      }
    }
  }

  // 5. Hand sizes and cards
  const ourHand = state.hands[player] || [];
  const oppHand = state.hands[opponent] || [];

  for (const card of ourHand) {
    score += card.value * 5;
    if (card.value === 13) score += 50;
    if (card.value === 12) score += 40;
    if (card.value === 11) score += 30;
  }
  for (const card of oppHand) {
    score -= card.value * 5;
    if (card.value === 13) score -= 50;
    if (card.value === 12) score -= 40;
    if (card.value === 11) score -= 30;
  }

  // 6. Evaluate cards in transit (friendly moves during the turn)
  if (state.movesThisTurn) {
    for (const move of state.movesThisTurn) {
      const [tq, tr] = move.to.split(',').map(Number);
      const distToGrail = getDistance(tq, tr, gq, gr);
      const distToEnemyBase = getDistance(tq, tr, eq, er);

      // These are always friendly moves since movesThisTurn is reset at end of turn
      const carriesGrail = state.grailCellKey === move.from;
      if (!carriesGrail) {
        score += (6 - distToGrail) * 80;
        const hasKing = (move.cards || []).some((c: HolyGrailCard) => c.value === 13);
        if (hasKing) {
          score += (6 - distToGrail) * 250;
        }
      }
      score += (6 - distToEnemyBase) * 40;

      for (const card of move.cards || []) {
        score += card.value * 10;
        if (card.value === 13) score += 300;
        if (card.value === 12) score += 200;
        if (card.value === 11) score += 150;
      }
    }
  }

  // 7. Evaluate pending combats
  for (const combat of state.pendingCombats) {
    const isAttacker = combat.attacker === player;
    const combatCell = state.board[combat.cellKey];
    if (combatCell) {
      const ourTop = isAttacker 
        ? (combat.attackerTopCard?.value || combat.attackerStack?.[0]?.value || 0)
        : (combat.defenderTopCard?.value || combatCell.soldiers[0]?.value || 0);
      const enemyTop = isAttacker
        ? (combat.defenderTopCard?.value || combatCell.soldiers[0]?.value || 7)
        : (combat.attackerTopCard?.value || combat.attackerStack?.[0]?.value || 7);

      const duelRes = evaluateDuel(ourTop, enemyTop);
      let duelScore = 0;
      if (duelRes.winner === 'attacker') {
        duelScore = isAttacker ? 400 : -400;
      } else if (duelRes.winner === 'defender') {
        duelScore = isAttacker ? -400 : 400;
      }
      score += duelScore;
    }
  }

  return score;
}

// Generate the best move by simulating 1-ply lookahead actions and evaluating outcomes
export function getSmartAiAction(state: HolyGrailGameState, player: PlayerPiece, handleMove: Function): any {
  const opponent: PlayerPiece = player === 'X' ? 'O' : 'X';
  const homeBaseKey = player === 'X' ? '0,-3' : '0,3';

  // ─── 1. REACT PHASE ───
  if (state.phase === 'react') {
    const activeCombat = state.pendingCombats.find(c => c.defender === player);
    if (!activeCombat) {
      return { type: 'react', cellKey: '', reactType: 'fight' };
    }

    const cellKey = activeCombat.cellKey;
    const cell = state.board[cellKey];
    if (!cell) {
      return { type: 'react', cellKey, reactType: 'fight' };
    }

    const [cq, cr] = cellKey.split(',').map(Number);
    const retreatOptions: string[] = [];
    for (const offset of AXIAL_NEIGHBORS) {
      const nq = cq + offset.q;
      const nr = cr + offset.r;
      const nKey = `${nq},${nr}`;
      const neighbor = state.board[nKey];
      if (neighbor && neighbor.owner === player && !state.pendingCombats.some(c => c.cellKey === nKey)) {
        retreatOptions.push(nKey);
      }
    }

    let bestScore = -Infinity;
    let bestAction: any = null;

    // Try fight
    const fightState = JSON.parse(JSON.stringify(state));
    let fightOk = false;
    try {
      handleMove(fightState, { type: 'react', cellKey, reactType: 'fight' }, player);
      fightOk = true;
    } catch (e) {}

    if (fightOk) {
      bestScore = evaluateBoard(fightState, player);
      bestAction = { type: 'react', cellKey, reactType: 'fight' };
    }

    // Try retreats
    for (const retreatTo of retreatOptions) {
      const retreatState = JSON.parse(JSON.stringify(state));
      try {
        handleMove(retreatState, { type: 'react', cellKey, reactType: 'retreat', retreatTo }, player);
        const score = evaluateBoard(retreatState, player);
        if (score > bestScore) {
          bestScore = score;
          bestAction = { type: 'react', cellKey, reactType: 'retreat', retreatTo };
        }
      } catch (e) {}
    }

    if (!bestAction) {
      return { type: 'react', cellKey, reactType: 'fight' };
    }
    return bestAction;
  }

  // ─── 2. DEPLOY PHASE ───
  if (state.phase === 'deploy') {
    const hand = state.hands[player] || [];
    if (hand.length === 0) {
      return { type: 'end_deploy' };
    }

    const validDeployCells = Object.values(state.board).filter(cell => 
      cell.owner === player && (cell.cellType === 'urban' || cell.cellType === 'home_base')
    );

    if (validDeployCells.length === 0) {
      return { type: 'end_deploy' };
    }

    let bestScore = -Infinity;
    let bestAction: any = null;

    // Evaluate "end_deploy" first as baseline
    const endDeployState = JSON.parse(JSON.stringify(state));
    try {
      handleMove(endDeployState, { type: 'end_deploy' }, player);
      bestScore = evaluateBoard(endDeployState, player);
      bestAction = { type: 'end_deploy' };
    } catch (e) {}

    const uniqueCardValues = Array.from(new Set(hand.map(c => c.value)));

    for (const cell of validDeployCells) {
      const cellKey = `${cell.q},${cell.r}`;

      // Try deploy_all
      const deployAllState = JSON.parse(JSON.stringify(state));
      try {
        handleMove(deployAllState, { type: 'deploy_all', cellKey }, player);
        const scoreAll = evaluateBoard(deployAllState, player);
        if (scoreAll > bestScore) {
          bestScore = scoreAll;
          bestAction = { type: 'deploy_all', cellKey };
        }
      } catch (e) {}

      // Try single card deploys
      for (const val of uniqueCardValues) {
        const deployOneState = JSON.parse(JSON.stringify(state));
        try {
          handleMove(deployOneState, { type: 'deploy', cellKey, cardValue: val }, player);
          const scoreOne = evaluateBoard(deployOneState, player);
          if (scoreOne > bestScore) {
            bestScore = scoreOne;
            bestAction = { type: 'deploy', cellKey, cardValue: val };
          }
        } catch (e) {}
      }
    }

    if (!bestAction) {
      return { type: 'end_deploy' };
    }
    return bestAction;
  }

  // ─── 3. MOVE PHASE ───
  if (state.phase === 'move') {
    if ((state.movesThisTurn || []).length >= 4) {
      return { type: 'end_turn' };
    }

    const moves: any[] = [];

    for (const [key, cell] of Object.entries(state.board)) {
      if (cell.owner === player && cell.soldiers.length > 0) {
        const isHomeBase = key === homeBaseKey;
        const maxAllowedToMove = isHomeBase ? cell.soldiers.length - 1 : cell.soldiers.length;
        if (maxAllowedToMove <= 0) continue;

        const [cq, cr] = key.split(',').map(Number);

        for (const offset of AXIAL_NEIGHBORS) {
          const nq = cq + offset.q;
          const nr = cr + offset.r;
          const nKey = `${nq},${nr}`;
          const neighbor = state.board[nKey];
          if (neighbor) {
            if (cell.soldiers[0].moved === true) continue;

            let usableCount = 0;
            for (let i = 0; i < maxAllowedToMove; i++) {
              if (cell.soldiers[i].moved !== true) {
                usableCount++;
              } else {
                break;
              }
            }

            const isGrailMove = state.grailCellKey === key;
            if (isGrailMove) {
              if (usableCount === cell.soldiers.length && cell.soldiers.some(c => c.value === 13) && neighbor.soldiers.length === 0) {
                moves.push({
                  type: 'move',
                  from: key,
                  to: nKey,
                  count: cell.soldiers.length
                });
              }
            } else {
              for (let count = 1; count <= usableCount; count++) {
                const movingStack = cell.soldiers.slice(0, count);
                const isEnteringGrailCell = state.grailCellKey === nKey;
                if (isEnteringGrailCell && !movingStack.some(c => c.value === 13)) {
                  continue;
                }
                moves.push({
                  type: 'move',
                  from: key,
                  to: nKey,
                  count
                });
              }
            }
          }
        }
      }
    }

    let bestScore = -Infinity;
    let bestAction: any = null;

    // Evaluate "end_turn" first as baseline
    const endTurnState = JSON.parse(JSON.stringify(state));
    try {
      handleMove(endTurnState, { type: 'end_turn' }, player);
      bestScore = evaluateBoard(endTurnState, player);
      bestAction = { type: 'end_turn' };
    } catch (e) {}

    for (const move of moves) {
      const moveState = JSON.parse(JSON.stringify(state));
      try {
        handleMove(moveState, move, player);
        const score = evaluateBoard(moveState, player);
        // Small random noise to prevent identical move loops
        const finalScore = score + Math.random() * 5;
        if (finalScore > bestScore) {
          bestScore = finalScore;
          bestAction = move;
        }
      } catch (e) {}
    }

    if (!bestAction) {
      return { type: 'end_turn' };
    }
    return bestAction;
  }

  return { type: 'end_turn' };
}
