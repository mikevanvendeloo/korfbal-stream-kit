## Overview

vMix integration covers two directions: **outbound** (StreamKit pushes data to vMix via HTTP data sources) and **inbound** (vMix calls StreamKit to advance the show when an input goes live). Title templates define what person names appear in lower-thirds, with configurable data sources per title part.

## Data Model

```
TitleDefinition
  id          Int (PK)
  productionId Int? (null = global template)
  name        String
  order       Int
  enabled     Boolean

TitlePart
  id                Int (PK)
  titleDefinitionId Int (FK)
  sourceType        TitlePartSourceType
  teamSide          TeamSide (HOME | AWAY | NONE)
  limit             Int?
  filters           Json?
  customFunction    String?
  customName        String?
```

**TitlePartSourceType values:**
- `COMMENTARY` — pulls crew member in Commentary position
- `PRESENTATION` — pulls presenter
- `PRESENTATION_AND_ANALIST` — merges presenter + analyst names with " & "
- `TEAM_PLAYER` — looks up player from the team (with InterviewSubject override)
- `TEAM_COACH` — looks up coach from the team
- `FREE_TEXT` — uses `customFunction` + `customName` directly

## vMix Outbound Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/vmix/sponsor-names` | Ticker: `[{ "sponsor-names": "Name1   \|   Name2   \|   ..." }]` |
| GET | `/api/vmix/sponsor-carrousel` | Carousel: `[{name, commercial, type, website}]` |
| GET | `/api/vmix/sponsor-rows` | Logo grid: `[{subject, image1, image2, image3}]` |
| GET | `/api/vmix/sponsor-slides` | Slides: similar to rows |
| GET | `/api/vmix/active-production/staff` | Crew of next future production |
| GET | `/api/vmix/production/active/titles` | Redirect to production titles endpoint |
| GET | `/api/vmix/production/:id/titles` | Resolved title names for production |
| GET | `/api/vmix/endpoints` | List all feed URLs for vMix configuration |
| POST | `/api/vmix/set-timer` | Set countdown timer on vMix Web Controller |

## vMix Inbound Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/vmix/sync/activate-event` | vMix activates event by `?inputName=` |
| POST | `/api/vmix/production/trigger-manual` | Trigger event by `{ eventId }` |

## Title Resolution

`GET /api/vmix/production/:id/titles` returns `[{ functionName, name }]`:

1. Load TitleDefinitions for the production (or global if none set)
2. For each part, resolve the name:
   - `COMMENTARY`: find `ProductionPersonPosition` where position.name contains "commentaar" → person name
   - `PRESENTATION_AND_ANALIST`: merge presenter + analist names with " & "
   - `TEAM_PLAYER`: check `InterviewSubject` for override → else fetch player from Club by teamSide + filters
   - `TEAM_COACH`: similar to TEAM_PLAYER for coaches
   - `FREE_TEXT`: return `customName` or apply `customFunction`
3. Return `functionName` as the vMix data source field name

## Sponsor Feed Logic

**Ticker** (`/sponsor-names`):
- Fetches sponsors by `sponsorNamesTypes` setting (default: premium, goud, zilver)
- Premiums first, others shuffled within type
- Joins with `"   |   "` separator; adds trailing separator
- Uses `displayName ?? name`

**Logo Rows** (`/sponsor-rows`):
- Query params: `sponsorIds[]` (filter to specific sponsors), `seed` (for reproducibility)
- Groups sponsors in steps of 3 (if ≥6); minimizes overlap between rows
- Uses `mulberry32` seeded RNG with `hashSeed(seed)` for reproducibility

## Admin Title Template Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/vmix/title-templates` | List global templates |
| POST | `/api/admin/vmix/title-templates` | Create template |
| PUT | `/api/admin/vmix/title-templates/:id` | Update template |
| DELETE | `/api/admin/vmix/title-templates/:id` | Delete template |
| PATCH | `/api/admin/vmix/title-templates:reorder` | Reorder by ID array |
| POST | `/api/admin/vmix/production/:id/titles/use-default` | Clone global templates to production |
