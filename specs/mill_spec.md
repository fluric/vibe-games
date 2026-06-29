# Specification: Nine Men's Morris (Mill)

**Domain:** Mill game rules and backend engine
**Status:** ✅ Core implemented · 🔲 Some edge cases and tests to add


## Traceability Matrix

| Requirement | Task ID | Status |
| :--- | :--- | :--- |
| Initial Implementation | - | ✅ Implemented |

---

## Overview

Nine Men's Morris (also known as "Mill" or "Mühle") is a classic two-player strategy board game. Each player places and moves 9 pieces on a 24-point board, trying to form "mills" (three in a row) to capture opponent pieces.

---

## 1. Board

The board has **24 positions** arranged in 3 concentric squares connected by lines. Positions are represented as a flat array of 24 elements (index 0–23).

```
Position index layout:
 0 ─────── 1 ─────── 2
 │   8 ─── 9 ─── 10  │
 │   │  16─17─18 │   │
 3───11──19   20─12───4
 │   │  23─22─21 │   │
 │  15──14──13   │   │
 7 ─────── 6 ─────── 5
```

Mill adjacency is defined in `backend/src/game/millRules.ts`.

---

## 2. Game Phases

### 2.1 Placement Phase
- Each player starts with 9 pieces off the board.
- Players take turns placing one piece per turn onto any empty position.
- Phase ends when all 18 pieces are placed.

### 2.2 Movement Phase
- Players take turns moving one of their pieces to an adjacent empty position.
- If a player has exactly 3 pieces remaining, they enter "Flying Phase".

### 2.3 Flying Phase
- A player with exactly 3 pieces may move to any empty position (not just adjacent).

---

## 3. Mills

A **mill** is 3 of the same player's pieces in a row (along one of the 16 possible lines).

- When a player forms a mill during their turn, they **must remove one opponent piece** from the board.
- You cannot remove a piece that is part of a mill, unless all opponent pieces are in mills.

---

## 4. Winning & Draw Conditions

- **Win:** Opponent is reduced to 2 pieces (cannot form a mill).
- **Win:** Opponent has no legal moves in the movement phase.
- **Draw:** 50 moves since the last capture (no progress).
- **Draw:** The same board position is repeated 3 times.

---

## 5. API Contract

### Move format
```json
{
  "type": "place",      // placement phase
  "to": 5              // target position index
}
{
  "type": "move",       // movement / flying phase
  "from": 3,
  "to": 11
}
{
  "type": "remove",     // after forming a mill
  "target": 7
}
```

---

## 6. AI Opponents

Configured in `backend/src/game/aiConfig.json` under the `mill` key.

| Bot | Strategy | ELO |
|---|---|---|
| Randy | Random moves | 800 |
| Minimax Easy | Minimax depth 2 | ~1000 |
| Minimax Hard | Minimax depth 5 | ~1400 |

---

## 7. Open Questions / Future Work

- 🔲 Verify all draw conditions are implemented and tested.
- 🔲 Add spec test cases for: removal from all-mill positions, no legal move win condition.
- 🔲 Add a visual board position diagram to this spec.
