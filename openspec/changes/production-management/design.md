## Overview

Productions are the central entity of the system. Each production is linked to exactly one MatchSchedule and acts as the container for all live-show resources. The backend stores productions in PostgreSQL via Prisma; the currently-active production's runtime state is held in memory in `productionState.ts`.

## Data Model

```
Production
  id                  Int (PK)
  matchScheduleId     Int (unique FK → MatchSchedule)
  isActive            Boolean (default false)
  liveTime            DateTime (when the stream starts; defaults to 5 min before match)
  callSheetTemplateId Int? (FK → CallSheetTemplate)
  createdAt           DateTime

ProductionSegment
  id              Int (PK)
  productionId    Int (FK → Production)
  naam            String (display name, e.g. "Eerste helft")
  volgorde        Int (unique per production)
  duurInMinuten   Int
  isTimeAnchor    Boolean (only one per production)
  createdAt       DateTime

ProductionPersonPresence  (join table)
  productionId    Int
  personId        Int

ProductionPersonPosition  (assignment table)
  id              Int (PK)
  productionId    Int
  personId        Int (FK → Person)
  positionId      Int (FK → Position)
  isStudio        Boolean
```

## API Routes

All routes under `/api/production`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/production` | List all productions (with matchSchedule), ordered by date DESC |
| POST | `/api/production` | Create production; auto-creates default segments and a "Callsheet" |
| GET | `/api/production/:id` | Get one production with matchSchedule + person-positions |
| PUT | `/api/production/:id` | Update matchScheduleId or liveTime |
| DELETE | `/api/production/:id` | Delete production and all related records |
| POST | `/api/production/:id/activate` | Activate; deactivates all others; sets productionState |
| GET | `/api/production/matches` | Returns matches suitable for production (home + manual) |
| GET | `/api/production/:id/segments` | List segments ordered by volgorde |
| POST | `/api/production/:id/segments` | Create segment (auto-inserts at position) |
| PUT | `/api/production/:id/segments/:sid` | Update segment; handles reorder via 2-phase transaction |
| DELETE | `/api/production/:id/segments/:sid` | Delete + renumber remaining |
| GET | `/api/production/:id/persons` | List present persons |
| POST | `/api/production/:id/persons` | Mark person as present |
| DELETE | `/api/production/:id/persons/:pid` | Remove person presence |
| GET | `/api/production/:id/person-positions` | List position assignments |
| POST | `/api/production/:id/person-positions` | Create assignment |
| PUT | `/api/production/:id/person-positions/:aid` | Update assignment |
| DELETE | `/api/production/:id/person-positions/:aid` | Remove assignment |
| GET | `/api/production/:id/report` | Get production report |
| POST | `/api/production/:id/report` | Upsert production report |

## Key Business Rules

**Default segments on create**: When a production is created, the API looks for a SegmentTemplate with `isDefault=true`. If found, its items are copied as segments. Otherwise, a hardcoded fallback creates 6 segments: Voorbeschouwing (20m), Oplopen (10m), Eerste helft (35m, anchor), Rust (10m), Tweede helft (35m), Nabeschouwing (20m).

**Single activation**: `POST /activate` wraps in a Prisma transaction — sets all productions `isActive=false`, then sets the target `isActive=true`. Also calls `productionState.setActiveProduction(id)` to update in-memory state.

**Segment reorder**: Changing `volgorde` uses a 2-phase approach: first bumps the conflicting segment's volgorde by 1000 (to avoid the unique constraint), then sets the desired value, then renumbers all segments sequentially to close gaps.

**liveTime**: Defaults to 5 minutes before `matchSchedule.date`. Used as the base time for callsheet time calculations.

## In-memory State

`productionState.ts` exports a singleton with:
- `productionId: number | null`
- `activeEventId: string | null`
- `clocks: { productionTime: number, scoreboardTime: number }`
- `isClockRunning: boolean`
- `broadcastState()` — emits `callsheet_state_update` via Socket.io

State persists only for the server process lifetime. On restart, all clock state is lost; the DB still holds event statuses.
