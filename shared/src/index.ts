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
}

// ─── Game (Phase 1 — placeholder shapes) ──────────────────────────────────────

export type GameStatus = 'waiting' | 'in_progress' | 'finished';

export type Player = 'X' | 'O';

export interface GameDto {
  id: string;
  status: GameStatus;
  board: (Player | null)[];  // 9-element array for Tic-Tac-Toe
  currentPlayer: Player;
  winner: Player | 'draw' | null;
  createdAt: string;
  updatedAt: string;
}
