# R002 — Split LobbyPage.tsx into focused components

**Type:** Refactoring
**Priority:** P3
**Reported:** 2026-06-30
**Spec:** specs/architecture_spec.md

## Description
`LobbyPage.tsx` is over 1400 lines long and handles multiple responsibilities (Leaderboard, Game Creation, Active Matches, Public Lobbies, etc.). It should be split into smaller, focused components to adhere to the Single Responsibility Principle and our 300-line limit rule.

## Acceptance Criteria
- [ ] Extract `Leaderboard` into its own component.
- [ ] Extract `GameCreationPanel` into its own component.
- [ ] Extract `ActiveGamesPanel` into its own component.
- [ ] Extract `PublicLobbiesPanel` into its own component.
- [ ] `LobbyPage.tsx` is reduced significantly in size.

## Agent Notes
- **2026-06-30**: Split `LobbyPage.tsx` into 4 focused sub-components: `ActiveGamesPanel`, `JoinByCodePanel`, `PublicLobbiesPanel`, and `LeaderboardPanel`. This reduced `LobbyPage.tsx` size by several hundred lines and decoupled the view logic. All `npm run test:quick` checks passed flawlessly.
