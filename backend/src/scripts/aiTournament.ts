import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PlayerPiece, GameType } from '@vibe-games/shared';
import { ENGINES } from '../game/gameRegistry';
import { calculateElo } from '../game/elo';

// Load bot config
const configPath = path.join(__dirname, '../game/aiConfig.json');
let config: any;

const timeArgIdx = process.argv.indexOf('--time');
const MOVE_TIME_MS = timeArgIdx !== -1 ? parseInt(process.argv[timeArgIdx + 1], 10) : null;

// Game loop runner that both master and workers can run
function runGame(
  gameType: GameType,
  botX: string,
  botO: string,
  localConfig: any,
  overrideMoveTime: number | null
): { winner: PlayerPiece | 'draw' } {
  const engine = ENGINES[gameType];
  let state = engine.createInitialState();
  let moveCount = 0;
  const maxMoves = gameType === 'mill' ? 150 : (gameType === 'holy_grail' ? 400 : 60);
  const positionCounts = new Map<string, number>();

  const gameBotsConfig = localConfig[gameType];

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
    const botTimeLimit = overrideMoveTime !== null ? overrideMoveTime : (botConfig.timeLimitMs ?? 1500);

    try {
      const action = engine.getAiAction(state, botType, botDepth, botWeights, botTimeLimit);
      state = engine.handleMove(state, action, state.turn);
    } catch (err: any) {
      console.error(`  ❌ Error during ${state.turn} (${currentBot}) turn:`, err.message);
      return { winner: state.turn === 'X' ? 'O' : 'X' };
    }
    moveCount++;
  }

  return { winner: state.winner || 'draw' };
}

if (!isMainThread) {
  // Worker logic
  parentPort?.on('message', (msg) => {
    if (msg.type === 'play') {
      const result = runGame(msg.gameType, msg.botX, msg.botO, msg.config, MOVE_TIME_MS);
      parentPort?.postMessage({
        type: 'result',
        winner: result.winner,
        taskIndex: msg.taskIndex
      });
    } else if (msg.type === 'exit') {
      process.exit(0);
    }
  });
} else {
  // Main thread logic
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const millBots = Object.keys(config.mill);
  const c4Bots = Object.keys(config.connect_four);
  const hgBots = Object.keys(config.holy_grail);

  if (MOVE_TIME_MS !== null) {
    console.log(`⏱️  Move time budget: Overridden to ${MOVE_TIME_MS}ms per move`);
  } else {
    console.log(`⏱️  Move time budget: Using configured timeLimitMs per bot`);
  }

  // Initialize tournament ratings
  const ratings: Record<string, Record<string, number>> = {
    mill: {},
    connect_four: {},
    holy_grail: {}
  };
  const winCounts: Record<string, Record<string, Record<string, number>>> = {
    mill: {},
    connect_four: {},
    holy_grail: {}
  };
  for (const key of millBots) {
    ratings.mill[key] = config.mill[key].elo;
    winCounts.mill[key] = { wins: 0, losses: 0, draws: 0 };
  }
  for (const key of c4Bots) {
    ratings.connect_four[key] = config.connect_four[key].elo;
    winCounts.connect_four[key] = { wins: 0, losses: 0, draws: 0 };
  }
  for (const key of hgBots) {
    ratings.holy_grail[key] = config.holy_grail[key].elo;
    winCounts.holy_grail[key] = { wins: 0, losses: 0, draws: 0 };
  }

  console.log('🤖 Starting Offline Parallel AI Tournament Calibration...');

  const MATCHUPS = [
    { gameType: 'mill' as const, bots: millBots, baselineKey: 'easy_random' },
    { gameType: 'connect_four' as const, bots: c4Bots, baselineKey: 'easy_random' },
    { gameType: 'holy_grail' as const, bots: hgBots, baselineKey: 'easy_random' },
  ];

  // Generate all tasks (matchups)
  interface Task {
    gameType: GameType;
    botX: string;
    botO: string;
    bots: string[];
    baselineKey: string;
  }

  const tasks: Task[] = [];
  const totalRounds = 3;

  for (const group of MATCHUPS) {
    for (let round = 1; round <= totalRounds; round++) {
      for (let i = 0; i < group.bots.length; i++) {
        for (let j = 0; j < group.bots.length; j++) {
          if (i !== j) {
            tasks.push({
              gameType: group.gameType,
              botX: group.bots[i],
              botO: group.bots[j],
              bots: group.bots,
              baselineKey: group.baselineKey
            });
          }
        }
      }
    }
  }

  const totalTasks = tasks.length;
  let nextTaskIndex = 0;
  let completedTasks = 0;

  const numWorkers = Math.max(1, os.cpus().length - 1);
  console.log(`🚀 Spawning ${numWorkers} worker threads for parallel execution of ${totalTasks} matches...`);

  // Start worker threads
  const workers: Worker[] = [];
  
  const handleWorkerMessage = (worker: Worker, workerId: number, msg: any) => {
    if (msg.type === 'result') {
      const task = tasks[msg.taskIndex];
      const botConfigX = config[task.gameType][task.botX];
      const botConfigO = config[task.gameType][task.botO];

      // Sequential ELO calculation to maintain consistency
      let xScore: 1 | 0.5 | 0 = 0.5;
      let oScore: 1 | 0.5 | 0 = 0.5;

      if (msg.winner === 'X') {
        xScore = 1;
        oScore = 0;
        winCounts[task.gameType][task.botX].wins++;
        winCounts[task.gameType][task.botO].losses++;
      } else if (msg.winner === 'O') {
        xScore = 0;
        oScore = 1;
        winCounts[task.gameType][task.botX].losses++;
        winCounts[task.gameType][task.botO].wins++;
      } else {
        winCounts[task.gameType][task.botX].draws++;
        winCounts[task.gameType][task.botO].draws++;
      }

      const newXRating = calculateElo(ratings[task.gameType][task.botX], ratings[task.gameType][task.botO], xScore);
      const newORating = calculateElo(ratings[task.gameType][task.botO], ratings[task.gameType][task.botX], oScore);

      ratings[task.gameType][task.botX] = newXRating;
      ratings[task.gameType][task.botO] = newORating;

      // Normalization anchor (easy_random = 0)
      if (ratings[task.gameType][task.baselineKey] !== undefined) {
        const easyOffset = ratings[task.gameType][task.baselineKey];
        for (const key of task.bots) {
          ratings[task.gameType][key] -= easyOffset;
        }
      }

      completedTasks++;
      const percent = ((completedTasks / totalTasks) * 100).toFixed(1);
      console.log(`[${percent}%] (${completedTasks}/${totalTasks}) Matchup: ${botConfigX.username} (X) vs ${botConfigO.username} (O) => Winner: ${msg.winner}`);

      // Dispatch next task to this worker
      sendNextTask(worker, workerId);
    }
  };

  const sendNextTask = (worker: Worker, workerId: number) => {
    if (nextTaskIndex < totalTasks) {
      const taskIndex = nextTaskIndex++;
      const task = tasks[taskIndex];
      worker.postMessage({
        type: 'play',
        taskIndex,
        gameType: task.gameType,
        botX: task.botX,
        botO: task.botO,
        config: config
      });
    } else {
      // No more tasks. Terminate this worker.
      worker.postMessage({ type: 'exit' });
      const idx = workers.indexOf(worker);
      if (idx !== -1) {
        workers.splice(idx, 1);
      }

      if (workers.length === 0) {
        onAllCompleted();
      }
    }
  };

  const onAllCompleted = () => {
    console.log('\n🏁 Parallel Tournament Completed.');
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
        console.log(`- ${config[group.gameType][bot].username}:   ${Math.round(ratings[group.gameType][bot])}`);
      }
    }

    // Write updated ELOs directly back to aiConfig.json
    const outConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    for (const group of MATCHUPS) {
      if (group.gameType === 'holy_grail') {
        for (const bot of group.bots) {
          outConfig[group.gameType][bot].elo = Math.round(ratings[group.gameType][bot]);
        }
      }
    }
    fs.writeFileSync(configPath, JSON.stringify(outConfig, null, 2) + '\n');
    console.log(`\n💾 Saved calibrated ratings directly to ${path.basename(configPath)}!`);
  };

  // Spawn all workers and dispatch their first task
  for (let w = 0; w < numWorkers; w++) {
    const worker = new Worker(__filename, {
      execArgv: ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']
    });
    worker.on('message', (msg) => handleWorkerMessage(worker, w, msg));
    worker.on('error', (err) => {
      console.error(`Worker ${w} encountered error:`, err);
    });
    workers.push(worker);
    sendNextTask(worker, w);
  }
}
