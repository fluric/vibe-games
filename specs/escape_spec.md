# Specification: Escape

**Domain:** Single-player puzzle adventure game  
**Status:** 🔲 Planned

---

## Traceability Matrix

| Requirement | Task ID | Status |
| :--- | :--- | :--- |
| Initial Implementation | - | 🔲 Planned |

---

## Overview

**Escape** is a single-player, level-based escape room game. The player progresses through a series of **rooms**, each locked by a unique puzzle. Solving the puzzle opens the door to the next room. Progress is persisted in the database so the player can return later.

There is **no opponent** and **no matchmaking** — Escape exists entirely outside the existing multiplayer game loop.

---

## 1. Rooms & Progression

### 1.1 Room Catalogue (v1 — 4 rooms)

| Room # | Name | Puzzle Type |
|---|---|---|
| 1 | The Keypad | PIN deduction — 3 clues visible in the scene reveal 3 of the 4 digits; one is hidden behind a tappable object |
| 2 | The Cipher Wheel | Letter substitution — a brass wheel on the wall can be rotated; a ciphertext scroll is shown; player decrypts and types the keyword |
| 3 | The Fuse Box | Wire-pairing circuit — drag coloured wire ends to matching posts to complete the circuit and power the door |
| 4 | The Illusionist's Desk | Anamorphic reflection — deduce the true time from a mirrored clock face reflected in a cylinder |

### 1.2 Room Gating

- All rooms are **sequential**. Room N+1 is only accessible once Room N is solved.
- On the room-select screen, rooms are shown as: **Solved** ✅, **Available** (one past last solved), or **Locked** 🔒.
- A player who has solved rooms 1–3 can freely jump to any room from 1 to 4 (when room 4 exists). They cannot jump to room 5 yet.
- **Rule:** `maxRoomAccessible = roomsCleared + 1` (capped at total rooms available).

### 1.3 Room Revisit

- Revisiting a solved room resets the puzzle visuals for replay but **does not overwrite** the existing solved state.
- Solving a previously solved room again does not update the leaderboard.

---

## 2. Puzzle Definitions

> **NOTE:** All escape room puzzles must be designed to be genuinely hard problems. They should challenge the player's deduction, memory, and logical reasoning. Trivial or overly easy puzzles are strictly not allowed.

### Room 1 — The Keypad

- A 4-digit numeric PIN lock on the door.
- Three **sticky-note clues** are visible on scene objects (walls, desk, safe).
- One **hidden clue** is behind a tappable object (lamp shade, drawer, picture frame). Tap reveals it with an animation.
- The player types 4 digits on the keypad. Correct → door opens. Wrong → keypad shakes + red flash.
- Solution is validated client-side (solution stored in room config).

### Room 2 — The Cipher Wheel

- A brass cipher wheel rendered as two concentric rings (outer = ciphertext alphabet, inner = plaintext alphabet).
- A scroll on the wall shows a 5-letter ciphertext word.
- Player drags/rotates the wheel left/right to shift the alphabet offset (1–25).
- At the correct offset, the decoded word is highlighted; a "Confirm" button submits it.
- The scene contains a visual clue hinting at the correct offset value.

### Room 3 — The Fuse Box

- An electrical panel with 4 colour-coded wire ends on the left (dangling) and 4 labelled posts on the right.
- Player drags each wire to its matching post (colour + label must match).
- On mobile: tap wire then tap post (two-tap mode).
- Correct pair = wire snaps and glows. All 4 correct = door sparks open.
- Wrong placement = wire snaps back with a buzz animation.

---

## 3. Leaderboard

### 3.1 What Is Tracked

- **Total hints used** across all rooms (primary ranking signal).
- **Rooms cleared** count.
- **First-clear date** — ISO timestamp of when the player first fully escaped.

### 3.2 Leaderboard Display

- Accessible from the Lobby (new "🔐 Escape" entry in game navigation).
- Sorted by: rooms cleared descending → then first-clear date ascending (earliest = better).
- Columns: **Rank**, **Player**, **Rooms Cleared**, **Hints Used**, **Escaped On**.
- Shows players who have cleared **at least 1 room**.

---

## 4. Hints System

- Each room has up to **3 hints**, revealed one at a time.
- Hints do **not** apply a time penalty (game is untimed).
- Hint count is stored in DB per player per room and summed for the leaderboard.
- Hint content is bundled in the client-side room config (no server round-trip needed).

---

## 5. Progress Persistence

### 5.1 DB Entity: `EscapeProgress`

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `userId` | UUID FK → users | |
| `roomId` | integer | Which room (1-indexed) |
| `solvedAt` | timestamptz nullable | Set when puzzle is first solved |
| `hintsUsed` | integer | Total hints used in this room |
| `attempts` | integer | Total wrong submission attempts |
| `createdAt` | timestamptz | |
| `updatedAt` | timestamptz | |

Unique constraint: `(userId, roomId)`.

### 5.2 Derived State

- `roomsCleared`: count of rows where `solvedAt IS NOT NULL`.
- `maxRoomAccessible`: `roomsCleared + 1`.
- `totalHintsUsed`: sum of `hintsUsed` across all rows.

---

## 6. Backend API Contract

### `GET /escape/progress`
Returns the current user's full escape progress. Requires auth.

**Response:**
```json
{
  "rooms": [
    { "roomId": 1, "solved": true,  "solvedAt": "2026-06-30T10:00:00Z", "hintsUsed": 1, "attempts": 3 },
    { "roomId": 2, "solved": false, "solvedAt": null,                    "hintsUsed": 0, "attempts": 0 }
  ],
  "roomsCleared": 1,
  "totalHintsUsed": 1
}
```

### `POST /escape/solve`
Called when the player solves a room. Requires auth.

**Body:**
```json
{ "roomId": 1, "hintsUsed": 1, "attempts": 3 }
```

**Response:**
```json
{ "ok": true, "solvedAt": "2026-06-30T10:00:00Z" }
```

Backend checks that the room is accessible (`roomId <= roomsCleared + 1`) before accepting. If already solved, returns existing `solvedAt` without overwriting.

### `POST /escape/attempt`
Called on each wrong attempt to increment the counter. Requires auth.

**Body:** `{ "roomId": 1 }`  
**Response:** `{ "ok": true }`

### `GET /escape/leaderboard`
Returns full-escapee rankings. Public (no auth required).

**Response:**
```json
{
  "entries": [
    { "userId": "...", "username": "Alice", "avatarUrl": null, "roomsCleared": 3, "totalHintsUsed": 0, "firstClearedAt": "2026-06-30T..." }
  ]
}
```

---

## 7. Frontend Structure

```
frontend/src/
├── pages/
│   └── EscapePage.tsx              # Top-level page — room-select or active room
├── components/
│   └── escape/
│       ├── RoomSelect.tsx          # Grid of room cards (solved / available / locked)
│       ├── RoomScene.tsx           # Renders the room background + interactive hotspots
│       ├── DoorUnlock.tsx          # Animated door-opening transition
│       ├── HudBar.tsx              # Room counter + hints button
│       ├── HintDrawer.tsx          # Slide-up panel with ordered hints
│       ├── EscapeLeaderboard.tsx   # Full-escapee rankings table
│       └── puzzles/
│           ├── KeypadPuzzle.tsx
│           ├── CipherWheelPuzzle.tsx
│           └── FuseBoxPuzzle.tsx
├── api/
│   └── escape.ts                   # Typed API client for /escape/* endpoints
└── data/
    └── escapeRooms.ts              # Static room definitions (puzzle config, hints, solutions)
```

---

## 8. Shared Types (additions to `shared/src/index.ts`)

```ts
export interface EscapeRoomProgressDto {
  roomId: number;
  solved: boolean;
  solvedAt: string | null;
  hintsUsed: number;
  attempts: number;
}

export interface EscapeProgressResponse {
  rooms: EscapeRoomProgressDto[];
  roomsCleared: number;
  totalHintsUsed: number;
}

export interface EscapeLeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  roomsCleared: number;
  totalHintsUsed: number;
  firstClearedAt: string;
}

export interface EscapeLeaderboardResponse {
  entries: EscapeLeaderboardEntry[];
}
```

---

## 9. Routing

| Path | Component | Notes |
|---|---|---|
| `/escape` | `EscapePage` (room-select view) | Auth required |
| `/escape/:roomId` | `EscapePage` (active room) | Auth required; gating enforced |

Auth guard: redirect to `/?redirect=...` if not logged in (same pattern as `GamePage`).

---

## 10. Visual & UX Direction

- **Palette:** Deep navy `#0a0e1a` · Electric teal `#00f5d4` · Amber `#f5a623` · Charcoal `#1c2333`
- **Fonts:** `Space Grotesk` for UI labels, `JetBrains Mono` for codes and clues
- **Room scenes:** CSS/SVG illustrated rooms — fully responsive from 320px to 1920px
- **Mobile UX:** Puzzles open in a full-screen overlay; all tap targets ≥ 44px; cipher wheel uses swipe-friendly drag
- **Animations:** CSS keyframe door-open sweep; glowing wire snap; keypad shake on error; lock shimmer on room card hover

---

## 11. Acceptance Criteria

### Room Gating
- [ ] Logged-in player sees room 1 as "Available" on first visit.
- [ ] Completing room 1 marks it solved in DB and unlocks room 2.
- [ ] Navigating to `/escape/3` when only room 1 is solved redirects to `/escape/2`.

### Puzzle: Keypad
- [ ] Correct PIN triggers door-open animation.
- [ ] Wrong PIN shakes keypad and flashes red.
- [ ] Hidden clue is revealed on tap with animation.

### Puzzle: Cipher Wheel
- [ ] Rotating the wheel updates the decoded plaintext in real time.
- [ ] Submitting the correct decoded word triggers door-open animation.

### Puzzle: Fuse Box
- [ ] Dragging a wire to the correct post snaps and glows it.
- [ ] Dragging to wrong post snaps back with buzz animation.
- [ ] All 4 correct → door animation plays.
- [ ] Mobile two-tap mode works correctly.

### Progress
- [ ] Refreshing the page restores the player's room state.
- [ ] Progress survives logout + re-login.
- [ ] Re-solving a previously solved room does not update the leaderboard.

### Leaderboard
- [ ] Only players who cleared all currently available rooms appear.
- [ ] Sorted by hintsUsed ascending, then firstClearedAt ascending.
- [ ] Accessible from the lobby / main navigation.

---

## 12. Future Work (post-v1)

- 🔲 Add new rooms without DB or backend changes (rooms are data-only).
- 🔲 **Daily Room** — a new room released each day, same puzzle for all players.
- 🔲 Time-based rooms (solve within N seconds of a trigger).
- 🔲 Inventory system — collect items across rooms and combine them.
- 🔲 Co-op mode — two players share a room and must both confirm the answer.
