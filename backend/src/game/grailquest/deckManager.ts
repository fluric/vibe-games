import { PlayerPiece, GrailQuestGameState, GrailQuestCard } from '@vibe-games/shared';
import { getFarmLandsCount } from './gridUtils';

// Count how many face cards are currently in play (hand + board) for a player
export function countFaceCardsInPlay(state: GrailQuestGameState, player: PlayerPiece, tempDrawn: GrailQuestCard[] = []) {
  const hand = state.hands[player] || [];
  const allHandCards = [...hand, ...tempDrawn];
  let kings = allHandCards.filter(c => c.value === 13).length;
  let queens = allHandCards.filter(c => c.value === 12).length;
  let jacks = allHandCards.filter(c => c.value === 11).length;

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
export function drawRandomCard(
  state: GrailQuestGameState,
  player: PlayerPiece,
  tempDrawn: GrailQuestCard[] = []
): GrailQuestCard {
  const value = Math.floor(Math.random() * 13) + 1; // 1 to 13 (Ace is replaced by 1)
  const faceCounts = countFaceCardsInPlay(state, player, tempDrawn);

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

// Perform deployment draws at start of deploy phase
export function runDeployDraw(state: GrailQuestGameState, player: PlayerPiece): GrailQuestCard[] {
  const isRound1PlayerX = player === 'X' && (state.history?.length === 0 || !state.history);
  const baseCards = isRound1PlayerX ? 2 : 4;
  const farmLandBonus = getFarmLandsCount(state, player);
  const totalDraw = baseCards + farmLandBonus;

  const drawn: GrailQuestCard[] = [];
  for (let i = 0; i < totalDraw; i++) {
    drawn.push(drawRandomCard(state, player, drawn));
  }
  return drawn;
}
