## Overview

Show control operates on the active production's `ProductionEvent` list. Events progress through WAITING → ACTIVE → COMPLETED. The server maintains a clock interval (`setInterval`) that increments `productionTime` every second and broadcasts the full state via Socket.io.

## Data Model

```
ProductionEvent
  id              String (UUID, PK)
  productionId    Int (FK → Production)
  title           String
  order           Int (sort key)
  status          EventStatus (WAITING | ACTIVE | COMPLETED)
  actualStartTime DateTime?
  plannedStartTime DateTime?
  plannedEndTime  DateTime?
  durationSec     Int? (if set, enables auto-advance)
  note            String?
  triggerSource   TriggerSource (VMIX | MANUAL | AUTO)
  vMixInputName   String? (for vMix sync)
  isTimeAnchor    Boolean
  autoAdvance     Boolean
  parentId        String? (FK → ProductionEvent, for hierarchical events)
  callSheetItemId Int? (FK → CallSheetItem)
```

## Show Control Routes (`/api/show`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/show/start/:productionId` | Start show — activates first event, starts clock |
| POST | `/api/show/next` | Advance to next event by order |
| POST | `/api/show/previous` | Go back to previous event by order |
| POST | `/api/show/stop/:productionId` | Stop show — clears state, marks active event COMPLETED |
| POST | `/api/show/clock` | Body `{ time: "MM:SS" }` — update scoreboardTime |
| POST | `/api/show/recalculate/:productionId` | Recalculate all event/callsheet times from anchor |
| POST | `/api/show/reset/:productionId` | Reset all events to WAITING, clear times |

## Clock Architecture

```
Server                          Clients
  │                               │
  ├── setInterval (1000ms)        │
  │     productionTime++          │
  │     broadcastState()          │
  │           │                   │
  │           └─── Socket.io ─────► callsheet_state_update
  │                                  { productionId, activeEventId,
  │                                    clocks: { productionTime, scoreboardTime },
  │                                    isClockRunning }
  │
  ├── heartbeat (2000ms) ─────────► { serverTime: timestamp }
```

## Socket.io Events

| Event | Payload | When |
|-------|---------|------|
| `callsheet_state_update` | `LiveProductionState` | Every clock tick + any state change |
| `active_event_update` | `ProductionEvent \| null` | When active event changes |
| `production_events_update` | `{ items: ProductionEvent[] }` | When event statuses change |
| `production_events_update_needed` | — | Signal clients to refetch (times changed) |
| `production_stopped` | `{ productionId }` | When show is stopped |
| `auto_advance_scheduled` | `{ eventId, delayMs, scheduledAt }` | When auto-advance timer is set |
| `time_state_update` | `{ mode, serverStartTime, initialDuration, venueClock }` | Clock mode changes |
| `event_updated` | `ProductionEvent` | vMix sync triggered an event change |
| `heartbeat` | `{ serverTime: ms }` | Every 2 seconds |

## Auto-Advance Logic

If a `ProductionEvent` has `autoAdvance=true` and `durationSec > 0`:
1. On event activation, a `setTimeout` is set for `durationSec * 1000` ms
2. On expiry, `next()` is called automatically (same as `POST /show/next`)
3. Timer is cancelled if `stop()` or manual `next()`/`previous()` is called first
4. `auto_advance_scheduled` is broadcast so clients can show a countdown

## Time Recalculation

`POST /show/recalculate/:productionId` recalculates all times:
1. Finds the anchor event: explicit `anchorEventId` → current active event → first event with `isTimeAnchor=true` → first event
2. Sets anchor's `plannedStartTime` to its `actualStartTime` (or `production.liveTime`)
3. Walks forward: each subsequent event's `plannedStartTime = previous.plannedEndTime`
4. Walks backward: each preceding event's `plannedEndTime = next.plannedStartTime`
5. Same logic applies to CallSheetItems via `calculate-times` endpoint
6. Broadcasts `production_events_update_needed`

## Client Initialization

On Socket.io `connect`:
1. Server calls `timeSyncService.initializeClient(socket)` — sends current time state
2. Server sends `callsheet_state_update` with current `LiveProductionState`
3. If `activeEventId` is set, sends `active_event_update` with that event
