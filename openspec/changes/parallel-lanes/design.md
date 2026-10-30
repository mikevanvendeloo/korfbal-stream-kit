# Design: parallel-lanes

Builds on `chapters` (hoofdstukken, `layOutTimes` in `services/draaiboekFile.ts`).

## D1. Lanes from the existing flags (user)

`lane(item)`: `isInVenue && !isInLivestream` → **ZAAL**; `isInLivestream && !isInVenue` → **STREAM**; otherwise **JOIN** (samenkomstpunt). A time anchor is always JOIN. The first item of a hoofdstuk starts a new block: lanes never cross a hoofdstuk boundary. Linked items (`parentId`) follow the same rule; a link only means "belongs to / moves along".

## D2. Timing (one implementation, API)

`services/laneTimes.ts` (pure, unit tests) replaces the body of `layOutTimes` and keeps its signature (+ chapter ids and minimum durations):
- The show order is cut into **blocks**: a JOIN item is a block on its own; a maximal run of ZAAL/STREAM items between two JOINs (within one hoofdstuk) is a parallel block. Each lane in a parallel block starts at the block start and lays its items end to end; block length = the longest lane.
- Forwards from an anchor: the next block starts at the previous block's end; an anchor still starts at its own time (kickoff / live time). Backwards before the first anchor: the same blocks, laid out backwards.
- **Hoofdstuk minimum** (`minDurationSec`, nullable, on `ProductionChapter` and `CallSheetTemplateChapter`): the first block of the next hoofdstuk starts no earlier than `chapterStart + minDurationSec`. Without minimum: no change.
- Used by: Tijden herberekenen, Draaiboek toepassen, draaiboek import (production), template GET (each item's `startOffsetSec` and each hoofdstuk's start/end/overrun, relative to the kickoff), production timing (`/timing`: hoofdstuk end = max(items end, start + minimum)), reports (`liveEnds`).
- The kit no longer computes template times itself (`relativeChapterTimes` goes): it shows what the API returns and refetches after a save.

## D3. Data

Migration: `minDurationSec INT NULL` on `ProductionSegment` (model `ProductionChapter`) and `CallSheetTemplateChapter`. Applying a template copies it; the template and production hoofdstuk PUT take it; backup, production export/import and draaiboek file (`chapters[].minDurationSec`) carry it. Standard set: Eerste helft 2100, Rust 600, Tweede helft 2100. *(Not the deprecated `duurInMinuten`; that column is still dropped in release 2 of `chapters`.)*

## D4. LIVE (user: Volgend follows the stream)

- **Volgend/Vorig** step through STREAM and JOIN events only.
- A ZAAL event becomes active by itself: when its block starts (the JOIN before it ended / the first STREAM item of the block started), the first ZAAL item starts; each next ZAAL item starts when the previous one's duration is over (same mechanism as Auto, per organization, `bindOrganization`). **Zaal ›** (`POST /api/production/:id/venue-next`, Show Caller only; not a Stream Deck feed for now) moves the hall lane on by hand.
- Live state gets `activeVenueEventId` (+ its start); `liveStateSnapshot()` carries it; `stopOrganization` clears its timer.
- Hall lane done early → wait row "*Zaal klaar · volgende: …*" in the hall lane. At a JOIN while a ZAAL event still runs: the Volgend button says *Zaal nog m:ss bezig*; pressing ends it (`actualEndTime` now) and goes on.
- Callsheet per position: a ZAAL item shows active/countdown from `activeVenueEventId`; wait-row logic considers both active events. `callsheetTiming` (vMix push) treats the active venue event as current for positions that have it.
- Hoofdstuk countdown ("Hoofdstuk: Rust · nog …") ends at max(items, start + minimum).

## D5. Editor

Template and production editor: per hoofdstuk an optional **Minimale duur** (mm:ss) in the hoofdstuk header; a notice *loopt m:ss langer dan de minimale duur* when the items run longer. Items keep their Zaal/Stream labels; in a parallel block the rows show their lane (green/blue edge like the Show Caller). Times come from the API.

## D6. Tests and security

Unit: `laneTimes` (parallel block, unequal lanes, minimum, anchors forward/backward, hoofdstuk boundary, no lanes = old result). Integration: calculate-times and apply template with lanes and minimum; venue-next (404 foreign production, leak suite entry, CSRF as other writes); live state with a ZAAL lane (auto start, Zaal ›, Volgend at JOIN ends the hall item). Kit: Show Caller lanes/wait row/warning, editor minimum. One e2e: rust with two lanes.
