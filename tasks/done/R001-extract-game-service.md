# R001 — Extract game service from `games.ts`

**Type:** Refactoring
**Priority:** P2
**Requested:** 2026-06-29
**Spec:** specs/architecture_spec.md §1.2

## Description

`backend/src/routes/games.ts` (785 lines) mixes HTTP route handling with significant business logic. This violates the architectural rule that route handlers should only orchestrate (parse → call service → return response), with no business logic of their own.

Three large functions need to be extracted into a new `backend/src/services/gameService.ts` file:

| Function | What it does |
|---|---|
| `runAiLoopIfNeeded(game)` | Runs the AI move loop after a human move |
| `handleGameFinished(game, gameRepo, statsRepo)` | Updates ELO, win/loss/draw stats when a game ends |
| `getOrCreateUser(userId)` | Gets or creates a User row (used for bot users) |

## Acceptance Criteria

- [x] `backend/src/services/gameService.ts` is created.
- [x] `runAiLoopIfNeeded`, `handleGameFinished`, and `getOrCreateUser` are moved there as named exports.
- [x] `backend/src/routes/games.ts` imports these functions from the service and no longer defines them.
- [x] `npm run test:quick` passes after the change.
- [x] `npm run test:full` passes (API integration tests must still work).
- [x] `npm run build` passes.
- [x] `games.ts` is shorter than 400 lines after the refactor.

## Agent Notes

*(append progress here when working on this task)*

**2026-06-29:**
- Extracted `runAiLoopIfNeeded`, `handleGameFinished`, and `getOrCreateUser` to `backend/src/services/gameService.ts`.
- Also extracted helper functions `seedBots`, `toUserDto`, `toGameDto`, and `obfuscateHolyGrailState` to further reduce the size of `games.ts` (now 389 lines, which satisfies the <400 lines criteria).
- Extracted `BOTS_MAP` and `aiConfig` initialization to `gameService.ts`.
- Ran `npm run test:full` and verified that everything builds and tests pass successfully.
