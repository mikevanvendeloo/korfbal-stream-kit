## Why

A production needs structured run-of-show documents that different crew members can view in their role-specific way. Callsheets list cues/items with timing, position assignments, and audio/video flags. They must support templates for reuse, time calculations anchored to the match start, and sync with the live event list.

## What Changes

- CallSheet CRUD within a production
- CallSheetItem CRUD (cues with timing, positions, flags)
- Time calculation based on segment anchors
- Callsheet templates (reusable structure)
- Callsheet-to-events sync (promote callsheet items to ProductionEvents)
- Segment assignment manager (crew assigned per segment per position)

## Capabilities

### New Capabilities

- `callsheet-crud`: CallSheet and CallSheetItem creation, editing, reordering
- `callsheet-time-calculation`: Calculate item times from segment anchor
- `callsheet-templates`: Reusable callsheet structures that can be cloned to new productions
- `callsheet-event-sync`: Sync callsheet items to ProductionEvents

### Modified Capabilities

## Impact

- `apps/korfbal-stream-api/src/routes/production/` — callsheet sub-routes
- `apps/korfbal-stream-api/prisma/schema.prisma` — CallSheet, CallSheetItem models
- Frontend: `CallSheetEditPage`, `CallSheetTemplatesPage`, `useCallsheet`, `useCallSheetTemplates`
