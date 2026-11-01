# Tasks: callsheet-active-production

## 1. API

- [x] 1.1 Emit `active_production_changed {productionId}` to the organization after `POST /api/production/:id/activate` and after an import that activates
- [x] 1.2 Integration test: the event reaches the own organization only

## 2. Kit

- [x] 2.1 `useLiveProductionId()` and `ActiveProductionRoute` (both in `components/ActiveProductionRoute.tsx`) (provider, loading / none, `key` per production, socket listener, legacy rewrite)
- [x] 2.2 `LiveApp` routes without id; remove `LiveCallsheetEntry`
- [x] 2.3 `useLiveState`, `CallSheetView`, `ShowCallerView`, `ShowCallerPhone`, `PositionSelector`, `InterviewText`: id from the hook, links without id
- [x] 2.4 `ProductionLayout`: "Open in LIVE" only for the active production
- [x] 2.5 Specs: routes, legacy rewrite, switch on the socket event, no active production; update existing specs with ids
- [x] 2.6 e2e `live-wide.spec.ts` address

## 3. Docs

- [x] 3.1 Handleiding callsheet and show caller (addresses, bookmark); `docs/claude/live-and-devices.md`; PROJECT_STRUCTURE if routes are listed
- [x] 3.2 Security review
