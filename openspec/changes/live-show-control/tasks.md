# Tasks: live-show-control

> Status: COMPLETE — All tasks implemented. This is a reverse-generated spec.

## Backend

- [x] `socket.ts` — Socket.io server with CORS, dual transport, heartbeat
- [x] `productionState.ts` — singleton with clock interval, broadcastState, auto-advance timer
- [x] `timeSyncService.ts` — time sync and client initialization
- [x] `venueClockSyncService.ts` — venue scoreboard clock sync
- [x] `POST /api/show/start/:id` — start show, activate first event
- [x] `POST /api/show/next` — advance to next event
- [x] `POST /api/show/previous` — go back to previous event
- [x] `POST /api/show/stop/:id` — stop show, clear state
- [x] `POST /api/show/clock` — update scoreboard time
- [x] `POST /api/show/recalculate/:id` — recalculate all times
- [x] `POST /api/show/reset/:id` — reset all events to WAITING

## Frontend

- [x] `useLiveState` hook — Socket.io subscription, LiveProductionState management
- [x] `ShowCallerView` component — live cue display driven by socket state
- [x] `CallSheetView` component — per-position live callsheet driven by socket state
- [x] `TimeControls` component — start/stop/next/previous buttons
- [x] `ActiveProductionPage` — production overview with live clock display
