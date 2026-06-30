# 🎮 Vibe Games — AI Agent Context

> **This file is read by AI coding assistants (Antigravity, Claude Code, Cursor, etc.) at the start of each session.**
> Keep it updated as the project evolves. It is the single source of truth for project conventions.
>
> **Specs-first rule:** Before implementing any feature or making any non-trivial change, read the relevant file in `specs/`. The specs folder is the product owner's source of truth. Implement to match specs, not assumptions.

---

## Project Overview

A full-stack round-based game platform built to practice modern architecture.
- **Current phase**: Phase 0 — Foundation (monorepo scaffold)
- **Roadmap**: Tic-Tac-Toe → Auth → Real-time (WebSockets) → Multiplayer → Supremacy-style strategy

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | npm workspaces |
| Backend | Node.js 24 · Fastify · TypeScript · TypeORM |
| Database | PostgreSQL 16 (via Docker Compose) |
| Frontend | React 19 · Vite · TypeScript · Tailwind CSS v3 |
| Shared types | `@vibe-games/shared` workspace package |
| DB UI | pgAdmin (http://localhost:5050) |

---

## Repository Structure

```
vibe-games/
├── backend/            # Fastify API server
│   ├── src/
│   │   ├── index.ts        # Server bootstrap
│   │   ├── data-source.ts  # TypeORM DataSource
│   │   ├── entities/       # TypeORM entities
│   │   ├── routes/         # Fastify route plugins
│   │   └── migrations/     # TypeORM migrations
│   ├── .env                # Local env (gitignored)
│   └── .env.example
├── frontend/           # Vite + React app
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/            # Typed API client functions
│   │   ├── components/
│   │   └── pages/
│   └── .env.example
├── shared/             # Shared TypeScript types & DTOs
│   └── src/index.ts
├── specs/              # ← Product specifications (source of truth)
│   ├── README.md       # How to use the specs folder
│   ├── auth_spec.md
│   ├── lobby_spec.md
│   ├── elo_spec.md
│   ├── mill_spec.md
│   ├── connect_four_spec.md
│   ├── holy_grail_spec.md
│   ├── testing_spec.md
│   └── architecture_spec.md
├── docker-compose.yml
├── AGENTS.md           # ← You are here
├── PLAYBOOK.md         # Developer & agent workflow guide
└── package.json        # Root workspace
```

---

## Key Commands

```bash
# ── Docker (run in your Mac terminal — keeps running) ──────────────────────────
npm run docker:up       # Start PostgreSQL + pgAdmin
npm run docker:down     # Stop containers
npm run docker:reset    # ⚠️  Wipe DB and restart

# ── Dev servers (run in your Mac terminal — long-running) ─────────────────────
npm run dev             # Start backend + frontend together (via concurrently)
npm run dev:backend     # Backend only  → http://localhost:3001
npm run dev:frontend    # Frontend only → http://localhost:5173

# ── One-off commands (Antigravity runs these autonomously) ────────────────────
npm run build                          # Build all packages
npm run lint                           # Type-check backend + ESLint frontend
npm run migration:generate --name=Foo  # Generate a TypeORM migration
npm run migration:run                  # Apply pending migrations
npm run migration:revert               # Roll back last migration

# ── Backend tests (no framework — plain ts-node, ~1s each) ────────────────────
# Engine unit tests (no DB required)
npx ts-node -r tsconfig-paths/register backend/src/game/elo.spec.ts
npx ts-node -r tsconfig-paths/register backend/src/game/millEngine.spec.ts
npx ts-node -r tsconfig-paths/register backend/src/game/connectFourEngine.spec.ts
npx ts-node -r tsconfig-paths/register backend/src/game/holyGrailEngine.spec.ts
# API integration tests (requires docker:up)
npx ts-node -r tsconfig-paths/register backend/src/game/authApi.spec.ts
npx ts-node -r tsconfig-paths/register backend/src/game/gamesApi.spec.ts

# ── Frontend tests ─────────────────────────────────────────────────────────────
npm run test -w frontend               # Vitest component tests (once configured)
npm run test:e2e                       # Playwright E2E (requires dev server running)
```

---

## Environment Setup (first time)

```bash
# 1. Make sure Docker Desktop is running
# 2. From project root:
npm install
npm run docker:up
npm run dev
```

`.env` files are pre-created from `.env.example` — edit `backend/.env` if you change DB credentials.

---

## 🤖 Antigravity Vibe Coding Workflow

> Full workflow guide: see [PLAYBOOK.md](./PLAYBOOK.md)

### Specs-first workflow
1. **Read the relevant spec** in `specs/` before implementing anything.
2. Find items marked `🔲 Planned` — these are approved requirements waiting for implementation.
3. **Also check `tasks/README.md`** for open bugs (prefix `B`) — fix P1 bugs before adding new features.
4. Implement each item and write tests for its Acceptance Criteria.
5. After every code change, run `npm run test:quick` to verify nothing broke.
6. Before committing a completed feature, run `npm run test:full`.
7. Move the task file to `tasks/done/` and update `tasks/README.md` after verifying they pass.
8. Commit with a message following the convention below.

### Test tier reminder
- `npm run test:quick` — ~5s, no DB needed — run after every change
- `npm run test:full` — ~30s, needs DB — run before pushing
- `npm run test:e2e` — minutes, needs full stack — run weekly or before releases

### What Antigravity handles autonomously
- **Writing all code** — entities, routes, services, React components, types
- **File management** — create, edit, delete, refactor across the monorepo
- **One-off terminal commands** — `npm install`, `tsc --noEmit`, migrations, git commits
- **Running tests** — engine specs, API integration tests, Vitest, Playwright
- **Web research** — reading docs, checking changelogs, finding best practices
- **Browser verification** — opening the running app to visually check UI changes
- **Planning** — breaking down features into implementation plans before acting

### What you run in your Mac terminal
- `npm run dev` — keep this running in the background
- `npm run docker:up` — keep this running in the background
- Anything requiring interactive stdin (rare)

### How to communicate with Antigravity effectively

**Be goal-oriented, not instruction-oriented:**
```
✅ "Add a Tic-Tac-Toe game — player X goes first, clicking a cell
    marks it, the game detects wins/draws and shows a reset button."

❌ "Create a file called Game.ts with a class..."
```

**Reference this file explicitly when starting a new session:**
```
"Read AGENTS.md first, then help me with [task]"
```

**Let it plan first for big features:**
> For anything spanning multiple files or phases, Antigravity will produce an
> implementation plan and ask for your approval before writing code.

**Iterate on UI visually:**
> Ask Antigravity to open the browser and show you screenshots. Request
> design changes in plain English ("make it darker", "center the board").

### Deployment (Vibe Coding style)

For quick iteration / staging:
- **Frontend** → [Vercel](https://vercel.com) — connect GitHub repo, auto-deploy on push
- **Backend** → [Railway](https://railway.app) or [Render](https://render.com) — Dockerfile or direct Node deploy
- **DB** → Managed Postgres on Railway/Render (replaces Docker Compose in prod)

For Google Cloud (when you want more control):
- **Frontend** → Firebase Hosting or Cloud Run (via Docker)
- **Backend** → Cloud Run (`Dockerfile` in `/backend`)
- **DB** → Cloud SQL (Postgres)

> Ask Antigravity: *"Set up a Dockerfile for the backend and a deploy script for Cloud Run"*
> and it will handle the full deployment configuration.

---

## Coding Conventions

### General
- **TypeScript strict mode** everywhere — no `any` unless justified with a comment.
- **Named exports** only — no default exports (except React components, which follow the React convention).
- File naming: `camelCase.ts` for utilities, `PascalCase.ts` for classes/entities/components.

### Backend
- Fastify **plugin pattern** — every feature is a `FastifyPlugin`.
- TypeORM **migrations** always — never use `synchronize: true` in production. `synchronize: true` is OK in local dev only.
- Entities live in `backend/src/entities/`, one file per entity.
- Routes live in `backend/src/routes/`, one file per feature domain.
- **No business logic in route handlers** — delegate to service functions.
- Target: `backend/src/routes/games.ts` business logic should move to `backend/src/services/gameService.ts`.

### Frontend
- React **functional components** with hooks only — no class components.
- API calls go through a typed client in `frontend/src/api/`.
- Use `@vibe-games/shared` types for all API shapes — never re-declare them in the frontend.
- Tailwind utility classes for styling — avoid inline styles.
- **Internationalization (i18n):** All UI text must be translated using `react-i18next`. Never hardcode English strings in components. When adding a new page or component, wrap strings in `t('key', { defaultValue: 'English text' })` and immediately add the translation keys to `en.json`, `fr.json`, `de.json`, and `es.json` in `frontend/src/i18n/locales/`.
- **File size limit:** target ≤ 300 lines per file. Files > 600 lines must be split.

### Shared Package
- `@vibe-games/shared` contains **types and interfaces only** — no runtime code.
- All API shapes (request/response) live in `shared/src/index.ts`.

### Commit message format
```
feat(scope): add feature X
fix(scope): correct behaviour Y
refactor(scope): extract Z to service
test(scope): add missing test for W
docs(specs): update lobby spec with active games panel
```

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| Fastify over Express | Faster, schema-validated, first-class TypeScript & plugin system |
| TypeORM over Prisma | Decorator-based entities; easier to evolve toward complex game state |
| npm workspaces over Turborepo | Minimal overhead for this size; upgrade if build time hurts |
| Docker Compose for DB locally | Reproducible; no global Postgres install required |
| `shared/` package | Single source of truth for API contracts; type-safe across the stack |
| TypeScript project references | Correct cross-workspace type importing without path hacks |

---

## Current Phase Status

- [x] Phase 0 — Monorepo scaffold, Docker Compose, AGENTS.md
- [x] Phase 1 — Nine Men's Morris (Mill): Game entity, REST API, React board UI
- [x] Phase 2 — Auth: JWT, user sessions, Google OAuth & mock login
- [ ] Phase 3 — Real-time: WebSockets via @fastify/websocket
- [x] Phase 4 — Multiplayer: REST-based Matchmaking, active lobby management, turn polling
- [ ] Phase 5 — Supremacy: Hex grid, territory, strategy mechanics

---

## pgAdmin Access

- URL: http://localhost:5050
- Email: `admin@vibegames.local`
- Password: `admin`
- DB Host (inside Docker network): `postgres`
- DB Port: `5432`
