# Tasks: chapters

> Status: proposed. See design.md (D1–D9). Phases are released in order; each one leaves the app working.

## Phase 1: Schema (backend)

- [x] Migration `20261028200000_chapters_schema`: `CallSheetTemplateChapter`, `CallSheetTemplateChapterPosition`; `CallSheetTemplateItem.chapterId` (nullable); `ProductionEvent.chapterId` (nullable); `chaptersAutoPlaced` on `CallSheetTemplate` and `Production`; `organizationId` default + `enforce_same_organization` triggers on the new tables and the new references
- [x] Prisma model renames without DB change: `ProductionSegment` → `ProductionChapter`, `SegmentRoleAssignment` → `ChapterRoleAssignment` (`@@map`); all `prisma.…` references updated
- [x] *Moved to phase 3:* field renames (`naam`/`volgorde` → `name`/`orderIndex`, `CallSheetItem.productionSegmentId` → `chapterId`): they are in the API's JSON and the kit, so they change with the endpoints that are rewritten there — done in 5a (API) and 5b (kit)
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
- [x] *Moved to 3b (with the kit):* field renames `naam`/`volgorde` → `name`/`orderIndex`, `productionSegmentId` → `chapterId` — done in 5a/5b

### Frontend (3b)
- [x] `components/ChapterBoard.tsx` (hoofdstuk blocks, drag within/between with `@dnd-kit`, drag a whole hoofdstuk, rename, delete with "Items verplaatsen naar", add hoofdstuk; the page renders its own items) on pure `lib/chapterStructure.ts` (move, append, keep linked items with their parent, remove, relative template times; unit tests), used by `CallSheetTemplateDetailsPage` (times relative to the kickoff, standard positions per hoofdstuk) and `CallSheetEditPage` (derived times; new item at the end of the chosen hoofdstuk); API calls in `lib/chaptersApi.ts`. The order is changed only by dragging (the Volgorde fields are gone).
- [x] "Hoofdstukken automatisch ingedeeld — controleer de indeling" with **Indeling klopt** (saves the structure, which clears `chaptersAutoPlaced`) on the template and the production's callsheet
- [x] Production Draaiboek tab: no segment list or segment template choice; a read-only table of the hoofdstukken with their times; *Opslaan als template* from the callsheet
- [x] Segment-templates and Standaardbezetting removed from the menu (pages and routes stay until phase 5)
- [x] Crewrapport → **Callsheet** (tab, page title, link on the callsheet page, manual)
- [x] Manual: Beheer 01, 06 (rewritten: hoofdstukken, standaardbezetting, slepen, check notice, import), 07, 08, 09, 11; LIVE 02
- [x] *Moved to phase 5:* the Bezetting tab still says "segment" in its labels (with the field renames) — done in 5b

## Phase 4: LIVE (frontend)

- [x] `useLiveState` keeps the hoofdstukken (from `/events` and the socket); pure helpers in `lib/liveChapters.ts` (name, current hoofdstuk with its remaining time, planned times, heading slots; unit tests)
- [x] `ShowCallerView`: heading rows per hoofdstuk (planned start–end), "Hoofdstuk: … · nog …" at the top, dimmed headings when filtering on a position; a hidden row (focus mode) still shows its heading
- [x] `ShowCallerPhone`: hoofdstuk with its remaining time above *Nu*, and at *Volgende* when it starts another hoofdstuk (truncated for 360 px)
- [x] `CallSheetView`/`CallSheetColumn`: heading slots per hoofdstuk aligned across columns ("— niets voor jou" without own items); the wait row names the next item's hoofdstuk
- [x] LIVE → Productie: the hoofdstukken (no segment number or anchor any more)
- [x] Component tests (ShowCallerView wide and phone, CallSheetColumn); manual LIVE 03 and 04
- [x] e2e with hoofdstukken (needs `createProductionScenario({chapters})`, moved to phase 5): written in 5b (not run yet); 360 px still to check by hand

## Phase 5: Cleanup

### Backend (5a)
- [x] Field renames with `@map` (no column rename): `ProductionChapter.name`/`orderIndex`, `CallSheetItem.chapterId` (relation `chapter`), `Production.chapters`; in the API JSON too (`GET /api/production/:id/chapters` new, timing `{id, name, orderIndex, durationMinutes, start, end}`, crew report `chapters` and cells with `chapterId`, item create/update take `chapterId`); backup and production export write `chapters` + `chapterOrderIndex` and still read `segments`/`productionSegmentVolgorde` (`ChapterRestore`, `fileChapters`)
- [x] Two releases, because production still runs without hoofdstukken and all migrations run before the app starts: migration `20261030100000_chapters_cleanup` only gives the old `duurInMinuten` a default. The startup migration `migrateAllChapters` stays (time-based placement, segment templates → draaiboek templates); `SegmentTemplate`, `SegmentTemplateItem`, `SegmentDefaultPosition`, `duurInMinuten`, `isTimeAnchor` stay in the DB and schema (deprecated, read only by it); `chapterId` stays nullable, the API always sets it. `placeLegacyItems` places items of older files on restore
- [x] **Release 2, after this release ran in production**: migration `20261101100000_chapters_release_2` (was `followup-cleanup.sql`): remaining items in their parent's or a "Draaiboek" hoofdstuk, `chapterId` NOT NULL, the deprecated tables and columns dropped; schema cleaned up, startup migration `migrateAllChapters` (with `placeProductionChapters`/`placeTemplateChapters`, the `chaptersMigrated` marker and its spec) removed; older files are still converted on restore (`ChapterRestore`)
- [x] Removed: `/api/production/segment-templates/*`, `/api/production/segment-default-positions*`, `/api/production/:id/segments` (GET/POST), `/api/production/segments/:segmentId` (GET/PUT/DELETE), `GET /api/backup/segment-templates/export` (the import stays for older backups: templates with hoofdstukken only); leak suite and `createTenantScenario` updated
- [x] Standard set: draaiboek templates with hoofdstukken (Korfbal League: Voorbereiding, Voorbeschouwing, Oplopen, Eerste helft 35:00, Rust 10:00 item, Tweede helft 35:00, Nabeschouwing); no segment templates; a new production starts with these hoofdstuk names
- [x] `createProductionScenario({chapters})` (items and events in a hoofdstuk; `ScenarioItem.chapter`), integration test for old files (`services/chapterMigration.int.spec.ts`)
- [x] GLOSSARY (Segment, Volgorde retired), CLAUDE.md, PROJECT_STRUCTURE.md (API part)

- [x] Productiedraaiboek as a file: `GET /api/production/callsheets/:callSheetId/export-json` (template format v2, so production and template files import into each other), `POST …/import-json` (replaces the items; hoofdstukken by name; times from the anchor), `GET …/export-excel` (the Excel import's columns)

### Frontend (5b)
- [x] Draaiboek tab: **Draaiboek als bestand** with **Exporteer JSON**, **Exporteer Excel** and **Importeer draaiboek** (`components/DraaiboekFileActions.tsx`: confirmation first, then the number of items and the new hoofdstukken, or the API message; refetches callsheet, hoofdstukken and timing)
- [x] Kit on the new JSON (`name`/`orderIndex`/`chapterId`, `GET /:id/chapters`, timing `durationMinutes` with null times, crew report `chapters`, nullable `liveEnd`), the Bezetting tab's "segment" labels → hoofdstuk (`ChapterAssignmentsCard`, `ChapterOverridesManager`; copy now calls `/assignments/copy`); segment template / Standaardbezetting hooks and pages removed; backup *Segment-templates (oude backup)* restore only
- [x] Manual: Beheer 02, 03, 08 (Draaiboek als bestand), 09, 10, 11, 12 (06/07 and LIVE 02–04 needed no change); PROJECT_STRUCTURE.md (kit part)
- [x] e2e with hoofdstukken (`createProductionScenario({chapters})`): `live-wide.spec.ts` (headings in show order, *Hoofdstuk: …* while running). *Written, not run yet.*
