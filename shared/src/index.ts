// @vibe-games/shared — Shared TypeScript types & interfaces
// Used by both backend and frontend — no runtime code here.

// ─── Health ───────────────────────────────────────────────────────────────────

export interface HealthResponse {
  ok: boolean;
  timestamp: string;
  version: string;
  database: boolean;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserDto {
  id: string;
  username: string;
  createdAt: string; // ISO 8601
  avatarUrl?: string | null;
  email?: string | null;
}

export interface AuthStatusResponse {
  user: UserDto | null;
}

// ─── Game ─────────────────────────────────────────────────────────────────────

export type GameType = 'mill' | 'tic_tac_toe';

export type GameStatus = 'waiting' | 'in_progress' | 'finished';

export type PlayerPiece = 'X' | 'O';

// State definition for the game of Mill (Nine Men's Morris)
export interface MillGameState {
  board: (PlayerPiece | null)[]; // 24 board positions
  phase: 'placement' | 'movement' | 'flying';
  placementsRemaining: {
    X: number; // starts at 9
    O: number; // starts at 9
  };
  piecesOnBoard: {
    X: number;
    O: number;
  };
  turn: PlayerPiece;
  winner: PlayerPiece | 'draw' | null;
  millFormedThisTurn: boolean; // True if player needs to remove an opponent piece
}

export interface GameDto {
  id: string;
  gameType: GameType;
  status: GameStatus;
  playerX: UserDto | null;
  playerO: UserDto | null;
  winnerId: string | null;
  state: MillGameState; // Generic state, typed as MillGameState for gameType: 'mill'
  isPublic: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
