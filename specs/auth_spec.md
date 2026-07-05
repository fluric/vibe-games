# Specification: Authentication & User Identity

**Domain:** User accounts, login, session management
**Status:** ✅ Core features implemented · 🔲 Some edge cases to add


## Traceability Matrix

| Requirement | Task ID | Status |
| :--- | :--- | :--- |
| Initial Implementation | - | ✅ Implemented |

---

## Overview

Vibe Games supports two authentication paths that coexist:
1. **Google OAuth** — real users sign in with their Google account.
2. **Mock Login** — development-only login by username, for testing without a Google account.

Sessions are maintained via an httpOnly JWT cookie named `session`.

---

## 1. User Registration & Identity

### 1.1 Google OAuth Login
**Status: ✅ Done**

- User clicks "Sign in with Google".
- Backend verifies the Google ID token via `google-auth-library`.
- If the Google account is new: a `User` row is created with `googleId`, `email`, `username` (derived from display name), and `avatarUrl`.
- If the Google account already exists: the existing user is loaded.
- A JWT is set as an httpOnly cookie (`session`) and the user is redirected to the lobby.

**Acceptance Criteria:**
- [x] A new Google account creates a unique User row.
- [x] Re-logging in with the same Google account returns the same user ID.
- [x] Username is derived from Google display name (spaces replaced with `_`, max 30 chars).
- [x] Username uniqueness is enforced — a suffix is appended if a collision occurs.
- [x] Avatar URL from Google profile is stored and displayed in the lobby.

---

### 1.2 Mock Login (Development Only)
**Status: ✅ Done**

- `POST /auth/mock-login` with `{ username }`.
- Creates a user row if no user with that username exists.
- Returns a JWT session cookie.
- This endpoint must never be reachable in production (guarded by environment check).

**Acceptance Criteria:**
- [x] Calling mock-login with a new username creates a user row.
- [x] Calling mock-login with an existing username returns the same user ID.
- [x] Session cookie is set correctly.

---

### 1.3 Session Verification
**Status: ✅ Done**

- `GET /auth/me` returns the current user's profile and game stats if a valid session cookie exists.
- Returns `{ user: null }` if no valid session.
- The global `preHandler` hook in `backend/src/index.ts` populates `request.user` from the JWT cookie on every request.
- Fallback: an `x-user-id` header (development/test only) auto-creates a user if no session exists.

**Acceptance Criteria:**
- [x] `/auth/me` returns full `UserDto` including `gameStats` for all game types.
- [x] Expired or tampered JWT tokens return `{ user: null }`.
- [x] `x-user-id` header fallback works in tests without a real session.

---

### 1.4 Logout
**Status: ✅ Done**

- `POST /auth/logout` clears the session cookie.

**Acceptance Criteria:**
- [x] After logout, `/auth/me` returns `{ user: null }`.

---

### 1.5 Username Editing
**Status: ✅ Done**

- Users can change their display name from the lobby.
- `PUT /auth/username` with `{ username }`.
- Username must be 2–30 characters, alphanumeric + underscores only.
- Uniqueness enforced.

**Acceptance Criteria:**
- [x] Valid username change persists to DB and is reflected in `/auth/me`.
- [x] Attempting a duplicate username returns an error.
- [x] Too-short or invalid characters are rejected.

---

## 2. Data Model

### User Entity (`backend/src/entities/User.ts`)
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key, auto-generated |
| `username` | string | Unique, 2–30 chars |
| `googleId` | string | Nullable, links to Google account |
| `email` | string | Nullable |
| `avatarUrl` | string | Nullable, from Google profile |
| `createdAt` | timestamp | Auto-set on creation |
| `updatedAt` | timestamp | Auto-updated |

### UserStats Entity (`backend/src/entities/UserStats.ts`)
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `userId` | UUID | Foreign key → User |
| `gameType` | string | `mill` / `connect_four` / `tic_tac_toe` / `grail_quest` |
| `elo` | number | Default 1200 |
| `wins` | number | |
| `losses` | number | |
| `draws` | number | |

---

## 3. API Contract

### `GET /auth/me`
**Response:** `AuthStatusResponse`
```json
{
  "user": {
    "id": "uuid",
    "username": "Player_abc",
    "createdAt": "2025-01-01T00:00:00Z",
    "avatarUrl": "https://...",
    "email": "user@example.com",
    "elo": 1200,
    "wins": 0,
    "losses": 0,
    "draws": 0,
    "gameStats": {
      "mill":         { "elo": 1200, "wins": 0, "losses": 0, "draws": 0 },
      "connect_four": { "elo": 1176, "wins": 0, "losses": 1, "draws": 0 },
      "tic_tac_toe":  { "elo": 1200, "wins": 0, "losses": 0, "draws": 0 },
      "grail_quest":   { "elo": 1200, "wins": 0, "losses": 0, "draws": 0 }
    }
  }
}
```

### `POST /auth/mock-login`
**Body:** `{ "username": "string" }`
**Response:** `AuthStatusResponse` (same shape as above)

### `POST /auth/logout`
**Response:** `{ "ok": true }`

### `PUT /auth/username`
**Body:** `{ "username": "string" }`
**Response:** `{ "user": UserDto }`

---

## 4. Open Questions / Future Work

- 🔲 **Email verification** — Google OAuth users are trusted, but mock login has no verification. Add a flag if email-verified matters later.
- 🔲 **Account deletion** — No endpoint to delete a user account yet. GDPR may require this.
- 🔲 **Avatar upload** — Users can only get an avatar from Google. Consider allowing custom avatar uploads.
- 🔲 **Session refresh** — JWT tokens expire. Add automatic refresh on page load if expiry is < 24h away.
