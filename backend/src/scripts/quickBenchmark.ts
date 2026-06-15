/**
 * quickBenchmark.ts
 * Runs a fast head-to-head between two bots (default: Oracle vs Magnus).
 * Much faster than the full round-robin tournament.
 *
 * Usage:
 *   npx ts-node src/scripts/quickBenchmark.ts
 *   npx ts-node src/scripts/quickBenchmark.ts --botA perfect_oracle --botB legendary_magnus --games 20
 */
import { MillGameState, PlayerPiece } from '@vibe-games/shared';
import { createInitialState, handlePlaceAction, handleMoveAction, handleRemoveAction } from '../game/millEngine';
import { getAiAction } from '../game/millAi';
import * as fs from 'fs';
import * as path from 'path';

const configPath = path.join(__dirname, '../game/aiConfig.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')).mill;

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (flag: string, fallback: string) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : fallback;
};

const botAKey = getArg('--botA', 'perfect_oracle');
const botBKey = getArg('--botB', 'legendary_magnus');
const totalGames = parseInt(getArg('--games', '20'), 10);

const botA = config[botAKey];
const botB = config[botBKey];

if (!botA || !botB) {
  console.error(`❌ Unknown bot key. Available: ${Object.keys(config).join(', ')}`);
  process.exit(1);
}

console.log(`\n🤖 Quick Benchmark: ${botA.username} vs ${botB.username}`);
console.log(`   ${totalGames} games total (alternating colors)\n`);

function invertState(state: MillGameState): MillGameState {
  return {
    ...state,
    board: state.board.map(c => c === 'X' ? 'O' : c === 'O' ? 'X' : null),
    turn: state.turn === 'X' ? 'O' : 'X',
    placementsRemaining: { X: state.placementsRemaining.O, O: state.placementsRemaining.X },
    piecesOnBoard: { X: state.piecesOnBoard.O, O: state.piecesOnBoard.X },
  };
}

function runGame(xKey: string, oKey: string): PlayerPiece | 'draw' {
  let state = createInitialState();
  let moves = 0;
  const maxMoves = 150;

  while (!state.winner && moves < maxMoves) {
    const currentKey = state.turn === 'X' ? xKey : oKey;
    const cfg = config[currentKey];

    try {
      let action;
      if (state.turn === 'X') {
        action = getAiAction(invertState(state), cfg.type, cfg.depth ?? 3, cfg.weights);
        if (action.type === 'place') state = handlePlaceAction(state, action.position!, 'X');
        else if (action.type === 'move') state = handleMoveAction(state, action.from!, action.to!, 'X');
        else state = handleRemoveAction(state, action.position!, 'X');
      } else {
        action = getAiAction(state, cfg.type, cfg.depth ?? 3, cfg.weights);
        if (action.type === 'place') state = handlePlaceAction(state, action.position!, 'O');
        else if (action.type === 'move') state = handleMoveAction(state, action.from!, action.to!, 'O');
        else state = handleRemoveAction(state, action.position!, 'O');
      }
    } catch (err: any) {
      return state.turn === 'X' ? 'O' : 'X';
    }
    moves++;
  }

  return state.winner || 'draw';
}

let aWins = 0, bWins = 0, draws = 0;
const startTime = Date.now();

for (let i = 0; i < totalGames; i++) {
  // Alternate colors each game
  const aIsX = i % 2 === 0;
  const xKey = aIsX ? botAKey : botBKey;
  const oKey = aIsX ? botBKey : botAKey;

  const winner = runGame(xKey, oKey);

  let result: string;
  if (winner === 'draw') {
    draws++;
    result = '½-½';
  } else if ((winner === 'X' && aIsX) || (winner === 'O' && !aIsX)) {
    aWins++;
    result = `${botA.username.split(' ')[0]} wins`;
  } else {
    bWins++;
    result = `${botB.username.split(' ')[0]} wins`;
  }

  const aColor = aIsX ? 'X' : 'O';
  const bColor = aIsX ? 'O' : 'X';
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  Game ${String(i + 1).padStart(2)}: ${botA.username.split(' ')[0]}(${aColor}) vs ${botB.username.split(' ')[0]}(${bColor}) → ${result}  [${elapsed}s]`);
}

const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
const aScore = aWins + draws * 0.5;
const total = totalGames;

console.log(`\n📊 Results after ${totalGames} games (${totalElapsed}s):`);
console.log(`   ${botA.username}: ${aWins}W / ${bWins}L / ${draws}D  (score: ${aScore}/${total})`);
console.log(`   ${botB.username}: ${bWins}W / ${aWins}L / ${draws}D`);

// Estimate ELO delta using the standard formula
const eloA = config[botAKey].elo ?? 1000;
const eloB = config[botBKey].elo ?? 1000;
const expected = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
const actual = aScore / total;
const K = 32;
const eloDelta = Math.round(K * total * (actual - expected));

console.log(`\n📈 ELO estimate:`);
console.log(`   ${botA.username} current ELO: ${eloA}`);
console.log(`   ${botB.username} current ELO: ${eloB}`);
console.log(`   Expected score: ${(expected * 100).toFixed(1)}%  |  Actual: ${(actual * 100).toFixed(1)}%`);
console.log(`   ELO delta for ${botA.username}: ${eloDelta >= 0 ? '+' : ''}${eloDelta}`);
console.log(`   Estimated new ELO: ~${eloA + eloDelta}\n`);
