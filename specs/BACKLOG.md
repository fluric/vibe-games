# Vibe Games — Backlog

> This is the task and bug tracker for Vibe Games.
> **You** add items here (bugs you find, features you want, refactoring you notice).
> **Agents** pick them up, implement them, mark them done, and commit.
>
> Agent instruction: *"Read specs/BACKLOG.md. Find all 🔲 Open items. Prioritise by Priority column. Implement each one, following the relevant spec file. Write tests. Mark as ✅ Done with date. Commit and push."*

---

## How to report a bug

Just add a row to the Bugs table below. Write in plain English — no technical details needed.
- Give it a priority: `P1` (broken, blocking), `P2` (wrong but workaround exists), `P3` (cosmetic/minor).
- Leave the Status as `🔲 Open`.
- An agent will find it, fix it, and mark it `✅ Done`.

## How to request a feature

Add a row to the Features table. Reference the spec file if relevant.

## How to request a refactoring

Add a row to the Refactoring table. Reference `specs/architecture_spec.md` if relevant.

---

## 🐛 Bugs

| # | Priority | Status | Description | Spec | Reported |
|---|---|---|---|---|---|
| B001 | P3 | 🔲 Open | `holy_grail_spec.md` still exists at the repo root — should be removed now that `specs/holy_grail_spec.md` is the canonical location | — | 2026-06-29 |

---

## ✨ Features

| # | Priority | Status | Description | Spec | Requested |
|---|---|---|---|---|---|
| F001 | P2 | 🔲 Open | Add a "My Active Games" panel to the lobby that shows games the current player is in the middle of | specs/lobby_spec.md §4.2 | 2026-06-29 |
| F002 | P3 | 🔲 Open | Session refresh — auto-refresh JWT cookie when expiry is < 24h away | specs/auth_spec.md §1.5 | 2026-06-29 |

---

## 🔧 Refactoring

| # | Priority | Status | Description | Spec | Requested |
|---|---|---|---|---|---|
| R001 | P2 | 🔲 Open | Extract `handleGameFinished`, `runAiLoopIfNeeded`, `getOrCreateUser` from `games.ts` into `backend/src/services/gameService.ts` | specs/architecture_spec.md §1.2 | 2026-06-29 |
| R002 | P2 | 🔲 Open | Split `LobbyPage.tsx` (67 KB) into `PlayerCard.tsx`, `GameCreationPanel.tsx`, `Leaderboard.tsx`, `ActiveLobbies.tsx` | specs/architecture_spec.md §1.3 | 2026-06-29 |
| R003 | P3 | 🔲 Open | Split `HolyGrailBoard.tsx` (~115 KB) — extract combat dialog to `CombatModal.tsx` and game state logic to `useHolyGrailGame.ts` hook | specs/architecture_spec.md §1.3 | 2026-06-29 |

---

## ✅ Done

| # | Type | Description | Completed | Commit |
|---|---|---|---|---|
| — | — | *(items move here when fixed)* | — | — |

---

## Nightly agent instruction (copy this into chat)

```
Read specs/BACKLOG.md. Find all items with status 🔲 Open, ordered by priority (P1 first).
For each item:
1. Read the referenced spec file if one is listed.
2. Implement the fix or feature.
3. Write or update tests to cover the change.
4. Run all quick tests (npm run test:quick) — they must pass.
5. Mark the item ✅ Done in BACKLOG.md with today's date and the commit hash.
6. Commit with an appropriate message (fix/feat/refactor).
Stop after all P1 and P2 items are done, or after 2 hours of work.
Push all changes.
```
