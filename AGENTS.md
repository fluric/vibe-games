# 🎮 Vibe Games — AI Agent Context

> **This file is read by AI coding assistants (Antigravity, Claude Code, Cursor, etc.) at the start of each session.**
> Keep it updated as the project evolves. It is the single source of truth for project conventions.

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
├── docker-compose.yml
├── AGENTS.md           # ← You are here
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
npx tsc --noEmit                       # Type-check (run inside backend/ or frontend/)
npm run migration:generate --name=Foo  # Generate a TypeORM migration
npm run migration:run                  # Apply pending migrations
npm run migration:revert               # Roll back last migration
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

### What Antigravity handles autonomously
- **Writing all code** — entities, routes, services, React components, types
- **File management** — create, edit, delete, refactor across the monorepo
- **One-off terminal commands** — `npm install`, `tsc --noEmit`, migrations, git commits
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

### Frontend
- React **functional components** with hooks only — no class components.
- API calls go through a typed client in `frontend/src/api/`.
- Use `@vibe-games/shared` types for all API shapes — never re-declare them in the frontend.
- Tailwind utility classes for styling — avoid inline styles.

### Shared Package
- `@vibe-games/shared` contains **types and interfaces only** — no runtime code.
- Group types by domain: `GameTypes.ts`, `UserTypes.ts`, etc.

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
