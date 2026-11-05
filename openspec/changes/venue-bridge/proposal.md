# Proposal

## Why

The API reaches into the sports hall: it reads the scoreboard, the shot clock and the statistics bridge, and it sends commands to vMix, all over the venue LAN. That ties the API — and the kit with LIVE that it serves — to the hall: neither can run in the cloud, so remote access and login for crews and other clubs cannot follow. Turning the direction around — the venue connects out, the central API receives and commands through that connection — removes the tie while the crew keeps the same screens, settings, vMix data sources and Stream Deck buttons.

## What Changes

- New app **venue-bridge** (`apps/venue-bridge`, Docker image `streamz-kit-venue-bridge`), one per venue. It is the only thing that talks to the venue network: scoreboard (stand, zaalklok), shot clock, statistics PC and vMix.
- One **outbound** socket.io connection from the bridge to the API, authenticated with an organization API key (`X-Api-Key` or `?key=`). Over it the bridge pushes stand, zaalklok and shot clock; the API asks statistics questions and sends vMix commands that the bridge carries out.
- **Configuration stays central**: the scoreboard and shot clock addresses, the statistics settings and the vMix instances remain organization settings in the kit. The bridge receives them on connect and on every change and caches them in a JSON file on a volume, so it keeps working when the cloud is out of reach. Only the API address, key, bridge name and its own folders are set locally.
- The API keeps the venue data in memory, so LIVE in the cloud and the vMix data sources keep working: `/api/scoreboard*`, `/api/stats/*` and `/api/vmix/*` keep their URLs, keys and answers.
- The bridge has a **fallback API** on the venue network (scoreboard, zaalklok, shot clock, statistics, countdown) with the same paths and key, for vMix and the Stream Deck when the internet or the cloud is down.
- The bridge has a small **React page** (status, local start settings), sharing layout with the kit through a new UI library.
- **BREAKING**: the API no longer calls the venue. `venueClockSyncService`, the statistics bridge URL and token settings and the separate `statistics-bridge` app go. Without a connected bridge there is no zaalklok, stand, shot clock, statistics or vMix control from the API.

## Capabilities

### New Capabilities
- `venue-bridge`: the venue app — device, statistics and vMix access, its cached configuration and local start settings, the outbound connection, the fallback API and its page.
- `venue-data`: the API side — the bridge connection per organization, sending the venue configuration, the venue data in memory, the scoreboard, statistics and vMix routes served through the bridge, and the bridge status.

### Modified Capabilities
- `match-analysis`: `/api/stats/analysis` goes over the bridge connection; "offline" means no connected venue-bridge.

## Impact

- New: `apps/venue-bridge` (statistics code moved from `apps/statistics-bridge`, device readers, vMix client, config cache, socket.io client), `apps/venue-bridge-ui` (Vite + React page), `libs/ui` (shared Tailwind preset and base components), Dockerfile, compose, README.
- API: socket namespace with key auth; `routes/scoreboard.ts`, `routes/stats.ts`, `routes/vmix.ts`, `routes/settings.ts` (`match-stats` gets the statistics settings, loses bridge URL and token), `services/vmixCallsheetPush.ts`, `services/stats/statsBridge.ts`, `productionState.ts`, both `apiErrorCodes.ts`, leak and security suites.
- Kit: Instellingen (bridge status card; statistics settings form), Statistieken gate, handleiding; start of `libs/ui`.
- Venue: the bridge machine needs outbound access to the API, and a port on the LAN only for the fallback API and the page.
