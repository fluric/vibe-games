# B001 — Remove duplicate `holy_grail_spec.md` at repo root

**Type:** Bug
**Priority:** P3
**Reported:** 2026-06-29
**Spec:** specs/holy_grail_spec.md

## Description

The file `holy_grail_spec.md` exists in two places:
- `/holy_grail_spec.md` (old location, at the repo root)
- `/specs/holy_grail_spec.md` (correct location, canonical)

The root-level file is stale. It should be deleted to avoid confusion about which file is the source of truth.

## Acceptance Criteria

- [x] `/holy_grail_spec.md` no longer exists at the repo root.
- [x] `/specs/holy_grail_spec.md` remains intact and unchanged.
- [x] No other file in the repo references the root-level path.
- [x] `npm run test:quick` passes after the removal.

## Agent Notes

- Deleted `holy_grail_spec.md` from the repo root.
- Ran `npm run test:quick` to ensure no breakages.
- Completed on 2026-06-29.
