# Korfbal Stream API

This API provides endpoints for managing sponsors and generating vMix-compatible data feeds.

---

## Sponsor Excel Import/Export

### Import Format

The API accepts Excel files (`.xlsx`) for bulk sponsor management via `POST /api/sponsors/upload-excel`.

#### Excel Structure

- **Sheet**: The first sheet in the workbook is used
- **Headers**: Column names are normalized (lowercase, diacritics removed, non-alphanumeric stripped), so variations like `Website URL`, `website_url`, and `WebsiteUrl` are all accepted

#### Required Columns

| Column Variants | Description | Valid Values |
|----------------|-------------|--------------|
| `Name`, `Naam` | Sponsor name (required) | Any non-empty string. Note: " B.V." suffix is automatically stripped |
| `Labels`, `Type`, `Pakket`, `Sponsor package` | Sponsor type (required) | `premium`, `goud`, `zilver`, `brons` (case-insensitive) |
| `Website`, `Website URL`, `Site`, `Url` | Sponsor website (required) | Any non-empty string |

#### Optional Columns

| Column Variants | Description | Default Behavior |
|----------------|-------------|------------------|
| `Logo`, `LogoUrl`, `Logo file name`, `LogoFilename` | Logo filename | If empty, derived from sponsor name (e.g., `ACME BV` → `acme-bv.png`) |
| `Sponsorcategorieën`, `Categories` | Sponsor categories | Stored as-is if provided |
| `DisplayName`, `Display Name`, `Weergavenaam` | Display name override | If empty, the regular `Name` is used in API outputs |

#### DisplayName Behavior

The `DisplayName` column provides an **optional override** for how the sponsor name appears in:
- `GET /api/vmix/sponsor-names` (ticker feed)
- `GET /api/vmix/sponsor-carrousel` (carrousel name field)

**Import rules**:
- If the `DisplayName` column is **present** in the Excel file, its value (even if empty) will be saved
- If the `DisplayName` column is **absent**, existing `displayName` values in the database are preserved (not overwritten)
- This allows you to maintain manually entered display names when importing older Excel files

#### Example: Minimal Import

```
Name          | Labels | Website
ACME BV       | goud   | https://acme.example
Widget Co     | zilver | https://widget.example
```

#### Example: Complete Import

```
Naam          | Labels   | Website URL           | Logo file name | Sponsorcategorieën    | DisplayName
ACME BV       | premium  | https://acme.example  | acme.png       | Hoofdsponsor;Premium  | ACME (Hoofdsponsor)
Widget Co     | goud     | https://widget.example| widget-logo.png| Materiaal             |
Tech Inc.     | zilver   | https://tech.example  |                | Technologie           | Tech Inc. Korfbal
```

---

### Export Format

You can export all sponsors to Excel via `GET /api/sponsors/export-excel`.

**Export includes**:
- All sponsors in the database (no filtering)
- All columns from the import format **plus** the `DisplayName` column
- Downloaded as `Sponsors.xlsx`

The exported file can be re-imported, and any `DisplayName` values will be preserved.

---

## API Endpoints

### Sponsors Management

- `GET /api/sponsors` - List sponsors (with optional `type` filter, pagination)
- `GET /api/sponsors/:id` - Get sponsor by ID
- `POST /api/sponsors` - Create new sponsor
- `PUT /api/sponsors/:id` - Update sponsor
- `DELETE /api/sponsors/:id` - Delete sponsor
- `POST /api/sponsors/upload-excel` - Bulk import from Excel
- `GET /api/sponsors/export-excel` - Export all sponsors to Excel

### vMix Integration

- `GET /api/vmix/sponsor-names` - Ticker feed (uses `displayName` when available)
- `GET /api/vmix/sponsor-carrousel` - Carrousel feed (uses `displayName` when available)
- `GET /api/vmix/sponsor-rows` - Logo rows (unaffected by `displayName`)

---

## Development

```bash
# Install dependencies
npm install

# Run migrations
npm run prisma:migrate

# Start dev server
npm run dev
```
