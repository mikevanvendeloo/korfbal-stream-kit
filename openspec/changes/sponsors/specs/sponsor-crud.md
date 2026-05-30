# Spec: sponsor-crud

## Overview

Sponsors are managed via CRUD endpoints. Each sponsor has a tier (type), optional logo, optional website, and an optional display name override for graphics use.

## Requirements

### List Sponsors
- `GET /api/sponsors` with query params:
  - `type` — one or more types to filter (e.g., `?type=premium&type=goud`)
  - `page` (default 1), `limit` (default 25, max 100)
  - `enabledOnly=true` — only return enabled sponsors
- Response: `{ items: Sponsor[], page, limit, total, pages }`
- Sorted by type priority (premium first), then alphabetically by name

### Create Sponsor
- `POST /api/sponsors` with `{ name, type, websiteUrl?, logoUrl?, displayName?, enabled? }`
- `name` must be unique
- If `logoUrl` not provided, auto-generates from name: `/storage/sponsors/<slug>.png`
- Returns 201 with created sponsor

### Update Sponsor
- `PUT /api/sponsors/:id` with any subset of fields
- If `name` changes and no explicit `logoUrl`, regenerates `logoUrl` from new name
- Returns updated sponsor

### Delete Sponsor
- `DELETE /api/sponsors/:id` — hard delete
- Returns 204

### Upload Logo
- `POST /api/sponsors/:id/logo` — multipart upload, field name `file`
- Saves to `$ASSETS_DIR/sponsors/<sanitized-name>.<ext>`
- Updates sponsor's `logoUrl` to `/storage/sponsors/<filename>`
- Returns updated sponsor

## Constraints

- `name` is unique across all sponsors (DB constraint)
- `enabled=false` hides the sponsor from vMix feed endpoints
- `displayName` is purely for output override; `name` remains the canonical identifier
- Logo files are served statically from `/storage/` by Express
