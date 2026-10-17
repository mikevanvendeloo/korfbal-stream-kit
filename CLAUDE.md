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

- **Separate test database**: tests always use `korfbal_stream_test` from `apps/korfbal-stream-api/.env.test` (overriding `.env`), and refuse to start when the database name doesn't end in `_test` (`src/test-database.ts`). The global setup creates and migrates it, so `npm run db:up` is all you need.
- Vitest runs spec files **one after another in a single fork** (`pool: 'forks'`, `singleFork`, `fileParallelism: false`) because they share that database. Config: `apps/korfbal-stream-api/vitest.config.ts`, run from the repo root.
- `REQUIRE_DB=true` enables the integration tests (`npm run api:test:integration`); without it they are skipped.
- Integration specs must clean up what they create (especially active productions: they'd be restored by later spec files).
- **Integration tests come first.** New API behaviour gets an integration test on the test database; unit tests with a mocked Prisma only for pure logic. Frontend flows that matter during a broadcast get an e2e test.
- **Reuse test data, don't rebuild it** (keep tests cheap to change):
  - `apps/korfbal-stream-api/test-scenarios.ts` → `createProductionScenario(prisma, {active, items, match, segments, report, organizationId})`: a match, production, LIVE items and positions with one `cleanup()`, in the test organization unless `organizationId` says otherwise. Used by the API integration tests and the e2e tests. Pass only what the test is about; extend the builder rather than writing setup by hand. `createTenantScenario(prisma, organizationId, marker)`: one of every tenant row, for isolation tests (its cleanup removes the organization).
  - **Organizations in tests**: the global setup creates `test-org` (`TEST_ORGANIZATION_SLUG`), and `test-setup.ts` adds `X-Organization: test-org` to every supertest request (`.set('X-Organization', …)` or `withoutOrganization(request(app)…)` to choose otherwise). For setup straight on the database use `testDb` from `test-helpers.ts` (the app's scoped client, defaulting to the test organization), never `new PrismaClient()`; call services that query tenant tables inside `inTestOrganization(() => …)`. `applyStandardSetToTestOrganization()` replaces running the seed.
  - **Leak suite** (`src/leak.int.spec.ts`): every mounted route has an entry in its `ROUTES` table (read/write probe, or why it is exempt); the suite fails when a new route is missing. Security tests (org context, extension, secrets, uploads) are in `src/security.int.spec.ts`; phase 2 adds the API-key tests there.
  - e2e (`apps/korfbal-stream-kit-e2e/src/support/`): the `liveShow` / `makeShow` fixtures (fresh active production per test, stopped and removed afterwards) and page objects (`LiveNav`, `ShowCallerPhone`, `ShowCallerWide`, `StartScreen`, `organizationSwitch`, `OrganizationPage`). The fixtures choose the organization: option `organization` (default `test-org`) is stored in `localStorage` before the page loads, and the `request` fixture sends it as `X-Organization`; `test.use({organization: null})` starts on the start screen. A mocked API (`page.route`) must also answer `/api/organizations`. Find screens through the page objects, so a changed label is fixed in one place.
  - Kit component tests: shared data in `apps/korfbal-stream-kit/src/test/` (e.g. `showCaller.ts`: items, `fakeControls()`; `organizations.tsx`: `FORTUNA`/`KNKV`, `chooseOrganization()`, `mockApi()`, `renderPage()`). A test that renders `App` chooses an organization first and answers `/api/organizations`.
- **e2e**: `npm run e2e` starts its own API on port 3335 against the test database (refuses a database whose name doesn't end in `_test`) and a dev server on 4300 pointed at it (`API_PROXY_TARGET`); it never reuses a running server. Needs `npm run db:up` and once `npx playwright install chromium`. Tests run one at a time (one live show state).
- **CI**: the `db-tests` job in `.github/workflows/ci.yml` runs the integration tests and the e2e tests on a `postgres:16-alpine` service with the `korfbal_stream_test` database (on failure the Playwright report is uploaded as an artifact). The Docker build waits for it, so failing integration or e2e tests block a release. The `ci-checks` job only runs the tests without a database.
- After fixing a bug, verify no regressions before moving on.

## Project Structure

See **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** for the full project tree and API endpoints.

- **`apps/korfbal-stream-api`** — Express + Prisma + PostgreSQL backend, port 3333. Routes under `/api/`, Swagger UI at `/api/docs`.
- **`apps/korfbal-stream-kit`** — React 19 + Vite + TanStack Query frontend, port 4200. Proxies `/api/*` and `/uploads/*` to port 3333 in dev.
- **`apps/korfbal-stream-kit-e2e`** — Playwright e2e tests.

## Project-Specific Conventions

- **No authentication**: This is an internal LAN tool — no login/roles system. Users only choose an organization on the start screen (see Organizations); later the organization will come from the login.
- **Two apps, one frontend build**: LIVE (`app/LiveApp.tsx`) is served from the root (`/`, `/scoreboard`, `/callsheet/...`, `/show-caller/...`) and is read-only except the interview selection and operating vMix (`/vmix`); its nav has a "Beheer" link to `/admin`. Beheer (`app/AdminApp.tsx`, lazy-loaded) lives under `/admin/*`, with URLs following its menu (`producties`, `draaiboeken`, `stamgegevens`, `rapportages`, `overig`). All Beheer URLs come from `lib/adminPaths.ts` — never write them by hand. A production's pages share the tabs in `components/ProductionLayout.tsx`. Both apps share the same pages/components; no redirects from old URLs.
- **Organizations (multi-tenant)**: an `Organization` (e.g. Fortuna, KNKV) owns all data except the global tables (Season, Club, Player, PlayerImage, Organization, Setting). Every other table has `organizationId`, also child tables. Design: `openspec/changes/organizations/design.md`.
  - **Organization context**: every `/api` request sends `X-Organization: <slug>`; `middleware/organizationContext.ts` resolves it (401 `ORGANIZATION_REQUIRED` without, 403 `ORGANIZATION_UNKNOWN` for unknown/inactive) and runs the request in `runWithOrganization(orgId, …)` (`services/organizationContext.ts`, AsyncLocalStorage). Global routes (`/api/health`, `/api/organizations`, `/api/seasons`, `/api/clubs`, `/api/players`, docs) work without one. Code outside a request (seed, startup, timers, socket handlers, background services) must set the context itself with `runWithOrganization`; stream middleware such as multer loses it, so wrap it in `keepOrganizationContext()` (or use `singleImage()`).
  - **Stable error codes**: every refusal for the organization, key or origin answers `{error, code}`: `ORGANIZATION_REQUIRED` (401), `ORGANIZATION_UNKNOWN` (403), `API_KEY_MISSING` / `API_KEY_INVALID` (401), `CROSS_SITE_REFUSED` (403); a refused socket handshake sends the code in `connect_error` `data.code`. The codes live in `apps/korfbal-stream-api/src/services/apiErrorCodes.ts` (`sendApiError(res, code)`) and `apps/korfbal-stream-kit/src/lib/apiErrorCodes.ts`: **keep the two in sync**. The kit matches on the code, never on the message text. The slug rule exists twice too (`ORGANIZATION_SLUG_PATTERN` in `middleware/organizationContext.ts` and `lib/organization.ts`): keep them in sync.
  - **Lookup cache**: the slug → organization (`findActiveOrganization`) and key hash → organization (`findOrganizationByApiKey`) lookups are answered from memory for `ORGANIZATION_LOOKUP_TTL_MS` (5 s); only known, active organizations and valid keys are cached. `clearOrganizationLookupCache()` empties both and must run on every change of an organization (PUT, logo, own club) and on a key revoke, so a deactivated organization, a renamed slug or a revoked key takes effect on the next request. A test that changes an organization or key straight in the database calls it too.
  - **Prisma extension**: `prisma` from `services/prisma.ts` is extended with `services/tenantScope.ts`: it adds `organizationId` to every `where`, sets it on every create (also nested), drops it from update data, and throws `MissingOrganizationContextError` without a context. Write queries as if there were one organization; never pass `organizationId` yourself except for compound unique keys (`organizationId_name`, `organizationId_code`, …: `MatchSchedule.externalId`, `Skill.code`, `Position.name`, `CallSheetTemplate.name`, `SegmentTemplate.name`, `SegmentDefaultPosition(segmentName, order)` are unique per organization, so use `findFirst` or the compound key). `prismaUnscoped` is only for system work across organizations (startup restore).
  - **Global models' tenant relations**: the extension also scopes `include`/`select`/`_count` and nested writes from a global model into a tenant table (`Season.matches`, `Player.interviewSubjects`, `Organization.*`), and throws without a context. `Organization.matchSource` (to-one) and nested writes into the Organization's own relations throw (`UnscopableRelationError`): query the tenant model itself. Relation filters in `where` are not scoped. `/api/seasons` counts only the own matches (none without an organization).
  - **Raw SQL is not scoped**: every `$queryRaw`/`$executeRaw` on a tenant table must filter on `"organizationId"` by hand (checked in review). Inserts without an organization fail in the database (`missing_organization_id()` default), and the trigger `enforce_same_organization` refuses a row that points at a row of another organization (404 through the error handler; the missing organization is a 500).
  - **Frontend: start screen**: `components/OrganizationGate.tsx` wraps both LIVE and Beheer (`app/app.tsx`). Without a chosen organization, with a stored slug that is gone or inactive, after an answer with code `ORGANIZATION_REQUIRED`/`ORGANIZATION_UNKNOWN` (or that socket `connect_error` `data.code`; any other 401/403, e.g. `CROSS_SITE_REFUSED`, just shows its error), or on "Wissel organisatie" (the `OrganizationSwitcher` in both navs) it shows the start screen (a button per active organization from the public `GET /api/organizations`); with exactly one active organization it chooses it itself. The choice is `localStorage` `organization` = slug (`lib/organization.ts`, try/catch, also kept in memory); a stored choice renders the app at once and is checked in the background. URLs don't contain the organization. Read the chosen one with `useCurrentOrganization()`. Renaming the chosen organization's slug in Beheer: `useUpdateOrganization` puts the saved organization in the cached lists and calls `followRenamedOrganization()` right after the PUT, before any refetch, so the next request already sends the new slug.
  - **Frontend: X-Organization is added centrally**: `installOrganizationFetch()` (called once in `main.tsx`) wraps `window.fetch` and adds the header to same-origin `/api` requests only (never to vMix or other hosts). Just call `fetch(createUrl('/api/...'))` — never add the header yourself. Things that can't send a header don't work: no `<a href="/api/...">`, `window.open` or `<img src="/api/...">` — download exports with `downloadExport()`/`downloadFromApi()` (`lib/download.ts`). Every `io()` gets `auth: socketAuth` (`lib/organization.ts`); the shared socket (`lib/socket.ts`) is reconnected on switch.
  - **Frontend: switching forgets everything**: on a switch the gate removes every query except `['organizations', …]` from the React Query cache, reconnects the shared socket and remounts the app (keyed on the slug), so nothing of the previous organization stays on screen. Give organization data a normal query key; don't keep it in module state or `localStorage`.
  - **Global ids are chosen by the server**: `CallSheetItem.id` is a string primary key over all organizations, so it is always `randomUUID()`; client ids (POST item, an Excel ID column) are ignored or only used as temporary keys for `parentId` mapping (as `backup.ts` does).
- **Error responses without internals**: `middleware/error.ts` sends 503 only when the database can't be reached (P1xxx), P2025/P2003 → 404, P2002 → 409 (generic messages), anything else → 500 "Interne serverfout"; details go to the server log. Errors thrown with a 4xx `status` keep their message. Never put `err.message` of a Prisma or unexpected error in a response yourself.
  - **Foreign resources answer 404** (lists leave them out). A route that only writes children of a resource checks the resource first (e.g. `assertProductionExists`), so a foreign id answers 404 instead of a database error.
  - **Standard set**: new organizations get the skills, positions with links, title templates, callsheet and segment templates from `src/standardSet/` via `applyStandardSet(orgId)` (`services/standardSet.ts`: idempotent, only adds what is missing, matches positions like `findPositionByName`). Used by `POST /api/organizations` (with the organization in one transaction, `createOrganizationWithStandardSet`: a failing standard set leaves no organization behind), the seed and a startup check for organizations without positions. The standard set names no club (neutral wording like "eigen ploeg"); existing organizations keep the templates they have. Fortuna's own crew and sponsor stay in the seed.
  - **Match import per organization**: `MatchSource` (provider, baseUrl, token) per organization, managed at `/api/match-source`; the token is never returned (`hasApiToken` only), is removed when provider or the origin of `baseUrl` changes without a new token, and `baseUrl` must be https (http only outside production). `POST /api/match-source/test` answers only ok/failed. The provider factory takes the source; own team names for the youth colours come from the organization's name and `productionTeamNames`.
- **Single active production**: one active production per organization: `POST /api/production/:id/activate` and the production import deactivate the others of that organization only (the extension scopes the update).
- **Event status flow**: WAITING → ACTIVE → COMPLETED (unidirectional). Never revert status in code.
- **Segment ordering**: `volgorde` is unique per production. Reorders use a 2-phase transaction (bump to 1000+, re-insert, renumber) to avoid unique constraint collisions.
- **Time anchoring**: Each production has at most one `isTimeAnchor` item. All other times are calculated relative to it — backwards for earlier items, forwards for later.
- **In-memory state, per organization**: live production state (`productionId`, `activeEventId`, clocks, `isClockRunning`, the clock interval and auto-advance timer) lives in `productionState.ts` in memory, one per organization (`Map<organizationId, state>`); `timeSyncService` (the production clock) likewise. Every exported function works on the organization in the context, so call them from a request or inside `runWithOrganization`; timers are bound with `bindOrganization`. Send `liveStateSnapshot()` to clients, never `getCurrentState()` (it holds the timers). On startup the active production of every organization is restored; on restart the state resets otherwise.
- **Socket.io rooms**: the handshake sends `auth: {organization: <slug>}`; `services/socket.ts` resolves it to an active organization and joins room `org:<id>` (unknown/inactive/malformed slug → `connect_error` "Onbekende of inactieve organisatie" with `data.code` `ORGANIZATION_UNKNOWN`; no slug → connected, but only the global events). Every live emit goes through `emitToOrganization(event, …)` (room of the organization in the context), never `io.emit`; only `heartbeat` and `season_changed` are global. Every state change calls `broadcastState()`; clients receive snapshots, not diffs. Handshakes from a page on another host are refused (`isSameOriginRequest`, see **Same-origin rule**).
- **Background services per organization**: `vmixCallsheetPushService` and `venueClockSyncService` run every second for each organization whose show runs, read from the live state in memory (`liveOrganizationIds()`: no database query per second while no show runs; switched-off organizations have no live state), each with its own settings, vMix and scoreboard (what was pushed last is remembered per organization). One organization's slow device must never hold up another: a busy flag per scoreboard URL / per organization, a try/catch per organization, and a wall-clock deadline on every outgoing device request (`signal: AbortSignal.timeout(ms)`, plus `maxContentLength` for small answers). Never use axios' `timeout` option: it is an idle timeout, so a server that drips bytes keeps the request open.
- **Switching an organization off**: `PUT /api/organizations/:id` with `isActive: false` calls `stopOrganization()` (`services/organizationLifecycle.ts`): clock and auto-advance timer stop, its entries in `liveStates`, `timeStates` and `pushMemories` are dropped and its sockets are closed (`disconnectOrganizationSockets`); the database is left alone. Switching it on again restores its active production (`resumeOrganization`). Add any new per-organization in-memory map to `stopOrganization`.
- **Same-origin rule**: `isSameOriginRequest` (`middleware/sameOrigin.ts`) is the one origin check, for HTTP and the socket handshake. The host the browser used is X-Forwarded-Host when present, else Host; hostnames must match the Origin's, and the port too when that header carries one. The Vite proxy sends X-Forwarded-Host with its own port (`xfwd: true` in `vite.config.ts`, keep it); nginx sends `Host: $host` without a port, so behind nginx only the hostname is compared. No Origin (vMix, curl, Node) passes.
- **No cross-site writes (CSRF)**: `refuseCrossSiteWrites` on `/api` (before `organizationContext`, so also on the global routes) answers 403 "Verzoek van een andere website geweigerd" (`CROSS_SITE_REFUSED`) for every method except GET/HEAD/OPTIONS when `Sec-Fetch-Site` is `cross-site` or the Origin isn't same-origin. Exempt: a feed path with an API key (e.g. an HTML overlay calling `trigger-manual`; an invalid key still gets 401). Without a login this is what stops a form on any website from posting to the API; don't add CORS to non-feed routes and don't bypass it for a new route.
- **API keys on the feeds (D7)**: devices (vMix data sources and triggers, scoreboard displays) can't send X-Organization; they send an organization's key as `?key=` or `X-Api-Key`. Feed routes are listed in `FEED_API_PATHS` (`middleware/apiKey.ts`: the `/api/vmix` data sources and triggers, `/api/scoreboard/*`); add a new feed there. On a feed the key decides the organization (401 "Ongeldige API-sleutel" for an unknown, revoked or inactive one), X-Organization still works for the browser, and neither gives 401 "API-sleutel ontbreekt". Anywhere else a key counts for nothing (401 "Kies een organisatie"). Keys are managed at `/api/organization/api-keys` (`services/apiKeys.ts`): `sk_` + 32 random bytes (base64url), only the SHA-256 `keyHash` and a display `prefix` are stored, the key is returned once by POST, looked up by hash, revoke works immediately, `lastUsedAt` is written at most once a minute. CORS (`*`) is only on the feeds and the static files; the rest of the API is same-origin. A feed URL handed to vMix must keep working without redirects (vMix drops the key on a redirect).
- **Keys never in logs**: `extractApiKey` runs first and takes the key off the request (URL, `req.query`, header) before the request log, the error handler or a route sees it; log URLs through `withoutApiKey()`. Never log `req.headers` or a raw URL of a feed request yourself.
- **One key parser**: the query key is read only from the URL with `URLSearchParams(...).getAll('key')`, and only exactly one plain `key=` counts; never read it from `req.query` (qs also turns `[key]=`, `%5Bkey%5D=`, `key[]=` into `req.query.key`). Every parameter whose qs root is `key` (`/^(?:key|\[key\])(?:\[.*)?$/` after decoding) is stripped and makes the key invalid; when qs saw a key the URL scan didn't, the key is invalid (401) and the whole query string is dropped from the URL.
- **Zod validation**: All API inputs are validated with Zod schemas in `apps/korfbal-stream-api/src/schemas/`.
- **Settings persistence**: settings are per organization (`OrganizationSetting`: vMix URL/instances, callsheet push, sponsor filter types, scoreboard/shot clock URL, production team names, `sponsorCarouselExtra`); only installation-wide keys (`GLOBAL_SETTING_KEYS` in `services/appSettings.ts`: `activeSeasonId`) stay in `Setting`. Always go through `getSetting`/`setSetting` (cache keyed by organization + key; "not set" is cached too, so never write settings rows any other way). The **own club** is not a setting: it is `Organization.clubId` (`services/ownClub.ts`), shown as `ownClubId` by `/api/settings/club-config` and as the club in Beheer → Organisaties. A settings restore into one organization skips installation-wide keys (`activeSeasonId`, `activeSeasonName`). Accessed via `/api/settings` for the chosen organization.
- **Seasons**: `MatchSchedule` and `Player` have a required `seasonId`. A match's season is always derived from its date (1 July–30 June, Europe/Amsterdam) via `services/season.ts` — never set it by hand. Season-bound list endpoints default to the active season (`activeSeasonId` setting) with an optional `?seasonId=` override; production-bound lookups use the production's match season. Clubs are global. KNKV downloads go to `storage/seasons/<YYYY-YYYY>/`.
- **Several vMix instances**: the `vmixInstances` setting holds the vMix PCs (e.g. stream PC and screen PC) and per function which one it sends to (`services/vmixInstances.ts`, `resolveVmixInstance(fn)`; empty target = first instance). Anything that sends commands to vMix must resolve its instance this way — add new functions to `VMIX_FUNCTIONS` (API schema and kit hook). The old single `vmixWebUrl` setting mirrors the first instance.
- **Callsheet → vMix**: `services/callsheetTiming.ts` derives the current/next item per position (same rule as the Show Caller: items without positions count for everyone). `services/vmixCallsheetPush.ts` pushes it every second (when enabled in the `vmixCallsheetPush` setting) with SetText/SetColor/SetTextColour, sending only changed fields plus a full resend every 15s.
- **Interview placeholders**: callsheet titles/notes may contain `{speler|coach-thuis|uit|eigen|tegenstander[:kort|:achternaam]}`. They're stored as typed and only filled in when shown (LIVE callsheet/Show Caller via `InterviewNamesProvider`, vMix timing). The parser exists twice — `apps/korfbal-stream-api/src/services/interviewPlaceholders.ts` and `apps/korfbal-stream-kit/src/lib/interviewPlaceholders.ts` — keep them in sync.
- **LIVE on phones**: LIVE is used on phones (e.g. 360 px wide). Nothing may be wider than the screen: one wide element makes the whole page wider, and then the sticky headers (Show Caller controls, clocks) scroll out of view. Use `truncate`/`min-w-0`/`flex-wrap` and check at 360 px. Below 768 px the Show Caller renders `components/ShowCallerPhone.tsx` (now/next/later, controls fixed at the bottom); its actions go through `hooks/useShowControls.ts`, which shows failures on screen. LIVE finds the active production with `GET /api/production/active` (`useActiveProduction`), independent of the active season.
- **User manual (handleiding)**: Markdown in `apps/korfbal-stream-kit/src/handleiding/live/` (crew, LIVE) and `.../beheer/` (Beheer), bundled into the app (works offline) and shown at `/handleiding` and `/admin/handleiding`. File names `NN-slug.md` give order and slug; the `?` button opens the chapter for the current screen via `handleiding/helpTopics.ts`. Written in Dutch for end users, with the exact UI labels. When you change a screen's behaviour or labels, update its chapter in the same change.
- **Positions by name**: never look up or create a position by its exact name. Use `findPositionByName` (`domain/positionSkill.ts`, ignores case/spacing and knows aliases like `regie` → "Regie livestream") or `findOrCreatePosition`/`findExistingPosition` (`services/positions.ts`). Exact lookups created duplicates ("regie" next to "Regie livestream", "Showcaller" next to "Show caller"); migration `20261014170000_merge_duplicate_positions` merged them. The seed matches the same way and renames an existing skill code (e.g. `SHOW_CALLER` → `SHOWCALLER`) instead of adding one.
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

This application has **no authentication or authorization**. It is an internal LAN tool used directly by the production crew. There are no user accounts or role-based access controls; the only choice is the organization (start screen, `X-Organization`), and devices on the feed routes use an organization's API key. Anyone with Beheer can manage organizations for now.

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
- `ASSETS_DIR` defaults to `storage/` in dev and `tmp/test-storage` in tests. Logo directories are keyed on the organization **id**, never the slug (a slug can be renamed and reused): sponsor logos go to `<ASSETS_DIR>/sponsors/<organizationId>/` (stored as `<organizationId>/<file>`, `services/sponsorLogos.ts`; older logos keep their plain file name), organization logos to `<ASSETS_DIR>/organizations/<organizationId>.<ext>`. A sponsor `logoUrl` is never derived from the name (null until an upload); a client value is only accepted when it is the current one or in the own directory (`resolveClientLogoUrl`). Logo uploads accept only png/jpg/gif/webp, checked on the content (`services/imageUpload.ts`); there is no generic upload endpoint.
- **Base images are Docker Hardened Images** (`dhi.io/node`, `dhi.io/nginx`); run `docker login dhi.io` (Docker Hub account) once before building. `-dev` variants only in build stages; runtime images have no shell, no npm/pnpm and run as non-root (API as uid 1000, nginx on port 8080 → host 80). Hence: the migrate job runs `node /app/seed/migrate-and-seed.cjs`, healthchecks use `node -e fetch(...)`, Prisma engines are pinned via `PRISMA_QUERY_ENGINE_LIBRARY`/`PRISMA_SCHEMA_ENGINE_BINARY`. PostgreSQL still uses the official `postgres:16-alpine` image.
- **Local image test against a backup**: `docker-compose-localtest.yml` (project `korfbal-localtest`, ports 80/3334/5433) builds the images and fills its own db from a pg_dump SQL file on first start (`LOCALTEST_SQL`, default `../2025-2026-backup/streamz-2025.sql`); the migrate job runs with `SKIP_SEED=true`. Images come from a bind mount on the local disk (`LOCALTEST_STORAGE`, default `./storage`), so they survive restarts. Reset the db to the backup: `down -v` then `up -d`. The API serves `/uploads` and `/storage` from `ASSETS_DIR`; there is no separate uploads dir.
- **Docker Hub overview**: `apps/<app>/DOCKERHUB.md` is published as the repository description on Docker Hub by the `merge` job in `ci.yml`, on releases only. Keep it up to date when env vars, ports or the purpose change.
- **No secrets in checked-in config**: compose files read them via `env_file` from local, gitignored files — `secrets.env` (dev, optional), `secrets.prod.env` (prod), `streamz-test/secrets.env`. Templates: `secrets.env.example`, `secrets.prod.env.example`. Don't use a root `.env`/`.env.local` for this: Nx loads those into every task.

## Environment Variables (API)

Validated with Zod at startup (`apps/korfbal-stream-api/src/config.ts`):

```
DATABASE_URL=postgresql://korfbal:korfbal@localhost:5432/korfbal
PORT=3333
SCOREBOARD_BASE_URL=http://<scoreboard-ip>/scoreboard
SHOTCLOCK_BASE_URL=http://<shotclock-ip>/shotclock
ASSETS_DIR=storage
HOST_IP=<optional, for vMix endpoint auto-detection in Docker>
```

The match import is not an env var: each organization configures its source (provider, URL, token) in Beheer → Overig → Organisatie → Wedstrijdimport (`MatchSource`).

In tests, `.env.test` is loaded automatically.
