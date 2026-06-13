import { MillGameState, PlayerPiece } from '@vibe-games/shared';
import { createInitialState, handlePlaceAction, handleMoveAction, handleRemoveAction } from '../game/millEngine';
import { getAiAction } from '../game/millAi';
import { StrategyWeights } from '../game/minimaxAi';
import { calculateElo } from '../game/elo';

// Define candidates with different weight configurations
interface Candidate {
  name: string;
  weights: StrategyWeights;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}

const candidates: Candidate[] = [
  {
    name: "Baseline",
    weights: { material: 200, mill: 150, blocked: -20, threat: 60 },
    elo: 1000, wins: 0, losses: 0, draws: 0
  },
  {
    name: "Materialist",
    weights: { material: 400, mill: 100, blocked: -10, threat: 30 },
    elo: 1000, wins: 0, losses: 0, draws: 0
  },
  {
    name: "Mill Master",
    weights: { material: 150, mill: 300, blocked: -10, threat: 50 },
    elo: 1000, wins: 0, losses: 0, draws: 0
  },
  {
    name: "Blocker",
    weights: { material: 150, mill: 100, blocked: -80, threat: 40 },
    elo: 1000, wins: 0, losses: 0, draws: 0
  },
  {
    name: "Threat Setup",
    weights: { material: 150, mill: 120, blocked: -20, threat: 150 },
    elo: 1000, wins: 0, losses: 0, draws: 0
  },
];

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
 * Simulates a single game between two weight sets
 */
function runGame(weightsX: StrategyWeights, weightsO: StrategyWeights, depth: number = 3): { winner: PlayerPiece | 'draw' } {
  let state = createInitialState();
  let moveCount = 0;
  const maxMoves = 100; // Cap moves to prevent infinite games in local tournament

  while (!state.winner && moveCount < maxMoves) {
    try {
      if (state.turn === 'X') {
        const invState = invertState(state);
        const action = getAiAction(invState, 'minimax', depth, weightsX);
        if (action.type === 'place') {
          state = handlePlaceAction(state, action.position!, 'X');
        } else if (action.type === 'move') {
          state = handleMoveAction(state, action.from!, action.to!, 'X');
        } else if (action.type === 'remove') {
          state = handleRemoveAction(state, action.position!, 'X');
        }
      } else {
        const action = getAiAction(state, 'minimax', depth, weightsO);
        if (action.type === 'place') {
          state = handlePlaceAction(state, action.position!, 'O');
        } else if (action.type === 'move') {
          state = handleMoveAction(state, action.from!, action.to!, 'O');
        } else if (action.type === 'remove') {
          state = handleRemoveAction(state, action.position!, 'O');
        }
      }
    } catch (err) {
      // In case of error, other player wins
      return { winner: state.turn === 'X' ? 'O' : 'X' };
    }
    moveCount++;
  }

  return { winner: state.winner || 'draw' };
}

/**
 * Simulates a matchup, updates stats and ratings
 */
function simulateMatchup(candX: Candidate, candO: Candidate, depth = 3) {
  const result = runGame(candX.weights, candO.weights, depth);

  let xScore: 1 | 0.5 | 0 = 0.5;
  let oScore: 1 | 0.5 | 0 = 0.5;

  if (result.winner === 'X') {
    xScore = 1;
    oScore = 0;
    candX.wins++;
    candO.losses++;
  } else if (result.winner === 'O') {
    xScore = 0;
    oScore = 1;
    candX.losses++;
    candO.wins++;
  } else {
    candX.draws++;
    candO.draws++;
  }

  // Compute new ELO ratings
  const newXRating = calculateElo(candX.elo, candO.elo, xScore);
  const newORating = calculateElo(candO.elo, candX.elo, oScore);

  candX.elo = newXRating;
  candO.elo = newORating;
}

console.log('🧪 Starting Offline AI Parameter Auto-Tuning...');
console.log('Running round-robin tournament with 5 weight configurations...');

// Run tournament rounds
const totalRounds = 5; // 5 rounds of round-robin
for (let round = 1; round <= totalRounds; round++) {
  console.log(`Round ${round}/${totalRounds}...`);
  for (let i = 0; i < candidates.length; i++) {
    for (let j = 0; j < candidates.length; j++) {
      if (i !== j) {
        simulateMatchup(candidates[i], candidates[j], 3);
      }
    }
  }
}

console.log('\n🏁 Auto-Tuning Tournament Completed.\n');

// Sort candidates by ELO
const sorted = [...candidates].sort((a, b) => b.elo - a.elo);

console.log('📊 Tournament Leaderboard & Calibrated ELOs:');
for (const cand of sorted) {
  const total = cand.wins + cand.losses + cand.draws;
  console.log(`- ${cand.name}: ${cand.elo} ELO (${cand.wins} Wins, ${cand.losses} Losses, ${cand.draws} Draws / Total: ${total})`);
  console.log(`  Weights: Material=${cand.weights.material}, Mill=${cand.weights.mill}, Blocked=${cand.weights.blocked}, Threat=${cand.weights.threat}`);
}

const best = sorted[0];
console.log(`\n🏆 Optimized configuration found: "${best.name}" with ELO ${best.elo}!`);
console.log(`Recommended weights configuration:`, JSON.stringify(best.weights, null, 2));
