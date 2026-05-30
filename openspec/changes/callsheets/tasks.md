# Tasks: callsheets

> Status: COMPLETE — All tasks implemented. This is a reverse-generated spec.

## Backend

- [x] Prisma schema: CallSheet, CallSheetItem, CallSheetTemplate, CallSheetTemplateItem models
- [x] CallSheet CRUD routes under `/api/production/:id/callsheets`
- [x] CallSheetItem CRUD with position M2M
- [x] `POST /callsheets/:cid/calculate-times` — time calculation from anchor
- [x] Template CRUD routes under `/api/admin/callsheets/templates`
- [x] Segment assignment routes under `/api/production/:segmentId/assignments`
- [x] Event sync route

## Frontend

- [x] `CallSheetEditPage` — item CRUD, time calculation, drag-drop reorder
- [x] `CallSheetsPage` — list callsheets per production
- [x] `CallSheetTemplatesPage` — template list
- [x] `CallSheetTemplateDetailsPage` — template item editing
- [x] `SegmentAssignmentsPage` — copy assignments across segments
- [x] `useCallsheet` hook
- [x] `useCallSheetTemplates` hook
- [x] `useCallSheetSync` hook — sync callsheet to events
