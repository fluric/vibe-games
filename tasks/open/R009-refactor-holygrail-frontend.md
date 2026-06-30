# R009 — Refactor Holy Grail frontend components

**Type:** Refactoring
**Priority:** P3
**Reported:** 2026-06-30
**Spec:** —

## Description

The Holy Grail frontend code has grown incredibly large and complex. `useHolyGrailBoard.ts` is ~800 lines, `boardUtils.tsx` is ~800 lines, and `HexGridRenderer.tsx` is ~580 lines. These files should be refactored into smaller, more modular files (e.g., splitting out input handling, specific rendering layers, and geometry math) to adhere to project constraints and maintainability.

## Acceptance Criteria

- [ ] Break down `useHolyGrailBoard.ts` into smaller hooks by concern (e.g., selection logic, action dispatching).
- [ ] Break down `boardUtils.tsx` and `HexGridRenderer.tsx` into smaller renderer components.
- [ ] All Holy Grail frontend files are ideally under 300 lines.

## Agent Notes
