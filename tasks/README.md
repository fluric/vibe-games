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
| `F` | Feature — new functionality | `F001` |
| `R` | Refactoring — internal code improvement | `R001` |
| `T` | Testing — add or fix a test | `T001` |

Numbers are sequential within each type. Always increment — never reuse an ID.

**Next available IDs:** B002 · F002 · R004 · T001

---

## Open

| ID | Title | Priority | File |
|---|---|---|---|
| F001 | My Active Games panel in lobby | P2 | [open/F001-active-games-panel.md](open/F001-active-games-panel.md) |
| R001 | Extract game service from `games.ts` | P2 | [open/R001-extract-game-service.md](open/R001-extract-game-service.md) |
| R002 | Split `LobbyPage.tsx` into focused components | P2 | [open/R002-split-lobby-page.md](open/R002-split-lobby-page.md) |
| R003 | Split `HolyGrailBoard.tsx` into sub-components | P3 | [open/R003-split-holy-grail-board.md](open/R003-split-holy-grail-board.md) |

## In Progress

*(none)*

## Done

| ID | Title | Completed | File |
|---|---|---|---|
| B001 | Remove duplicate `holy_grail_spec.md` at repo root | 2026-06-29 | [done/B001-remove-duplicate-spec.md](done/B001-remove-duplicate-spec.md) |

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

## Agent instruction (nightly backlog run)

```
Read tasks/README.md. For each file in tasks/open/ ordered by priority (P1 first, P3 last):
1. Move the file to tasks/in-progress/ (git mv).
2. Read the task file. Read the referenced spec if listed.
3. Implement the change.
4. Run npm run test:quick — must pass before continuing.
5. Append a summary to the "Agent Notes" section of the task file.
6. Move the file to tasks/done/ (git mv).
7. Update tasks/README.md: remove from Open table, add to Done table with today's date and commit hash.
8. Run npm run test:full before the final push.
Commit each task separately. Push all at the end.
```
