# Vibe Games — Developer & Agent Playbook

> This is your guide to working with this project asynchronously: writing specs, running agents overnight, keeping the code clean, and staying in control without reading the code yourself.

---

## Table of Contents

1. [The Big Picture](#1-the-big-picture)
2. [Your Role as Product Owner](#2-your-role-as-product-owner)
3. [Task & Bug Tracking](#3-task--bug-tracking)
4. [Choosing an AI Model](#4-choosing-an-ai-model)
5. [How to Write a Good Spec](#5-how-to-write-a-good-spec)
6. [How to Talk to AI Agents](#6-how-to-talk-to-ai-agents)
7. [Running Agents Overnight](#7-running-agents-overnight)
8. [Nightly Automation — Recurring Schedules](#8-nightly-automation--recurring-schedules)
9. [Local Setup — Keep Things Running](#9-local-setup--keep-things-running)
10. [Running Tests Locally](#10-running-tests-locally)
11. [Code Health & Refactoring](#11-code-health--refactoring)
12. [Quick Reference](#12-quick-reference)

---

## 1. The Big Picture

```
YOU (Product Owner)
    │
    ▼
specs/         ← write requirements here in plain English
    │
    ▼
AI Agent       ← reads spec, writes code, writes tests, commits
    │
    ▼
Code + Tests   ← stable, tested, spec-aligned implementation
```

**You never need to read the code** unless you want to. Your job is to maintain the `specs/` folder and review the results. Agents implement, test, refactor, and push.

### The golden rule
If it's in the spec, it should be in the code and tested. If it's not in the spec, the agent should not implement it.

---

## 2. Your Role as Product Owner

**What you do:**
- Describe features and rules in `specs/` in plain English.
- Mark items as `🔲 Planned`, `🔶 In Progress`, `✅ Done`.
- Review the browser or screenshots to confirm features work as described.
- Decide priorities — what gets implemented next.

**What agents do:**
- Read specs and implement them.
- Write tests that prove the implementation matches the spec.
- Refactor code to keep it clean without breaking anything.
- Report back with a summary.

**Analogy:** You are the architect sketching buildings on paper. The agent is the construction crew. The tests are the building inspector.

---

## 3. Task & Bug Tracking

All tasks, bugs, and refactoring ideas live in **[specs/BACKLOG.md](./specs/BACKLOG.md)**.
This is the human-and-agent shared task queue.

### How to report a bug
1. Open `specs/BACKLOG.md`.
2. Add a row to the **Bugs** table: a short description in plain English, a priority (`P1`/`P2`/`P3`), and today's date.
3. Leave Status as `🔲 Open`.
4. Tell the agent: *"Read specs/BACKLOG.md and fix all P1 and P2 open bugs."*

**Priority guide:**
| Priority | Meaning | Example |
|---|---|---|
| P1 | Broken, blocking — fix immediately | Game crashes on move submission |
| P2 | Wrong but a workaround exists | ELO not updating after win |
| P3 | Cosmetic or minor inconvenience | Wrong label text |

### How to request a feature
Add a row to the **Features** table in `specs/BACKLOG.md` and reference the spec file where the detailed description lives.

### How agents close items
When an agent finishes an item, it:
1. Marks the row `✅ Done` in `BACKLOG.md`.
2. Adds the completion date and commit hash.
3. Commits with a message like `fix(auth): resolve B001 — remove duplicate spec file`.

### Why not GitHub Issues?
GitHub Issues are great for team projects. For this solo setup, a file-based backlog has one big advantage: agents can **read and write it directly** without needing API credentials. You can always link a GitHub Issue number in the description column if you want cross-referencing.

---

## 4. Choosing an AI Model

The model selector is the **dropdown in the top-right of the Antigravity chat UI**. Here's how to choose:

| Situation | Recommended model | Why |
|---|---|---|
| Overnight `/goal` run | **Claude Sonnet or Gemini Pro** | Better at long-horizon reasoning, following multi-step plans, not losing context |
| Large refactoring | **Claude Sonnet (Thinking)** | Extended thinking handles complex dependency analysis |
| Quick fix / typo / minor feature | **Gemini Flash** | 10× faster, cheaper, sufficient for small tasks |
| Writing specs or docs | Either | Both work well for text generation |
| Debugging tricky logic | **Claude Sonnet (Thinking)** | Thinking mode reasons step-by-step through edge cases |

**Practical rule:** Switch to Flash during the day for interactive coding. Switch to Sonnet/Pro before kicking off an overnight run.

**Where to switch:** Click the model name in the Antigravity header → select from the dropdown. The change takes effect on the next message.

---

## 5. How to Write a Good Spec

A good spec answers three questions:
1. **What does this feature do?** (plain English description)
2. **How do I know it works?** (Acceptance Criteria as a checkbox list)
3. **What questions are not yet decided?** (Open Questions section)

### Status tags — use these consistently
- `🔲 Planned` — requirement exists, not yet implemented
- `🔶 In Progress` — agent is currently working on it
- `✅ Done` — implemented and tested
- `❌ Cancelled` — no longer wanted

### Acceptance Criteria format
Write them as checkboxes:
```markdown
**Acceptance Criteria:**
- [ ] Given a new player, when they visit the lobby, then they see 1200 ELO.
- [ ] When the game tab is switched, then the ELO label and value update immediately.
- [ ] If no stats exist for a game type, then 0 W/0 L/0 D is shown.
```

The `[ ]` becomes `[x]` when the agent verifies it is implemented.

### Adding visual references
Drag images directly into a spec file in VS Code or add them with:
```markdown
### Visual Reference
![Lobby mockup](./assets/lobby_mockup.png)
```

Keep image files in `specs/assets/`.

### Example of a well-written requirement
```markdown
### 4.2 My Active Games Panel
**Status: 🔲 Planned**

The lobby should show a panel listing any games the current player is already in the middle of,
so they can quickly return to an active match without remembering the game ID.

**Acceptance Criteria:**
- [ ] Section is only visible if the player has ≥ 1 in-progress game.
- [ ] Each row shows: opponent name, game type icon, and whose turn it is.
- [ ] Clicking a row navigates to `/game/:id`.
- [ ] Section refreshes automatically every 10 seconds.
```

---

## 6. How to Talk to AI Agents

### Be goal-oriented, not instruction-oriented

✅ Good:
> *"Read specs/lobby_spec.md. Find all 🔲 Planned items. Implement them, write tests for the Acceptance Criteria, run all tests, and push. Report what you did."*

❌ Not as good:
> *"Add a component called MyGamesPanel.tsx with a useState hook..."*

### Start sessions by referencing specs
> *"Read AGENTS.md and specs/README.md. Then look at specs/testing_spec.md Section 1.3. Set up Vitest in the frontend package and write the first component test for the player card ELO display. Run the test, make it pass, commit."*

### For big features, ask for a plan first
> *"Read specs/architecture_spec.md. Plan how to split HolyGrailBoard.tsx into sub-components as described in Section 1.3. Show me the plan before writing any code."*

### For overnight autonomous runs
Use the `/goal` slash command in the chat:
> `/goal Read all specs in specs/. Find every item marked 🔲 Planned. Implement each one, starting with items in testing_spec.md. Write tests for each Acceptance Criterion. Run all tests after each change. Push all passing changes. Write a summary in test_report.md.`

---

## 7. Running Agents Overnight

### Step 1 — Keep your Mac awake
Open a terminal and run:
```bash
caffeinate -di
```
This keeps the Mac and disk awake indefinitely. Press `Ctrl+C` to stop when you're done.

> **What is `caffeinate`?** It is a built-in macOS command that prevents the system from sleeping. `-d` prevents display sleep, `-i` prevents system sleep.

### Step 2 — Keep the dev servers running
In a separate terminal window (keep it open):
```bash
cd ~/Dev/vibe-games
npm run docker:up    # starts PostgreSQL database (needed for API tests)
npm run dev          # starts backend (port 3001) and frontend (port 5173)
```

You can leave this terminal running overnight. Both servers restart automatically if code changes (nodemon for backend, Vite HMR for frontend).

### Step 3 — Start the agent with a goal
In the Antigravity chat, type your `/goal` command and press Enter. The agent will work autonomously without needing your input.

### What happens while you sleep
1. Agent reads the specs.
2. Agent writes code and tests.
3. Agent runs tests (`ts-node` for backend, `vitest` for frontend).
4. If tests pass, agent commits and pushes.
5. If tests fail, agent reads the error, fixes the code, and retries.
6. Agent writes a summary file (`test_report.md`) and stops.

You wake up to a pushed commit and a summary.

### Safety: what agents don't do autonomously
- Agents do **not** run `docker:reset` (wipe database) unless you explicitly ask.
- Agents do **not** deploy to production.
- Agents do **not** modify secrets or `.env` files without asking.

---

## 8. Nightly Automation — Recurring Schedules

Use the `/schedule` slash command in Antigravity to set up a recurring cron job. The agent wakes up on schedule, does the work, and goes back to sleep.

> **Prerequisite:** Your Mac must be awake and `npm run dev` + `npm run docker:up` must be running.

### Nightly test + backlog run (recommended starting point)

Type this in Antigravity chat:
```
/schedule Run every night at 2am:
1. Run npm run test:full. For any failure: read the relevant spec, fix the code, commit.
2. Read specs/BACKLOG.md. Fix all P1 and P2 open items. Mark them done. Commit.
3. Write a summary to test_report.md at the repo root. Push all changes.
```

### Nightly refactoring scan
```
/schedule Run every Sunday at 1am:
Read specs/architecture_spec.md. Scan the codebase for files > 400 lines.
For each oversized file: propose a split that matches the target structure in the spec.
Implement the split if all existing tests still pass after the refactor.
Commit each split separately. Push.
```

### Nightly spec alignment check
```
/schedule Run every night at 3am:
For each spec file in specs/: find all items marked ✅ Done.
Verify the implementation actually matches the spec description.
If a test is missing for a Done item, write it.
If the code doesn't match the spec, file a bug in specs/BACKLOG.md as P2.
Commit any new tests. Push.
```

### Managing scheduled jobs
- **To see running schedules:** Use `Manage Task → list` in the Antigravity UI.
- **To cancel a schedule:** Use `Manage Task → kill <task-id>`.
- **One-time variant:** Use `/goal` instead of `/schedule` for a single overnight run without recurrence.

### Test tiers in automation

| Automation type | Use this test command | Why |
|---|---|---|
| After every code change (agent) | `npm run test:quick` | Fast feedback, no DB dependency |
| Nightly full regression | `npm run test:full` | Includes integration tests + build |
| Before a release or major refactor | `npm run test:full && npm run test:e2e` | Full confidence |

---

## 9. Local Setup — Keep Things Running

### First-time setup
```bash
# 1. Make sure Docker Desktop is running (find it in /Applications)
# 2. Clone and install
cd ~/Dev/vibe-games
npm install

# 3. Start the database
npm run docker:up

# 4. Start the dev servers
npm run dev
```

### Database management
```bash
npm run docker:up     # Start PostgreSQL + pgAdmin (run once, keep running)
npm run docker:down   # Stop containers
npm run docker:reset  # ⚠️  Wipes ALL data and restarts — use only when needed
```

### pgAdmin (database browser)
URL: http://localhost:5050
- Email: `admin@vibegames.local`
- Password: `admin`

Useful for browsing data, checking ELO values, seeing what's in the database.

### Common problems

**Backend won't start — port 3001 already in use:**
```bash
lsof -i :3001   # find what's using the port
kill <PID>      # kill it
npm run dev:backend
```

**Database connection error:**
```bash
npm run docker:up   # make sure containers are running
docker ps           # verify they are listed
```

---

## 10. Running Tests Locally

### Test tiers at a glance

```bash
npm run test:quick   # ~5s — engine unit tests + Vitest (no DB needed)
npm run test:full    # ~30s — everything: unit + integration + lint + build
npm run test:e2e     # minutes — Playwright browser tests (needs dev server)
```

### When to use each tier
- **During active development** → `test:quick`. Run it before every commit.
- **Before pushing** → `test:full`. Catches integration issues and type errors.
- **Before a release or after a big refactor** → `test:full && test:e2e`.
- **In overnight agent runs** → `test:full` by default; add `test:e2e` for weekly runs.

All backend tests use `ts-node` (no test framework) and take ~1 second each.

### Engine unit tests (no database needed)
```bash
npx ts-node -r tsconfig-paths/register backend/src/game/elo.spec.ts
npx ts-node -r tsconfig-paths/register backend/src/game/millEngine.spec.ts
npx ts-node -r tsconfig-paths/register backend/src/game/connectFourEngine.spec.ts
npx ts-node -r tsconfig-paths/register backend/src/game/holyGrailEngine.spec.ts
```

### API integration tests (requires database running)
```bash
npx ts-node -r tsconfig-paths/register backend/src/game/authApi.spec.ts
npx ts-node -r tsconfig-paths/register backend/src/game/gamesApi.spec.ts
```

### Frontend component tests (once Vitest is set up)
```bash
npm run test -w frontend
```

### Full type check
```bash
npm run lint   # runs tsc --noEmit on backend + eslint on frontend
```

### Full build verification
```bash
npm run build   # builds shared → backend → frontend in order
```

### Run everything (nightly regression)
```bash
# Engine tests
npx ts-node -r tsconfig-paths/register backend/src/game/elo.spec.ts && \
npx ts-node -r tsconfig-paths/register backend/src/game/millEngine.spec.ts && \
npx ts-node -r tsconfig-paths/register backend/src/game/connectFourEngine.spec.ts && \
npx ts-node -r tsconfig-paths/register backend/src/game/holyGrailEngine.spec.ts && \
# API tests (requires DB)
npx ts-node -r tsconfig-paths/register backend/src/game/authApi.spec.ts && \
npx ts-node -r tsconfig-paths/register backend/src/game/gamesApi.spec.ts && \
# Build verification
npm run lint && npm run build && \
echo "✅ All checks passed"
```

---

## 11. Code Health & Refactoring

### Why code quality matters for agents
AI agents work from context windows — they read a portion of your code and work within it. If files are 700 lines long with unrelated things mixed together, the agent sees half the file, misses context, and makes mistakes. Smaller, focused files = better, more accurate agents.

**Target: ≤ 300 lines per file.**

### Planned refactoring work (from `specs/architecture_spec.md`)

| File | Current size | Problem | Plan |
|---|---|---|---|
| `HolyGrailBoard.tsx` | ~115 KB | Too much mixed in one file | Split: board, combat modal, game hook |
| `LobbyPage.tsx` | ~67 KB | Too many concerns | Split: player card, game creation, leaderboard |
| `backend/src/routes/games.ts` | 785 lines | Business logic in routes | Extract to `services/gameService.ts` |

### How to trigger a refactoring run
> *"Read specs/architecture_spec.md Sections 1.2 and 1.3. Refactor `backend/src/routes/games.ts` to extract `handleGameFinished`, `runAiLoopIfNeeded`, and `getOrCreateUser` into `backend/src/services/gameService.ts`. Update all imports. Run all backend tests. Commit."*

### Safe refactoring checklist
Before any refactor, agents must:
1. Run all tests → confirm they pass.
2. Make the structural change.
3. Run all tests again → must still pass.
4. Build the project → must succeed.
5. Commit with a `refactor(...)` commit message.

---

## 12. Quick Reference

### Key URLs
| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001 |
| Database browser | http://localhost:5050 |

### Key files to know about
| File | Purpose |
|---|---|
| `specs/README.md` | Overview of all specs |
| `AGENTS.md` | Project context read by agents at session start |
| `PLAYBOOK.md` | This file — workflow guide |
| `shared/src/index.ts` | All shared TypeScript types |
| `backend/src/game/aiConfig.json` | Bot definitions and ELO ratings |
| `.env` files | Local environment variables (never committed) |

### Git commit message format
```
type(scope): short description

feat(grail): add hill retreat to AI logic
fix(lobby): correct ELO display on tab switch
refactor(backend): extract game service from routes
test(mill): add draw condition test cases
docs(specs): add active games panel requirement
```

### Useful agent prompts (copy & paste)

**Run all tests:**
> *"Run every test file listed in specs/testing_spec.md Section 2. Report results. Fix any failures, push fixes, and output a summary."*

**Implement spec items:**
> *"Read specs/[filename]. Find all items marked 🔲 Planned. Implement each one and write tests. Commit and push."*

**Refactor for cleanliness:**
> *"Read specs/architecture_spec.md. Identify the largest files. Propose a refactoring plan that splits them per the target structure. Wait for my approval before writing any code."*

**Nightly regression:**
> `/goal Run the full test suite from specs/testing_spec.md. Fix any failures. Run lint and build. Output a test_report.md. Push all changes.`
