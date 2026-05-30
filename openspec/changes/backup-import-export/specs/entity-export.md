# Spec: entity-export

## Overview

Export endpoints allow the entire system configuration to be serialized to JSON files for backup, migration, and cross-environment sharing.

## Requirements

### All Export Endpoints
- All export routes return JSON as a file download (`Content-Disposition: attachment`)
- No query parameters — always exports all records

### Individual Entity Exports

| Endpoint | Upsert Key on Import | Notes |
|----------|---------------------|-------|
| `GET /api/backup/skills/export` | `code` | Includes all Skill fields |
| `GET /api/backup/positions/export` | `name` | Exports `skillCode` (not skillId) |
| `GET /api/backup/persons/export` | `name` | Nested `skills[]` array |
| `GET /api/backup/matches/export` | `externalId` | Full MatchSchedule |
| `GET /api/backup/clubs/export` | `slug` | Nested `players[]` |
| `GET /api/backup/sponsors/export` | `name` | Excludes `id`, `createdAt` |
| `GET /api/backup/settings/export` | `key` | All key-value settings |
| `GET /api/backup/segment-templates/export` | `name` | Nested `items[]` |
| `GET /api/backup/producties/export` | See production-export-import spec | Full relational graph |

## Constraints

- Logo/image files are NOT included in exports — only relative URLs
- Export order is not guaranteed
- IDs are excluded from exports where they are environment-specific (positions, persons, sponsors)
- MatchSchedule IDs are excluded; `externalId` is the portable key
