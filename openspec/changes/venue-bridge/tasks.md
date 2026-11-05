# Tasks

## 1. Backend — shared protocol (`libs/venue-protocol`)

- [ ] 1.1 Nx lib with event names, `VenueReading`, `VenueConfig`, request/answer shapes and their zod schemas, the `MM:SS` venue time parser and the shot clock colour rule (moved from the API). Verify: unit tests of schemas (valid, too large, wrong device), parser and colour thresholds 10/15; API and bridge both import it (typecheck).

## 2. Backend — venue-bridge app (`apps/venue-bridge`)

- [ ] 2.1 `git mv apps/statistics-bridge apps/venue-bridge`; rename the Nx project, Docker image (`streamz-kit-venue-bridge`), compose files and scripts; drop `BRIDGE_TOKEN`; listen on `0.0.0.0:3340` (`HOST`, `PORT`). Verify: the moved statistics tests pass (`vitest run --config apps/venue-bridge/vitest.config.ts`).
- [ ] 2.2 Local start settings (`API_URL`, `API_KEY`, `BRIDGE_NAME`, `STATS_DIR`, `COPY_DIR`, `CONFIG_FILE`, `LOG_LEVEL`): exit non-zero without URL or key, key never logged. Verify: unit tests (missing key, key absent from log output).
- [ ] 2.3 Config cache (`services/configCache.ts`): validate with the shared schema, apply live (change events), atomic write mode 600, valid cache applied at start, invalid cache → no venue config until the API sends one. Verify: unit tests (apply + write, corrupt file at start, mode 600, change event fired).
- [ ] 2.4 Statistics handlers callable in-process and configured from the cache (page URL, database path, on/off, share host, keep copy) plus local `STATS_DIR`/`COPY_DIR`. Verify: existing statistics tests green; a test calls a handler by path and query after a config change.
- [ ] 2.5 Device readers (`services/deviceReaders.ts`): 1 s loop, 800 ms deadline, 4 KB cap, in-flight skip, `unreachable`/`invalid`/`not-configured`, change detection plus 5 s resend, URLs from the cache. Verify: unit tests with a fake device server (slow device, non-array, unchanged clock resend, URL change).
- [ ] 2.6 vMix client (`services/vmixClient.ts`): instance resolution per function from the cache, function URL builder and inputs XML parser moved from the API, 1.5 s/2 s deadlines, size cap, errors without address. Verify: unit tests against a fake vMix (SetCountdown URL, batch of SetText, inputs parsed, unreachable).
- [ ] 2.7 API connection (`services/apiConnection.ts`): socket.io-client to `/venue-bridge` with `auth.key`, name, version, page URL; reconnect 1–30 s; emits readings; answers `config:apply`, `stats:request` (404 for unknown paths), `vmix:call`, `vmix:inputs`. Verify: integration test against an in-process socket.io server for each event.
- [ ] 2.8 Fallback API and bridge routes: `/api/scoreboard`, `/clock`, `/shotclock`, `/api/stats/*`, `POST /api/vmix/set-timer` with the key (header or `?key=`, timing-safe); `/bridge/status` without secrets; `/health`. Verify: integration tests (401 missing/wrong key, shot clock colour, stats pass-through, set-timer reaches the fake vMix, status has no key or URL secrets).

## 3. Backend — API: bridge connection, configuration and venue data

- [ ] 3.1 `VENUE_BRIDGE_OFFLINE` in both `apiErrorCodes.ts` files, `STATS_BRIDGE_OFFLINE` removed. Verify: typecheck; kit and API tests that use the codes.
- [ ] 3.2 Namespace `/venue-bridge` with key middleware (`auth.key` / `x-api-key` / `?key=`, `API_KEY_MISSING` / `API_KEY_INVALID`, key never logged), one socket per organization, raised `maxHttpBufferSize` on this namespace only; `askBridge` helper. Verify: integration tests (no key, revoked key, inactive organization, second bridge replaces first, timeout → offline) and security tests in `security.int.spec.ts` (foreign Origin refused, key absent from logs, organization isolation).
- [ ] 3.3 `services/venueConfig.ts`: build the configuration from `scoreboard-config`, `match-stats` and `vmix-instances`; `config:apply` on connect and (debounced) after each of those settings is saved; config state in the status. Verify: integration tests (sent on connect, resent after a save, refused config shown, other organization's settings never sent).
- [ ] 3.4 `match-stats` settings become `{pageUrl, mdbPath, mdbEnabled, shareHost, keepCopy}` with zod validation; bridge URL and token removed (and left out of the backup). Verify: integration tests (valid save, `../` path refused, old keys absent from backup export).
- [ ] 3.5 `services/venueData.ts`: validated readings, per-organization store, 10 s currency, cleared on disconnect, `venue_bridge_status` on connection, configuration or device state change. Verify: integration tests (malformed reading ignored, stale after 10 s, disconnect, isolation).
- [ ] 3.6 Zaalklok: a current `clock` reading feeds `updateVenueClock` for a live organization. Verify: integration test (show running → `venue_clock_update` only on change; no show → only stored).

## 4. Backend — API: routes through the bridge

- [ ] 4.1 `routes/scoreboard.ts` from `venueData` (same answers and 502 messages, colour rule). Verify: integration tests per route (current, unavailable, colours).
- [ ] 4.2 `statsBridge.bridgeGet` over `stats:request` (5 s, 10 MB, header filter, cache, shared in-flight); `/api/stats/status` keeps its shape. Verify: integration tests with a fake bridge client (pass-through, own 503 passes, timeout and no bridge → `VENUE_BRIDGE_OFFLINE`, team query appended).
- [ ] 4.3 vMix through the bridge: callsheet push sends its commands as one batch per tick, `POST /api/vmix/callsheet/push`, `GET /api/vmix/inputs`, `POST /api/vmix/set-timer`; organizations without a bridge skipped quietly by the push. Verify: integration tests with a fake bridge (commands sent, answers unchanged, offline → 503, push skips without repeated logging).
- [ ] 4.4 `GET /api/venue-bridge/status` (organization or feed key; in `FEED_API_PATHS`). Verify: integration test of the body; leak suite entry.

## 5. Backend — API: removal of direct venue access

- [ ] 5.1 Remove `venueClockSyncService`, direct axios calls to scoreboard, shot clock and vMix, `config.scoreBoardBaseUrl`/`shotClockBaseUrl` and env vars, `BridgeNotConfiguredError`. Verify: `grep` finds no axios call to a device or vMix in the API; existing tests updated.
- [ ] 5.2 Update `docs/claude/live-and-devices.md`, `security.md`, `docker.md`, `PROJECT_STRUCTURE.md`, `.env.example` files. Verify: `grep` finds no `statistics-bridge` or bridge token left.

## 6. Frontend — shared UI and bridge page

- [ ] 6.1 `libs/ui`: the kit's Tailwind preset and the base components the bridge page needs (card, button, status badge, key/value row), moved from the kit; the kit imports them from the lib. Verify: kit tests and `kit:build` green; no visual change in the kit.
- [ ] 6.2 `apps/venue-bridge-ui`: Vite + React + TanStack Query status page on `/bridge/status` (connection, configuration state and time, per device and vMix instance state and age, fallback addresses with copy), built into the bridge image. Verify: component tests (connected, cloud down, device not configured); works at 360 px.

## 7. Frontend — kit

- [ ] 7.1 Instellingen tab "Venue": bridge status card (route + `venue_bridge_status`; configuration state; per device state and age; link to the bridge page) and the scoreboard, statistics and vMix settings moved there from their current tabs. Verify: component tests (connected, disconnected, refused config, settings on the tab); works at 360 px.
- [ ] 7.2 Bridge indicator in the Beheer top bar ("Bridge verbonden"/"Bridge offline", live, links to Instellingen → Venue, dot only at 360 px). Verify: component test (live switch on the socket event).
- [ ] 7.3 Statistieken settings form: the new statistics settings instead of bridge URL and token. Verify: component tests (save, `../` path error shown).
- [ ] 7.4 Statistieken gate and other `STATS_BRIDGE_OFFLINE` users switch to `VENUE_BRIDGE_OFFLINE`. Verify: component tests; user runs the statistics e2e flow.
- [ ] 7.5 Handleiding: Instellingen (venue-bridge card, statistics settings), Statistieken, Stream Deck table (fallback addresses), a chapter "Venue-bridge in de zaal" (install, start settings, page, cache, fallback). Verify: `handleiding/manual.spec.ts` passes.

## 8. Delivery

- [ ] 8.1 Dockerfile (multi-stage: bridge + page), compose venue example (`/data` volume, share at `STATS_DIR`, port 3340 on the LAN, restart policy), dev compose running a bridge against the dev API. Verify: user runs `docker compose up` in dev and sees the bridge connected in Instellingen and on its page.
- [ ] 8.2 README of the bridge (Dutch): what it does, start settings, central configuration and cache, page, fallback API, install at the venue, migration from statistics-bridge, troubleshooting. Verify: review by the user.
- [ ] 8.3 Security review (`/security-review`) and the full API suite run by the user. Verify: no open findings; user confirms a green suite.

## Workflow follow-up

- Archive with `/opsx:archive` after release; `venue-bridge`, `venue-data` and the updated `match-analysis` then become main specs.
