import { PlayerPiece, GameType } from '@vibe-games/shared';
import { createInitialState as createMillState, handlePlaceAction, handleMoveAction, handleRemoveAction } from './millEngine';
import { getAiAction as getMillAiAction } from './millAi';
import { ConnectFourEngine } from './connectFourEngine';
import { HolyGrailEngine } from './holyGrailEngine';
import { getRLAction } from './rlClient';

export interface IGameEngine {
  createInitialState(): any;
  handleMove(state: any, action: any, player: PlayerPiece): any;
  getAiAction(state: any, botType: string, depth: number, weights: any, timeLimitMs: number): any;
  /** For async-backed bots (e.g. RL sidecar). Returns null if botType is not an RL bot. */
  getAiActionAsync?(state: any, botType: string, depth: number, weights: any, timeLimitMs: number): Promise<any> | null;
}

function invertState(state: any): any {
  const invertedBoard = state.board.map((cell: any) => {
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

export const MillEngine: IGameEngine = {
  createInitialState: createMillState,
  handleMove(state: any, action: any, player: PlayerPiece): any {
    const actType = action.action || action.type;
    if (actType === 'place') {
      if (action.position === undefined) throw new Error('Missing position');
      return handlePlaceAction(state, action.position, player);
    } else if (actType === 'move') {
      if (action.from === undefined || action.to === undefined) {
        throw new Error('Missing from/to coordinates');
      }
      return handleMoveAction(state, action.from, action.to, player);
    } else if (actType === 'remove') {
      if (action.position === undefined) throw new Error('Missing position');
      return handleRemoveAction(state, action.position, player);
    }
    throw new Error('Invalid game action type');
  },
  getAiAction(state: any, botType: string, depth: number, weights: any, timeLimitMs: number): any {
    const stateToPass = state.turn === 'X' ? invertState(state) : state;
    return getMillAiAction(stateToPass, botType as any, depth, weights, timeLimitMs);
  },
  getAiActionAsync(state: any, botType: string, _depth: number, _weights: any, _timeLimitMs: number): Promise<any> | null {
    if (botType.startsWith('rl_')) {
      return getRLAction('mill', state, botType);
    }
    return null;
  },
};

export const ConnectFourEngineWithRL: IGameEngine = {
  ...ConnectFourEngine,
  getAiActionAsync(state: any, botType: string, _depth: number, _weights: any, _timeLimitMs: number): Promise<any> | null {
    if (botType.startsWith('rl_')) {
      return getRLAction('connect_four', state, botType);
    }
    return null;
  },
};

export const ENGINES: Record<GameType, IGameEngine> = {
  mill: MillEngine,
  connect_four: ConnectFourEngineWithRL,
  tic_tac_toe: null as any, // Placeholder for future games
  holy_grail: HolyGrailEngine,
};
