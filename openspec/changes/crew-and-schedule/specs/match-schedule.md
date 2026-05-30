# Spec: match-schedule

## Overview

Match schedules are imported from the external KNKV competition API or created manually. They serve as the basis for creating productions. Each match links to at most one production.

## Requirements

### Import from KNKV API
- `POST /api/match/matches/schedule/import`
- Fetches matches from `config.matchScheduleBaseUrl` with configurable date range
- Upserts by `externalId` (from external API)
- Returns `{ ok, inserted, updated, total }`

**Normalization applied during import:**
- Team color assigned based on known team names (Fortuna/Ruitenheer divisions J1–J23)
- Referee name filtered by privacy level: FULL_NAME (all), FIRST_NAME (first only), LAST_NAME (last only), HIDDEN (masked)
- Non-referee officials (Juryvoorzitter, Schotklokbediener, Tijdwaarnemer) filtered out
- Field names cleaned: text before hyphen removed (e.g., "Hal 3 - Veld 2" → "Veld 2")

### List Matches
- `GET /api/match/matches/schedule?date=2025-03-15&location=HOME`
- Query params: `date` (ISO date string, defaults to today), `location` (HOME | AWAY | both)
- Date range filter: 00:00:00 to 23:59:59 of the given date (UTC)
- Location filter: HOME includes `isHomeMatch=true`, AWAY includes `isHomeMatch=false`
- Includes manually created matches in results
- Returns `{ items: MatchSchedule[], count, date }`

### Manual Matches
- `GET/POST/PUT/DELETE /api/manual-matches` — full CRUD for manually-created match entries
- Manual matches have `isManual=true` and are always included in production match selection

## Constraints

- `externalId` is unique; re-importing updates existing records
- Manual matches are not affected by import (different records, no externalId)
- A MatchSchedule cannot be deleted if it has an associated Production
