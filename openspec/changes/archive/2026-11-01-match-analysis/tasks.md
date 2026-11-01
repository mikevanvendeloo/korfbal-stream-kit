# Tasks: match-analysis

## 1. Bridge

- [x] 1.1 `currentMatch` also returns the action rows (`rows`), still one memoized scan
- [x] 1.2 `services/matchAnalysis.ts`: halves and clock, score progression, runs, droughts
- [x] 1.3 Vakken from the lineup rows and substitutions; possessions as runs of one `opstelling`; attack/defence figures per vak and half
- [x] 1.4 Duels per pair (for/against, per half)
- [x] 1.5 Shot zones from `aktieomschrijving`, shots by type; turnovers by kind with the sign convention
- [x] 1.6 Unit tests `matchAnalysis.spec.ts` on the fixture (score equals the page's final score, vak totals add up to team totals, zones never dropped, turnover sides)
- [x] 1.7 Route `GET /analysis` (memoized `analysis`, source headers, 503 without database, 400 refused path) + `app.spec.ts`
- [x] 1.8 README: route and response

## 2. API

- [x] 2.1 `routes/stats.ts`: forward `GET /analysis`
- [x] 2.2 `stats.int.spec.ts` (forward with team, bridge 503 passes through), leak suite entry, 401 list in `security.int.spec.ts`
- [x] 2.3 `PROJECT_STRUCTURE.md` endpoint list

## 3. Kit

- [x] 3.1 `lib/statsApi.ts`: `MatchAnalysis` type and `fetchMatchAnalysis`
- [x] 3.2 `pages/AnalysisPage.tsx`: four cards, half switch, 360 px layout, offline and 503 notices, source line
- [x] 3.3 `app/LiveApp.tsx`: nav item and route `/analyse`
- [x] 3.4 `AnalysisPage.spec.tsx`: renders the cards from a fixture answer, half switch, 503 message

## 4. Docs

- [x] 4.1 Handleiding: new chapter `handleiding/live/` Analyse (what each card means, when to use it)
- [x] 4.2 `docs/claude/live-and-devices.md`: `/analysis` in the bridge routes
- [x] 4.3 Security review of the change
