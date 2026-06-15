import { MillGameState, PlayerPiece } from '@vibe-games/shared';
import { createInitialState, handlePlaceAction, handleMoveAction, handleRemoveAction } from '../game/millEngine';
import { getAiAction } from '../game/millAi';
import * as fs from 'fs';
import * as path from 'path';

const configPath = path.join(__dirname, '../game/aiConfig.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8')).mill;

function invertState(state: MillGameState): MillGameState {
  const invertedBoard = state.board.map((cell: PlayerPiece | null) => {
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

function runGame(botX: string, botO: string): { winner: PlayerPiece | 'draw' } {
  let state = createInitialState();
  let moveCount = 0;
  const maxMoves = 150;

  while (!state.winner && moveCount < maxMoves) {
    const currentBot = state.turn === 'X' ? botX : botO;
    const botType = config[currentBot].type;
    const botDepth = config[currentBot].depth ?? 3;
    const botWeights = config[currentBot].weights;

    try {
      if (state.turn === 'X') {
        const invState = invertState(state);
        const action = getAiAction(invState, botType, botDepth, botWeights);
        if (action.type === 'place') {
          state = handlePlaceAction(state, action.position!, 'X');
        } else if (action.type === 'move') {
          state = handleMoveAction(state, action.from!, action.to!, 'X');
        } else if (action.type === 'remove') {
          state = handleRemoveAction(state, action.position!, 'X');
        }
      } else {
        const action = getAiAction(state, botType, botDepth, botWeights);
        if (action.type === 'place') {
          state = handlePlaceAction(state, action.position!, 'O');
        } else if (action.type === 'move') {
          state = handleMoveAction(state, action.from!, action.to!, 'O');
        } else if (action.type === 'remove') {
          state = handleRemoveAction(state, action.position!, 'O');
        }
      }
    } catch (err: any) {
      console.error(`Error during turn for ${state.turn}:`, err);
      return { winner: state.turn === 'X' ? 'O' : 'X' };
    }
    moveCount++;
  }

  return { winner: state.winner || 'draw' };
}

function testMatchup(botA: string, botB: string, gamesPerSide = 10) {
  console.log(`\n⚔️ Matchup: ${config[botA].username} vs ${config[botB].username}`);
  let botAWins = 0;
  let botBWins = 0;
  let draws = 0;

  // Bot A is X, Bot B is O
  for (let i = 1; i <= gamesPerSide; i++) {
    const res = runGame(botA, botB);
    if (res.winner === 'X') botAWins++;
    else if (res.winner === 'O') botBWins++;
    else draws++;
  }

  // Bot B is X, Bot A is O
  for (let i = 1; i <= gamesPerSide; i++) {
    const res = runGame(botB, botA);
    if (res.winner === 'X') botBWins++;
    else if (res.winner === 'O') botAWins++;
    else draws++;
  }

  console.log(`- ${config[botA].username} Wins: ${botAWins}`);
  console.log(`- ${config[botB].username} Wins: ${botBWins}`);
  console.log(`- Draws: ${draws}`);
}

console.log('🤖 Starting Direct AI Evaluation Series...');
testMatchup('perfect_oracle', 'legendary_magnus', 10);
testMatchup('perfect_oracle', 'medium_mobile', 10);
