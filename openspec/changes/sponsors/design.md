## Overview

Sponsors are stored in PostgreSQL with a type (tier) system. Logos are stored as files in `storage/sponsors/`. The vMix feed endpoints filter sponsors by type based on configurable settings. Excel import/export uses flexible header matching to handle Dutch/English column name variants.

## Data Model

```
Sponsor
  id          Int (PK)
  name        String (unique)
  type        SponsorType (premium | goud | zilver | brons | event)
  logoUrl     String?     (relative path, e.g. "/storage/sponsors/name.png")
  websiteUrl  String?
  categories  String[]    (tags for additional grouping)
  displayName String?     (override for ticker/carousel; falls back to name)
  enabled     Boolean     (default true)
  createdAt   DateTime
```

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sponsors` | Paginated list; query: `type[]`, `page`, `limit`, `enabledOnly` |
| GET | `/api/sponsors/:id` | Get one sponsor |
| POST | `/api/sponsors` | Create sponsor |
| PUT | `/api/sponsors/:id` | Update sponsor |
| DELETE | `/api/sponsors/:id` | Delete sponsor |
| POST | `/api/sponsors/:id/logo` | Upload logo (multipart, field: `file`) |
| GET | `/api/sponsors/export-excel` | Download Excel workbook |
| POST | `/api/sponsors/upload-excel` | Import from Excel workbook |

## Sponsor Type Priority

Sponsors sort by type priority, then alphabetically within type:
1. premium
2. goud
3. zilver
4. brons
5. event

## Logo Upload

- File saved to `$ASSETS_DIR/sponsors/<sanitized-name>.<ext>`
- `logoUrl` is set to `/storage/sponsors/<filename>`
- If `name` changes on PUT and no explicit `logoUrl`, auto-regenerates `logoUrl` from new name

## Excel Format

**Export columns**: Name, Labels, Website URL, Logo file name, Sponsorcategorieën, DisplayName, Enabled

**Import**: Flexible header matching handles Dutch/English variants:
- "Name" / "Naam"
- "Labels" / "Type"
- "Website URL" / "Website"
- "Logo" / "Logo file name"
- "Sponsorcategorieën" / "Categories"
- "DisplayName" / "Display Name"
- "Enabled" / "Actief"

**Import logic**: Upsert by name. Returns `{ ok, sheet, total, created, updated, problems[] }`.

## Feed Filtering

Different vMix contexts use different sponsor type subsets, configured via Settings:
- `sponsorNamesTypes` (default: premium, goud, zilver) → used by `/api/vmix/sponsor-names`
- `sponsorRowsTypes` → used by `/api/vmix/sponsor-rows`
- `sponsorSlidesTypes` → used by `/api/vmix/sponsor-slides`
