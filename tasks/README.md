# Tasks — Index

> Each task is its own file. Moving a file to a folder changes its state.
>
> **You:** Create a file in `open/` to report a bug or request a feature.
> **Agent:** Moves it to `in-progress/` when starting, to `done/` when complete.

---

## ID Scheme

| Prefix | Type | Example |
|---|---|---|
| `B` | Bug — something is broken or wrong | `B001` |
| `F` | Feature — new functionality | `F002` |
| `R` | Refactoring — internal code improvement | `R001` |
| `T` | Testing — add or fix a test | `T001` |

Numbers are sequential within each type. Always increment — never reuse an ID.

**Next available IDs:** B003 · F002 · R008 · T002

---

## Open

| ID | Title | Priority | File |
|---|---|---|---|
| F002 | [CLARIFICATION NEEDED] Active Matches on Main Page | P2 | [open/F002-active-matches-main-page.md](open/F002-active-matches-main-page.md) |

| R005 | Refactor `minimaxAi.ts` into specific strategies | P3 | [open/R005-refactor-minimax-ai.md](open/R005-refactor-minimax-ai.md) |
| R006 | Split `GamePage.tsx` into specialized game views | P3 | [open/R006-split-game-page.md](open/R006-split-game-page.md) |
| R007 | Extract Auth Service from Routes | P3 | [open/R007-extract-auth-service.md](open/R007-extract-auth-service.md) |

## In Progress

*(none)*

## Done

| ID | Title | Completed | File |
|---|---|---|---|
| B001 | Remove duplicate `holy_grail_spec.md` at repo root | 2026-06-29 | [done/B001-remove-duplicate-spec.md](done/B001-remove-duplicate-spec.md) |
| R001 | Extract game service from `games.ts` | 2026-06-29 | [done/R001-extract-game-service.md](done/R001-extract-game-service.md) |
| F001 | My Active Games panel in lobby | 2026-06-29 | [done/F001-active-games-panel.md](done/F001-active-games-panel.md) |
| T001 | Add test case for full-board draw in Connect Four | 2026-06-30 | [done/T001-c4-draw-test.md](done/T001-c4-draw-test.md) |
| R002 | Split `LobbyPage.tsx` into focused components | 2026-06-30 | [done/R002-split-lobby-page.md](done/R002-split-lobby-page.md) |
| R004 | Refactor `holyGrailEngine.ts` into sub-modules | 2026-06-30 | [done/R004-extract-holygrail-engine.md](done/R004-extract-holygrail-engine.md) |
| B002 | Fix AI Training Stuck (RL / ML model training) | 2026-06-30 | [done/B002-fix-ai-training-stuck.md](done/B002-fix-ai-training-stuck.md) |
| R003 | Split `HolyGrailBoard.tsx` into focused components | 2026-06-30 | [done/R003-split-holygrail-board.md](done/R003-split-holygrail-board.md) |

---

## How to add a task

1. Pick the next available ID for the type (see above).
2. Create a file: `tasks/open/B002-short-description.md`
3. Use the template below.
4. Update the **Next available IDs** line and the Open table above.
5. Tell the agent: *"Read tasks/open/B002-short-description.md and fix it."*

## Task file template

```markdown
# B002 — Short description of the problem

**Type:** Bug | Feature | Refactoring | Testing
**Priority:** P1 | P2 | P3
**Reported:** YYYY-MM-DD
**Spec:** specs/relevant-spec.md (or —)

## Description

Plain English description of what the problem is or what should be built.
No technical jargon needed — write it as you'd explain it to a colleague.

## Acceptance Criteria

- [ ] First condition that must be true for this to be considered done.
- [ ] Second condition.

## Assets

*(optional — drag in screenshots, sketches, wireframes)*

## Agent Notes

*(agents append their progress, decisions, and commit references here)*
```

---

## 🌙 Nightly Pipeline Instructions

When the scheduled nightly run triggers, the agent MUST execute the following 4 phases sequentially:

### Phase 1: Test & Bug Triage (Highest Priority - P1)
1. Run the full test suite (`npm run test:full`).
2. If any tests fail, investigate the root cause. 
3. If it's a minor break, fix it immediately. If it requires significant architectural work, create a new bug task in `tasks/open/` (e.g., `B00X-description.md`), assign it **Priority P1**, and log it in this README.

### Phase 2: Specification Alignment (Priority - P2)
1. Read through the active specifications in `specs/`.
2. Cross-reference the specs with the current codebase to identify missing features, unfulfilled Acceptance Criteria, or missing test coverage for specs.
3. For any gaps found, create new task files in `tasks/open/` (prefix `F` for Feature or `T` for Test). Assign them **Priority P2**, pick the next available ID, and log them in this README.

### Phase 3: Refactoring & Tech Debt (Priority - P3)
1. Scan the codebase for technical debt (e.g., files exceeding 300 lines, violations of the Single Responsibility Principle, mixed concerns, or missing types).
2. For each major refactoring opportunity, create a new task file in `tasks/open/` (prefix `R` for Refactor). Assign them **Priority P3**, pick the next available ID, and log them in this README.

### Phase 4: Backlog Execution
1. Once the backlog is fully triaged and sorted, begin working off the `tasks/open/` directory.
2. ALWAYS execute in strict priority order: **P1 (Bugs)** > **P2 (Specs/Features)** > **P3 (Refactors)**.
3. For each task:
   - Implement the code and write accompanying tests.
   - Run `npm run test:quick` to verify.
   - **MISSING SPECS / AMBIGUITY:** If the task lacks critical details in the specs to implement it correctly, DO NOT GUESS. Prepend `[CLARIFICATION NEEDED]` to the task title, write your exact questions in the Agent Notes, and immediately move on to the next task.
   - **INFINITE LOOP PREVENTION:** If a task fails testing more than 3 times, prepend `[BLOCKED]` to the task title in the file, leave a summary in the Agent Notes detailing why it failed, and immediately move on to the next task.
   - Append a summary to the "Agent Notes" section of the task file.
   - Move the task file to `tasks/done/` (`git mv`) and update the Done table in this README.
   - Commit the changes using the conventional commit format (`feat/fix/refactor/test(scope): ...`).
4. Run `npm run test:full` before the final push. Push all commits at the end.
