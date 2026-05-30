## Why

A korfbal production involves a fixed set of crew roles (commentator, presenter, camera operator, etc.) that must be filled by known persons. Matches are imported from the external competition API and can also be created manually. Skills and positions define the crew role catalog; persons are assigned to positions within each production.

## What Changes

- Match schedule import from external league API (KNKV)
- Manual match creation
- Skill and Position CRUD (crew role catalog)
- Person CRUD with skill assignments
- Club and player management (for interview title resolution)
- Segment default positions (pre-fill crew per segment type)

## Capabilities

### New Capabilities

- `match-schedule`: Import matches from external API; manual match CRUD
- `skills-positions`: Skill and Position catalog management
- `persons`: Crew member management with skill assignments
- `clubs-players`: Club and player roster management for interview subjects

### Modified Capabilities

## Impact

- `apps/korfbal-stream-api/src/routes/match.ts`
- `apps/korfbal-stream-api/src/routes/production.ts` (positions, persons sub-routes)
- `apps/korfbal-stream-api/prisma/schema.prisma` — Skill, Position, Person, Club, Player, MatchSchedule
- Frontend: `MatchSchedulePage`, `SkillsAdminPage`, `PositionsAdminPage`, `PersonsAdminPage`, `ClubsPage`
