# Tasks: chapters

> Status: proposed. See design.md (D1–D9). Phases are released in order; each one leaves the app working.

## Phase 1: Schema (backend)

- [x] Migration `20261028200000_chapters_schema`: `CallSheetTemplateChapter`, `CallSheetTemplateChapterPosition`; `CallSheetTemplateItem.chapterId` (nullable); `ProductionEvent.chapterId` (nullable); `chaptersAutoPlaced` on `CallSheetTemplate` and `Production`; `organizationId` default + `enforce_same_organization` triggers on the new tables and the new references
- [x] Prisma model renames without DB change: `ProductionSegment` → `ProductionChapter`, `SegmentRoleAssignment` → `ChapterRoleAssignment` (`@@map`); all `prisma.…` references updated
- [ ] *Moved to phase 3:* field renames (`naam`/`volgorde` → `name`/`orderIndex`, `CallSheetItem.productionSegmentId` → `chapterId`): they are in the API's JSON and the kit, so they change with the endpoints that are rewritten there
- [x] `createTenantScenario` covers the new tables (template hoofdstuk with a standard position, event in its hoofdstuk); security test: the triggers refuse a hoofdstuk of another organization

## Phase 2: Migration and read paths (backend)

- [x] `services/chapters.ts` (pure, unit tests): `segmentWindows`, `sequentialStarts` (match start anchor preferred), `placeItemsInChapters` (boundaries, Voorbereiding, after the last, linked items, items without time), `chapterTime`. *`flattenChapters` moved to phase 3 (write paths).*
- [x] `services/chapterMigration.ts`: productions (segments → hoofdstukken, items/events placed, *Voorbereiding* in front, *Draaiboek* fallback, flag for future matches) and templates (default segment template, standard positions by name, other segment templates once as templates with hoofdstukken only); startup per organization (`migrateAllChapters` in main.ts), idempotent
- [x] Until phase 3: apply template, sync to LIVE, backup restore and production import call `placeProductionChapters` for what they create without a hoofdstuk; sync to LIVE copies the item's hoofdstuk to its event
- [x] Timing derived from items (`services/productionTiming.ts`): `GET /api/production/:id/timing` (same shape), the end of the livestream (`liveEnds`: latest item end, else live + segment durations) in the reports, the day planning, the production report (PDF/Markdown/WhatsApp) and `/api/production/active` (`liveEnd`, used by LIVE → Productie). *The crew report already groups by the item's hoofdstuk, which the migration now sets.*
- [x] LIVE: `GET /api/production/:id/events` and the `production_events_update` socket event carry `chapters` (id, name, order); every event has its `chapterId`
- [x] Backup / production import of the old format: placed by the same function after the restore (the backup already carries segments and item → segment)
- [x] Integration test `services/chapterMigration.int.spec.ts` (own organization): production with Voorbereiding/after-last/events, template from the match start anchor with standard positions, kept segment template, idempotent second run, derived timing and LIVE chapters. *`createProductionScenario({chapters})` moved to phase 3; `segments` now accepts `isTimeAnchor`.*

## Phase 3: Write paths and editor

### Backend (3a)
- [x] Apply draaiboek template: the production gets the template's hoofdstukken (a hoofdstuk with the same name stays, with its bezetting), items and events with their hoofdstuk; the standard positions per hoofdstuk come from the template (`/segments/:id/positions`, fallback the old per-name defaults)
- [x] Templates: `POST /:id/chapters`, `PUT|DELETE /chapters/:chapterId` (name, standard positions; delete non-empty → 409), `PUT /:id/structure`; `GET /:id` with `chapters`; item create/update take `chapterId` (same template, else the last item's hoofdstuk)
- [x] Productions: `POST /:id/chapters`, `PUT|DELETE /chapters/:chapterId`, `PUT /callsheets/:callSheetId/structure` (production's hoofdstuk order + that callsheet's items); a callsheet item is always in a hoofdstuk of its own production (the old check allowed any segment); items are listed by `orderIndex` (one flat show order) instead of by segment id
- [x] `flattenChapters` / `structureProblem` (pure, unit tests): every hoofdstuk and item exactly once, linked items with their parent. *`orderIndex` stays one flat order over the whole draaiboek, so every existing reader keeps working.*
- [x] *Opslaan als template*: `POST /api/callsheets/templates/from-callsheet/:callSheetId` copies hoofdstukken, items (positions, anchors, links) and the standard positions of the production's template
- [x] Template export/import: JSON version 2 (hoofdstukken with positions, item → hoofdstuk), Excel column "Hoofdstuk"; files without hoofdstukken are placed as the migration does; the callsheet Excel import also reads "Hoofdstuk"
- [x] Leak suite entries for every new route; integration test `routes/chapters.int.spec.ts`
- [ ] *Moved to 3b (with the kit):* field renames `naam`/`volgorde` → `name`/`orderIndex`, `productionSegmentId` → `chapterId`

### Frontend
- [ ] `components/DraaiboekEditor.tsx` (hoofdstuk blocks, drag within/between, drag a whole hoofdstuk, standard positions in the header, "Items verplaatsen naar …?") used by `CallSheetTemplateDetailsPage` and `CallSheetEditPage`
- [ ] Production Draaiboek tab: no segment list or segment template choice; the "controleer de indeling" notice while `chaptersAutoPlaced`
- [ ] Remove the Segment-templates and Standaardbezetting pages from the menu (`adminPaths`, AdminApp)
- [ ] Rename Crewrapport → **Callsheet** (tab, page, manual)

## Phase 4: LIVE (frontend)

- [ ] `ShowCallerView`: heading rows per hoofdstuk, current hoofdstuk with remaining time at the top, dimmed headings when filtering on a position
- [ ] `ShowCallerPhone`: hoofdstuk label above *Nu* (and at *Straks* on a change of hoofdstuk); check at 360 px
- [ ] `CallSheetView`/`CallSheetColumn`: heading rows, folded hoofdstuk without own items, heading slots aligned across columns; wait row names the hoofdstuk
- [ ] LIVE → Productie: timing per hoofdstuk
- [ ] Component tests (test data in `src/test/showCaller.ts` with hoofdstukken); e2e: current hoofdstuk in the Show Caller, phone width

## Phase 5: Cleanup

- [ ] Migration: drop `SegmentTemplate`, `SegmentTemplateItem`, `SegmentDefaultPosition`, `ProductionChapter.duurInMinuten`/`isTimeAnchor`; `chapterId` NOT NULL on template items and callsheet items
- [ ] Remove the segment template / default position routes, hooks and pages (and their leak suite entries)
- [ ] Standard set: draaiboek templates with hoofdstukken (Voorbereiding, Voorbeschouwing, Oplopen, Eerste helft 35:00, Rust 10:00, Tweede helft 35:00, Nabeschouwing); no segment templates
- [ ] Manual: Beheer 06, 07, 08, 09, 11 and LIVE 02, 03, 04; GLOSSARY: retire *Segment* and *Volgorde*; CLAUDE.md (segment ordering convention, time anchoring) and PROJECT_STRUCTURE.md
