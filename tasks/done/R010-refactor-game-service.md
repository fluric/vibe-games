# R010 — Refactor gameService.ts using Strategy/Factory pattern

**Type:** Refactoring
**Priority:** P3
**Reported:** 2026-06-30
**Spec:** —

## Description

The `gameService.ts` currently sits at ~645 lines because it handles all logic (move processing, win condition checking, bot turn dispatching) for all games in a single file via `switch` statements. This violates the Open-Closed Principle. We should refactor this to a Factory pattern where each game engine provides a unified interface for handling actions and generating bot moves.

## Acceptance Criteria

- [ ] Extract game-specific `processAction` logic into individual strategy classes or modules.
- [ ] `gameService.ts` relies on a game engine factory to route actions.
- [ ] `gameService.ts` length is significantly reduced (under 300 lines).

## Agent Notes
