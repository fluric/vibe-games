# T002 — Add unit tests for gameService.ts

**Type:** Testing
**Priority:** P2
**Reported:** 2026-06-30
**Spec:** —

## Description

Currently, `gameService.ts` holds all core business logic mapping REST requests to game engine updates, including managing database transactions and matching. However, there are no unit tests covering this service layer in isolation.

## Acceptance Criteria

- [ ] Write unit tests for `gameService.ts` covering matchmaking logic.
- [ ] Write unit tests covering action processing logic.
- [ ] Verify that bot turns are correctly scheduled and triggered.

## Agent Notes
