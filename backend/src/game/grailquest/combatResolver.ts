import { GrailQuestGameState, GrailQuestCard } from '@vibe-games/shared';
import { getNeighborIndex } from './gridUtils';

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
export function reassembleCellStack(state: GrailQuestGameState, cellKey: string, baseSoldiers: GrailQuestCard[]): GrailQuestCard[] {
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
export function reassembleCombatAttackerStack(state: GrailQuestGameState, cellKey: string): GrailQuestCard[] {
  const incoming = (state.movesThisTurn || []).filter(m => m.to === cellKey);
  const [q_dest, r_dest] = cellKey.split(',').map(Number);

  const sortedIncoming = [...incoming].sort((a, b) => {
    const [aq, ar] = a.from.split(',').map(Number);
    const [bq, br] = b.from.split(',').map(Number);
    return getNeighborIndex(q_dest, r_dest, aq, ar) - getNeighborIndex(q_dest, r_dest, bq, br);
  });

  return sortedIncoming.flatMap(m => m.cards);
}
