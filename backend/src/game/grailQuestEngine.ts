import { PlayerPiece, GrailQuestGameState, GrailQuestCell, GrailQuestCard, GrailQuestCellType, PendingCombat } from '@vibe-games/shared';

import { getDistance, isValidHex, getCellType, getInitialOwner, getNeighborIndex, getFarmLandsCount, AXIAL_NEIGHBORS } from './grailquest/gridUtils';
import { countFaceCardsInPlay, drawRandomCard, getCardLabel, runDeployDraw } from './grailquest/deckManager';
import { evaluateDuel, reassembleCellStack, reassembleCombatAttackerStack } from './grailquest/combatResolver';
import { getSmartAiAction } from './grailquest/aiHelpers';
import { checkGameEnd, endRound } from './grailquest/roundResolver';
import { handleReactAction, handleDeployAction, handleMoveAction, handleEndTurnAction } from './grailquest/actionHandlers';

// Generate the initial board state
export function generateBoard(): Record<string, GrailQuestCell> {
  const board: Record<string, GrailQuestCell> = {};
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

export function createInitialState(): GrailQuestGameState {
  const state: GrailQuestGameState = {
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
export const GrailQuestEngine = {
  createInitialState,
  
  handleMove(state: GrailQuestGameState, action: any, player: PlayerPiece): GrailQuestGameState {
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

    if (type === 'react') {
      return handleReactAction(state, action, player);
    }
    if (type === 'deploy_all' || type === 'deploy' || type === 'end_deploy') {
      return handleDeployAction(state, action, player);
    }
    if (type === 'move') {
      return handleMoveAction(state, action, player);
    }
    if (type === 'end_turn') {
      return handleEndTurnAction(state, player);
    }

    throw new Error('Invalid game action type');
  },

  getAiAction(state: GrailQuestGameState, botType: string, depth: number, weights: any, timeLimitMs: number): any {
    const player = state.turn;
    const opponent: PlayerPiece = player === 'X' ? 'O' : 'X';
    const homeBaseKey = player === 'X' ? '0,-3' : '0,3';
    const enemyBaseKey = player === 'X' ? '0,3' : '0,-3';

    if (botType === 'smart') {
      return getSmartAiAction(state, player, GrailQuestEngine.handleMove);
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
                  // Must move all soldiers from the Grail cell together when carrying the Grail
                  if (count !== cell.soldiers.length) continue;
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
