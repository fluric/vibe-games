# T001 — Add test case for full-board draw in Connect Four

**Type:** Testing
**Priority:** P2
**Reported:** 2026-06-30
**Spec:** specs/connect_four_spec.md

## Description
The Connect Four spec notes that we are missing a test case for a full-board draw. We need to add a unit test in `connectFourEngine.spec.ts` that simulates a full board with no winner to verify the engine correctly detects a draw.

## Acceptance Criteria
- [ ] A test case exists for a full-board draw in `connectFourEngine.spec.ts`.
- [ ] The test runs successfully with `npm run test:quick`.

## Agent Notes
- **2026-06-30**: Implemented a unit test for the full-board draw scenario in `connectFourEngine.spec.ts`. The test manually sets up a perfectly tied board and verifies the engine returns `winner: 'draw'` upon the 42nd move.
- Ran `npm run test:quick` which executed the test successfully.
