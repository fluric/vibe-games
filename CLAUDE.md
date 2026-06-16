# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Docker (keep running in background)
npm run docker:up          # Start PostgreSQL + pgAdmin
npm run docker:down        # Stop containers
npm run docker:reset       # ⚠️ Wipe DB and restart

# Dev servers (keep running in background)
npm run dev                # Start backend + frontend concurrently
npm run dev:backend        # Backend only → http://localhost:3001
npm run dev:frontend       # Frontend only → http://localhost:5173

# Type checking / lint
npx tsc --noEmit           # Run inside backend/ or frontend/
npm run lint               # ESLint across all packages

# Build
npm run build              # Build shared → backend → frontend (order matters)

# TypeORM migrations
npm run migration:generate --name=<Name>   # Run from repo root
npm run migration:run
npm run migration:revert

# Tests — backend specs are plain Node.js scripts (no test runner framework)
node -r ts-node/register backend/src/game/millEngine.spec.ts
node -r ts-node/register backend/src/game/connectFourEngine.spec.ts
node -r ts-node/register backend/src/game/elo.spec.ts
node -r ts-node/register backend/src/game/gamesApi.spec.ts   # requires live DB
node -r ts-node/register backend/src/game/authApi.spec.ts

# E2E tests (requires dev server already running)
npm run test:e2e

# AI tooling (run from repo root)
npm run ai:tournament      # Round-robin tournament between all bots (calibrates ELO)
npm run ai:tune            # Weight-tuning sweep via tournament
npm run ai:test            # Benchmark perfect_oracle bot strength
```

## Architecture

### Monorepo layout

Three npm workspaces: `shared/`, `backend/`, `frontend/`. The `shared/` package (`@vibe-games/shared`) contains **types only** — no runtime code — and is the single source of truth for API contracts. Always import game state types and DTOs from there rather than redefining them.

### Backend (`backend/src/`)

- **`index.ts`** — Fastify server bootstrap. Registers CORS, cookie plugin, a global `preHandler` hook that populates `request.user` from either a `session` JWT cookie or a fallback `x-user-id` header (dev/test compatibility).
- **`data-source.ts`** — TypeORM `DataSource`. Uses `synchronize: true` in local dev, migrations-only in production. `DATABASE_URL` env var overrides individual host/port/creds.
- **`routes/`** — One file per feature domain. All business logic is in helper functions; route handlers only orchestrate.
- **`entities/`** — `User`, `Game`, `UserStats`. `Game.state` is a `jsonb` column typed as `MillGameState` (widened at runtime for Connect Four too).
- **`game/`** — Pure game logic, no DB access:
  - `gameRegistry.ts` — `ENGINES` map (`GameType → IGameEngine`). Abstracts `createInitialState`, `handleMove`, and `getAiAction` per game.
  - `millEngine.ts` / `connectFourEngine.ts` — Deterministic state machines; throw on invalid moves.
  - `minimaxAi.ts` — Iterative-deepening alpha-beta minimax with transposition table, move ordering, opening book, and seesaw (double-mill) detection. Evaluates from **O's perspective**; the registry inverts the board when the bot plays as X.
  - `millAi.ts` / `connectFourAi.ts` — Thin wrappers that select between random and minimax strategies.
  - `aiConfig.json` — Bot registry: fixed UUIDs, ELO ratings, minimax depth, time limit, and strategy weights. ELO values here are the **canonical** source for leaderboard display (not DB rows for bots).

### AI loop flow

When a player submits a move via `POST /games/:id/move`, the route calls `runAiLoopIfNeeded(game)` synchronously before saving. The AI loop runs in-process: it calls `engine.getAiAction → engine.handleMove` in a while-loop until the game ends or it's the human's turn again. Bot moves are never async or queued.

### Authentication

Two parallel auth paths coexist:
1. **JWT cookie** (`session`) — set by `/auth/google/callback` or `/auth/mock-login`. Verified in the global `preHandler`.
2. **`x-user-id` header** — fallback for local dev and integration tests. Auto-creates a user row if missing.

Google OAuth flow lives in `routes/auth.ts`. The `/auth/mock-login` endpoint is intentionally left available for local development.

### Frontend (`frontend/src/`)

- **`api/games.ts`** — All fetch calls. Reads `vibe-games-user-id` from `localStorage` and sends it as `x-user-id` header when no real session exists.
- **`pages/`** — `LobbyPage` (game list + create), `GamePage` (active game UI), `StatusPage` (health check).
- **`components/MillBoard.tsx`** / **`ConnectFourBoard.tsx`** — SVG-rendered boards. Receive board state as props and emit actions via callbacks; no direct API calls.
- **Polling** — `GamePage` polls `/games/:id` every 2 seconds for multiplayer games. AI games don't poll because the AI response is returned synchronously in the move response.
- **Connect Four AI delay** — After a move against an AI in C4, `GamePage` temporarily hides the AI's move by building an intermediate `GameDto` and showing it for 1.2 s before revealing the full server response. This creates the visual illusion of the AI "thinking".

### ELO system

`UserStats` stores per-user, per-game-type ELO. Bot ELO is read from `aiConfig.json` at runtime and **never written to DB** — the DB row exists only as a placeholder. After each finished game `handleGameFinished` recalculates ELO for human players only. The leaderboard re-sorts by the live `aiConfig.json` value for bots.

## Coding conventions

- **TypeScript strict mode** everywhere — no `any` unless justified with a comment.
- **Named exports** only — except React components, which use default exports.
- File naming: `camelCase.ts` for utilities, `PascalCase.ts` for classes/entities/components.
- Backend: Fastify **plugin pattern** — every feature is a `FastifyPlugin`. No business logic in route handlers.
- Frontend: API calls go through `frontend/src/api/`; board components are pure presentational.
- `synchronize: true` is intentionally enabled for local dev; never enable it in shared or production environments — use migrations instead.

## Adding a new game type

1. Add the type to `GameType` in `shared/src/index.ts` and define its state interface.
2. Implement an `IGameEngine` in `backend/src/game/` (engine + optional AI).
3. Register it in `ENGINES` in `gameRegistry.ts`.
4. Add bot entries to `aiConfig.json` with fixed UUIDs in the `000...00XX` range.
5. Add a board React component in `frontend/src/components/` and wire it into `GamePage.tsx`.
6. Add the bot UUIDs to `AI_BOT_IDS` in `GamePage.tsx`.

## pgAdmin

- URL: http://localhost:5050 — Email: `admin@vibegames.local` / Password: `admin`
- DB host inside Docker network: `postgres`, port `5432`