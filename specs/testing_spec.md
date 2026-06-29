# Specification: Testing Strategy

**Domain:** All automated tests across backend and frontend
**Status:** 🔶 Partially implemented — gaps documented below

---

## Overview

Tests are the safety net that allows agents to refactor and add features without breaking existing behaviour. Every Acceptance Criterion in the specs should have a corresponding test.

**Principle:** If it's not tested, it doesn't exist. Before a feature is marked ✅ Done in any spec, the corresponding tests must pass.

---

## Test Tiers — Quick, Full, E2E

Tests are split into three tiers based on how long they take and what infrastructure they need.
This lets agents (and you) choose the right level of feedback for each situation.

| Tier | Command | Duration | Needs DB? | Needs browser? | When to run |
|---|---|---|---|---|---|
| **Quick** | `npm run test:quick` | ~5s | ❌ No | ❌ No | After every code change |
| **Full** | `npm run test:full` | ~30s | ✅ Yes | ❌ No | Every night / before pushing |
| **E2E** | `npm run test:e2e` | Minutes | ✅ Yes | ✅ Yes | Weekly / before releases |

### What each tier includes

**Quick** (`npm run test:quick`):
- All 4 backend engine unit tests (elo, mill, connectFour, holyGrail)
- All frontend Vitest component tests

**Full** (`npm run test:full`):
- Everything in Quick, plus:
- Backend API integration tests (authApi, gamesApi)
- TypeScript type check + ESLint (`npm run lint`)
- Production build verification (`npm run build`)

**E2E** (`npm run test:e2e`):
- Playwright browser tests — simulate real user flows
- Requires both `npm run dev` and `npm run docker:up` running

---

## 1. Test Layers

### 1.1 Backend Engine Unit Tests
**Status: ✅ Partially covered — expand as engine grows**

Pure game logic, no database, no network. Each engine has a dedicated spec file.

| Test file | Engine | Coverage target |
|---|---|---|
| `backend/src/game/millEngine.spec.ts` | Nine Men's Morris | Game rules, win conditions, draw detection |
| `backend/src/game/connectFourEngine.spec.ts` | Connect Four | Column drops, win detection, full board draw |
| `backend/src/game/holyGrailEngine.spec.ts` | Grail Quest | All rules in `specs/holy_grail_spec.md` |
| `backend/src/game/elo.spec.ts` | ELO formula | All 5 cases in `specs/elo_spec.md` Section 1 |

**How to run:**
```bash
# From repo root — each takes ~1 second
npx ts-node -r tsconfig-paths/register backend/src/game/millEngine.spec.ts
npx ts-node -r tsconfig-paths/register backend/src/game/connectFourEngine.spec.ts
npx ts-node -r tsconfig-paths/register backend/src/game/holyGrailEngine.spec.ts
npx ts-node -r tsconfig-paths/register backend/src/game/elo.spec.ts
```

**Acceptance Criteria:**
- [x] All engine spec files exit with code 0.
- [ ] Every Acceptance Criterion in the game specs has a corresponding test case.

---

### 1.2 Backend API Integration Tests
**Status: ✅ Done — requires running DB**

These tests spin up the Fastify server and hit real endpoints against the local PostgreSQL database.

| Test file | What it covers |
|---|---|
| `backend/src/game/authApi.spec.ts` | Auth flow: signup, login, `/auth/me`, logout |
| `backend/src/game/gamesApi.spec.ts` | Game creation, joining, moves, AI loop, cancellation, forfeit |

**How to run:**
```bash
# Requires: npm run docker:up running in a separate terminal
npx ts-node -r tsconfig-paths/register backend/src/game/authApi.spec.ts
npx ts-node -r tsconfig-paths/register backend/src/game/gamesApi.spec.ts
```

**Acceptance Criteria:**
- [x] Auth tests: signup creates user, login returns user, logout clears session.
- [x] Games tests: create game, join game, submit move, AI responds, cancel game, forfeit.
- [ ] Auth tests: `gameStats` field is present in `/auth/me` response with correct shape.

---

### 1.3 Frontend Component Tests (Vitest)
**Status: 🔲 Not yet set up**

Fast in-process tests for React components using Vitest + React Testing Library. No browser needed.

**Goal:** Test that components render correctly and respond to user interaction — without needing E2E tests for every case.

**Setup required:**
```bash
npm install -D vitest @testing-library/react @testing-library/user-event jsdom -w frontend
```

Add to `frontend/vite.config.ts`:
```ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: './src/test/setup.ts',
}
```

**Target component tests to write first:**

| Component | What to test |
|---|---|
| `LobbyPage` — Player Card | ELO and stats display correct value per active game tab |
| `LobbyPage` — Game Creation | Correct AI list appears when switching tabs |
| `MillBoard` | Board renders 24 positions; piece placement triggers callback |
| `ConnectFourBoard` | Board renders 42 positions; column click triggers callback |

**How to run (once set up):**
```bash
npm run test -w frontend
# or in watch mode:
npx vitest --watch --project frontend
```

**Acceptance Criteria:**
- [ ] Vitest is configured in `frontend/vite.config.ts`.
- [ ] At least 1 test file exists in `frontend/src/__tests__/`.
- [ ] LobbyPage player card displays correct ELO per tab (unit test, no server needed).
- [ ] `npm run test -w frontend` exits 0.

---

### 1.4 End-to-End Tests (Playwright)
**Status: 🔶 Configured but no tests written**

Playwright is installed in the frontend package. E2E tests simulate a real user in a real browser.

**Reserved for:** Critical happy paths that are too important to test manually every release.

**Target flows to write:**

| Flow | Priority |
|---|---|
| Sign in with mock login → land in lobby | High |
| Create a game vs AI → make a move → see AI respond | High |
| Create a public lobby → join from another session → game starts | Medium |
| Win a game → ELO updates in lobby | Medium |

**How to run (requires dev server running):**
```bash
npm run dev  # in a terminal, keep running
npm run test:e2e  # runs playwright tests
```

**Acceptance Criteria:**
- [ ] At least the mock login → lobby flow is covered by a Playwright test.
- [ ] Create game vs AI → make one move → game continues test exists.

---

## 2. Running All Tests (Nightly Regression)

**To run every test in sequence:**
```bash
# Backend engine tests
npx ts-node -r tsconfig-paths/register backend/src/game/elo.spec.ts
npx ts-node -r tsconfig-paths/register backend/src/game/millEngine.spec.ts
npx ts-node -r tsconfig-paths/register backend/src/game/connectFourEngine.spec.ts
npx ts-node -r tsconfig-paths/register backend/src/game/holyGrailEngine.spec.ts

# Backend API tests (requires DB running)
npx ts-node -r tsconfig-paths/register backend/src/game/authApi.spec.ts
npx ts-node -r tsconfig-paths/register backend/src/game/gamesApi.spec.ts

# Frontend component tests (once Vitest is set up)
npm run test -w frontend

# Type checking
npm run lint

# Full build verification
npm run build
```

**Agent instruction for nightly runs:**
> *"Run all test files listed in specs/testing_spec.md Section 2. For each failure: read the relevant spec file, identify the root cause, fix the code or test as appropriate, and commit. Output a summary in `test_report.md` at the repo root."*

---

## 3. Test Writing Conventions

- Backend tests: plain TypeScript, no test framework. Use `console.log` for passing assertions and `throw new Error()` for failures.
- Frontend tests: Vitest + React Testing Library. Use `describe` / `it` / `expect`.
- Test files live alongside the code they test (backend) or in `__tests__/` subdirectories (frontend).
- Each test file must be self-contained and runnable independently.
- No test should mutate shared state that another test depends on.

---

## 4. Open Questions / Future Work

- 🔲 Add Vitest to the frontend (blocked: setup needed, see Section 1.3).
- 🔲 Write Playwright E2E for mock login and first game flow.
- 🔲 Add `npm run test:all` script at root that runs everything.
- 🔲 Set up a GitHub Actions workflow to run tests on every push.
