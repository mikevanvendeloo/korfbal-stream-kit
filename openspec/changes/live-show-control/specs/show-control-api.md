# Spec: show-control-api

## Overview

HTTP endpoints for controlling live show progression. Operates on the active production's `ProductionEvent` list. Events move WAITING → ACTIVE → COMPLETED.

## Requirements

### Start Show
- `POST /api/show/start/:productionId`
- Finds the first event (lowest `order`)
- Sets its `status=ACTIVE`, `actualStartTime=now()`
- Starts the production clock (1-second interval)
- Recalculates all event/callsheet times from anchor
- Broadcasts: `active_event_update`, `callsheet_state_update`, `production_events_update`
- Returns `{ message, activeEvent }`

### Advance to Next
- `POST /api/show/next`
- Marks current ACTIVE event as COMPLETED
- Finds next event by `order > current.order`
- Sets next event `status=ACTIVE`, `actualStartTime=now()`
- If next event has `autoAdvance=true` and `durationSec > 0`, schedules auto-advance timer
- Broadcasts: `active_event_update`, `production_events_update`, `auto_advance_scheduled`
- Returns updated next event

### Go to Previous
- `POST /api/show/previous`
- Marks current ACTIVE event as COMPLETED
- Finds previous event by `order < current.order` (highest order below current)
- Sets previous event `status=ACTIVE`, `actualStartTime=now()`
- Broadcasts same as next

### Stop Show
- `POST /api/show/stop/:productionId`
- Stops clock interval
- Marks active event COMPLETED
- Clears `productionTime`, `scoreboardTime`, `activeEventId`
- Broadcasts: `production_stopped`, `active_event_update` (null), `callsheet_state_update`
- Returns `{ message }`

### Update Scoreboard Clock
- `POST /api/show/clock` with `{ time: "MM:SS" }`
- Parses time string into seconds and sets `scoreboardTime`
- Broadcasts: `time_state_update`

### Recalculate Times
- `POST /api/show/recalculate/:productionId` with optional `{ anchorEventId?, anchorTime? }`
- Recalculates all `ProductionEvent.plannedStartTime` and `plannedEndTime`
- Recalculates all `CallSheetItem.timeStart` and `timeEnd`
- Broadcasts: `production_events_update_needed`

### Reset Production
- `POST /api/show/reset/:productionId`
- Sets all events `status=WAITING`, clears `actualStartTime`
- Resets `liveTime` to `matchSchedule.date`
- Clears in-memory active event
- Recalculates all times with `force=true`

## Constraints

- All show control routes operate on the **currently active production** (from `productionState`)
- If no production is active, routes return 404
- Event status is unidirectional in normal flow; reset is the only way to revert to WAITING
