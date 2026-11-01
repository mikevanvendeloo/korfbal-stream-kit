## Why

The callsheet always shows the venue clock (zaalklok), although it only matters while the match is played: a half is 25 minutes of pure playing time, so the clock stops at every stoppage and the crew needs it then, not during the voorbeschouwing or the rust. Graphics and the crew also need to know which part of the match is on (1e helft, 2e helft, or more parts when a match has quarters), and nothing records that today.

## What Changes

- A callsheet item gets two choices: **Wedstrijddeel** (this item is a part of the match: a half or a quarter) and **Zaalklok tonen** (show the venue clock while this item runs; default off). Ticking Wedstrijddeel also ticks Zaalklok tonen (it can be unticked).
- The choices exist on template items, production callsheet items and the live items, and travel along every path that copies items (template → callsheet → LIVE, production export/import, backup, draaiboek file, the template Excel, the standard set). In the standard set the halves are match parts.
- LIVE (callsheet and show caller) shows the venue clock only while a running item (stream or hall lane) has Zaalklok tonen.
- The current match part: the number of match-part items started so far (1 = first half, 2 = second half, counting on for more parts), 0 before the first; and whether a match part is running now. Returned by `GET /api/vmix/active-production/match` as `matchPart` and `matchPartRunning`.
- Editor and handleiding updated.

## Capabilities

### New Capabilities

- `match-parts`: callsheet items marked as match part and/or showing the venue clock, the venue clock in LIVE only while such an item runs, and the current match part in the match data source.

### Modified Capabilities

## Impact

- Prisma: `isMatchPart`, `showVenueClock` (Boolean, default false) on `CallSheetTemplateItem`, `CallSheetItem`, `ProductionEvent`; one migration.
- API: callsheet templates (CRUD, apply, chapter copy, Excel), production callsheets (CRUD, sync to events), callsheet files, export/import, backup, standard set, draaiboek file schema, OpenAPI in `main.ts`, the vMix match row (`services/vmixMatch*` / `routes/vmix.ts`), a pure `services/matchParts.ts`.
- Kit: types (`useCallsheet`, `useCallSheetTemplates`, `useProductions`, `useLiveState`), editor items (`CallSheetEditPage`, `CallSheetTemplateDetailsPage`, `DraaiboekItem`), `TimeDisplay` via `CallSheetView` / `ShowCallerView`.
- Handleiding: draaiboek/callsheet editor chapter, callsheet and show caller (zaalklok), vMix data source fields.
