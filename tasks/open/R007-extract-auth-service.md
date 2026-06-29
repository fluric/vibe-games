# Task: Extract Auth Service from Routes

## Metadata
- **ID**: R007
- **Type**: Refactoring
- **Priority**: P3
- **Status**: Open
- **Created**: 2026-06-30

## Description
`backend/src/routes/auth.ts` is over the 300 line limit (384 lines). The `AGENTS.md` explicitly mandates: "No business logic in route handlers — delegate to service functions." The auth routes currently handle OAuth token verification, user creation, ELO initialization, and JWT generation inline.

## Acceptance Criteria
- [ ] Create `backend/src/services/authService.ts`.
- [ ] Extract Google OAuth token verification and user lookup/creation to `authService.ts`.
- [ ] Extract Mock Login authentication logic to `authService.ts`.
- [ ] Ensure `backend/src/routes/auth.ts` only handles HTTP request parsing, calling the service, and sending responses.
- [ ] The API integration tests (`npx ts-node -r tsconfig-paths/register backend/src/game/authApi.spec.ts`) must still pass successfully.

## Agent Notes
- *(Leave blank until work begins)*
