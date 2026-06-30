# Task: Active Matches on Main Page

## Metadata
- **ID**: F002
- **Type**: Feature
- **Priority**: P2
- **Status**: Done
- **Created**: 2026-06-30

## Description
Currently, active matches are not prominently displayed on the main page (lobby). We want to create an "Active Games" panel in the lobby that lists all currently ongoing games for all game types, allowing users to easily spot them and potentially spectate or join if applicable.

## Acceptance Criteria
- [x] Read `specs/lobby_spec.md` to determine if "Active Games" panel is specified and align with its design.
- [x] Fetch the list of active games from the backend (for all game types).
- [x] Display an "Active Games" panel on the main page (`LobbyPage.tsx` or similar).
- [x] Each active game should show its game type, players involved, and current status.
- [x] Write Vitest component tests for the new panel.
- [x] Write/Update E2E tests for the lobby active matches feature.

## Agent Notes
- ~~**2026-06-29**: Does this refer to a list of ALL ongoing games for spectating?... Moving to the next task until clarification is provided.~~ *(Resolved on 2026-06-30 by user request to implement the global active matches panel)*

- **2026-06-30**: Implemented `OngoingMatchesPanel` to show in-progress matches globally on the `LobbyPage`. Also updated the `GET /games` backend endpoint to support filtering by status (waiting, in_progress). Completed Vitest component test and E2E playwright test block for it. Moved to `done/`.
