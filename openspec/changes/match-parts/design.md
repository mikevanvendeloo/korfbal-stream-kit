## Context

Item flags (`isInVenue`, `isInLivestream`, `isTimeAnchor`, `anchorType`) live on three models: `CallSheetTemplateItem` (template), `CallSheetItem` (a production's callsheet) and `ProductionEvent` (the LIVE item), and are copied along every path: applying a template, syncing a callsheet to the live items, production export/import, backup, the draaiboek file, the template Excel, the chapter copy, the standard set. `TimeDisplay` (callsheet and show caller) always shows the venue clock. `GET /api/vmix/active-production/match` returns one flat row for vMix.

## Decisions

1. **Two booleans, not one.** `isMatchPart` and `showVenueClock` (default false) on all three models. The venue clock can be wanted outside a match part (e.g. a time-out item), and a match part could do without it. The editor ticks `showVenueClock` when `isMatchPart` is ticked (UI only; the API stores what it gets).
2. **Copied like `isInVenue`.** Every place that copies `isInVenue` copies both new fields. Files and imports without them read as false (old exports, backups and Excel files stay valid). The template Excel gets two columns at the end, "Wedstrijddeel" and "Zaalklok" (JA/NEE); a file without them imports as NEE.
3. **Standard set.** The items that are the halves ("Eerste helft", "Tweede helft", "Wedstrijd (1e helft)", "Wedstrijd (2e helft)") get both flags. Existing productions are not migrated: the editor sets them.
4. **Venue clock in LIVE.** `TimeDisplay` shows the Zaal clock only when the running stream item or the running hall item has `showVenueClock`. Otherwise the slot is left out (the other clocks keep their place).
5. **Match part from the item statuses** (`services/matchParts.ts`, pure): the live items in draaiboek order; `matchPart` = how many match-part items have started (status ACTIVE or COMPLETED); `matchPartRunning` = one of them is ACTIVE. 0 / false before the first. No extra state: it follows Volgend/Vorig and survives a restart of the API.
6. **In the match data source.** `GET /api/vmix/active-production/match` adds `matchPart` (number) and `matchPartRunning` (boolean); without an active production 0 and false.

## Risks / Trade-offs

- [Existing draaiboeken have no match parts] → the clock is hidden until someone ticks the items; the handleiding says so, and the standard set has them.
- [Many copy paths] → one integration test per path family (template → callsheet → events, export/import, backup).
