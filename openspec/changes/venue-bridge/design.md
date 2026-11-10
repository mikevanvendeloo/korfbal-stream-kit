# Design

## Context

Today the API reaches into the venue in four ways (see proposal.md):

- `routes/scoreboard.ts` asks the scoreboard (`score-as-array`, `time-as-array`) and the shot clock (`time-as-array`) on every request, with a 2 s deadline.
- `services/venueClockSyncService.ts` asks every live organization's scoreboard each second (800 ms deadline, 4 KB cap, one in flight per URL) and feeds `updateVenueClock`.
- `services/stats/statsBridge.ts` forwards `/api/stats/*` with axios to the `apps/statistics-bridge` HTTP server (5 s deadline, 10 MB cap, 2 s cache, shared in-flight, `X-Bridge-Token`).
- vMix: `services/vmixCallsheetPush.ts` (1 s loop, `SetText` per field, 1.5 s deadline), `POST /api/vmix/callsheet/push`, `GET /api/vmix/inputs` (vMix XML) and `POST /api/vmix/set-timer` (`SetCountdown`, 2 s), on the instance `resolveVmixInstance` picks from the `vmixInstances` setting (`{instances: [{id, name, url}], targets}`).

The kit never calls vMix or a device itself; everything goes through the API. The API has a socket.io server (`services/socket.ts`) whose browser clients join `org:<id>` rooms after an `auth.organization` handshake, behind the same-origin `allowRequest`. API keys (`services/apiKeys.ts`, `findOrganizationByApiKey`) identify an organization for devices on the feed routes.

## Goals / Non-Goals

**Goals:**
- The API and the kit (with LIVE) can run in the cloud; the venue needs no inbound port for them.
- Kit, vMix data sources and Stream Deck keep every URL, key and answer shape.
- One bridge per venue is the only thing talking to the venue network; its configuration is managed centrally and cached, so the venue keeps working when the cloud is out of reach (fallback API, status page).

**Non-Goals:**
- Login and remote access themselves.
- Several bridges per organization (several halls at once).
- Show control on the bridge: in a fallback the bridge gives raw data, not the running show.
- Serving the vMix data sources (sponsors, titles, callsheet timing) from the bridge.
- Editing configuration on the bridge itself (a local override while the cloud is down may follow later).

## Decisions

### D1. One socket.io namespace `/venue-bridge`, key in the handshake
The bridge connects to namespace `/venue-bridge` on the existing socket.io server. A namespace middleware reads the key from `auth.key`, the `x-api-key` header or the `key` query (same precedence as `middleware/apiKey.ts`), resolves it with `findOrganizationByApiKey` and stores `organizationId` on the socket. Refusals reuse `API_KEY_MISSING` / `API_KEY_INVALID`. The server-wide same-origin `allowRequest` stays: a Node client sends no `Origin` and passes; a foreign page is refused. A registry keeps one socket per organization; a new one disconnects the old.
*Alternatives*: a separate WebSocket server (second port and auth path); an extra auth branch in the browser namespace (mixes device and browser rooms). Rejected.

### D2. Readings pushed, kept in memory per organization
`services/venueData.ts` keeps per organization `{socketId, name, version, connectedAt, devices: {score, clock, shotclock}: {reading, receivedAt}}`. `venue:reading` is zod-validated (device enum, `data` an array of at most 20 items, ≤ 4 KB). Current = ok, received within 10 s, socket still registered (on change plus a 5 s resend tolerates one lost heartbeat). A `clock` reading runs `updateVenueClock` in `runWithOrganization` for a live organization, with the `MM:SS` parser moved to a shared helper.
*Alternative*: the bridge sends every second regardless — ~3 messages/s per venue for nothing while the clock stands still. Rejected.

### D3. Request/response over the socket for statistics and vMix
One helper `askBridge(organizationId, event, payload, {deadlineMs, maxBytes})` = `socket.timeout(ms).emitWithAck(event, payload)` plus shape and size checks; no socket, a timeout or a bad shape → `BridgeOfflineError` → 503 `VENUE_BRIDGE_OFFLINE`. Events: `stats:request {path}` (5 s, 10 MB; `statsBridge.bridgeGet` keeps its cache, shared in-flight and team handling, only its transport changes), `vmix:call {function | instanceId, commands}` (2 s), `vmix:inputs {function | instanceId}` (3 s), `config:apply {config}` (3 s, answers `{ok}` or `{ok: false, error}`). `maxHttpBufferSize` is raised on this namespace only.
*Alternative*: snapshots pushed by the bridge — loses `/matches/:table/...` and parameter queries. Rejected with the user.

### D4. vMix: the API decides, the bridge executes
The callsheet push keeps computing texts and change detection in the API (it knows the show) and sends only the commands it would have sent, per organization, as one `vmix:call` batch per tick. Instance resolution per function runs on the bridge from its cached configuration (same rules as `resolveVmixInstance`). `/api/vmix/inputs` returns the bridge's parsed inputs; `set-timer` sends `SetCountdown`. Answers never carry a vMix address. The instances, targets and push mapping stay API settings, edited in the kit as today.

### D5. Configuration is central; the bridge caches it
Source of truth: the organization settings in the API — `scoreboard-config` (`scoreboardUrl`, `shotclockUrl`), `match-stats` (now `{pageUrl, mdbPath, mdbEnabled, shareHost, keepCopy}`) and `vmix-instances` (`{instances, targets}`). `services/venueConfig.ts` builds `VenueConfig = {scoreboard, shotclock, stats, vmix, version}` (version = hash of the content) and sends it with `config:apply` on connect and after a save of any of those settings (the settings routes call `pushVenueConfig()`; debounced 500 ms). The bridge validates it (shared zod schema in `libs/venue-protocol`), applies it live and writes `/data/venue-bridge.json` atomically (tmp + rename, mode 600). At start the bridge applies the cached file if valid. Local only: `API_URL`, `API_KEY`, `BRIDGE_NAME`, `STATS_DIR`, `COPY_DIR`, `PORT`, `HOST`, `CONFIG_FILE`, `LOG_LEVEL` — values that depend on the machine or are needed to reach the API.
*Alternatives*: the bridge owns its settings (local page edits) — two places to manage and no remote management; env only — no change without redeploy. Rejected with the user. A temporary local override while the cloud is down is a possible later addition.

### D6. Shared protocol library
`libs/venue-protocol` (TypeScript, no runtime deps besides zod): event names, `VenueReading`, `VenueConfig`, request/answer shapes and their schemas, the `MM:SS` venue time parser and the shot clock colour rule. Both the API and the bridge import it, so the two sides cannot drift.

### D7. Bridge server: fallback API, statistics, page, health
One Express server on `0.0.0.0:3340` (`HOST`, `PORT`):
- `/health` (no key).
- `/bridge/status` (no key, no secrets: key masked, no device or vMix URLs beyond host names) for the page.
- The fallback API: `/api/scoreboard`, `/clock`, `/shotclock`, `/api/stats/*`, `POST /api/vmix/set-timer`, key required (`?key=` or `X-Api-Key`, timing-safe compare with `API_KEY`), the same answers as the central API from the same readings, cached configuration and statistics code. The statistics team in a fallback is the one last given by the API (kept in the cache file), else 1.
- `/` and assets: the built page (D8).
The statistics routes (`/live`, `/matches`, ...) become internal handlers that `stats:request` and `/api/stats/*` both call in-process. No CORS. `BRIDGE_TOKEN` disappears.

### D8. Page: a small React app sharing `libs/ui`
`apps/venue-bridge-ui`: Vite + React + TanStack Query + Tailwind, one status page polling `/bridge/status` every 2 s: API connection, configuration received at/version, per device and vMix instance state and age, fallback addresses with a copy button. Built in the bridge's Docker image (multi-stage) and served statically. `libs/ui` (new Nx lib): the kit's Tailwind preset (colours, dark mode) and a few base components moved from the kit (card, button, status badge, key/value row). The kit imports them from `libs/ui` too; only components the bridge page needs move now.
*Alternative*: a static HTML page — no reuse of the kit's look. Rejected with the user.

### D9. Bridge internals
`git mv apps/statistics-bridge apps/venue-bridge` keeps history. New: `services/configCache.ts` (D5), `services/deviceReaders.ts` (code moved from the API), `services/vmixClient.ts` (function URL builder, instance resolution and inputs XML parser moved from the API), `services/apiConnection.ts` (socket.io-client, `reconnectionDelayMax: 30000`, emits readings, answers requests, never logs the key).

### D10. Error code `VENUE_BRIDGE_OFFLINE` replaces `STATS_BRIDGE_OFFLINE`
"De venue-bridge is offline", 503, hint: check the bridge machine and its API key. Both `apiErrorCodes.ts` files. The kit's Statistieken gate and the status card match on it.

### D11. Kit: status card and statistics settings
Instellingen gets a Venue-bridge card (`GET /api/venue-bridge/status` + `venue_bridge_status`): connected, name, version, configuration state, per device state and age, a link to the bridge page (only works on the venue network). The scoreboard and vMix settings stay as they are; the statistics settings form changes from bridge URL + token to the statistics settings of D5.

### D12. Removal
Removed: `venueClockSyncService` and its start, direct axios calls to scoreboard, shot clock and vMix, `config.scoreBoardBaseUrl`/`shotClockBaseUrl` and their env vars (the settings stay), `matchStats.bridgeUrl` and `matchStatsBridgeToken`, `BridgeNotConfiguredError`, `apps/statistics-bridge`. Stored bridge URL/token rows stay for rollback but are ignored and left out of the settings backup.

## Risks / Trade-offs

- [A stolen API key lets someone pose as the venue, push a fake clock, receive the venue configuration (LAN addresses) or take vMix commands] → per-organization revocable keys; the status card shows bridge name and connect time; one bridge per organization makes an impostor kick the real one off (visible). Recommend a dedicated key per bridge.
- [Configuration cannot be changed while the cloud is down] → accepted; the cached configuration keeps the venue working; a local override can be added later.
- [The stats tunnel carries up to 10 MB answers] → raised buffer only on the bridge namespace; 2 s cache and shared in-flight remain.
- [vMix commands now cross the internet, adding latency to the callsheet push] → one batch per tick per organization; text updates are not timing-critical below a second.
- [Everything stops without the bridge] → BREAKING, made visible on the page, `/health` and the status card; compose restarts the container; the fallback API keeps vMix and the Stream Deck going at the venue.
- [Moving components to `libs/ui` touches the kit] → move only what the bridge page needs; kit tests guard the moved components.
- [socket.io versions] → pin `socket.io-client` to the server's major version.

## Migration Plan

1. Release API and bridge together. Existing scoreboard and vMix settings stay as they are.
2. In Instellingen → Statistieken fill in the statistics settings that were environment variables on the statistics bridge (`PAGE_URL`, `MDB_PATH`, `MDB_ENABLED`, `SHARE_HOST`, `KEEP_COPY`).
3. At the venue: create an API key "venue-bridge <zaal>"; run `streamz-kit-venue-bridge` with a `/data` volume, the share mounted at `STATS_DIR`, port 3340 published on the LAN, and `API_URL`, `API_KEY`, `BRIDGE_NAME`.
4. Stop the old `statistics-bridge` container. Check Instellingen → Venue-bridge (connected, configuration applied, devices ok) and the bridge page.
5. Note the fallback addresses (`http://<bridge>:3340/api/...?key=...`) in the venue runbook.
6. Rollback: previous API and the old statistics-bridge image; its bridge URL/token rows are still in the database.

## Open Questions

- Docker Hub repository name (`mvanvendeloo/streamz-kit-venue-bridge` assumed).
