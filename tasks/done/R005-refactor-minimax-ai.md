# Task: Refactor minimaxAi.ts into specific strategies

## Metadata
- **ID**: R005
- **Type**: Refactoring
- **Priority**: P3
- **Status**: Done
- **Created**: 2026-06-30

## Description
`backend/src/game/minimaxAi.ts` is 844 lines long. It currently handles evaluation heuristics and search tree logic for multiple different games (Mill, Connect Four, Holy Grail) within a single file.

## Acceptance Criteria
- [x] Create `backend/src/game/ai/` directory.
- [x] Extract Mill-specific evaluation logic to `millHeuristics.ts`.
- [x] Extract Connect Four evaluation logic to `connectFourHeuristics.ts`.
- [x] Extract generic Minimax/Alpha-Beta search algorithms into `search.ts`.
- [x] Refactor `minimaxAi.ts` to compose these modules and remain under 300 lines.
- [x] Verify that bots still perform correctly via `npx ts-node -r tsconfig-paths/register backend/src/scripts/testOracle.ts` or `quickBenchmarkC4.ts`.

## Agent Notes
- *(Leave blank until work begins)*

## Agent Notes

Extracted generic Minimax logic to `ai/search.ts`. Extracted Mill heuristics to `ai/millHeuristics.ts` and Connect Four heuristics to `ai/connectFourHeuristics.ts`. Adapted both `minimaxAi.ts` and `connectFourAi.ts` to use the generic search engine.
