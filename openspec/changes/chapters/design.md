# Design: chapters

Decisions marked *(user)* were made with the product owner (2026-10-28). Term: **Hoofdstuk** (GLOSSARY.md); in code `Chapter`.

## D1. One timeline: the draaiboek with hoofdstukken (user)

- A draaiboek (template or production) is an ordered list of **hoofdstukken**, each holding an ordered list of items. **Every item is in exactly one hoofdstuk**; there are no loose items *(user)*. A *Voorbereiding* hoofdstuk holds the checks before the stream (cables, audio, thumbnail).
- A hoofdstuk has **no duration, start or anchor of its own** *(user)*. Its start is the calculated start of its first item, its end the latest calculated end of its items, its duration the difference. Linked items (`parentId`) run in parallel with their parent and are always in the parent's hoofdstuk.
- The time anchor stays on an item (`isTimeAnchor` + `anchorType` `MATCH_START` / `LIVESTREAM_START`), with the existing calculation (`production-callsheets.ts`, `recalculateProductionTimes`). The segment anchor goes away.
- **End of the livestream** = the latest planned end of the production's items (instead of `liveTime` + the sum of the segment durations). It is used by `dayPlanning.liveEnd`, the reports and LIVE → Productie. Without items it is unknown (shown as "—").
- Fixed lengths are items, not hoofdstuk properties *(user)*: at Korfbal League matches the *Rust* is 10 minutes and each half about 35 minutes. The standard set has an item *Eerste helft* (35:00), *Rust* (10:00) and *Tweede helft* (35:00) in those hoofdstukken.

## D2. Data model

Templates (new):

```prisma
model CallSheetTemplateChapter {
  id         String @id @default(cuid())
  templateId Int
  name       String
  orderIndex Int
  items      CallSheetTemplateItem[]
  positions  CallSheetTemplateChapterPosition[]   // standard positions of the hoofdstuk, in order
  organizationId Int @default(dbgenerated("missing_organization_id()"))
  @@unique([templateId, orderIndex])            // reorders rewrite the whole template in one transaction (D4)
}
model CallSheetTemplateChapterPosition { chapterId String; positionId Int; orderIndex Int; organizationId … }
// CallSheetTemplateItem: + chapterId String (required after migration); orderIndex = place within the hoofdstuk
```

Production (existing tables, renamed in Prisma only, so no data is copied):

```prisma
model ProductionChapter {            // @@map("ProductionSegment")
  name       String  @map("naam")
  orderIndex Int     @map("volgorde")
  // duurInMinuten, isTimeAnchor: kept until phase 5, then dropped
  items      CallSheetItem[]
  events     ProductionEvent[]
  assignments ChapterRoleAssignment[]   // @@map("SegmentRoleAssignment"): the bezetting per hoofdstuk stays
}
// CallSheetItem.productionSegmentId → chapterId (@map), required after migration
// ProductionEvent: + chapterId (nullable for events without a callsheet item, e.g. manual log entries)
```

- `SegmentTemplate`, `SegmentTemplateItem` and `SegmentDefaultPosition` are removed in phase 5. The `organizationId` and `enforce_same_organization` triggers are added to the new tables, as for every tenant table.
- The flat show order (`ProductionEvent.order`, `CallSheetItem.orderIndex` as LIVE reads it) = hoofdstuk order, then the item's place within it. It is computed on every write by one function (`flattenChapters`), never edited by hand.

## D3. Applying a draaiboek template

`POST /api/production/:id/apply-template/:templateId` (replace, as now) creates in one transaction:
- the production's hoofdstukken (name and order) from the template; existing hoofdstukken are replaced;
- the items with `chapterId` and the events with `chapterId`;
- the bezetting defaults: the template hoofdstuk's standard positions become the production hoofdstuk's suggested positions (what *Standaardbezetting per segment* did through the segment name). Existing assignments of hoofdstukken with the same name are kept.

The separate *segment template* choice and its endpoints (`/api/production/segment-templates/*`, `/segment-default-positions`) go away. *Opslaan als template* from a production copies its hoofdstukken, items and standard positions.

## D4. Editing: one editor, whole-structure writes

- API, for templates and productions alike:
  - `POST/PUT/DELETE …/chapters[/:chapterId]` (name; delete only when empty, else 409 "Hoofdstuk is niet leeg");
  - `PUT …/structure` with `{chapters: [{id, itemIds: [...]}]}`: the whole order in one transaction. It validates that every item of the draaiboek occurs exactly once and that linked items stay with their parent. No two-phase `volgorde` bump.
  - Item create/update takes `chapterId` (required).
- Kit: `components/DraaiboekEditor.tsx` (shared by `CallSheetTemplateDetailsPage` and `CallSheetEditPage`). Hoofdstukken are collapsible blocks whose header shows the name, the calculated start–end (relative to the anchor in a template, absolute in a production), the duration, the standard positions and "+ item". "+ hoofdstuk" sits at the bottom. With `@dnd-kit` (already used) you drag items within and between hoofdstukken, and a whole hoofdstuk by its header. Deleting a non-empty hoofdstuk asks "Items verplaatsen naar …?".
- The segment list and the segment template choice on the production's Draaiboek tab go away; the editor shows the hoofdstukken.

## D5. LIVE: hoofdstukken are headings, not steps (user: Show Caller and callsheet)

- The live snapshot (`liveStateSnapshot`) gets `chapters: [{id, name, order}]`; each event carries `chapterId`. Clients derive each hoofdstuk's planned start and end from the events, and the remaining time of the current hoofdstuk from the clocks.
- **Show control does not change**: start, next, previous, auto-advance and the Stream Deck routes work per item. A hoofdstuk is never active by itself.
- **Show Caller, wide** (`ShowCallerView`): a heading row before the first item of each hoofdstuk (name, planned start–end), and at the top "Hoofdstuk: Eerste helft · nog 12:30". When a position is chosen, headings without items for that position are still shown, dimmed.
- **Show Caller, phone** (`ShowCallerPhone`, 360 px): a small hoofdstuk label above *Nu*. At *Straks* the label appears only when the next item is in another hoofdstuk. Labels truncate; the controls stay fixed at the bottom.
- **Callsheet per position** (`CallSheetView`/`CallSheetColumn`):
  - heading rows between the hoofdstukken;
  - a hoofdstuk without items for the position becomes one thin line ("Rust — niets voor jou");
  - the wait row names the hoofdstuk ("Volgende: Interview coach (Nabeschouwing)").
  - In two or three columns the heading rows align like the item slots (the `allTimes` slots get a heading slot per hoofdstuk).
- LIVE → Productie: the timing list shows the hoofdstukken with their derived start and end (instead of the segments).

## D6. Reports

- **Callsheet** (renamed from "Crewrapport"): the hoofdstukken are the columns, and items are grouped by their hoofdstuk (no longer by `productionSegmentId`, which was empty for template items).
- **Tijdsanalyse**: a subtotal per hoofdstuk (planned against actual).
- **Productierapport** (PDF, Markdown): the timing table per hoofdstuk.
- **Entertainmentrollen / Crewrollen**: the per-segment bezetting becomes per hoofdstuk (same table).
- **Dagplanning**: `liveEnd` per D1.

## D7. Migration (user: migrate the current segments into the draaiboek templates)

A data migration in code (`services/chapterMigration.ts`). It runs at startup per organization (`runWithOrganization`), like `migrateLogoStorage`, after the schema migration. It is idempotent: it only touches draaiboeken without hoofdstukken. The placement logic is one pure function, `placeItemsInChapters(windows, items)`, with unit tests:

- An item belongs to the window that contains its start. Items **before the first window** go to a new hoofdstuk **Voorbereiding** at the front; items **after the last window** go to the last hoofdstuk. Linked items follow their parent. Items without a time take the hoofdstuk of the item before them (or the first).
- **Productions**: the existing `ProductionSegment`s become the hoofdstukken (same rows, D2). The windows come from the current timing calculation (anchor segment at the match start, see `production-timing.ts`). Item times are laid out from the **match start anchor** (*Start wedstrijd*) when the draaiboek has one, the same zero point as the segments. The app's own calculation starts from the first anchor, often *Livestream starten*, which would put pre-show items after the kickoff. A draaiboek without an anchor uses the stored `timeStart`. The stored times are not changed. Events take the hoofdstuk of their callsheet item, or are placed by `plannedStartTime`. A production with items but no segments gets one hoofdstuk *Draaiboek*.
- **Draaiboek templates**: a template doesn't know its segment template, so the migration uses the organization's **default segment template** (`isDefault`, else the first). Windows are relative to the match start (anchor segment at 0). Items are relative to their `MATCH_START` anchor; with only a `LIVESTREAM_START` anchor, livestream = match − 5 min (the default `liveTime` of a new production). The segment template's standard positions (`SegmentDefaultPosition`, by segment name) become the hoofdstuk's standard positions.
- Other segment templates (not the default) are kept as draaiboek templates with only hoofdstukken (no items), named "<naam> (hoofdstukken)", so nothing is lost; they can be deleted in Beheer.
- **Check**: every migrated template and every production *with a future match* gets `chaptersAutoPlaced = true`. Beheer shows "Hoofdstukken automatisch ingedeeld — controleer de indeling" until the editor is saved. Past productions are not flagged (their reports stay as they were).
- **Backups / production exports in the old format** (segments with durations, items without hoofdstuk, segment templates) are converted on restore with the same function. Segment templates in an old backup become templates with hoofdstukken only, as above.

## D8. Phases (each releasable)

1. **Schema add** (nothing removed): new tables and columns, nullable; Prisma renames with `@map`.
2. **Migration** (D7) + read paths: timing, LIVE snapshot, reports derive from hoofdstukken.
3. **Write paths and editor** (D3, D4): apply template, structure endpoints, DraaiboekEditor; segment template pages hidden.
4. **LIVE** (D5): Show Caller wide and phone, callsheet, Productie.
5. **Cleanup**: drop `SegmentTemplate*`, `SegmentDefaultPosition`, `duurInMinuten`/`isTimeAnchor` on chapters; `chapterId` NOT NULL; standard set with hoofdstukken; old routes removed (and from the leak suite).

## D9. Tests and security

- Unit: `placeItemsInChapters` (boundaries, Voorbereiding, linked items, no times, two anchors), `flattenChapters`, chapter timing.
- Integration (test db): migration of a production and a template from a `createProductionScenario` with segments (extend the builder with `chapters`), apply template, structure endpoint (missing/duplicate item → 400, foreign item → 404), delete a non-empty hoofdstuk → 409, backup round trip incl. an old-format backup.
- Leak suite: every new route in `ROUTES`; tenant isolation of the new tables in `createTenantScenario`. Security review after each phase (no raw SQL; the migration runs per organization in its context).
- Kit: DraaiboekEditor (drag between hoofdstukken), ShowCallerView/Phone and CallSheetColumn heading rows (360 px), wait row with the hoofdstuk.
- e2e: the `liveShow` fixture with hoofdstukken; the Show Caller shows the current hoofdstuk; the phone stays 360 px wide.
- Manual: Beheer 06 (draaiboek-templates), 07, 08 (draaiboek), 09 (bezetting), 11 (rapportages); LIVE 03 (callsheet), 04 (Show Caller), 02 (Productie). Remove the segment template and Standaardbezetting chapters.
