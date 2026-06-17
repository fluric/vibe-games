import { PlayerPiece, HolyGrailGameState, HolyGrailCell, HolyGrailCard, HolyGrailCellType, PendingCombat } from '@vibe-games/shared';

// Neighbor offsets in axial coordinates (q, r)
// Clockwise starting from East (3 o'clock)
export const AXIAL_NEIGHBORS = [
  { q: 1, r: 0 },   // 0: East / 3 o'clock
  { q: 0, r: 1 },   // 1: Southeast / 5 o'clock
  { q: -1, r: 1 },  // 2: Southwest / 7 o'clock
  { q: -1, r: 0 },  // 3: West / 9 o'clock
  { q: 0, r: -1 },  // 4: Northwest / 11 o'clock
  { q: 1, r: -1 }   // 5: Northeast / 1 o'clock
];

// Calculate distance from center (0,0) or between two cells
export function getDistance(q1: number, r1: number, q2: number, r2: number): number {
  return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs((q1 + r1) - (q2 + r2))) / 2;
}

// Check if axial coordinate is within radius 3 grid
export function isValidHex(q: number, r: number): boolean {
  return getDistance(0, 0, q, r) <= 3;
}

// Get the type of a cell based on coordinates
export function getCellType(q: number, r: number): HolyGrailCellType {
  if (q === 0 && r === 0) return 'grail_center';
  
  if (q === 0 && r === -3) return 'home_base'; // Player X
  if (q === 0 && r === 3) return 'home_base';  // Player O
  
  // Urban / Housing Hexes
  if ((q === -1 && r === -2) || (q === 2 && r === -2)) return 'urban'; // Player X
  if ((q === -2 && r === 2) || (q === 1 && r === 2)) return 'urban';   // Player O
  
  // Farm Land Hexes
  if ((q === -2 && r === 0) || (q === 2 && r === 0)) return 'farm_land';
  
  // Hill Hexes
  if ((q === -1 && r === -1) || (q === 1 && r === -1) || (q === 1 && r === 1) || (q === -1 && r === 1)) {
    return 'hill';
  }
  
  return 'normal';
}

// Get the initial owner of a cell
export function getInitialOwner(q: number, r: number): PlayerPiece | null {
  const type = getCellType(q, r);
  if (type === 'home_base') {
    return r < 0 ? 'X' : 'O';
  }
  return null;
}

// Generate the initial board state
export function generateBoard(): Record<string, HolyGrailCell> {
  const board: Record<string, HolyGrailCell> = {};
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) {
      if (isValidHex(q, r)) {
        const key = `${q},${r}`;
        board[key] = {
          q,
          r,
          cellType: getCellType(q, r),
          owner: getInitialOwner(q, r),
          soldiers: []
        };
      }
    }
  }
  return board;
}

export function createInitialState(): HolyGrailGameState {
  const state: HolyGrailGameState = {
    board: generateBoard(),
    hands: {
      X: [
        { value: 13, revealed: false }, // King
        { value: 12, revealed: false }, // Queen
        { value: 11, revealed: false }  // Jack
      ],
      O: [
        { value: 13, revealed: false }, // King
        { value: 12, revealed: false }, // Queen
        { value: 11, revealed: false }  // Jack
      ]
    },
    phase: 'deploy', // Players start by deploying their initial hand
    turn: 'X',
    winner: null,
    pendingCombats: [],
    grailCellKey: '0,0',
    grailMovementCandidates: [],
    drawnThisTurn: false,
    movesThisTurn: [],
    roundTurnsCompleted: 0,
    history: [],
    turnCount: 0
  };

  // Draw initial 2 cards for Player X immediately!
  const drawn = runDeployDraw(state, 'X');
  state.hands.X = [...state.hands.X, ...drawn];
  state.drawnThisTurn = true;

  return state;
}

// Count how many face cards are currently in play (hand + board) for a player
export function countFaceCardsInPlay(state: HolyGrailGameState, player: PlayerPiece) {
  const hand = state.hands[player] || [];
  let kings = hand.filter(c => c.value === 13).length;
  let queens = hand.filter(c => c.value === 12).length;
  let jacks = hand.filter(c => c.value === 11).length;

  for (const cell of Object.values(state.board)) {
    if (cell.owner === player) {
      for (const card of cell.soldiers) {
        if (card.value === 13) kings++;
        if (card.value === 12) queens++;
        if (card.value === 11) jacks++;
      }
    }
  }

  // Check pending combats where player is attacker
  for (const combat of state.pendingCombats) {
    if (combat.attacker === player && combat.attackerStack) {
      for (const card of combat.attackerStack) {
        if (card.value === 13) kings++;
        if (card.value === 12) queens++;
        if (card.value === 11) jacks++;
      }
    }
  }

  return { kings, queens, jacks };
}

// Draw a single random card obeying face card limits
export function drawRandomCard(state: HolyGrailGameState, player: PlayerPiece): HolyGrailCard {
  const value = Math.floor(Math.random() * 13) + 1; // 1 to 13 (Ace is replaced by 1)
  const faceCounts = countFaceCardsInPlay(state, player);

  if (value === 13 && faceCounts.kings >= 1) {
    return { value: Math.floor(Math.random() * 10) + 1, revealed: false }; // Redraw to number card (1..10)
  }
  if (value === 12 && faceCounts.queens >= 2) {
    return { value: Math.floor(Math.random() * 10) + 1, revealed: false };
  }
  if (value === 11 && faceCounts.jacks >= 3) {
    return { value: Math.floor(Math.random() * 10) + 1, revealed: false };
  }

  return { value, revealed: false };
}

// Format card value as a string (K, Q, J or number)
export function getCardLabel(val: number): string {
  if (val === 13) return 'King (K)';
  if (val === 12) return 'Queen (Q)';
  if (val === 11) return 'Jack (J)';
  return val.toString();
}

// Count Farm Land cells owned by player
export function getFarmLandsCount(state: HolyGrailGameState, player: PlayerPiece): number {
  let count = 0;
  for (const cell of Object.values(state.board)) {
    if (cell.cellType === 'farm_land' && cell.owner === player) {
      count++;
    }
  }
  return count;
}

// Perform deployment draws at start of deploy phase
export function runDeployDraw(state: HolyGrailGameState, player: PlayerPiece): HolyGrailCard[] {
  const isRound1PlayerX = player === 'X' && (state.history?.length === 0 || !state.history);
  const baseCards = isRound1PlayerX ? 2 : 4;
  const farmLandBonus = getFarmLandsCount(state, player);
  const totalDraw = baseCards + farmLandBonus;

  const drawn: HolyGrailCard[] = [];
  for (let i = 0; i < totalDraw; i++) {
    drawn.push(drawRandomCard(state, player));
  }
  return drawn;
}

// Find axial neighbor index for clockwise merging sort (0-5, or -1 if not neighbors)
export function getNeighborIndex(q_dest: number, r_dest: number, q_start: number, r_start: number): number {
  const dq = q_start - q_dest;
  const dr = r_start - r_dest;
  return AXIAL_NEIGHBORS.findIndex(n => n.q === dq && n.r === dr);
}

// Card comparison duel logic
// Returns: 'attacker' | 'defender' | 'draw'
export function evaluateDuel(attackerVal: number, defenderVal: number): { winner: 'attacker' | 'defender' | 'draw', newAttackerVal: number, newDefenderVal: number } {
  const isAttackerFace = attackerVal >= 11;
  const isDefenderFace = defenderVal >= 11;

  if (isAttackerFace && isDefenderFace) {
    if (attackerVal === defenderVal) {
      return { winner: 'draw', newAttackerVal: attackerVal, newDefenderVal: defenderVal };
    }
    // King (13) beats Jack (11)
    // Jack (11) beats Queen (12)
    // Queen (12) beats King (13)
    if (
      (attackerVal === 13 && defenderVal === 11) ||
      (attackerVal === 11 && defenderVal === 12) ||
      (attackerVal === 12 && defenderVal === 13)
    ) {
      return { winner: 'attacker', newAttackerVal: attackerVal, newDefenderVal: defenderVal };
    } else {
      return { winner: 'defender', newAttackerVal: attackerVal, newDefenderVal: defenderVal };
    }
  }

  // Face beats numbers
  if (isAttackerFace && !isDefenderFace) {
    return { winner: 'attacker', newAttackerVal: attackerVal, newDefenderVal: defenderVal };
  }
  if (!isAttackerFace && isDefenderFace) {
    return { winner: 'defender', newAttackerVal: attackerVal, newDefenderVal: defenderVal };
  }

  // Numbers comparison (1-10)
  if (attackerVal === defenderVal) {
    return { winner: 'draw', newAttackerVal: attackerVal, newDefenderVal: defenderVal };
  }
  if (attackerVal > defenderVal) {
    // Attacker wins. Attacker card is reduced by the defender card's value.
    return { winner: 'attacker', newAttackerVal: Math.max(1, attackerVal - defenderVal), newDefenderVal: defenderVal };
  } else {
    // Defender wins. Defender card is reduced by the attacker card's value.
    return { winner: 'defender', newAttackerVal: attackerVal, newDefenderVal: Math.max(1, defenderVal - attackerVal) };
  }
}

// Re-sort and assemble stack for a cell, respecting clockwise incoming moves
export function reassembleCellStack(state: HolyGrailGameState, cellKey: string, baseSoldiers: HolyGrailCard[]): HolyGrailCard[] {
  const incoming = (state.movesThisTurn || []).filter(m => m.to === cellKey);
  if (incoming.length === 0) return baseSoldiers;

  const [q_dest, r_dest] = cellKey.split(',').map(Number);
  
  // Sort incoming moves clockwise starting from East (neighbor index 0 to 5)
  const sortedIncoming = [...incoming].sort((a, b) => {
    const [aq, ar] = a.from.split(',').map(Number);
    const [bq, br] = b.from.split(',').map(Number);
    return getNeighborIndex(q_dest, r_dest, aq, ar) - getNeighborIndex(q_dest, r_dest, bq, br);
  });

  const mergedIncoming = sortedIncoming.flatMap(m => m.cards);
  return [...baseSoldiers, ...mergedIncoming];
}

// Re-sort and assemble combat attacker stack
export function reassembleCombatAttackerStack(state: HolyGrailGameState, cellKey: string): HolyGrailCard[] {
  const incoming = (state.movesThisTurn || []).filter(m => m.to === cellKey);
  const [q_dest, r_dest] = cellKey.split(',').map(Number);

  const sortedIncoming = [...incoming].sort((a, b) => {
    const [aq, ar] = a.from.split(',').map(Number);
    const [bq, br] = b.from.split(',').map(Number);
    return getNeighborIndex(q_dest, r_dest, aq, ar) - getNeighborIndex(q_dest, r_dest, bq, br);
  });

  return sortedIncoming.flatMap(m => m.cards);
}

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

  // 2. Radioactivity: kill 1 random card in the Grail's cell
  const grailCell = state.board[state.grailCellKey || '0,0'];
  if (grailCell && grailCell.soldiers.length > 0) {
    const killIdx = Math.floor(Math.random() * grailCell.soldiers.length);
    const killedCard = grailCell.soldiers[killIdx];
    grailCell.soldiers.splice(killIdx, 1);

    const cellName = getCellType(grailCell.q, grailCell.r) === 'grail_center' ? 'Grail Center' : `${grailCell.q},${grailCell.r}`;
    const cardName = getCardLabel(killedCard.value);
    const ownerName = grailCell.owner || 'neutral';

    if (!state.history) state.history = [];
    state.history.push(JSON.stringify({
      type: 'radioactivity',
      cell: cellName,
      player: ownerName,
      card: cardName
    }));

    if (grailCell.soldiers.length === 0) {
      if (grailCell.cellType !== 'home_base' && grailCell.cellType !== 'urban') {
        grailCell.owner = null;
      }
    }
  }

  // 3. Check Game Ending conditions
  checkGameEnd(state);
}

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
export function getSmartAiAction(state: HolyGrailGameState, player: PlayerPiece): any {
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
      HolyGrailEngine.handleMove(fightState, { type: 'react', cellKey, reactType: 'fight' }, player);
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
        HolyGrailEngine.handleMove(retreatState, { type: 'react', cellKey, reactType: 'retreat', retreatTo }, player);
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
      HolyGrailEngine.handleMove(endDeployState, { type: 'end_deploy' }, player);
      bestScore = evaluateBoard(endDeployState, player);
      bestAction = { type: 'end_deploy' };
    } catch (e) {}

    const uniqueCardValues = Array.from(new Set(hand.map(c => c.value)));

    for (const cell of validDeployCells) {
      const cellKey = `${cell.q},${cell.r}`;

      // Try deploy_all
      const deployAllState = JSON.parse(JSON.stringify(state));
      try {
        HolyGrailEngine.handleMove(deployAllState, { type: 'deploy_all', cellKey }, player);
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
          HolyGrailEngine.handleMove(deployOneState, { type: 'deploy', cellKey, cardValue: val }, player);
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
              if (usableCount === cell.soldiers.length && cell.soldiers.some(c => c.value === 13)) {
                moves.push({
                  type: 'move',
                  from: key,
                  to: nKey,
                  count: cell.soldiers.length
                });
              }
            } else {
              for (let count = 1; count <= usableCount; count++) {
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
      HolyGrailEngine.handleMove(endTurnState, { type: 'end_turn' }, player);
      bestScore = evaluateBoard(endTurnState, player);
      bestAction = { type: 'end_turn' };
    } catch (e) {}

    for (const move of moves) {
      const moveState = JSON.parse(JSON.stringify(state));
      try {
        HolyGrailEngine.handleMove(moveState, move, player);
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

export const HolyGrailEngine = {
  createInitialState,
  
  handleMove(state: HolyGrailGameState, action: any, player: PlayerPiece): HolyGrailGameState {
    if (state.winner) {
      throw new Error('Game is already finished');
    }
    if (state.turn !== player) {
      throw new Error(`It is not ${player}'s turn`);
    }

    const type = action.action || action.type;

    // Trigger auto-draw at deploy phase start
    if (state.phase === 'deploy' && !state.drawnThisTurn) {
      const drawn = runDeployDraw(state, player);
      state.hands[player] = [...(state.hands[player] || []), ...drawn];
      state.drawnThisTurn = true;
    }

    // Append action to history
    if (!state.history) {
      state.history = [];
    }
    const logAction = { ...action };
    if (type === 'deploy_all') {
      logAction.count = state.hands[player]?.length || 0;
    } else if (type === 'deploy') {
      logAction.count = 1;
    }
    if (type === 'deploy' || type === 'deploy_all') {
      delete (logAction as any).cardValue;
    }
    state.history.push(JSON.stringify({ ...logAction, player }));

    // ─── 1. REACT ACTION ───────────────────────────────────────────────────────
    if (type === 'react') {
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
          throw new Error('Cannot fight with empty stack');
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
            // Draw
            attackerStack.shift();
            defenderStack.splice(bestCardIdx, 1); // Best destroyed
            // Worst survives and goes to bottom
            const wCard = defenderStack.splice(defenderStack.indexOf(worstCard), 1)[0];
            defenderStack.push(wCard);

            if (!state.history) state.history = [];
            state.history.push(`⚔️ Hill Combat at ${cellName}: Attacker (${combat.attacker})'s ${attackerName} vs Defender (${combat.defender})'s [${bestName}, ${worstName}]. Draw! Defender's ${bestName} and Attacker's card are both destroyed. Defender's ${worstName} survives.`);
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

          return state;
        }

        // Resolve combat check
        if (attackerStack.length === 0) {
          state.pendingCombats.splice(combatIdx, 1);
          if (defenderStack.length === 0 && cell.cellType !== 'home_base' && cell.cellType !== 'urban') {
            cell.owner = null;
          }
        } else if (defenderStack.length === 0) {
          // Attacker wins and captures cell
          cell.owner = combat.attacker;
          cell.soldiers = attackerStack;
          state.pendingCombats.splice(combatIdx, 1);
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
        state.history.push(`🏃 Retreat at ${cellName}: Defender (${combat.defender}) retreated to ${destKey}. Attacker (${combat.attacker}) captures ${cellName} with ${attackerStack.length} unit(s).`);

        // Resolve combat
        state.pendingCombats.splice(combatIdx, 1);
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

    // ─── 2. DEPLOY ACTION ──────────────────────────────────────────────────────
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

    // ─── 3. MOVE ACTION ────────────────────────────────────────────────────────
    if (type === 'move') {
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

    // ─── 4. END TURN ACTION ────────────────────────────────────────────────────
    if (type === 'end_turn') {
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

    throw new Error('Invalid game action type');
  },

  getAiAction(state: HolyGrailGameState, botType: string, depth: number, weights: any, timeLimitMs: number): any {
    const player = state.turn;
    const opponent: PlayerPiece = player === 'X' ? 'O' : 'X';
    const homeBaseKey = player === 'X' ? '0,-3' : '0,3';
    const enemyBaseKey = player === 'X' ? '0,3' : '0,-3';

    if (botType === 'smart') {
      return getSmartAiAction(state, player);
    }

    // ─── 1. REACT PHASE ───
    if (state.phase === 'react') {
      const activeCombat = state.pendingCombats.find(c => c.defender === player);
      if (!activeCombat) {
        return { type: 'react', cellKey: '', reactType: 'fight' }; // fallback
      }

      const cellKey = activeCombat.cellKey;
      const cell = state.board[cellKey];
      if (!cell) {
        return { type: 'react', cellKey, reactType: 'fight' };
      }

      // Find valid retreat cells
      const [cq, cr] = cellKey.split(',').map(Number);
      const retreatOptions: string[] = [];

      for (const offset of AXIAL_NEIGHBORS) {
        const nq = cq + offset.q;
        const nr = cr + offset.r;
        const nKey = `${nq},${nr}`;
        const neighbor = state.board[nKey];
        if (neighbor) {
          // Valid retreat target must be owned by player
          const isFriendly = neighbor.owner === player;
          const hasCombat = state.pendingCombats.some(c => c.cellKey === nKey);
          if (isFriendly && !hasCombat) {
            retreatOptions.push(nKey);
          }
        }
      }

      // Heuristic: retreat if we have retreat options AND our top card is weaker than the attacker's top card (if known)
      const attackerTopVal = activeCombat.attackerTopCard?.value || 7;
      const defenderTopVal = activeCombat.defenderTopCard?.value || (cell.soldiers[0]?.value) || 0;

      if (retreatOptions.length > 0 && defenderTopVal < attackerTopVal) {
        // Pick retreat option that is closest to our home base
        const [hq, hr] = homeBaseKey.split(',').map(Number);
        retreatOptions.sort((a, b) => {
          const [aq, ar] = a.split(',').map(Number);
          const [bq, br] = b.split(',').map(Number);
          return getDistance(aq, ar, hq, hr) - getDistance(bq, br, hq, hr);
        });

        return {
          type: 'react',
          cellKey,
          reactType: 'retreat',
          retreatTo: retreatOptions[0]
        };
      }

      return {
        type: 'react',
        cellKey,
        reactType: 'fight'
      };
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

      // Rule: base defense. Check if home base has 0 units.
      const homeBase = state.board[homeBaseKey];
      const baseIsEmpty = !homeBase || homeBase.soldiers.length === 0;

      let targetCellKey = '';
      if (baseIsEmpty) {
        targetCellKey = homeBaseKey;
      } else {
        // Choose a deploy cell. Prefer home base or closest to the Grail.
        const [gq, gr] = (state.grailCellKey || '0,0').split(',').map(Number);
        validDeployCells.sort((a, b) => {
          return getDistance(a.q, a.r, gq, gr) - getDistance(b.q, b.r, gq, gr);
        });
        targetCellKey = `${validDeployCells[0].q},${validDeployCells[0].r}`;
      }

      // Pick a card. Higher values are better for defense or push.
      const sortedHand = [...hand].sort((a, b) => b.value - a.value);
      
      return {
        type: 'deploy',
        cellKey: targetCellKey,
        cardValue: sortedHand[0].value
      };
    }

    // ─── 3. MOVE PHASE ───
    if (state.phase === 'move') {
      // Limit number of moves to prevent infinite loops
      if ((state.movesThisTurn || []).length >= 4) {
        return { type: 'end_turn' };
      }

      const moves: any[] = [];
      const [hq, hr] = homeBaseKey.split(',').map(Number);
      const [eq, er] = enemyBaseKey.split(',').map(Number);
      const [gq, gr] = (state.grailCellKey || '0,0').split(',').map(Number);

      for (const [key, cell] of Object.entries(state.board)) {
        if (cell.owner === player && cell.soldiers.length > 0) {
          // Rule: always have at least one unit in base.
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
              // Ensure we don't move units that already moved
              if (cell.soldiers[0].moved === true) {
                continue;
              }
              let usableCount = 0;
              for (let i = 0; i < maxAllowedToMove; i++) {
                if (cell.soldiers[i].moved !== true) {
                  usableCount++;
                } else {
                  break;
                }
              }

              for (let count = 1; count <= usableCount; count++) {
                const isGrailMove = state.grailCellKey === key;
                if (isGrailMove) {
                  const movingCards = cell.soldiers.slice(0, count);
                  const hasKing = movingCards.some(c => c.value === 13);
                  if (!hasKing) continue;
                }

                moves.push({
                  from: key,
                  to: nKey,
                  count
                });
              }
            }
          }
        }
      }

      if (moves.length === 0) {
        return { type: 'end_turn' };
      }

      // Score moves
      const scoredMoves = moves.map(move => {
        let score = 0;
        const [fq, fr] = move.from.split(',').map(Number);
        const [tq, tr] = move.to.split(',').map(Number);
        const toCell = state.board[move.to];
        const fromCell = state.board[move.from];

        if (!toCell || !fromCell) return { move, score: -1000 };

        // 1. Carrying Grail closer to home base
        const isGrailMove = state.grailCellKey === move.from;
        if (isGrailMove) {
          const currentDist = getDistance(fq, fr, hq, hr);
          const newDist = getDistance(tq, tr, hq, hr);
          score += (currentDist - newDist) * 1500;
        }

        // 2. Intercepting/getting closer to the Grail
        if (!isGrailMove) {
          const currentDist = getDistance(fq, fr, gq, gr);
          const newDist = getDistance(tq, tr, gq, gr);
          score += (currentDist - newDist) * 150;
        }

        // 3. Capturing enemy base
        if (move.to === enemyBaseKey) {
          score += 1000;
        }

        // 4. Capturing neutral cells
        if (toCell.owner === null) {
          if (toCell.cellType === 'farm_land') score += 200;
          else if (toCell.cellType === 'urban') score += 150;
          else score += 50;
        }

        // 5. Combat evaluation
        if (toCell.owner !== null && toCell.owner !== player) {
          const ourTop = fromCell.soldiers[0]?.value || 0;
          const enemyTop = toCell.soldiers[0]?.value || 7;
          
          if (ourTop === 13 && enemyTop === 11) score += 300;
          else if (ourTop === 12 && enemyTop === 13) score += 300;
          else if (ourTop === 11 && enemyTop === 12) score += 300;
          else if (ourTop > 10 && enemyTop <= 10) score += 200;
          else if (ourTop <= 10 && enemyTop <= 10 && ourTop > enemyTop) score += 100 + (ourTop - enemyTop) * 10;
          else score -= 150;
        }

        // Add some small random noise
        score += Math.random() * 20;

        return { move, score };
      });

      scoredMoves.sort((a, b) => b.score - a.score);

      if (botType === 'random') {
        if (Math.random() < 0.25) {
          return { type: 'end_turn' };
        }
        return {
          type: 'move',
          ...moves[Math.floor(Math.random() * moves.length)]
        };
      }

      const best = scoredMoves[0];
      if (best.score < -50) {
        return { type: 'end_turn' };
      }

      return {
        type: 'move',
        ...best.move
      };
    }

    return { type: 'end_turn' };
  }
};
