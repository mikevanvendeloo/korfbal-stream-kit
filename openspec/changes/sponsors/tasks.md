# Tasks: sponsors

> Status: COMPLETE — All tasks implemented. This is a reverse-generated spec.

## Backend

- [x] Prisma schema: Sponsor model with SponsorType enum
- [x] Zod schemas: SponsorInputSchema, SponsorUpdateSchema, SponsorQuerySchema
- [x] `GET /api/sponsors` — paginated, filtered, sorted
- [x] `GET /api/sponsors/:id` — single sponsor
- [x] `POST /api/sponsors` — create with auto-logoUrl
- [x] `PUT /api/sponsors/:id` — update with logo regeneration
- [x] `DELETE /api/sponsors/:id` — hard delete
- [x] `POST /api/sponsors/:id/logo` — multer upload to storage/sponsors/
- [x] `GET /api/sponsors/export-excel` — exceljs workbook download
- [x] `POST /api/sponsors/upload-excel` — flexible header import

## Frontend

- [x] `SponsorsPage` — list with pagination and type filter
- [x] `SponsorFormModal` — create/edit form with logo preview
- [x] `useSponsors` hook — paginated fetch + mutations
