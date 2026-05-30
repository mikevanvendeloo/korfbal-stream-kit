## Overview

All backup/import routes are under `/api/backup`. Export routes return JSON file downloads. Import routes accept JSON POST bodies and use upsert semantics (create or update based on a natural key). The production export/import is the most complex operation, handling a full relational graph.

## API Routes

### Entity Export (all return `Content-Disposition: attachment; filename=*.json`)

| GET | `/api/backup/skills/export` | `[{ code, name, nameMale, nameFemale, type }]` |
| GET | `/api/backup/positions/export` | `[{ name, category, sortOrder, isStudio, skillCode }]` |
| GET | `/api/backup/persons/export` | `[{ name, gender, skills: [...] }]` |
| GET | `/api/backup/matches/export` | Full MatchSchedule array |
| GET | `/api/backup/clubs/export` | `[{ name, shortName, slug, logoUrl, players: [...] }]` |
| GET | `/api/backup/sponsors/export` | `[{ name, type, websiteUrl, logoUrl, categories, displayName }]` |
| GET | `/api/backup/settings/export` | `[{ key, value }]` |
| GET | `/api/backup/segment-templates/export` | `[{ version, name, items: [...] }]` |
| GET | `/api/backup/producties/export` | Complete production package (see below) |

### Entity Import (all accept JSON body, return `{ ok, created, updated }`)

| POST | `/api/backup/skills/import` | Upsert by `code` |
| POST | `/api/backup/positions/import` | Upsert by `name`; link to skill by `skillCode` |
| POST | `/api/backup/persons/import` | Upsert by `name`; recreate PersonSkill links |
| POST | `/api/backup/matches/import` | Upsert by `externalId` or `(date, homeTeam, awayTeam)` |
| POST | `/api/backup/clubs/import` | Upsert by `slug` |
| POST | `/api/backup/sponsors/import` | Upsert by `name` |
| POST | `/api/backup/settings/import` | Upsert by `key` |
| POST | `/api/backup/segment-templates/import` | Delete + recreate template items |
| POST | `/api/backup/producties/import` | Full relational import (see below) |

## Production Export Format

```json
{
  "version": "1.0",
  "exportedAt": "ISO8601",
  "matchSchedule": { ...MatchSchedule fields },
  "production": { "isActive": false, "liveTime": "...", "report": {...} },
  "persons": [{ "name", "gender", "skills": [...] }],
  "positions": [{ "personName", "positionName", "isStudio" }],
  "segments": [{ "naam", "volgorde", "duurInMinuten", "isTimeAnchor", "assignments": [...] }],
  "titles": [{ "id", "name", "order", "enabled", "parts": [...] }],
  "interviews": [{ "side", "role", "playerName", "titleDefinitionName" }],
  "callSheets": [{ "name", "color", "items": [...] }],
  "productionEvents": [{ "id", "title", "status", "order", ... }]
}
```

## Production Import Logic

`POST /api/backup/producties/import` accepts an array of production packages and processes each:

1. **MatchSchedule** — upsert by externalId or (date, homeTeam, awayTeam)
2. **Production** — create or update for this matchScheduleId
3. **Persons** — upsert by name; ensure PersonSkill links exist
4. **Positions** — upsert by name
5. **Person-position assignments** — recreate for this production
6. **Segments** — delete existing; recreate with correct volgorde
7. **Segment role assignments** — recreate for each segment
8. **Title definitions + parts** — delete existing; recreate with new IDs (re-map for interviews)
9. **Interview subjects** — create with new titleDefinition IDs
10. **CallSheets** — delete existing; recreate with items and positions
11. **ProductionEvents** — delete existing; recreate with new order

Returns `{ ok: true, imported: number }`.

## Constraints

- Import is not transactional across multiple productions in a batch; each is processed independently
- ID re-mapping is handled in memory during import (old IDs from export → new IDs after create)
- Logo files are NOT included in backup — only file paths are exported
- Settings import overwrites existing values by key
