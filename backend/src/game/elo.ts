/**
 * Calculates the new ELO rating of a player.
 * @param playerRating The current ELO rating of the player.
 * @param opponentRating The current ELO rating of the opponent.
 * @param outcome The game outcome for the player: 1 = win, 0.5 = draw, 0 = loss.
 * @param kFactor The maximum adjustment per game (default: 32).
 */
export function calculateElo(
  playerRating: number,
  opponentRating: number,
  outcome: 1 | 0.5 | 0,
  kFactor: number = 32
): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  return Math.round(playerRating + kFactor * (outcome - expectedScore));
}
