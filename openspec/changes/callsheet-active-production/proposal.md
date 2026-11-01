## Why

The crew bookmarks their callsheet on their own phone or tablet. Today the address holds the production (`/callsheet/12/camera-links`), and `/callsheet` redirects to it. A bookmark therefore points at last week's production, and when the show caller activates another production, every screen keeps showing the old one until someone reloads and chooses again. There is only one active production per organization, so the callsheet should simply always show that one.

## What Changes

- LIVE addresses without a production: `/callsheet` (position choice), `/callsheet/<positie>`, `/show-caller` (all items) and `/show-caller/<positie>`. No redirect to an address with a production id.
- These screens always show the active production of the organization. Without one: "Geen actieve productie".
- When another production is activated, the API emits `active_production_changed` to the organization; every open callsheet and show caller switches to it without a reload.
- Old bookmarks (`/callsheet/12/camera-links`, `/show-caller/12/all`, `/callsheet/12`) are rewritten once to the new address without the id.
- Beheer: "Open in LIVE" only for the active production; for another production it says the production must be activated first.

## Capabilities

### New Capabilities

- `callsheet-active-production`: the LIVE callsheet and show caller always follow the organization's active production, with addresses without a production id and a live switch when the active production changes.

### Modified Capabilities

## Impact

- API: `routes/production.ts` (activate), `routes/production/production-export-import.ts` (import as active): emit `active_production_changed`.
- Kit: `app/LiveApp.tsx` (routes), new `components/ActiveProductionRoute.tsx` (provider, `useLiveProductionId()`, legacy rewrite); `useLiveState`, `CallSheetView`, `ShowCallerView`, `ShowCallerPhone`, `PositionSelector`, `InterviewText` take the id from it; `LiveCallsheetEntry` goes; `ProductionLayout` link.
- Tests: kit specs for routes and the switch; API integration test for the event; e2e `live-wide.spec.ts` address.
- Handleiding: callsheet and show caller chapters (addresses, bookmark).
