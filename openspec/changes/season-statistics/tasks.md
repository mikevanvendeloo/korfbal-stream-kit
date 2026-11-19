# Tasks

## 1. Shared derivation (libs/venue-protocol)

- [ ] 1.1 Move `matchActions.ts` and `matchAnalysis.ts` (with `Ratio`, `ReboundRatio`, `pct`) to `libs/venue-protocol/src/matchStats/`, export them; the bridge's files re-export, its specs stay green
- [ ] 1.2 Attack figures: `withoutAttempt` and `byAttempts` (0..4, 5+) per team, vak and half; spec in the bridge's `matchAnalysis.spec.ts`
- [ ] 1.3 Own team helpers: team number from a table name for the own club, own club in the definition row; unit specs (`Fortuna DOS46`, `DVO2 Fortuna2`, `DVO DOS46`)

## 2. Venue-bridge

- [ ] 2.1 `/matches` items also give `actionCount` and `lastActionAt` (from the memoized rows)
- [ ] 2.2 New `/matches/:table/rows`: all normalized rows of a listed table, 503 without a usable database (no page fallback); app spec

## 3. API storage and sync

- [ ] 3.1 Prisma model `StatsMatch` (organizationId, team, tableName, matchDate, ownTeam, opponentTeam, actionCount, lastActionAt, rows Json, figures Json, derivationVersion, syncedAt) + migration; tenant scope metadata
- [ ] 3.2 `services/stats/statsSync.ts`: sync per organization (connect + 60 s), fingerprints, own-team filter, skip memory, sync state; integration tests on the test database with a fake bridge
- [ ] 3.3 Re-derive stored figures when `derivationVersion` is older

## 4. API season routes

- [ ] 4.1 `services/stats/season.ts`: season range (indoorStartDate or 1 July), match list, top scorers with ranks, totals
- [ ] 4.2 `GET /api/stats/season` and `GET /api/stats/season/top-scorers` (`?limit=`, flat rows) with zod; feed route; vMix datasource entry "Statistieken: topscorers seizoen"
- [ ] 4.3 Integration tests, leak suite entries, security tests (organization isolation, key/organization required)

## 5. Kit (frontend)

- [ ] 5.1 `lib/statsApi.ts`: season types and fetch
- [ ] 5.2 LIVE Statistieken card "Seizoen": top scorers, team figures (own and opponents), match list, "niet bijgewerkt" message; 360 px; spec
- [ ] 5.3 Handleiding: LIVE Statistieken (Seizoen), Beheer vMix (datasource)

## 6. Docs and checks

- [ ] 6.1 `docs/claude/live-and-devices.md` / `docker.md` (backup note), PROJECT_STRUCTURE endpoints
- [ ] 6.2 Run the touched specs, lint, typecheck; security review of the change
