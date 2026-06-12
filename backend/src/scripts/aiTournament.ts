import { MillGameState, PlayerPiece } from '@vibe-games/shared';
import { createInitialState, handlePlaceAction, handleMoveAction, handleRemoveAction } from '../game/millEngine';
import { getAiAction } from '../game/millAi';
import { calculateElo } from '../game/elo';
import * as fs from 'fs';
import * as path from 'path';

// Load bot config
const configPath = path.join(__dirname, '../game/aiConfig.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize tournament ratings
const ratings: Record<string, number> = {
  easy: config.easy.elo,
  medium: config.medium.elo,
  hard: config.hard.elo,
};

const winCounts: Record<string, Record<string, number>> = {
  easy: { wins: 0, losses: 0, draws: 0 },
  medium: { wins: 0, losses: 0, draws: 0 },
  hard: { wins: 0, losses: 0, draws: 0 },
};

/**
 * Inverts the game state colors so we can reuse O-maximizing bots for Player X
 */
function invertState(state: MillGameState): MillGameState {
  const invertedBoard = state.board.map(cell => {
    if (cell === 'X') return 'O';
    if (cell === 'O') return 'X';
    return null;
  });

  return {
    ...state,
    board: invertedBoard,
    turn: state.turn === 'X' ? 'O' : 'X',
    placementsRemaining: {
      X: state.placementsRemaining.O,
      O: state.placementsRemaining.X,
    },
    piecesOnBoard: {
      X: state.piecesOnBoard.O,
      O: state.piecesOnBoard.X,
    }
  };
}

/**
 * Simulates a single game between two bots
 */
function runGame(botX: 'easy' | 'medium' | 'hard', botO: 'easy' | 'medium' | 'hard'): { winner: PlayerPiece | 'draw' } {
  let state = createInitialState();
  let moveCount = 0;
  const maxMoves = 150; // Avoid infinite loops in draw situations

  while (!state.winner && moveCount < maxMoves) {
    const currentBot = state.turn === 'X' ? botX : botO;
    const botType = config[currentBot].type;
    const botDepth = config[currentBot].depth ?? 3;

    try {
      if (state.turn === 'X') {
        const invState = invertState(state);
        const action = getAiAction(invState, botType, botDepth);
        if (action.type === 'place') {
          state = handlePlaceAction(state, action.position!, 'X');
        } else if (action.type === 'move') {
          state = handleMoveAction(state, action.from!, action.to!, 'X');
        } else if (action.type === 'remove') {
          state = handleRemoveAction(state, action.position!, 'X');
        }
      } else {
        const action = getAiAction(state, botType, botDepth);
        if (action.type === 'place') {
          state = handlePlaceAction(state, action.position!, 'O');
        } else if (action.type === 'move') {
          state = handleMoveAction(state, action.from!, action.to!, 'O');
        } else if (action.type === 'remove') {
          state = handleRemoveAction(state, action.position!, 'O');
        }
      }
    } catch (err) {
      // In case of any engine action validation failure, the other player wins
      return { winner: state.turn === 'X' ? 'O' : 'X' };
    }
    moveCount++;
  }

  return { winner: state.winner || 'draw' };
}

/**
 * Simulates a matchup, updates stats and ratings
 */
function simulateMatchup(botX: 'easy' | 'medium' | 'hard', botO: 'easy' | 'medium' | 'hard') {
  const result = runGame(botX, botO);

  let xScore: 1 | 0.5 | 0 = 0.5;
  let oScore: 1 | 0.5 | 0 = 0.5;

  if (result.winner === 'X') {
    xScore = 1;
    oScore = 0;
    winCounts[botX].wins++;
    winCounts[botO].losses++;
  } else if (result.winner === 'O') {
    xScore = 0;
    oScore = 1;
    winCounts[botX].losses++;
    winCounts[botO].wins++;
  } else {
    winCounts[botX].draws++;
    winCounts[botO].draws++;
  }

  // Compute new ELO ratings
  const newXRating = calculateElo(ratings[botX], ratings[botO], xScore);
  const newORating = calculateElo(ratings[botO], ratings[botX], oScore);

  ratings[botX] = newXRating;
  ratings[botO] = newORating;

  // Anchoring normalization: offset all ratings by the easy rating
  const easyOffset = ratings.easy;
  ratings.easy -= easyOffset; // Anchored at 0
  ratings.medium -= easyOffset;
  ratings.hard -= easyOffset;
}

console.log('🤖 Starting Offline AI Tournament Calibration...');
console.log(`Initial Ratings: Easy = ${ratings.easy}, Medium = ${ratings.medium}, Hard = ${ratings.hard}\n`);

// Run tournament rounds
const totalRounds = 40; // 40 rounds * 6 games = 240 matches
for (let round = 1; round <= totalRounds; round++) {
  simulateMatchup('easy', 'medium');
  simulateMatchup('medium', 'easy');
  
  simulateMatchup('easy', 'hard');
  simulateMatchup('hard', 'easy');

  simulateMatchup('medium', 'hard');
  simulateMatchup('hard', 'medium');
}

console.log('🏁 Tournament Completed.');
console.log('\n📊 Win/Loss Stats:');
for (const bot of ['easy', 'medium', 'hard']) {
  const stats = winCounts[bot];
  const total = stats.wins + stats.losses + stats.draws;
  console.log(`- ${config[bot].username}: ${stats.wins} Wins, ${stats.losses} Losses, ${stats.draws} Draws (Total: ${total})`);
}

console.log('\n📈 Calibrated ELO Ratings (relative to Easy baseline = 0):');
console.log(`- Easy:   ${ratings.easy}`);
console.log(`- Medium: ${ratings.medium}`);
console.log(`- Hard:   ${ratings.hard}`);

// Write updated ELOs back to aiConfig.json
config.easy.elo = ratings.easy;
config.medium.elo = ratings.medium;
config.hard.elo = ratings.hard;

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log(`\n💾 Successfully saved updated ratings to ${path.basename(configPath)}!`);
