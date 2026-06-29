# Specification: ELO Rating System

**Domain:** Player skill rating across all game types
**Status:** ✅ Core implemented


## Traceability Matrix

| Requirement | Task ID | Status |
| :--- | :--- | :--- |
| Initial Implementation | - | ✅ Implemented |

---

## Overview

ELO is a rating system that estimates the relative skill of players. Each player has a separate ELO rating per game type. Bots also have ELO ratings, defined statically in `aiConfig.json`.

**Plain English:** If you beat a strong opponent, you gain a lot of points. If you lose to a weak opponent, you lose a lot of points. If two players are equal, wins and losses are roughly symmetric.

---

## 1. Rating Formula

**Status: ✅ Done**

The standard ELO formula is used:

```
expectedScore = 1 / (1 + 10^((opponentRating - playerRating) / 400))
newRating = round(playerRating + K * (outcome - expectedScore))
```

Where:
- `K = 32` (maximum points exchangeable per game — can be tuned per game type later)
- `outcome = 1` for a win, `0.5` for a draw, `0` for a loss

**Example:**
- Player A: 1200 ELO, Player B: 1200 ELO
- Player A wins → A gains +16, B loses −16
- Both reach 1216 / 1184

**Acceptance Criteria:**
- [x] Equal-rated win: `1200 vs 1200 → 1216`
- [x] Equal-rated loss: `1200 vs 1200 → 1184`
- [x] Win vs stronger (`1200 vs 1600`): `→ 1229`
- [x] Loss vs weaker (`1200 vs 800`): `→ 1171`
- [x] Equal-rated draw: `1200 vs 1200 → 1200`

---

## 2. Rating Updates

### 2.1 When ratings update
**Status: ✅ Done**

ELO is updated immediately when a game reaches `status = 'finished'`.
The `handleGameFinished` function in `backend/src/routes/games.ts` updates both players' `UserStats` rows.

**Acceptance Criteria:**
- [x] Both players' `UserStats` rows are updated on game finish.
- [x] Win/loss/draw counter is incremented correctly.
- [x] If a `UserStats` row doesn't exist yet for that user+gameType, it is created with ELO 1200.

### 2.2 Bot ratings
**Status: ✅ Done**

- Bot ELO is defined in `backend/src/game/aiConfig.json`.
- Bot ELO is **never written to the database** — it is always read from the config file.
- This means bot ratings can be calibrated by running the AI tournament script without affecting any game data.

**Acceptance Criteria:**
- [x] Bot ELO in leaderboard comes from `aiConfig.json`, not the DB.
- [x] Human ELO changes are reflected when human plays vs bot.
- [x] Bot ELO does not change in the DB after a game.

---

## 3. Initial Rating

- All new players start at **1200 ELO**.
- This applies per game type — a player new to Grail Quest starts at 1200 even if their Mill ELO is 1400.

---

## 4. Leaderboard

- Combines human players (from DB) and bots (from `aiConfig.json`) into a single ranked list.
- Sorted by ELO descending.
- Displayed separately per game type.

---

## 5. Open Questions / Future Work

- 🔲 **Provisional period** — New players could use K=64 for the first 10 games to converge faster, then drop to K=32.
- 🔲 **Per-game-type K factor** — Grail Quest is longer and more complex; a higher K might suit it better.
- 🔲 **Rating floor** — Consider a minimum ELO of 100 to prevent negative ratings.
- 🔲 **Decay** — Inactive players' ratings could decay over time to prevent stale high ratings.
