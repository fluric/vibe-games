// @vibe-games/shared — Shared TypeScript types & interfaces
// Used by both backend and frontend.

export const API_VERSION = '0.0.1';

// ─── Health ───────────────────────────────────────────────────────────────────

export interface HealthResponse {
  ok: boolean;
  timestamp: string;
  version: string;     // npm package version
  revision: string;    // Git commit hash
  apiVersion: string;  // API Contract version
  database: boolean;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserStatsDto {
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface UserDto {
  id: string;
  username: string;
  createdAt: string; // ISO 8601
  avatarUrl?: string | null;
  email?: string | null;
  elo?: number;
  wins?: number;
  losses?: number;
  draws?: number;
  gameStats?: Record<GameType, UserStatsDto>;
}

export interface AuthStatusResponse {
  user: UserDto | null;
  /** JWT token — returned on login for clients that can't use httpOnly cookies (e.g. Safari ITP) */
  token?: string;
}

// ─── Game ─────────────────────────────────────────────────────────────────────

export type GameType = 'mill' | 'connect_four' | 'tic_tac_toe' | 'grail_quest' | 'escape';

export type GameStatus = 'waiting' | 'in_progress' | 'finished';

export type PlayerPiece = 'X' | 'O';

export interface ConnectFourGameState {
  board: (PlayerPiece | null)[]; // 42 board positions (6 rows * 7 cols, row-major)
  turn: PlayerPiece;
  winner: PlayerPiece | 'draw' | null;
}

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
  movesSinceLastCapture?: number; // ply count since last capture
  positionHistory?: string[]; // board positions in '........................X' format
}
export interface GrailQuestCard {
  value: number; // 1 to 10 for numbers, 11=J, 12=Q, 13=K
  revealed: boolean; // Once a card participates in combat, it becomes revealed
  moved?: boolean; // True if card has moved in the current turn
}

export type GrailQuestCellType = 'grail_center' | 'hill' | 'farm_land' | 'urban' | 'home_base' | 'normal';

export interface GrailQuestCell {
  q: number;
  r: number;
  cellType: GrailQuestCellType;
  owner: PlayerPiece | 'neutral' | null; // owner of the stack
  soldiers: GrailQuestCard[]; // Stack of soldiers (first card is top of stack, i.e. index 0 is top)
}

export interface PendingCombat {
  cellKey: string; // "q,r" coordinate
  attacker: PlayerPiece;
  defender: PlayerPiece | 'neutral';
  // DTO reveals the top cards currently fighting
  attackerTopCard?: GrailQuestCard | null;
  defenderTopCard?: GrailQuestCard | null;
  attackerRemainingCount: number;
  defenderRemainingCount: number;
  attackerStack?: GrailQuestCard[]; // Full stack of attacker's cards (hidden from client)
  originKey?: string;
  carriesGrail?: boolean;
}

export interface GrailQuestGameState {
  board: Record<string, GrailQuestCell>; // Keyed by "q,r" coord
  hands: {
    X: GrailQuestCard[];
    O: GrailQuestCard[];
  };
  phase: 'react' | 'deploy' | 'move';
  turn: PlayerPiece;
  winner: PlayerPiece | 'draw' | null;
  pendingCombats: PendingCombat[];
  grailCellKey?: string;
  grailMovementCandidates?: string[];
  drawnThisTurn?: boolean;
  movesThisTurn?: { from: string; to: string; cards: GrailQuestCard[]; carriesGrail?: boolean }[];
  roundTurnsCompleted?: number;
  history?: string[];
  turnCount?: number;
}

export interface GameDto {
  id: string;
  gameType: GameType;
  status: GameStatus;
  playerX: UserDto | null;
  playerO: UserDto | null;
  winnerId: string | null;
  state: MillGameState | ConnectFourGameState | GrailQuestGameState; // Generic state, typed based on gameType
  isPublic: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface LeaderboardEntryDto {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  isBot: boolean;
}

export interface LeaderboardResponse {
  gameType: GameType;
  entries: LeaderboardEntryDto[];
}

// ─── Escape ───────────────────────────────────────────────────────────────────

export interface EscapeRoomProgressDto {
  roomId: number;
  solved: boolean;
  solvedAt: string | null; // ISO 8601
}

export interface EscapeProgressResponse {
  rooms: EscapeRoomProgressDto[];
  roomsCleared: number;
}

export interface EscapeLeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  roomsCleared: number;
  firstClearedAt: string; // ISO 8601 — when the player first fully escaped
}

export interface EscapeLeaderboardResponse {
  entries: EscapeLeaderboardEntry[];
}
