# Spec: production-crud

## Overview

A Production represents a live korfbal broadcast event. It is linked 1:1 with a MatchSchedule entry and acts as the container for all production resources (crew, callsheets, segments, events, titles).

## Requirements

### Create Production
- `POST /api/production` with `{ matchScheduleId: number }`
- Creates a Production record; sets `liveTime` to 5 minutes before `matchSchedule.date`
- Auto-creates segments: copies from the default SegmentTemplate, or uses the hardcoded fallback (6 segments, "Eerste helft" is the time anchor)
- Auto-creates a CallSheet named "Callsheet"
- Returns 201 with the created Production

### List Productions
- `GET /api/production` returns all productions ordered by match date DESC
- Each item includes `matchSchedule` (home/away team names, date, scores)
- Returns `{ items: Production[], total: number }`

### Get Production
- `GET /api/production/:id` returns production with `matchSchedule` and `productionPositions` (with linked person + position)
- Returns 404 if not found

### Update Production
- `PUT /api/production/:id` accepts `{ matchScheduleId?, liveTime? }`
- Validates new matchScheduleId if provided (must exist)

### Delete Production
- `DELETE /api/production/:id` cascades to all related records
- Returns 204

### List Eligible Matches
- `GET /api/production/matches` returns matches eligible for production
- A match is eligible if `isManual=true` OR (`isHomeMatch=true` AND team name is in the `productionTeamNames` setting)
- Includes a `filters` array of active filter names

## Constraints

- A match can only have one production (`matchScheduleId` is unique on Production)
- `liveTime` can be overridden via PUT; defaults to match date minus 5 minutes
