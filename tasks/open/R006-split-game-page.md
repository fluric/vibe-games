# Task: Split GamePage.tsx into specialized game views

## Metadata
- **ID**: R006
- **Type**: Refactoring
- **Priority**: P3
- **Status**: Open
- **Created**: 2026-06-30

## Description
`frontend/src/pages/GamePage.tsx` is 840 lines long. It handles WebSocket connections, local polling, state management, and rendering generic UI components for multiple different games, making it difficult to maintain.

## Acceptance Criteria
- [ ] Create `frontend/src/components/game/` directory.
- [ ] Extract generic layout and player stats to `GameLayout.tsx` and `PlayerStats.tsx`.
- [ ] Extract the action panels and turn controls into `GameControls.tsx`.
- [ ] Ensure `GamePage.tsx` drops under 300 lines by delegating these rendering concerns.
- [ ] The Vite build (`npm run test:quick`) still passes successfully.

## Agent Notes
- *(Leave blank until work begins)*
