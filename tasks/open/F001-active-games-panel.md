# F001 — My Active Games panel in the lobby

**Type:** Feature
**Priority:** P2
**Requested:** 2026-06-29
**Spec:** specs/lobby_spec.md §4.2

## Description

Currently there is no way in the lobby to see games you are already playing. If you start a match and then navigate away, you have to remember the game ID to get back to it. This is inconvenient and players can "lose" active games.

A small panel should appear in the lobby showing any games the current player is actively participating in (status `in_progress`), so they can quickly return without hunting for a game ID.

## Acceptance Criteria

- [ ] A "My Active Games" section is visible in the lobby when the current player has at least 1 in-progress game.
- [ ] The section is completely hidden when the player has no active games.
- [ ] Each row shows: opponent name (or "Waiting for opponent"), game type icon, and whose turn it currently is.
- [ ] Clicking a row navigates to the correct `/game/:id`.
- [ ] The section refreshes automatically every 10 seconds (same polling interval as other lobby data).
- [ ] The section is filtered by the active game tab (only shows games of the selected type).

## Technical Notes

- Query: `GET /games?status=in_progress&playerId=<userId>` — check if this endpoint already supports this filter, or add it.
- Data needed from `GameDto`: `id`, `gameType`, `status`, `playerX`, `playerO`, `state.turn`.

## Assets

*(add a sketch or screenshot here if you have a visual idea)*

## Agent Notes

*(append progress here when working on this task)*
