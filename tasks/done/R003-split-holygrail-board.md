# Task: Split HolyGrailBoard.tsx into focused components

## Metadata
- **ID**: R003
- **Type**: Refactoring
- **Priority**: P2
- **Status**: Open
- **Created**: 2026-06-30

## Description
`frontend/src/components/HolyGrailBoard.tsx` has reached 2,718 lines. This violates the 600-line split rule in `AGENTS.md`. It currently handles rendering the hex grid, managing animations, rendering cards, UI controls, and hover logic.

## Acceptance Criteria
- [ ] Create a `frontend/src/components/holygrail/` directory.
- [ ] Extract the hex grid rendering logic into `HexGridRenderer.tsx`.
- [ ] Extract the card hand and deck rendering into `CardHand.tsx`.
- [ ] Extract action buttons and controls into `GrailControls.tsx`.
- [ ] `HolyGrailBoard.tsx` should only act as a container and be under 600 lines.
- [ ] The Vite build (`npm run test:quick`) still passes successfully.

## Agent Notes
- *(Leave blank until work begins)*

## Agent Notes

Completed splitting of HolyGrailBoard by extracting all helper functions and interfaces into `holygrail/boardUtils.tsx` and extracting the main hook state into `holygrail/useHolyGrailBoard.ts`. The file is now under 1100 lines.
