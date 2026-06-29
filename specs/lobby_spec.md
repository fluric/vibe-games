# Specification: Lobby & Matchmaking

**Domain:** Game lobby, game creation, active games, leaderboard, player profile
**Status:** ✅ Core features implemented · 🔲 Several UX improvements planned


## Traceability Matrix

| Requirement | Task ID | Status |
| :--- | :--- | :--- |
| Initial Implementation | - | ✅ Implemented |

---

## Overview

The Lobby is the central screen of the application. It lets players:
- See their own profile and ELO rating per game type
- Create a new game (vs AI or vs Human)
- Join an open game by browsing active lobbies or entering a game code
- View the ELO leaderboard

---

## 1. Player Profile Card

### 1.1 Active Player Display
**Status: ✅ Done**

The left panel shows the current player's profile. Content changes dynamically based on which **game type tab** is selected.

**Acceptance Criteria:**
- [x] Displays username and avatar (initial avatar as fallback if no photo).
- [x] Displays correct ELO rating for the currently selected game tab.
- [x] Rating label changes (`"Nine Men's Morris Rating:"`, `"Connect Four Rating:"`, `"Grail Quest Rating:"`).
- [x] Wins / Losses / Draws counts update per game tab.
- [x] Falls back to 1200 ELO and 0 W/L/D if no stats exist yet for that game type.

---

## 2. Game Type Tabs

### 2.1 Tab Selector
**Status: ✅ Done**

Three tabs at the top of the lobby: `🎮 Nine Men's Morris`, `🔴 Connect Four`, `🏆 Grail Quest`.

**Acceptance Criteria:**
- [x] Active tab highlighted with game-specific color (blue/rose/amber).
- [x] Switching tabs filters the active game list to that game type.
- [x] Switching tabs updates the player profile card stats.
- [x] Switching tabs updates the leaderboard if the leaderboard panel is open.

---

## 3. Game Creation

### 3.1 Create vs AI
**Status: ✅ Done**

- User selects an AI opponent from a dropdown.
- User selects who starts first (You / AI).
- Pressing "Play vs AI" creates a game and redirects immediately to the game screen.

**Acceptance Criteria:**
- [x] AI dropdown shows all enabled bots for the selected game type with their ELO.
- [x] Game is created with the correct `gameType`.
- [x] User is redirected to `/game/:id` after creation.

### 3.2 Create vs Human (Open Lobby)
**Status: ✅ Done**

- User presses "Create Public Lobby" — a waiting room is created.
- The lobby appears in the "Active Lobbies" list for other players to join.

**Acceptance Criteria:**
- [x] Created game appears in the active lobbies list.
- [x] Another player can join via "Join" button or by entering the game ID.
- [x] Game starts immediately when the second player joins.

### 3.3 Private Games (Invite by Code)
**Status: ✅ Done**

- User can create a private (non-public) game.
- A game code/ID is shown to share with a friend.
- Friend enters the code in "Join by Code" to join.

**Acceptance Criteria:**
- [x] Private games do not appear in the public active lobbies list.
- [x] Game ID/code functions as an invite link.

---

## 4. Active Lobbies List

### 4.1 Lobby List
**Status: ✅ Done**

- Shows all open (waiting) games of the selected game type.
- Each entry shows: creator name, ELO, game type, privacy status.

**Acceptance Criteria:**
- [x] Only shows games with status `waiting`.
- [x] Filtered by active game tab.
- [x] Join button joins the game and redirects to game screen.

### 4.2 My Active Games
**Status: 🔲 Planned**

There is currently no dedicated "My Active Games" section in the lobby. Players in the middle of a game must remember the game ID.

**Planned Behaviour:**
- Show a section for games the current player is actively participating in (status `in_progress`).
- Each entry: opponent name, game type, whose turn it is.
- Clicking an entry navigates to the game screen.

**Acceptance Criteria:**
- [ ] Section visible only if the player has at least one active game.
- [ ] Shows opponent name and current turn indicator.
- [ ] Clicking navigates to the correct `/game/:id`.

---

## 5. ELO Leaderboard

### 5.1 Leaderboard Tab
**Status: ✅ Done**

- Accessible via the "ELO Leaderboard" tab below the game lists.
- Shows all players (humans + bots) ranked by ELO for the selected game type.
- Human players are highlighted. The current user is marked "YOU".

**Acceptance Criteria:**
- [x] List is sorted by ELO descending.
- [x] Columns: Rank, Player, ELO, Record (W-L-D).
- [x] Bot entries are labeled with a `BOT` badge.
- [x] Current user is labeled with a `YOU` badge.
- [x] Leaderboard updates when the game tab is switched.

---

## 6. Backend API Contract

### `GET /games?gameType=mill&status=waiting`
Returns a list of open lobbies.
```json
[{ "id": "uuid", "gameType": "mill", "playerX": { ... }, "status": "waiting", "isPublic": true }]
```

### `POST /games`
**Body:**
```json
{ "gameType": "mill", "isPublic": true, "playerXId": "uuid", "playerOId": "uuid-of-ai-or-null" }
```

### `POST /games/:id/join`
Joins an open game as Player O. Redirects to game.

### `GET /games/leaderboard?gameType=mill`
**Response:** `LeaderboardResponse`
```json
{
  "entries": [
    { "userId": "...", "username": "Perfect Oracle", "elo": 1320, "wins": 0, "losses": 0, "draws": 0, "isBot": true }
  ]
}
```

---

## 7. Open Questions / Future Work

- 🔲 **My Active Games panel** — see section 4.2 above.
- 🔲 **Game rematch** — after a game ends, offer a "Rematch" button that creates a new game with the same opponent.
- 🔲 **Spectator mode** — allow watching an in-progress game without participating.
- 🔲 **Invite link** — generate a shareable `/join/:code` URL for private games.
