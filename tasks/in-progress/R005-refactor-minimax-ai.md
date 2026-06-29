# Task: Refactor minimaxAi.ts into specific strategies

## Metadata
- **ID**: R005
- **Type**: Refactoring
- **Priority**: P3
- **Status**: Open
- **Created**: 2026-06-30

## Description
`backend/src/game/minimaxAi.ts` is 844 lines long. It currently handles evaluation heuristics and search tree logic for multiple different games (Mill, Connect Four, Holy Grail) within a single file.

## Acceptance Criteria
- [ ] Create `backend/src/game/ai/` directory.
- [ ] Extract Mill-specific evaluation logic to `millHeuristics.ts`.
- [ ] Extract Connect Four evaluation logic to `connectFourHeuristics.ts`.
- [ ] Extract generic Minimax/Alpha-Beta search algorithms into `search.ts`.
- [ ] Refactor `minimaxAi.ts` to compose these modules and remain under 300 lines.
- [ ] Verify that bots still perform correctly via `npx ts-node -r tsconfig-paths/register backend/src/scripts/testOracle.ts` or `quickBenchmarkC4.ts`.

## Agent Notes
- *(Leave blank until work begins)*
