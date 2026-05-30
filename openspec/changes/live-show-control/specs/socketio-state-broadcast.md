# Spec: socketio-state-broadcast

## Overview

All live production state is pushed to clients via Socket.io. Clients never poll for show state — they subscribe to events and receive snapshots.

## Requirements

### Connection Initialization
When a client connects:
1. Server sends `callsheet_state_update` with current `LiveProductionState`
2. If `activeEventId` is set, server sends `active_event_update` with the active event's full details
3. `timeSyncService.initializeClient(socket)` sends current time state

### Heartbeat
- Server emits `heartbeat` every 2 seconds
- Payload: `{ serverTime: number }` (milliseconds since epoch)
- Used by clients to detect connection health and estimate clock drift

### LiveProductionState Shape
```typescript
{
  productionId: number | null,
  activeEventId: string | null,
  clocks: {
    productionTime: number,   // seconds elapsed since show start
    scoreboardTime: number    // seconds from venue scoreboard
  },
  isClockRunning: boolean
}
```

### Event Catalog

| Event Name | Direction | Payload | Trigger |
|-----------|-----------|---------|---------|
| `callsheet_state_update` | server→client | `LiveProductionState` | Every clock tick + any state change |
| `active_event_update` | server→client | `ProductionEvent \| null` | Active event changes |
| `production_events_update` | server→client | `{ items: ProductionEvent[] }` | Event status changes |
| `production_events_update_needed` | server→client | — | Times recalculated; clients should refetch |
| `production_stopped` | server→client | `{ productionId: number }` | Show stopped |
| `auto_advance_scheduled` | server→client | `{ eventId, delayMs, scheduledAt }` | Auto-advance timer set |
| `time_state_update` | server→client | `{ mode, serverStartTime, initialDuration, venueClock }` | Clock mode changes |
| `event_updated` | server→client | `ProductionEvent` | vMix sync activated an event |
| `heartbeat` | server→client | `{ serverTime: ms }` | Every 2 seconds |

### Active Event Sanitization
The `active_event_update` payload removes recursive relations before sending:
- Strips `parent` and `linkedItems` from event and its positions
- Normalizes position details to flat objects

## Constraints

- All broadcasts use `io.emit()` (to all connected clients), never targeted to a single socket
- The `callsheet_state_update` is emitted on every 1-second clock tick even if nothing changed — clients rely on this for clock display
- Socket.io transport: WebSocket + long-polling fallback; CORS open for internal LAN use
