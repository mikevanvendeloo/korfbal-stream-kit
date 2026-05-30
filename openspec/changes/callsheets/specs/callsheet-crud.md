# Spec: callsheet-crud

## Overview

A CallSheet is a named run-of-show document within a production. It contains an ordered list of CallSheetItems (cues). Multiple callsheets can exist per production (e.g., one per team role).

## Requirements

### CallSheet CRUD
- `GET /api/production/:id/callsheets` — list callsheets for production
- `POST /api/production/:id/callsheets` with `{ name, color? }` — create; name must be unique per production
- `GET /api/production/:id/callsheets/:cid` — get with items and their position assignments
- `DELETE /api/production/:id/callsheets/:cid` — delete callsheet and all its items

### CallSheetItem CRUD
- `GET /callsheets/:cid/items` — list items ordered by `orderIndex`
- `POST /callsheets/:cid/items` with `{ title, cue?, note?, durationSec?, isInVenue, isInLivestream, isTimeAnchor, autoAdvance, orderIndex, positionIds[], productionSegmentId?, parentId? }` — create item
- `PUT /callsheets/:cid/items/:iid` — update any field; updating `positionIds` replaces all position links
- `DELETE /callsheets/:cid/items/:iid` — delete item (also cascades to linked ProductionEvent if present)

### Item Fields
| Field | Description |
|-------|-------------|
| `cue` | Short cue code (e.g., "CUE 1", "LIVE") |
| `title` | Display name shown on screen |
| `note` | Director note, not shown to all crew |
| `durationSec` | Planned duration for time calculation |
| `isInVenue` | Whether this cue is visible in venue display |
| `isInLivestream` | Whether this cue is visible in livestream display |
| `isTimeAnchor` | This item's time is the reference for calculation |
| `autoAdvance` | Auto-advance to next event when timer expires |
| `positions` | Crew positions this item is relevant for |
| `parentId` | Parent item for hierarchical nesting |

## Constraints

- At most one item per callsheet should have `isTimeAnchor=true` (not enforced by DB, enforced by frontend)
- `orderIndex` determines display order; gaps are allowed
- Position links are replaced (not merged) on PUT when `positionIds` is included
