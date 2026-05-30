# Tasks: vmix-integration

> Status: COMPLETE — All tasks implemented. This is a reverse-generated spec.

## Backend

- [x] Prisma schema: TitleDefinition, TitlePart models with enums
- [x] `/api/vmix/sponsor-names` — ticker feed with seeded shuffle
- [x] `/api/vmix/sponsor-carrousel` — carousel feed
- [x] `/api/vmix/sponsor-rows` — seeded logo grid with mulberry32 RNG
- [x] `/api/vmix/sponsor-slides` — slides feed
- [x] `/api/vmix/active-production/staff` — next production crew
- [x] `/api/vmix/production/:id/titles` — resolved title names
- [x] `/api/vmix/endpoints` — self-describing endpoint list
- [x] `/api/vmix/set-timer` — vMix Web Controller timer
- [x] `/api/vmix/sync/activate-event` — inbound event sync by input name
- [x] `/api/vmix/production/trigger-manual` — manual trigger
- [x] Admin title template CRUD routes
- [x] Title reorder route
- [x] Clone global templates to production

## Frontend

- [x] `VmixTemplatesPage` — template CRUD with part editor
- [x] `VmixDatasourcesPage` — display all endpoint URLs
- [x] `VmixControlPage` — manual show control from vMix panel
- [x] `ProductionTitlesPage` — per-production title configuration
- [x] `useTitles` hook
