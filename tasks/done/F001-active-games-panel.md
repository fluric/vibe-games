# F001 — My Active Games panel in the lobby

**Type:** Feature
**Priority:** P2
**Requested:** 2026-06-29
**Spec:** specs/lobby_spec.md §4.2

## Description

Currently there is no way in the lobby to see games you are already playing. If you start a match and then navigate away, you have to remember the game ID to get back to it. This is inconvenient and players can "lose" active games.

A small panel should appear in the lobby showing any games the current player is actively participating in (status `in_progress`), so they can quickly return without hunting for a game ID.

## Acceptance Criteria

- [x] A "My Active Games" section is visible in the lobby when the current player has at least 1 in-progress game.
- [x] The section is completely hidden when the player has no active games.
- [x] Each row shows: opponent name (or "Waiting for opponent"), game type icon, and whose turn it currently is.
- [x] Clicking a row navigates to the correct `/game/:id`.
- [x] The section refreshes automatically every 10 seconds (same polling interval as other lobby data).
- [x] The section is filtered by the active game tab (only shows games of the selected type).

## Technical Notes

- Query: `GET /games?status=in_progress&playerId=<userId>` — check if this endpoint already supports this filter, or add it.
- Data needed from `GameDto`: `id`, `gameType`, `status`, `playerX`, `playerO`, `state.turn`.

## Assets

*(add a sketch or screenshot here if you have a visual idea)*

## Agent Notes

*(append progress here when working on this task)*

**2026-06-29:**
- The `My Active Games` section was already partially built in `LobbyPage.tsx`, but it was displaying all games instead of filtering by the active game tab.
- Added `filteredActiveGames = activeGames.filter(g => g.gameType === activeGameTab)` to correctly filter the matches.
- Ran tests and verified successful `npm run test:quick`.
