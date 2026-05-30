## Why

The StreamKit needs a way to represent a live korfbal broadcast as a structured entity — linking a match schedule entry to the crew, timeline, and technical resources needed to produce the show. Productions are the central organizing object that all other features (callsheets, events, crew, vMix titles) attach to.

## What Changes

- CRUD for Production records, each linked to exactly one MatchSchedule entry
- Production activation (only one active at a time)
- Segment management within a production (ordered time blocks like "Voorbeschouwing", "Eerste helft")
- Person presence tracking (crew members marked present for the production)
- Person-position assignments (crew assigned to named roles like "Commentator", "Presenter")
- Production metadata (liveTime, callsheet template, report data)
- Import/export of complete production packages

## Capabilities

### New Capabilities

- `production-crud`: Create, read, update, delete productions linked to match schedules
- `production-activation`: Activate a production (deactivating all others); ties in-memory state to the active production
- `production-segments`: Ordered time segments within a production (volgorde, duration, time anchor)
- `production-crew`: Persons present in a production and assigned to positions
- `production-report`: Production metadata report (match sponsor, interview rationale, remarks)

### Modified Capabilities

## Impact

- `apps/korfbal-stream-api/src/routes/production.ts` — main route file
- `apps/korfbal-stream-api/src/services/productionState.ts` — in-memory active state
- `apps/korfbal-stream-api/prisma/schema.prisma` — Production, ProductionSegment, ProductionEvent models
- Frontend pages: ProductionsAdminPage, ProductionDetailPage, ProductionAttendancePage
