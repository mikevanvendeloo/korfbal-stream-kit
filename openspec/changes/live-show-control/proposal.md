## Why

During a live broadcast, the production crew needs real-time control over show progression — advancing between cues, tracking elapsed time, syncing with the venue scoreboard clock, and triggering vMix graphics at the right moment. All connected clients (show caller screens, crew tablets, director display) must stay in sync without polling.

## What Changes

- Start/stop/advance/previous controls for the active production's event list
- Production clock (elapsed time since show start, broadcast via Socket.io every second)
- Scoreboard clock sync (receive venue clock time from scoreboard integration)
- Auto-advance: events that automatically trigger the next event after a configured duration
- Recalculate and reset production times
- Real-time state broadcast to all connected Socket.io clients

## Capabilities

### New Capabilities

- `show-control-api`: HTTP endpoints to start, stop, advance, and reset the live show
- `production-clock`: Server-side interval that increments `productionTime` and broadcasts state every second
- `venue-clock-sync`: Receive venue scoreboard time and propagate it to connected clients
- `auto-advance`: Schedule automatic event progression after a configurable delay
- `socketio-state-broadcast`: Socket.io events that push live state to all clients

### Modified Capabilities

## Impact

- `apps/korfbal-stream-api/src/routes/show-control.ts`
- `apps/korfbal-stream-api/src/services/productionState.ts`
- `apps/korfbal-stream-api/src/services/timeSyncService.ts`
- `apps/korfbal-stream-api/src/services/venueClockSyncService.ts`
- `apps/korfbal-stream-api/src/socket.ts`
- Frontend: `useLiveState` hook, `ShowCallerView`, `CallSheetView`, `TimeControls`
