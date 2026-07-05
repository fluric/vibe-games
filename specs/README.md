# Vibe Games — Specification Folder

This folder is the **single source of truth** for everything this project does and how it should behave.

As a **Product Owner or Requirements Engineer**, you work here — not in the code. You describe what the system should do, and AI agents implement it, test it, and keep the code aligned with what you have written.

---

## How to read this folder

| File | What it describes |
|---|---|
| [auth_spec.md](./auth_spec.md) | Login, registration, session management, Google OAuth |
| [lobby_spec.md](./lobby_spec.md) | Lobby UI, matchmaking, game creation, ELO display |
| [elo_spec.md](./elo_spec.md) | Rating system rules, calculation formula, update logic |
| [mill_spec.md](./mill_spec.md) | Nine Men's Morris game rules and API |
| [connect_four_spec.md](./connect_four_spec.md) | Connect Four game rules and API |
| [grail_quest_spec.md](./grail_quest_spec.md) | Grail Quest — hex strategy game rules and API |
| [testing_spec.md](./testing_spec.md) | What tests must exist and what they must cover |
| [architecture_spec.md](./architecture_spec.md) | Module structure, file organization, code quality rules |

---

## Glossary — Key terms explained

**Spec (Specification):** A document that describes what the system should do. It is the *what*, not the *how*. You write it in plain English. Agents figure out the implementation details.

**Acceptance Criteria:** A list of conditions that must be true for a feature to be considered complete. Written as "Given… When… Then…" or as checkboxes. Agents use these to verify their implementation.

**API Contract:** A precise description of how the frontend and backend communicate — what URL, what request body, what response format. It is the agreement between the two sides.

**ELO:** A numeric skill rating system. A higher number means a stronger player. When you beat someone with a higher ELO, your rating goes up more than if you beat a weaker player.

**Game Type:** One of the four game modes: `mill` (Nine Men's Morris), `connect_four`, `tic_tac_toe`, `grail_quest` (Grail Quest). These string identifiers are used throughout the codebase.

**DTO (Data Transfer Object):** A TypeScript interface that defines the exact shape of data sent over the network. Lives in `shared/src/index.ts`. Never redefine these in frontend or backend.

**Entity:** A database table represented as a TypeScript class. Lives in `backend/src/entities/`. Currently: `User`, `Game`, `UserStats`.

**Fastify Plugin:** The pattern used by the backend — each feature domain is a self-contained plugin registered in `backend/src/index.ts`.

**Vitest:** A modern test runner for frontend TypeScript/React code. Fast, runs in Node (no browser needed).

**ts-node:** A tool that runs TypeScript files directly without compiling to JavaScript first. Used to run backend spec tests.

---

## How to add a new requirement

1. **Open the relevant spec file** (or create a new one if the feature doesn't fit anywhere).
2. **Describe the requirement in plain English.** Don't worry about being technically perfect — write it the way you'd explain it to a colleague.
3. **Add Acceptance Criteria** as a checkbox list so it is clear when the feature is done.
4. **If you have a visual idea**, add a screenshot or rough sketch under an `### Assets` section (drag images into the file).
5. **Mark it with a status tag** at the top of the section: `🔲 Planned`, `🔶 In Progress`, `✅ Done`.
6. **Tell the agent:** *"Read specs/lobby_spec.md. Find all 🔲 Planned items and implement them. Run all related tests. Push when done."*

---

## How to run agents overnight

See [PLAYBOOK.md](../PLAYBOOK.md) at the repo root for the full guide on keeping your Mac awake, running tests, and invoking agents autonomously.
