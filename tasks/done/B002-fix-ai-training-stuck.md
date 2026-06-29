# B002 — Fix AI Training Stuck (RL / ML model training)

**Type:** Bug
**Priority:** P1
**Reported:** 2026-06-30
**Spec:** -

## Description

The AI training process (Reinforcement Learning / Machine Learning) is reportedly stuck and not progressing. We need to analyse why the training is hanging or stuck in a loop, and come up with a solution to fix it. We also need to verify the correct terminology (RL vs ML) based on the training script and correct it.

## Acceptance Criteria

- [ ] The AI training script no longer hangs or gets stuck.
- [ ] The training makes forward progress and completes (or runs successfully without deadlocking).
- [ ] Any incorrect terminology referring to "AI" in the codebase is corrected to the appropriate terminology (RL or ML) if necessary.

## Agent Notes
