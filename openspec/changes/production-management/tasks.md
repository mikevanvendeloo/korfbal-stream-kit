# Tasks: production-management

> Status: COMPLETE — All tasks implemented. This is a reverse-generated spec.

## Backend

- [x] Prisma schema: Production, ProductionSegment models
- [x] `POST /api/production` — create with default segments
- [x] `GET /api/production` — list with matchSchedule
- [x] `GET /api/production/:id` — detail with person-positions
- [x] `PUT /api/production/:id` — update
- [x] `DELETE /api/production/:id` — delete with cascade
- [x] `POST /api/production/:id/activate` — transactional activation
- [x] `GET /api/production/matches` — eligible matches filter
- [x] Segment CRUD routes with 2-phase reorder
- [x] Person presence routes (add/remove/list)
- [x] Person-position assignment routes (CRUD)
- [x] Production report upsert route
- [x] `productionState.ts` — in-memory singleton with broadcast

## Frontend

- [x] ProductionsAdminPage — list, create, activate, delete
- [x] ProductionDetailPage — segments, crew assignments
- [x] ProductionAttendancePage — mark persons present
- [x] ProductionReportPage — match sponsor, remarks
- [x] useProductions hook — all production mutations
