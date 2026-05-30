# Spec: vmix-event-sync

## Overview

vMix can activate a specific show event when an input goes live, by calling a StreamKit HTTP endpoint with the input name. This enables automatic callsheet progression triggered by the video switcher.

## Requirements

### Activate Event by Input Name
- `GET /api/vmix/sync/activate-event?inputName=<name>`
- Finds a `ProductionEvent` where `vMixInputName` matches the query parameter (case-insensitive)
- If found:
  1. Marks the currently ACTIVE event as COMPLETED
  2. Sets the found event's `status=ACTIVE`, `actualStartTime=now()`
  3. Broadcasts `event_updated` via Socket.io
- If not found: returns 404
- Returns 200 with message "Call sheet gesynchroniseerd" on success

### Manual Trigger
- `POST /api/vmix/production/trigger-manual` with `{ eventId: string }`
- Same logic as activate-event but looks up by event ID instead of vMixInputName
- Used for manual show control from the vMix control panel page

### vMix Timer Control
- `POST /api/vmix/set-timer` with `{ seconds: number }`
- Sends HTTP GET to the configured vMix Web Controller URL: `http://<vmixUrl>/api/?Function=SetCountdown&Value=MM:SS`
- Response: `{ ok: true, seconds, vmixResponse? }`
- `vmixWebUrl` is read from the `Setting` table

## Constraints

- `vMixInputName` on `ProductionEvent` must be configured before this endpoint is useful
- If `vmixWebUrl` setting is not configured, `set-timer` returns an error
- Sync events do NOT start the production clock — they only update event status
