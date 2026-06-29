# Specification: Connect Four

**Domain:** Connect Four game rules and backend engine
**Status:** ✅ Core implemented


## Traceability Matrix

| Requirement | Task ID | Status |
| :--- | :--- | :--- |
| Initial Implementation | - | ✅ Implemented |
| Add test case for full-board draw | T001 | ✅ Implemented |

---

## Overview

Connect Four is a two-player game where players drop colored discs into a 7-column, 6-row grid. The first player to connect 4 discs in a row (horizontally, vertically, or diagonally) wins.

---

## 1. Board

- 7 columns × 6 rows = **42 positions**.
- Represented as a flat array of 42 elements (row-major: index 0 = top-left, index 41 = bottom-right).
- Pieces fall to the lowest available row in the selected column (gravity).

---

## 2. Rules

- Players alternate turns. `X` goes first.
- A turn consists of choosing a column (0–6) to drop a piece into.
- A column is **invalid** if it is already full (6 pieces in it).
- The game ends when:
  - A player connects 4 of their pieces in a line (horizontal, vertical, or either diagonal). → **Win**
  - All 42 positions are filled with no winner. → **Draw**

---

## 3. API Contract

### Move format
```json
{ "col": 3 }   // 0-indexed column (0 = leftmost, 6 = rightmost)
```

---

## 4. AI Opponents

Configured in `backend/src/game/aiConfig.json` under the `connect_four` key.

| Bot | Strategy | ELO |
|---|---|---|
| Randy HG Easy | Random moves | 0 |
| Aggressive Archie | Center-focused minimax | ~1018 |
| Defensive Debbie | Blocking minimax | ~1019 |
| Grandmaster Garry | Deep minimax | ~1123 |
| Champion Magnus | Very deep minimax | ~1278 |
| Perfect Oracle | Brute-force solver | ~1320 |

---

## 5. Open Questions / Future Work

- 🔲 Add test case for diagonal win detection.
- ✅ Add test case for full-board draw.
- 🔲 Verify that AI correctly blocks a human 3-in-a-row.
