# Spec: sponsor-excel

## Overview

Sponsors can be bulk-managed via Excel files. The export produces a standard workbook; the import reads any workbook with matching column names (Dutch or English variants accepted).

## Requirements

### Export to Excel
- `GET /api/sponsors/export-excel`
- Returns an `.xlsx` file as a download (`Content-Disposition: attachment`)
- Columns: Name, Labels, Website URL, Logo file name, Sponsorcategorieën, DisplayName, Enabled
- All sponsors sorted by type priority then name
- No filtering — exports all sponsors

### Import from Excel
- `POST /api/sponsors/upload-excel` — multipart upload, field name `file`
- Reads first sheet that contains a recognized header row
- Upserts sponsors by `name` (case-insensitive match)
- Returns:
  ```json
  { "ok": true, "sheet": "Sheet1", "total": 20, "created": 3, "updated": 17, "problems": [] }
  ```
- `problems` array contains `{ row, reason }` for rows that failed to process

### Column Name Variants Accepted
| Canonical | Also accepted |
|-----------|--------------|
| Name | Naam |
| Labels | Type, Sponsortype |
| Website URL | Website, Url |
| Logo file name | Logo, Logobestand |
| Sponsorcategorieën | Categories, Categorieën |
| DisplayName | Display Name, Weergavenaam |
| Enabled | Actief, Active |

## Constraints

- The `type` column (Labels) must match a valid `SponsorType` value after normalization (lowercase, trim)
- Rows with an unrecognizable type are added to `problems` and skipped
- Logo file names in the import are stored as-is in `logoUrl` (no upload logic in import)
- Excel library: `exceljs`
