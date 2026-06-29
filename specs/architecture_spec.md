# Specification: Code Architecture & Quality

**Domain:** Module structure, file organization, code quality rules
**Status:** 🔶 Partially enforced — technical debt noted


## Traceability Matrix

| Requirement | Task ID | Status |
| :--- | :--- | :--- |
| Initial Implementation | - | ✅ Implemented |

---

## Overview

A clean, lean codebase helps AI agents work accurately and efficiently. Files that are too long, or that mix unrelated concerns, cause agents to make mistakes and miss context. This spec defines the rules for how code should be organized and what "done" means for code quality.

**The core rule:** A file should do one thing. If you can't describe a file's purpose in one sentence, it needs to be split.

---

## 1. Module Structure

### 1.1 Monorepo Workspaces

```
vibe-games/
├── shared/         # TypeScript types & DTOs only — no runtime logic
├── backend/        # Fastify API server + game engines
├── frontend/       # React + Vite UI
├── specs/          # ← YOU ARE HERE — product specifications
└── PLAYBOOK.md     # Developer & agent workflow guide
```

**Rules:**
- `shared/` contains **interfaces and types only** — never functions, never classes.
- All API shapes (request/response) are defined in `shared/src/index.ts`. Never redefine them in backend or frontend.
- `backend/` and `frontend/` both import from `@vibe-games/shared`.

---

### 1.2 Backend Structure (Target State)

```
backend/src/
├── index.ts              # Server bootstrap only — no business logic
├── data-source.ts        # TypeORM DataSource configuration
├── entities/             # DB models (one file per entity)
│   ├── User.ts
│   ├── Game.ts
│   └── UserStats.ts
├── routes/               # HTTP route handlers (one file per domain)
│   ├── auth.ts           # /auth/* routes
│   ├── games.ts          # /games/* routes
│   └── health.ts         # /health route
├── services/             # 🔲 PLANNED: Business logic extracted from routes
│   ├── authService.ts    # User creation, session logic
│   ├── gameService.ts    # Game lifecycle, AI loop, ELO updates
│   └── eloService.ts     # (Currently inline in games.ts)
├── game/                 # Pure game logic (no DB, no HTTP)
│   ├── gameRegistry.ts   # Engine map (GameType → IGameEngine)
│   ├── millEngine.ts
│   ├── connectFourEngine.ts
│   ├── holyGrailEngine.ts
│   ├── elo.ts
│   └── *.spec.ts         # Unit tests alongside the logic they test
└── migrations/
```

**Current technical debt:**
- `backend/src/routes/games.ts` (785 lines) — contains `runAiLoopIfNeeded`, `handleGameFinished`, `getOrCreateUser`, and many route handlers mixed together.
- **Target:** Extract `runAiLoopIfNeeded`, `handleGameFinished`, and `getOrCreateUser` into `backend/src/services/gameService.ts`.

**Rules for routes:**
- Route handlers orchestrate only: parse request → call service → return response.
- No business logic (if/else decisions) in route handlers.
- No DB queries directly in route handlers — delegate to service functions.

---

### 1.3 Frontend Structure (Target State)

```
frontend/src/
├── main.tsx              # React root mount only
├── App.tsx               # Router configuration only
├── api/                  # All fetch calls — typed, one function per endpoint
├── pages/                # Full-page components (route targets)
│   ├── LobbyPage.tsx     # 🔶 Too large — planned split
│   ├── GamePage.tsx      # 🔶 Too large — planned split
│   └── StatusPage.tsx
├── components/           # Reusable UI pieces
│   ├── HolyGrailBoard.tsx  # 🔶 Too large — planned split
│   ├── MillBoard.tsx
│   ├── ConnectFourBoard.tsx
│   ├── ConfirmModal.tsx
│   └── RulesModal.tsx
├── hooks/                # 🔲 PLANNED: Custom React hooks extracted from pages
│   └── useHolyGrailGame.ts
└── __tests__/            # 🔲 PLANNED: Vitest component tests
```

**Current technical debt:**

| File | Size | Problem |
|---|---|---|
| `HolyGrailBoard.tsx` | ~115 KB | Mixes board rendering, combat modal, animation, game state logic |
| `LobbyPage.tsx` | ~67 KB | Mixes player card, leaderboard, game creation, lobby list |
| `GamePage.tsx` | ~37 KB | Mixes all game types and page routing logic |

**Planned splits:**
- `HolyGrailBoard.tsx` → split into `HolyGrailBoard.tsx` (rendering), `CombatModal.tsx`, `useHolyGrailGame.ts` (state hook)
- `LobbyPage.tsx` → split into `LobbyPage.tsx` (layout), `PlayerCard.tsx`, `GameCreationPanel.tsx`, `Leaderboard.tsx`, `ActiveLobbies.tsx`

---

## 2. Code Quality Rules

### 2.1 TypeScript
- Strict mode enabled everywhere (`"strict": true`).
- No `any` unless justified by a comment explaining why.
- No `as` type assertions without a comment.
- All exported functions must have explicit return types.

### 2.2 Naming
- File names: `camelCase.ts` for utilities, `PascalCase.ts` for classes/entities/components.
- Named exports everywhere — no default exports except React components.
- Variables and functions: descriptive names that explain *what*, not *how*.

### 2.3 File Size Limits
- Target: **≤ 300 lines per file**.
- Warning: **> 400 lines** — consider splitting.
- Must split: **> 600 lines** — file is definitely doing too much.

### 2.4 Comments
- Comments explain *why*, not *what*. The code should explain itself.
- Every exported function should have a one-line JSDoc comment.
- Preserve all existing comments during edits unless they are directly related to the changed code.

---

## 3. Refactoring Process

Refactoring means changing the internal structure of code without changing its external behaviour.

**Safe refactoring process:**
1. Ensure all tests pass **before** starting.
2. Make the structural change (split file, move function, rename).
3. Run all tests again — they must still pass.
4. Commit with a message like `refactor(backend): extract handleGameFinished to gameService`.

**Agent instruction for a refactoring session:**
> *"Read specs/architecture_spec.md Section 1.2. Extract the `handleGameFinished`, `runAiLoopIfNeeded`, and `getOrCreateUser` functions from `backend/src/routes/games.ts` into a new file `backend/src/services/gameService.ts`. Update all imports. Run all backend test specs. Build must pass. Commit."*

---

## 4. Dependency Rules

- `shared/` may not import from `backend/` or `frontend/`.
- `backend/` may import from `shared/`.
- `frontend/` may import from `shared/`.
- `backend/` and `frontend/` must never import from each other.
- `game/` (pure logic) may not import from `routes/`, `entities/`, or `data-source.ts`.

---

## 5. Open Questions / Future Work

- 🔲 Set up ESLint rule for max file length.
- 🔲 Extract game service functions from `games.ts`.
- 🔲 Split `HolyGrailBoard.tsx` into sub-components + hook.
- 🔲 Split `LobbyPage.tsx` into focused components.
- 🔲 Add `frontend/src/hooks/` directory with `useHolyGrailGame.ts`.
- 🔲 GitHub Actions CI: run lint + build on every push.
