# Spec: production-export-import

## Overview

Complete production packages (including crew, segments, callsheets, events, titles, interviews) can be exported and re-imported. This is the primary mechanism for moving a completed production setup to another environment or restoring after data loss.

## Requirements

### Export Production Package
- `GET /api/backup/producties/export`
- Returns array of production packages (one per production in the system)
- Each package includes:
  - `matchSchedule` — match details
  - `production` — metadata (liveTime, report)
  - `persons` — crew members with their skills
  - `positions` — person-position assignments for this production
  - `segments` — ordered segments with role assignments
  - `titles` — title definitions with parts
  - `interviews` — interview subjects with player references
  - `callSheets` — callsheets with all items and position assignments
  - `productionEvents` — production event list with status

### Import Production Package
- `POST /api/backup/producties/import` with array of packages
- For each package:
  1. Upsert MatchSchedule by externalId or (date, homeTeam, awayTeam)
  2. Create or update Production
  3. Ensure all referenced Persons exist (upsert by name)
  4. Ensure all referenced Positions exist (upsert by name)
  5. Recreate person-position assignments
  6. Delete existing segments; recreate from package
  7. Recreate segment role assignments using name-based lookups
  8. Delete existing title definitions; recreate with parts (track old→new ID mapping)
  9. Recreate interview subjects using new title IDs
  10. Delete existing callsheets; recreate with items and positions
  11. Delete existing events; recreate in order
- Returns `{ ok: true, imported: number }`

## Constraints

- Import uses **name-based upserts** for portable entities (persons, positions, skills)
- ID re-mapping: old IDs from the export are re-mapped to new DB IDs during import (stored in memory maps)
- Productions are imported sequentially (not transactional across the whole batch)
- If a Person's skill references an unknown Skill code, the skill is created on the fly
- Logo files must be manually restored — only paths are in the backup
- The import is idempotent: re-importing the same package overwrites with the same data
