## Why

The statistics of a match (scorers, attacks, turnovers) are only read live from the statistics PC's `WEDSTRIJDEN.mdb`: after the match, or when the share or the PC is gone, they are lost to the crew, and there is no view over the season. The analist and the commentators want season figures (top scorers of the own club, how often an attack ends without a shot, shots per attack, turnovers) during the broadcast, and the vMix operator wants the season top scorers as a title.

## What Changes

- The API keeps every match of the own team that the bridge can read from the statistics database: the raw action rows of the match table and the figures derived from them, per organization and team number. The API syncs them from the bridge in the background (on connect and every minute) through the existing statistics request; it only works when the bridge reads the database file itself (variants `cifs`, `windows-robocopy`, `mac`, or its local copy), not from the statistics page alone.
- Tables of other matches in the database are not kept: a table without the own club in the definition row, or whose name gives the own club another team number (`DVO2 Fortuna2` in the database of team 1).
- The derivation of the match figures (`matchActions`, `matchAnalysis`) moves from the bridge to `libs/venue-protocol`, so the API derives the same figures from the stored rows (also for matches stored before a change of the derivation).
- The match analysis adds per attack figure: attacks without a shot and the number of attacks per number of shots (0, 1, 2, 3, 4, 5+).
- New `GET /api/stats/season`: the season of the active season (from its `indoorStartDate`) for the team of the active production: the list of matches it is based on, the own club's top scorers and the team figures (attacks, without a shot, shots per attack, goal %, turnovers by kind and per vak per match), all from the stored matches, so also without the database.
- New vMix datasource `GET /api/stats/season/top-scorers` (feed route): one flat row per own player.
- LIVE Statistieken gets a card "Seizoen" with the top scorers, the team figures and the match list, and says when the matches are not being updated (database not readable).

## Capabilities

### New Capabilities
- `season-statistics`: keeping the matches from the statistics database in the API, choosing the own team's matches, the season overview, its API routes, the vMix datasource and the card on LIVE Statistieken.

### Modified Capabilities
- `match-analysis`: the attack figures also give the attacks without a shot and the distribution of shots per attack; the derivation lives in `libs/venue-protocol`.

## Impact

- `libs/venue-protocol`: new `matchStats/` (moved from `apps/venue-bridge/src/services/matchActions.ts`, `matchAnalysis.ts`).
- Venue-bridge: `/matches` also gives `actionCount` and `lastActionAt`; new `/matches/:table/rows` (all rows, database only).
- API: Prisma model `StatsMatch` + migration; `services/stats/statsSync.ts`, `services/stats/season.ts`; routes in `routes/stats.ts` (`/season`, `/season/top-scorers`), vMix datasource list, leak and security tests, backup coverage.
- Kit: `StatisticsPage` card "Seizoen", `lib/statsApi.ts`; handleiding LIVE Statistieken and Beheer vMix.
