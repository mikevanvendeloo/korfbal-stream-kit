## Context

The statistics routes of the API only forward to the venue-bridge (`stats:request`, `services/stats/statsBridge.ts`); the bridge opens `F{team}/WEDSTRIJDEN.mdb` (or its local copy), derives figures per read (`services/matchActions.ts`, `matchAnalysis.ts`) and falls back to the statistics page when the database is off or unreachable. Nothing is kept. The team number comes from the active production (`resolveStatsTeam`), the own club from `getOwnClubId` + the organization name (`ownTeamName`). See proposal.md for the why.

## Goals / Non-Goals

**Goals:** keep the own team's matches (raw rows) in PostgreSQL; derive every figure from those rows with one shared derivation; a season overview and a vMix datasource that work without the bridge.

**Non-Goals:** season figures per vak (the composition of vak 1/2 differs per match; per vak stays per match, in the match list); editing or deleting stored matches in the kit; a season of another team than the active production's; keeping matches in the per-entity JSON backups (the PostgreSQL dump of `upgrade.cmd` and `pg_dump` cover them, like `MatchSource`).

## Decisions

**Store raw rows plus the derivation version, not only figures.** `StatsMatch` holds the normalized rows (all rows of the table, also the definition rows the vak and lineup need) as JSON, the derived match figures as JSON and `derivationVersion`. Reading a match whose version is older re-derives it from the rows and updates the stored figures. Alternative: figures only (smaller, but a new statistic or a fix could never reach past matches) or a JSON cache file on the bridge (lost with the bridge PC, unreachable for a cloud API when the bridge is down, outside the backups).

**API pulls, the bridge does not push.** The sync uses the existing `stats:request` (`bridgeGet`): `/matches?team=N` (now with `actionCount` and `lastActionAt`) and the new `/matches/:table/rows?team=N`. The bridge stays a request/answer component with no knowledge of storage; all choices (own club, team, season) live in the API, which has the club and production data. Alternative: a new bridge→API event after each read (needs the bridge to know the team and the own club, and a second write path).

**Only the database file.** `/matches/:table/rows` answers 503 without a usable database (no page fallback); the sync also skips a `/matches` answer whose source is `page`. So `page-only` and "Database gebruiken" off store nothing.

**Sync loop.** A per-organization sync (`services/stats/statsSync.ts`) runs on bridge connect and from a 60 s interval over the connected bridges, inside `runWithOrganization`, at most one at a time per organization. Per listed table: skip names whose own-club token carries another team number (cheap, no fetch); fetch rows of tables that are new or whose `actionCount`/`lastActionAt` changed; store when the definition row has the own club in `speler`; remember skipped tables in memory (per org, table and fingerprint) so they are not fetched every minute. The last attempt's state (`ok` / `unavailable` / `offline`, time) is kept in memory per organization for the season answer.

**Shared derivation in `libs/venue-protocol/src/matchStats/`.** `matchActions.ts` and `matchAnalysis.ts` move there (with the `Ratio`/`pct` helpers they need); the bridge's files re-export them so its routes and specs stay. The API imports them through `@korfbal-stream-kit/venue-protocol`, already bundled into the API and the bridge. Alternative: a new lib (more Nx wiring for the same two consumers).

**Own team detection.** Table name tokens: the token starting with the first word of an own-club name (letters only, case-insensitive) followed by digits gives that team number; no digits = team 1. Definition row: `speler` starts with an own-club name (normalized as in `ownTeamName`). Both must agree with the database's team.

**Season aggregation in the API** (`services/stats/season.ts`) from the stored figures: players by exact name (own side only), totals summed, the match list from each match's figures. The match date is the table name's date (`@db.Date`).

## Risks / Trade-offs

- [The live match table is fetched every minute (~1,600 rows, ~150 kB)] → only when its fingerprint changed; once per minute is far below the live polling the bridge already handles.
- [Names written differently count as two players] → documented in the handleiding; the stored rows allow a later rename/merge.
- [A deleted/renamed table in the database keeps its stored copy] → intended (the database is overwritten between seasons); an unwanted test table can be removed with SQL; a delete action in Beheer can follow.
- [Derivation change makes stored figures stale] → `derivationVersion`, re-derived on read.
- [Team number in the table name not following `<Club><n>`] → then it counts as team 1 and the definition row still has to name the own club; matches of other clubs never pass.

## Migration Plan

One Prisma migration adds `StatsMatch` (organization-scoped, unique on organization, team and table name). No data migration: the first sync after deploy fills it from the databases the bridges can read. Rollback: drop the table; nothing else depends on it.
