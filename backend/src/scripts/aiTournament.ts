import { PlayerPiece, GameType } from '@vibe-games/shared';
import { ENGINES } from '../game/gameRegistry';
import { calculateElo } from '../game/elo';
import * as fs from 'fs';
import * as path from 'path';

// Load bot config
const configPath = path.join(__dirname, '../game/aiConfig.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const millBots = Object.keys(config.mill);
const c4Bots = Object.keys(config.connect_four);
const botKeys = [...millBots, ...c4Bots];

// ── CLI args ──────────────────────────────────────────────────────────────────
// --time <ms>  Per-move time budget for all bots (default: 500ms).
const timeArgIdx = process.argv.indexOf('--time');
const MOVE_TIME_MS = timeArgIdx !== -1 ? parseInt(process.argv[timeArgIdx + 1], 10) : 500;
console.log(`⏱️  Move time budget: ${MOVE_TIME_MS}ms per move`);

// Initialize tournament ratings
const ratings: Record<string, Record<string, number>> = {
  mill: {},
  connect_four: {}
};
const winCounts: Record<string, Record<string, Record<string, number>>> = {
  mill: {},
  connect_four: {}
};
for (const key of millBots) {
  ratings.mill[key] = config.mill[key].elo;
  winCounts.mill[key] = { wins: 0, losses: 0, draws: 0 };
}
for (const key of c4Bots) {
  ratings.connect_four[key] = config.connect_four[key].elo;
  winCounts.connect_four[key] = { wins: 0, losses: 0, draws: 0 };
}

/**
 * Simulates a single game between two bots of the same gameType.
 */
function runGame(gameType: GameType, botX: string, botO: string): { winner: PlayerPiece | 'draw' } {
  const engine = ENGINES[gameType];
  let state = engine.createInitialState();
  let moveCount = 0;
  const maxMoves = gameType === 'mill' ? 150 : 60;
  const positionCounts = new Map<string, number>();

  const gameBotsConfig = config[gameType];

  while (!state.winner && moveCount < maxMoves) {
    if (gameType === 'mill') {
      // 3-fold repetition detection
      const posKey = state.board.map((c: any) => c ?? '.').join('') + state.turn;
      const seen = (positionCounts.get(posKey) ?? 0) + 1;
      positionCounts.set(posKey, seen);
      if (seen >= 3) {
        return { winner: 'draw' };
      }
    }

    const currentBot = state.turn === 'X' ? botX : botO;
    const botConfig = gameBotsConfig[currentBot];
    const botType = botConfig.type;
    const botDepth = botConfig.depth ?? 3;
    const botWeights = botConfig.weights;

    try {
      const action = engine.getAiAction(state, botType, botDepth, botWeights, MOVE_TIME_MS);
      state = engine.handleMove(state, action, state.turn);
    } catch (err: any) {
      console.error(`  ❌ Error during ${state.turn} (${currentBot}) turn:`, err.message);
      return { winner: state.turn === 'X' ? 'O' : 'X' };
    }
    moveCount++;
  }

  return { winner: state.winner || 'draw' };
}

/**
 * Simulates a matchup, updates stats and ratings
 */
function simulateMatchup(gameType: GameType, botX: string, botO: string, botKeysList: string[], baselineKey: string) {
  const result = runGame(gameType, botX, botO);

  let xScore: 1 | 0.5 | 0 = 0.5;
  let oScore: 1 | 0.5 | 0 = 0.5;

  if (result.winner === 'X') {
    xScore = 1;
    oScore = 0;
    winCounts[gameType][botX].wins++;
    winCounts[gameType][botO].losses++;
  } else if (result.winner === 'O') {
    xScore = 0;
    oScore = 1;
    winCounts[gameType][botX].losses++;
    winCounts[gameType][botO].wins++;
  } else {
    winCounts[gameType][botX].draws++;
    winCounts[gameType][botO].draws++;
  }

  const botConfigX = config[gameType][botX];
  const botConfigO = config[gameType][botO];

  // Compute new ELO ratings
  console.log(`  ⚔️ Matchup (${gameType}): ${botConfigX.username} (X) vs ${botConfigO.username} (O) => Winner: ${result.winner}`);

  const newXRating = calculateElo(ratings[gameType][botX], ratings[gameType][botO], xScore);
  const newORating = calculateElo(ratings[gameType][botO], ratings[gameType][botX], oScore);

  ratings[gameType][botX] = newXRating;
  ratings[gameType][botO] = newORating;

  // Anchoring normalization: offset ratings by the respective game's easy_random baseline
  if (ratings[gameType][baselineKey] !== undefined) {
    const easyOffset = ratings[gameType][baselineKey];
    for (const key of botKeysList) {
      ratings[gameType][key] -= easyOffset;
    }
  }
}

console.log('🤖 Starting Offline AI Tournament Calibration...');

const MATCHUPS = [
  { gameType: 'mill' as const, bots: millBots, baselineKey: 'easy_random' },
  { gameType: 'connect_four' as const, bots: c4Bots, baselineKey: 'easy_random' },
];

for (const group of MATCHUPS) {
  console.log(`\n🏆 Starting Round-Robin Tournament for Game Type: ${group.gameType.toUpperCase()}`);
  console.log('Initial Ratings: ' + group.bots.map(k => `${config[group.gameType][k].username} = ${ratings[group.gameType][k]}`).join(', ') + '\n');

  const totalRounds = 3;
  for (let round = 1; round <= totalRounds; round++) {
    console.log(`Round ${round}/${totalRounds}...`);
    for (let i = 0; i < group.bots.length; i++) {
      for (let j = 0; j < group.bots.length; j++) {
        if (i !== j) {
          simulateMatchup(group.gameType, group.bots[i], group.bots[j], group.bots, group.baselineKey);
        }
      }
    }
  }
}

console.log('\n🏁 Tournament Completed.');
console.log('\n📊 Win/Loss Stats:');
for (const group of MATCHUPS) {
  for (const bot of group.bots) {
    const stats = winCounts[group.gameType][bot];
    const total = stats.wins + stats.losses + stats.draws;
    console.log(`- ${config[group.gameType][bot].username}: ${stats.wins} Wins, ${stats.losses} Losses, ${stats.draws} Draws (Total: ${total})`);
  }
}

console.log('\n📈 Calibrated ELO Ratings (relative to Easy baseline = 0):');
for (const group of MATCHUPS) {
  for (const bot of group.bots) {
    console.log(`- ${config[group.gameType][bot].username}:   ${ratings[group.gameType][bot]}`);
  }
}

// Write updated ELOs back to aiConfig.json
for (const group of MATCHUPS) {
  for (const bot of group.bots) {
    config[group.gameType][bot].elo = ratings[group.gameType][bot];
  }
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log(`\n💾 Successfully saved updated ratings to ${path.basename(configPath)}!`);
