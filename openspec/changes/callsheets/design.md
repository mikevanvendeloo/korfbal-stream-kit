## Overview

A Production can have multiple CallSheets (e.g., "Callsheet", "Technisch"). Each callsheet contains CallSheetItems — individual cues with timing, crew positions, and flags. Items support parent-child nesting. Time calculation is driven by an anchor item (matching the production's time anchor segment).

## Data Model

```
CallSheet
  id              Int (PK)
  productionId    Int (FK → Production)
  name            String (unique per production)
  color           String?
  createdAt/updatedAt DateTime

CallSheetItem
  id              Int (PK)
  callSheetId     Int (FK → CallSheet)
  productionSegmentId Int? (FK → ProductionSegment)
  cue             String?
  title           String
  note            String?
  color           String?
  timeStart       DateTime?
  timeEnd         DateTime?
  durationSec     Int?
  orderIndex      Int
  isInVenue       Boolean
  isInLivestream  Boolean
  isTimeAnchor    Boolean
  anchorType      String?
  autoAdvance     Boolean
  parentId        Int? (FK → CallSheetItem)
  createdAt/updatedAt DateTime
  positions       Position[] (M2M)
```

## API Routes

All under `/api/production/:id/callsheets`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/callsheets` | List all callsheets for production |
| POST | `/callsheets` | Create callsheet |
| GET | `/callsheets/:cid` | Get callsheet with items (incl. positions) |
| DELETE | `/callsheets/:cid` | Delete callsheet + items |
| POST | `/callsheets/:cid/calculate-times` | Recalculate item times |
| GET | `/callsheets/:cid/items` | List items |
| POST | `/callsheets/:cid/items` | Create item |
| PUT | `/callsheets/:cid/items/:iid` | Update item |
| DELETE | `/callsheets/:cid/items/:iid` | Delete item |

Template routes under `/api/admin/callsheets/templates`:
| GET | `/templates` | List all templates |
| POST | `/templates` | Create template |
| GET | `/templates/:id` | Get template with items |
| PUT | `/templates/:id` | Update template |
| DELETE | `/templates/:id` | Delete template |

## Time Calculation

`POST /callsheets/:cid/calculate-times`:
1. Finds the item with `isTimeAnchor=true`
2. The anchor's `timeStart` is set to `production.liveTime` + sum of preceding segment durations
3. Walks backwards from anchor: each preceding item's `timeEnd = next.timeStart`, `timeStart = timeEnd - durationSec`
4. Walks forwards from anchor: each following item's `timeStart = previous.timeEnd`, `timeEnd = timeStart + durationSec`
5. Saves all updated items

## Event Sync

`POST /callsheets/:cid/sync-to-events` promotes callsheet items to `ProductionEvent` records:
- Each item becomes an event with matching `title`, `order`, `durationSec`, `autoAdvance`, `isTimeAnchor`
- Existing events are updated; items without events get new events created
- `callSheetItemId` on events links back to the source item

## Segment Assignments

`SegmentRoleAssignment` (join table) records which person fills which position in which segment:
```
id, productionSegmentId, personId, positionId
```
Routes under `/api/production/:segmentId/assignments`:
- GET, POST, PUT, DELETE

The frontend's `SegmentAssignmentsPage` copies assignments across segments.
