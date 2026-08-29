# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⛔ MANDATORY FIRST-RUN GATE — Read This Before Doing ANYTHING

**STOP. Before responding to ANY user request, check this file for `TODO` comments.**

If ANY `TODO` comments remain in this file, you MUST complete ALL of the following steps before doing any other work — no exceptions:

1. **Scan the codebase**: Read `package.json`, `docker-compose.yml`, directory structure, source files, and any other config files to learn the project.
2. **EDIT this file**: Use the Edit tool to replace every `TODO` placeholder in this file with the actual values you discovered. Write the real tech stack, real build commands, real project description, real conventions — directly into this file.
3. **Fill PROJECT_STRUCTURE.md**: If `PROJECT_STRUCTURE.md` exists and has TODO placeholders, edit that file too with the real project tree and API endpoints.
4. **Fill GLOSSARY.md**: If `GLOSSARY.md` exists and has TODO placeholders, add the domain terms you discovered from the codebase.
5. **Know your toolkit**: Read the agent definitions in `.claude/agents/` and skill definitions in `.claude/skills/`. Understand what each agent does and when to invoke it before starting any work.

**WHY THIS IS NON-NEGOTIABLE:**
- Other agents and teammates read this file for context. If the TODOs remain unfilled, every agent you spawn will lack critical project information.
- Your memory is NOT a substitute for editing this file. Memory is local to your session — teammates cannot access it.
- "I already know this" is not an acceptable reason to skip editing. The file must contain the actual values.

**GATE CHECK:** After completing the steps above, re-read this file and confirm zero `TODO` comments remain. Only then proceed with the user's request.

## Project Overview

Korfbal StreamKit is an Nx monorepo for a livestream production management system for korfbal (Dutch sport) events. It manages production crew callsheets, real-time show control, sponsor data feeds, and vMix graphics integration during live broadcasts. Used internally by production crews at Fortuna/Ruitenheer korfbal matches.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20, Express 5, TypeScript 5.9, Prisma ORM |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router v6 |
| Database | PostgreSQL 16, Prisma migrations |
| Testing | Vitest (backend unit + integration), Playwright (e2e) |
| Build | Nx 21 monorepo, esbuild (API), Vite (frontend) |
| Dev Environment | Docker Compose (db + api + frontend + pgAdmin) |
| Real-time | Socket.io (bidirectional live state sync) |

## Build Commands

```bash
# Infrastructure
npm run db:up              # Start PostgreSQL (required before running tests/api)
npm run db:down            # Stop PostgreSQL
npm run prisma:migrate     # Run/create migrations
npm run prisma:seed        # Seed database
npm run prisma:studio      # DB browser at http://localhost:5555

# Development
npm run dev                # Start all (API + frontend)
npm run api:dev            # API only (tsx watch, port 3333)
npm run kit:dev            # Frontend only (Vite, port 4200)

# Build
npm run api:build          # esbuild output
npm run kit:build          # Vite output

# Quality
npm run lint               # ESLint (max-warnings=0)
npm run lint:fix
npm run typecheck

# Tests
npm run api:test           # All API tests (requires running DB)
npm run api:test-no-db     # Unit tests only (REQUIRE_DB=false)
```

**Run a single test file:**
```bash
# With database
dotenv -e apps/korfbal-stream-api/.env -- vitest run apps/korfbal-stream-api/src/routes/sponsors.spec.ts

# Without database (unit tests only)
REQUIRE_DB=false vitest run apps/korfbal-stream-api/src/routes/sponsors.spec.ts
```

## Testing

- Vitest runs **single-threaded** (`singleFork: true`) to avoid DB race conditions.
- `REQUIRE_DB=false` skips integration tests; `REQUIRE_DB=true` (or having `DATABASE_URL` set) enables them.
- Test setup in `apps/korfbal-stream-api/src/test-setup.ts` — loads `.env.test`, manages Prisma lifecycle.
- After fixing a bug, verify no regressions before moving on.

## Project Structure

See **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** for the full project tree and API endpoints.

- **`apps/korfbal-stream-api`** — Express + Prisma + PostgreSQL backend, port 3333. Routes under `/api/`, Swagger UI at `/api/docs`.
- **`apps/korfbal-stream-kit`** — React 19 + Vite + TanStack Query frontend, port 4200. Proxies `/api/*` and `/uploads/*` to port 3333 in dev.
- **`apps/korfbal-stream-kit-e2e`** — Playwright e2e tests.

## Project-Specific Conventions

- **No authentication**: This is an internal LAN tool — no login/roles system.
- **Single active production**: Only one production can be active at a time. `POST /api/production/:id/activate` deactivates all others.
- **Event status flow**: WAITING → ACTIVE → COMPLETED (unidirectional). Never revert status in code.
- **Segment ordering**: `volgorde` is unique per production. Reorders use a 2-phase transaction (bump to 1000+, re-insert, renumber) to avoid unique constraint collisions.
- **Time anchoring**: Each production has at most one `isTimeAnchor` item. All other times are calculated relative to it — backwards for earlier items, forwards for later.
- **In-memory state**: Live production state (`productionId`, `activeEventId`, clocks, `isClockRunning`) lives in `productionState.ts` in memory. PostgreSQL holds persistent data. On server restart, state resets.
- **Socket.io broadcasts**: Every state change calls `broadcastState()`. Clients receive snapshots, not diffs.
- **Zod validation**: All API inputs are validated with Zod schemas in `apps/korfbal-stream-api/src/schemas/`.
- **Settings persistence**: App settings (vMix URL, sponsor filter types, etc.) stored as `key/value` JSON in the `Setting` table. Accessed via `/api/settings`.
- **Seeded RNG**: Sponsor row/slide generation uses `mulberry32` seeded by a `seed` query param for reproducible randomization.
- **Vitest test files**: DB integration guard is inside the spec file via `REQUIRE_DB` env check — not a separate file suffix.

### Frontend Design Rules

**MANDATORY**: When implementing or modifying ANY frontend visual code (components, pages, layouts, styles), you MUST:

1. Read `skills/frontend-design/SKILL.md` and follow its instructions BEFORE writing any UI code
2. Read `skills/ui-ux-pro-max/SKILL.md` and follow its instructions with `--design-system --persist` to generate brand guidelines
3. Persist the output as `BRAND_GUIDELINES.md` in the project root
4. Reference `BRAND_GUIDELINES.md` for all color palettes, font pairings, spacing, and UX patterns
5. Never output plain/generic styling — every component must reflect the brand guidelines

`BRAND_GUIDELINES.md` is the single source of truth for visual design decisions.

## Roles

This application has **no authentication or authorization**. It is an internal LAN tool used directly by the production crew. All routes are publicly accessible. There are no user accounts or role-based access controls.

## Key References

- **GLOSSARY.md** — Ubiquitous Language glossary. Consult before using domain terms in specs, designs, and code.
- **PROJECT_STRUCTURE.md** — Full project tree + all API endpoints. Search by domain keyword to locate any file.
- **BRAND_GUIDELINES.md** — Design system (colors, fonts, spacing, component patterns). Required before any frontend visual work.
- **openspec/specs/** — Capability specifications documenting existing system behavior. Read before modifying a feature.
- **openspec/e2e-test-plan.md** — E2E test plan with scenario groups.

---

## Agent Teams

This project uses custom AI agents that work together as a team. The lead agent (Claude Code) orchestrates the pipeline — it does NOT implement code itself but distributes tasks to sub-agents.

### Agent Architecture

Agents are markdown files in `.claude/agents/` that define specialized roles. They are spawned as sub-agents via the `Agent` tool. Sub-agents use skills by reading the skill's SKILL.md file and following its instructions — they do NOT have access to a `Skill()` tool.

### How Agents Use Skills

Skills are `.md` files in `.claude/skills/`. Agents use them by:
1. Reading the skill file (e.g., `skills/design-grill/SKILL.md`)
2. Following its instructions completely — executing the full process described in that file

Agents must NOT just summarize or paraphrase a skill. They must read and execute.

### Human-in-the-Loop Rule (CRITICAL)

**NEVER:**
- Answer your own design questions or auto-approve decisions
- Assume you know what the human would choose
- Skip asking the human because the answer seems obvious

**ALWAYS:**
- Present decisions and options directly to the human
- Wait for the human's explicit response before proceeding
- Confirm alignment before moving to the next phase

### Available Agents

| Agent | Role | When to Use |
|-------|------|-------------|
| `design-flow` | Full design phase: explore, stress-test, glossary alignment, spec generation | Before implementation — when a feature needs design |
| `workflow-orchestrator` | Pipeline orchestration, team coordination, glossary enforcement | Full Pipeline Mode — orchestrates all other agents, enforces glossary term consistency |
| `backend-dev` | Back-end implementation + unit tests | Any back-end work (reads tech stack from CLAUDE.md) |
| `frontend-dev` | Frontend implementation + unit/e2e tests | Any frontend work (reads tech stack from CLAUDE.md) |
| `full-e2e-test` | E2E test audit + Playwright execution | When OpenSpec + frontend are enabled |
| `code-review-final` | Code quality review of PRs | After all implementation is complete |
| `security-review-final` | Security review of PRs (conditional) | Only when diff touches security-sensitive files |

### Security Review Trigger

Run `security-review-final` only when the diff includes files matching ANY of:
- Any new route/controller (new attack surface)
- `docker-compose.yml`, `Dockerfile` (container security)
- `apps/korfbal-stream-api/src/config.ts` (env/config changes)
- Any file with `password`, `secret`, `token`, `credential` in its path
- `package.json` (dependency changes — supply chain risk)

Skip security review when the diff only touches: service logic, schemas, frontend components, tests, migrations, README/docs.

### How to Use the Agents

#### Assisted Mode (small changes, bug fixes)

For changes under ~5 files or single-module work, use agents directly without orchestration:

1. Spawn the appropriate implementation agent (e.g., `backend-dev`)
2. Agent implements + tests + commits
3. Run build verification
4. Read `skills/review-local/SKILL.md` and follow its instructions on the changed code
5. Spawn `code-review-final` agent
6. Fix review comments, push, merge

#### Full Pipeline Mode (features, multi-module changes)

For larger features, spawn the `workflow-orchestrator` agent. It will:

- Distribute tasks to implementation agents in parallel
- Run build verification, pre-commit quality checks, and local review
- Create the PR and spawn `code-review-final` (and `security-review-final` if the diff touches security-sensitive files)
- Spawn Playwright e2e test agents if the project has a frontend
- For optional or ambiguous steps, ask the human before executing

See the `workflow-orchestrator` agent definition for the full pipeline details.

### Available Skills

Skills are invoked by reading their SKILL.md file and following the instructions. Available in `.claude/skills/`:

- `design-grill` — Stress-test design decisions
- `parallel-plan` — Fan-out parallel approach comparison
- `glossary` — Ubiquitous language glossary management
- `review-local` — 4-agent parallel local code review
- `gitlab-code-review` — PR review via VCS CLI
- `playwright-cli` — Browser automation for e2e testing
- `write-simply` — Plain language writing
- `structure-clearly` — Pyramid principle document structure
- `retro` — Retrospective on the change

### Key Rules

- **Sweep enforcement**: Every review finding includes a grep command. Fix agents MUST run the sweep and fix ALL matches — not just the reported file
- **Cross-stack contract alignment**: When backend and frontend run in parallel, the frontend API service task MUST read the actual backend DTOs before writing interfaces
- **PR Key Decisions**: Include a "Key Decisions" section in PR descriptions listing intentional design choices. Prevents review agents from flagging them as bugs

## Code Review Workflow

- When reviewing PRs, structure findings by category: security, efficiency, code quality, reuse
- Post findings directly to PR via `gh` CLI
- Two review passes max — after pass 2, the PR is considered ready for merge

## Docker & Database

- `docker compose up` starts the full stack: PostgreSQL (5432), API (3333), frontend (4200), pgAdmin (5050).
- Prisma migrations run automatically on startup via the `migrate` job in docker-compose.
- After `docker compose down -v` (volume wipe), run `npm run prisma:seed` to re-seed.
- Local dev: `npm run db:up` then `npm run prisma:migrate` before starting the API.
- Never edit the database directly — use migrations (`npm run prisma:migrate`).
- `ASSETS_DIR` defaults to `storage/` in dev and `tmp/test-storage` in tests. Logo uploads go to `storage/sponsors/`.

## Environment Variables (API)

Validated with Zod at startup (`apps/korfbal-stream-api/src/config.ts`):

```
DATABASE_URL=postgresql://korfbal:korfbal@localhost:5432/korfbal
PORT=3333
SCOREBOARD_BASE_URL=http://<scoreboard-ip>/scoreboard
SHOTCLOCK_BASE_URL=http://<shotclock-ip>/shotclock
MATCH_SCHEDULE_BASE_URL=https://api.sportclubvrijwilligersmanagement.nl/v1
MATCH_SCHEDULE_API_TOKEN=<optional>
MATCH_SCHEDULE_PROVIDER=vrijwilligers  # selects the MatchScheduleProvider adapter, see services/matchSchedule/providerFactory.ts
ASSETS_DIR=storage
HOST_IP=<optional, for vMix endpoint auto-detection in Docker>
```

In tests, `.env.test` is loaded automatically.
