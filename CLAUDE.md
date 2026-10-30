# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Korfbal StreamKit is an Nx monorepo for a livestream production management system for korfbal (Dutch sport) events. It manages production crew callsheets, real-time show control, sponsor data feeds, and vMix graphics integration during live broadcasts. Used internally by production crews at Fortuna/Ruitenheer korfbal matches.
However, this tool shows potential to become a product that runs in the cloud for other korfbal clubs and sports organizations, with multi-tenant support and a SaaS model. Since there still are local dependencies and connections to be made to i.e. vMix, the shotclock and scoreboard and later maybe the statistics system, a hybrid approach with an edge application that combines the local and remote functionality is envisioned. The current codebase is a monorepo with a backend API, frontend React app, and e2e tests.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20, Express 4.22 (qs `extended` query parser), TypeScript 5.9, Prisma ORM |
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

**Run a single test file** (from the repo root; paths are relative to `apps/korfbal-stream-api`):
```bash
# With database (always the separate test database from .env.test)
REQUIRE_DB=true npx vitest run --config apps/korfbal-stream-api/vitest.config.ts src/routes/sponsors.int.spec.ts

# Without database (unit tests only)
REQUIRE_DB=false npx vitest run --config apps/korfbal-stream-api/vitest.config.ts src/routes/sponsors.spec.ts
```


## Testing

- Tests use the separate database `korfbal_stream_test` (`.env.test`); `npm run db:up` is all you need. `REQUIRE_DB=true` enables the integration tests.
- **Integration tests come first**: new API behaviour gets an integration test on the test database; mocked Prisma only for pure logic. Broadcast-critical frontend flows get an e2e test.
- **Reuse test data**: `createProductionScenario` (`apps/korfbal-stream-api/test-scenarios.ts`), `testDb` / `inTestOrganization` (`test-helpers.ts`), never `new PrismaClient()`. Specs clean up what they create.
- Every mounted route needs an entry in the leak suite (`src/leak.int.spec.ts`); security tests live in `src/security.int.spec.ts`.
- Details (fixtures, e2e, kit test data, CI): [docs/claude/testing.md](docs/claude/testing.md).

## Project Structure

See **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** for the full project tree and API endpoints.

- **`apps/korfbal-stream-api`** — Express + Prisma + PostgreSQL backend, port 3333. Routes under `/api/`, Swagger UI at `/api/docs`.
- **`apps/korfbal-stream-kit`** — React 19 + Vite + TanStack Query frontend, port 4200. LIVE at `/`, Beheer under `/admin/*` (URLs from `lib/adminPaths.ts`).
- **`apps/korfbal-stream-kit-e2e`** — Playwright e2e tests.

## Core Rules

- **No authentication**: an internal LAN tool. The only choice is the organization (start screen, `X-Organization`); devices on the feed routes use an organization's API key.
- **Multi-tenant**: every table except Season, Club, Player, PlayerImage, Organization, Setting has `organizationId`. Use `prisma` from `services/prisma.ts` (scoped automatically) and write queries as if there were one organization. Code outside a request runs inside `runWithOrganization`. **Raw SQL is not scoped**: filter `"organizationId"` by hand. The kit never adds `X-Organization` itself (`installOrganizationFetch`); no `<a href="/api/...">`. → [organizations.md](docs/claude/organizations.md)
- **Security**: errors never expose internals (`middleware/error.ts`); foreign resources answer 404; no CORS outside the feeds, no bypass of the CSRF check; feed keys never in logs (`withoutApiKey()`); new feeds go in `FEED_API_PATHS`. → [security.md](docs/claude/security.md)
- **Zod** validates every API input (`apps/korfbal-stream-api/src/schemas/`).
- **Times**: stored as UTC, shown and entered as Europe/Amsterdam via `lib/time.ts` / `utils/time.ts`; never use the server or browser zone.
- **Draaiboek times** come from one rule, `services/laneTimes.ts` (anchors, Zaal/Stream lanes, Minimale duur); the kit never computes them. Every item sits in exactly one hoofdstuk. → [domain-rules.md](docs/claude/domain-rules.md)
- **Live state** is in memory, one per organization (`productionState.ts`); emit through `emitToOrganization`, send `liveStateSnapshot()`. One active production per organization. LIVE must work at 360 px wide. → [live-and-devices.md](docs/claude/live-and-devices.md)
- **Settings** only through `getSetting`/`setSetting`; **positions** only through `findPositionByName` / `services/positions.ts`; vMix calls through `resolveVmixInstance` and `buildVmixFunctionUrl`.
- **Keep in sync** (exist twice): API error codes, the slug pattern, interview placeholders, lanes (`services/laneTimes.ts` ↔ `lib/lanes.ts`).
- **Handleiding**: when a screen's behaviour or labels change, update its chapter in `apps/korfbal-stream-kit/src/handleiding/` in the same change.
- **Frontend style**: match the existing components and Tailwind styles.
- **Database**: never edit it directly; use migrations (`npm run prisma:migrate`). Docker, backups, storage and env vars: [docker.md](docs/claude/docker.md).
- After fixing a bug, verify no regressions before moving on.

## Key References

- **GLOSSARY.md** — Ubiquitous Language glossary. Consult before using domain terms in specs, designs, and code.
- **PROJECT_STRUCTURE.md** — Full project tree + all API endpoints. Search by domain keyword to locate any file.
- **openspec/specs/** — Capability specifications documenting existing system behavior. Read before modifying a feature.
- **openspec/e2e-test-plan.md** — E2E test plan with scenario groups.
- **docs/claude/** — the detailed rules: [organizations](docs/claude/organizations.md), [security](docs/claude/security.md), [live and devices](docs/claude/live-and-devices.md), [domain rules](docs/claude/domain-rules.md), [testing](docs/claude/testing.md), [docker](docs/claude/docker.md), [agent team and review](docs/claude/agents.md). Read the one for the area you change.
