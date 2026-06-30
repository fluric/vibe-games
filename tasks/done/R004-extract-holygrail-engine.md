# Task: Refactor holyGrailEngine.ts into sub-modules

## Metadata
- **ID**: R004
- **Type**: Refactoring
- **Priority**: P2
- **Status**: Open
- **Created**: 2026-06-30

## Description
`backend/src/game/holyGrailEngine.ts` is 1,601 lines long. It violates the `AGENTS.md` limit of 300 lines (and absolute max 600 lines). The engine handles combat resolution, card deck logic, grid traversal, and turn management all in one file.

## Acceptance Criteria
- [x] Create `backend/src/game/holygrail/` directory.
- [x] Extract combat logic into `combatResolver.ts`.
- [x] Extract card and deck logic into `deckManager.ts`.
- [x] Extract grid traversal and line-of-sight logic into `gridUtils.ts`.
- [x] Refactor `holyGrailEngine.ts` to coordinate these modules while staying under 600 lines.
- [x] Ensure all engine unit tests pass via `npx ts-node -r tsconfig-paths/register backend/src/game/holyGrailEngine.spec.ts`.

## Agent Notes
- *(Leave blank until work begins)*
