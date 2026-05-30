## Why

Production crews need to back up and restore all configuration data (persons, skills, positions, sponsors, segment templates) and complete production packages across different environments (dev → staging → production). Without a backup system, data loss means manually re-entering weeks of setup.

## What Changes

- Export endpoints for all major data entities (returns JSON attachments)
- Import endpoints for all major data entities (upsert semantics)
- Complete production export/import including all related data
- Settings export/import

## Capabilities

### New Capabilities

- `entity-export`: Export skills, positions, persons, matches, clubs, sponsors, settings, segment templates as JSON
- `entity-import`: Import the same entities with upsert semantics
- `production-export-import`: Export/import complete production packages with all relations

### Modified Capabilities

## Impact

- `apps/korfbal-stream-api/src/routes/backup.ts`
- `apps/korfbal-stream-api/src/routes/production/production-export-import.ts`
- Frontend: SettingsPage backup tab
