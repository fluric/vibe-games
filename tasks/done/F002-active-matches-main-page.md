# [CLARIFICATION NEEDED] Task: Active Matches on Main Page

## Metadata
- **ID**: F002
- **Type**: Feature
- **Priority**: P2
- **Status**: Open
- **Created**: 2026-06-30

## Description
Currently, active matches are not prominently displayed on the main page (lobby). We want to create an "Active Games" panel in the lobby that lists all currently ongoing games for all game types, allowing users to easily spot them and potentially spectate or join if applicable.

## Acceptance Criteria
- [ ] Read `specs/lobby_spec.md` to determine if "Active Games" panel is specified and align with its design.
- [ ] Fetch the list of active games from the backend (for all game types).
- [ ] Display an "Active Games" panel on the main page (`Lobby.tsx` or similar).
- [ ] Each active game should show its game type, players involved, and current status.
- [ ] Write Vitest component tests for the new panel.
- [ ] Write/Update E2E tests for the lobby active matches feature.

## Agent Notes
- **2026-06-29**: Does this refer to a list of ALL ongoing games for spectating? The spec currently only defines 'My Active Games' (which is already implemented as F001) and 'Active Lobbies' (games waiting for players). 'Spectator mode' is listed as Future Work in the spec but lacks UX/UI details. Should we design a new 'Ongoing Games' section for spectators, and if so, how should it differ from 'My Active Games'? Moving to the next task until clarification is provided.

## Agent Notes

Implemented OngoingMatchesPanel to show in-progress matches globally on the LobbyPage. Also updated the GET /games backend endpoint to support filtering by status (waiting, in_progress).
