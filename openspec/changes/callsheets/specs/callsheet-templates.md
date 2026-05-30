# Spec: callsheet-templates

## Overview

CallSheetTemplates are reusable callsheet structures that can be applied to new productions. A template has a name and a list of template items (with the same fields as CallSheetItems minus production-specific timing).

## Requirements

### Template CRUD
- `GET /api/admin/callsheets/templates` — list all templates
- `POST /api/admin/callsheets/templates` with `{ name, items?: [...] }` — create template
- `GET /api/admin/callsheets/templates/:id` — get with items
- `PUT /api/admin/callsheets/templates/:id` — update name or items
- `DELETE /api/admin/callsheets/templates/:id` — delete template + items

### Template Item CRUD
- `POST /templates/:id/items` — add item
- `PUT /templates/:id/items/:iid` — update item
- `DELETE /templates/:id/items/:iid` — delete item

### Apply Template to Production
- When a Production is created and `callSheetTemplateId` is set, its template items are copied as CallSheetItems into the production's default callsheet
- Template can be selected on the ProductionDetailPage via `CallSheetTemplateSelector`

## Constraints

- Template items store position names (not IDs) to remain portable across environments
- Applying a template does not overwrite existing callsheet items — it appends
