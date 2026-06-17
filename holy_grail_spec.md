# Specification: Holy Grail (Hex Wars)

A custom, hex-grid strategy game of tactical card combat and objective transport.

---

## 1. Board & Grid Representation

### Hex Coordinates
The game uses a **flat-topped hex grid** represented in **axial coordinates** `(q, r)` where:
- Distance from center `(0, 0)` is calculated as `(abs(q) + abs(r) + abs(q + r)) / 2`.
- Neighbors of `(q, r)` are determined by adding one of the following offsets:
  `[ (1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1) ]`.

### Map Layout (Radius 3)
A standard map has a radius of 3 (37 hexes total):
- **`(0, 0)`**: Holy Grail Center (Grail starts here).
- **Home Bases**:
  - **Player X Home Base**: `(0, -3)` (Top pole)
  - **Player O Home Base**: `(0, 3)` (Bottom pole)
  *Note*: Home bases are immune to capture, but if an enemy stack moves onto a home base, that owner loses immediately.
- **Urban / Housing Hexes** (2 cells per player, near bases):
  - Player X Urban Cells: `(-1, -2)` and `(1, -3)`
  - Player O Urban Cells: `(-1, 3)` and `(1, 2)`
- **Farm Land Hexes** (provide +1 deploy card per round if controlled):
  - Farm Land Cells: `(-2, 0)` and `(2, 0)`
- **Hills** (provide defensive combat advantage):
  - Hill Cells: `(-1, -1)`, `(1, 1)`, `(-1, 2)`, `(1, -2)`
- **Normal / Plains**: All other hexes.

---

## 2. Card Combat & Card Strength System

### Card Stacks
Soldier stacks are represented by a list of card objects:
`{ value: number, revealed: boolean }`
- **value**: The card value (1 to 13).
- **revealed**: Boolean flag. Once a card participates in combat, `revealed` is set to `true`. This flag persists even if the card is moved to another cell, meaning the card remains visible to the opponent for the rest of the game.

### Card Values
Soldiers are represented by standard card values. Aces are excluded, and a `1` card is used instead.
- **Number Cards**: `1, 2, 3, 4, 5, 6, 7, 8, 9, 10`
- **Face Cards**: `J` (Jack = 11), `Q` (Queen = 12), `K` (King = 13)

### Combat Strength Rules
1. **Numbers (1–10)**: Strict linear hierarchy (`1 < 2 < ... < 10`).
2. **Face Card Cycle**:
   - `King (13)` beats `Jack (11)` and all number cards.
   - `Jack (11)` beats `Queen (12)` and all number cards.
   - `Queen (12)` beats `King (13)` and all number cards.
   *Face Card Cycle summary*: `King > Jack > Queen > King` (Rock-Paper-Scissors).
3. **Faces Beat Numbers**: Any face card (`J`, `Q`, `K`) strictly beats any number card (`1` to `10`).
4. **Draws**: If card values are equal (e.g., `10 vs 10` or `Q vs Q`), both cards are destroyed.

### Number Card Degradation
- If two number cards duel (e.g., `6 vs 3`):
  - The higher value card wins (the `6`), and the lower value card is destroyed.
  - However, the winning number card **is reduced by the value of the defeated card** (the `6` is reduced by `3`, degrading to a `3`). For example, if a `10` defeats a `3`, it degrades to a `7` (`10 - 3 = 7`).
  - Face cards (`J`, `Q`, `K`) do not degrade when defeating cards.

### Fight Execution (Card Stack Battle)
Combat occurs when a stack moves into a cell containing enemy soldiers.
- Both stacks fight top-card vs top-card.
- For each card duel:
  - The dueling cards are automatically **revealed** (`revealed = true` for both).
  - The losing card is **destroyed** (removed from the game).
  - The winning card is **placed at the bottom** of its stack (with its value degraded if it is a number card).
  - If it is a draw, **both are destroyed**.
- **Hill Advantage**:
  - If a player defends a **Hill** cell and has **at least 2 cards** in their stack:
    - The system automatically draws the top **two** cards of their stack.
    - The **best value** of the two counts in the duel against the attacker's top card.
    - If the chosen card wins (or draws), the unused card survives and goes to the bottom of the defender's stack as well, while the winning card undergoes standard resolution (goes to the bottom of the stack).
    - If *both* drawn cards are worse than the attacker's card, **both defender cards are destroyed**.
- **Combat Interrupt (Retreat)**:
  - Fights are evaluated card-by-card.
  - After each individual card duel, if both stacks still have remaining cards, the **defender** can choose to **retreat** their remaining stack to any adjacent cell that they control (already occupied by their own units).
  - If they retreat, the combat stops, and the attacker occupies the contested cell.

### Clockwise Merging
If stacks from different cells are moved into the same destination cell in the same turn:
- All incoming stacks are appended to the **bottom** of the destination stack.
- To resolve the merge order, stacks are added clockwise starting from the right (East neighbor at 3 o'clock).
- Neighbor offsets clockwise ordering:
  1. `(1, 0)` (East / 3 o'clock)
  2. `(0, 1)` (Southeast / 5 o'clock)
  3. `(-1, 1)` (Southwest / 7 o'clock)
  4. `(-1, 0)` (West / 9 o'clock)
  5. `(0, -1)` (Northwest / 11 o'clock)
  6. `(1, -1)` (Northeast / 1 o'clock)

---

## 3. Hidden Information Rules

- The card values of any stack are **hidden** from the opponent unless they have been `revealed = true` in combat. The opponent only sees the total count of soldiers and the values of already revealed cards.
- When a card duel occurs during combat resolution, the top card values involved in that specific duel are **temporarily revealed** to both players in the logs/UI, and their `revealed` status is permanently set to `true`.
- Each player's hand (undeployed cards) is completely hidden from the opponent.

---

## 4. Holy Grail & Radioactivity

- **Initial State**: The Holy Grail is placed at `(0, 0)`.
- **Radioactivity**: At the end of every round (after both players take their turn), the Grail emits radiation.
  - One **random** card in the stack occupying the Grail's cell is **destroyed** (killed).
  - If the only King in the Grail's cell dies due to radioactivity, it prevents the Grail from being moved in the next round (since no King is present).
- **Transporting the Grail**:
  - The Grail moves immediately when a King moves from the cell with the Grail to an adjacent cell (and survives the combat/movement).
  - If two Kings move to two different adjacent cells from the Grail cell, the Grail moves to one of the destination cells at random.

---

## 5. Round & Turn Lifecycle

 A game consists of successive **Rounds**. Each round has two player **Turns**, followed by an **End-of-Round resolution**.

### Face Card Limit & Starting Hand
- **Starting Hand**: At the start of the game, each player's hand is initialized with exactly one `King` (13), one `Queen` (12), and one `Jack` (11).
- **Face Card Count Restriction**:
  - A player can have **at most one King, one Queen, and one Jack** in play (board + hand) at any time.
  - The card drawer will only generate number cards (`1` to `10`) unless a player's `King`, `Queen`, or `Jack` dies (leaves the board). Once a face card is destroyed, it becomes eligible to be drawn again in subsequent deploy phases.

### Player Turn Phases
1. **React Phase**:
   - The player must resolve any incoming attacks initiated by the opponent in the previous turn.
   - For each contested cell, the player duels card-by-card and can choose to **fight** or **retreat** to an adjacent friendly cell.
2. **Deploy Phase**:
   - The player draws 4 cards at random using a pure random generator (which can be tilted/handicapped to level out player levels).
   - Plus **+1 card** for each **Farm Land** cell currently under their control.
   - *First turn exception*: Player 1 draws only 2 cards on Round 1 (to balance starting advantage).
   - Drawn face cards obey the **Face Card Count Restriction** (if a player already has a King, they cannot draw another King; a number card is drawn instead).
   - The player can deploy any number of cards from their hand onto any **Urban** cells they control. Newly deployed cards go to the **bottom** of the stack in that cell.
   - Remaining undeployed cards are kept in their hand for future rounds.
3. **Move Phase**:
   - The player can move any of their stacks of soldiers to adjacent cells (max 1 cell distance).
   - Moving into a cell occupied by enemy or neutral/independent soldiers initiates an attack (combat is marked as pending and will be resolved at the start of the opponent's next turn).
   - A stack carrying the Grail can only move if a King is present in the stack.

### End of Round Resolution (After both players finish turns)
1. **Apply Radiation**:
   - 1 random soldier in the Grail's current cell is destroyed.
2. **Check Game Ending Conditions**:
   - **Victory**: A player has successfully moved the Grail onto their **Home Base** cell.
   - **Capture Defeat**: If a player's **Home Base** cell is captured/entered by an enemy stack, that player loses immediately.
     - The defeated player's hand cards **leave the game**.
     - Their remaining soldiers on the board become **independent neutral passive fighters** (they no longer move and will defend themselves if attacked). Other players can capture these cells by defeating the independent stacks.
