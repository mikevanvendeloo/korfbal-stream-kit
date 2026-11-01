## Why

In the rust the analist has a few minutes to tell the presenters what is happening in the match. The Statistieken page shows totals (percentages per player and per team), but totals do not explain a match: they don't show when a team fell away, which vak is struggling, which duel is lost, or where the shots come from. The statistics PC records every action with its match time, the duel (own player and direct opponent), the shot zone and every change of possession. That is enough to answer those questions directly.

## What Changes

- New LIVE page **Analyse** (`/analyse`), meant for the rust and for the analist, readable at 360 px. Four cards, each with first half vs second half where it adds something:
  1. **Verloop**: the score over the match time, runs (three or more goals in a row by one team), and per team the longest period without a goal.
  2. **Per vak**: per vak of the own team (and the opponent's vak against it) the attacks, attempts per attack, share of attacks with a goal, turnovers and rebound %.
  3. **Duels**: per own player against the direct opponent: goals/attempts for and goals/attempts against.
  4. **Schotkaart en balverlies**: goal % per zone (voor/achter/links/rechts, afstand/halve afstand) and per shot type, and turnovers by kind (steal, bal over, schotklok, onnodige fout).
- Bridge route `GET /analysis` with pure functions over the action rows of the match with the latest action. Only the database has these rows: without a usable database the route answers 503 with a clear message (the live page has no times or duels).
- API forwards `GET /api/stats/analysis` like the other statistics routes (feed with API key, leak and security suites).
- Handleiding chapter for the Analyse page.

## Capabilities

### New Capabilities

- `match-analysis`: match analysis derived from the action rows of the statistics database (score progression, runs, droughts, per vak, duels, shot zones, turnovers by kind), served by the statistics bridge and shown on the LIVE page Analyse.

### Modified Capabilities

## Impact

- `apps/statistics-bridge/src/services/matchAnalysis.ts` (new, pure), `services/currentPlayers.ts` (`currentMatch` also hands the action rows), `app.ts` (route)
- `apps/korfbal-stream-api/src/routes/stats.ts`, `leak.int.spec.ts`, `security.int.spec.ts`, `routes/stats.int.spec.ts`
- `apps/korfbal-stream-kit`: `lib/statsApi.ts`, new `pages/AnalysisPage.tsx`, `app/LiveApp.tsx` (nav + route), `handleiding/live/` (new chapter)
- Docs: `docs/claude/live-and-devices.md`, bridge README, `PROJECT_STRUCTURE.md`
- No database or Prisma changes; no new settings.
