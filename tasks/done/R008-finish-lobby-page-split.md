# R008 — Finish splitting LobbyPage.tsx

**Type:** Refactoring
**Priority:** P3
**Reported:** 2026-06-30
**Spec:** —

## Description

The `LobbyPage.tsx` file is still 954 lines long, despite a previous task attempting to split it. We need to extract the remaining inline markup and logic (such as modals, bot selection, layout sections) into smaller focused components in `frontend/src/components/lobby/` so that `LobbyPage.tsx` acts solely as a layout and state coordinator and complies with the <300 line rule.

## Acceptance Criteria

- [ ] `LobbyPage.tsx` is under 300 lines.
- [ ] Remaining inline UI sections (bot selection, user info block, top bar) are moved to dedicated components.
- [ ] No regression in UI functionality.

## Agent Notes
