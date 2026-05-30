# Spec: vmix-title-templates

## Overview

Title templates define what names appear in vMix lower-third graphics. Each template has a name (the vMix data source field name) and one or more parts that describe how to resolve the displayed name from live production data.

## Requirements

### Global Title Templates
- `GET /api/admin/vmix/title-templates` — list global templates (productionId=null), ordered by `order`
- `POST /api/admin/vmix/title-templates` with `{ name, order?, enabled?, parts: [...] }` — create
  - If `order` is in the middle, auto-renumbers following templates
- `PUT /api/admin/vmix/title-templates/:id` — update; re-inserts parts if `parts` array is provided
- `DELETE /api/admin/vmix/title-templates/:id` — delete + renumber remaining
- `PATCH /api/admin/vmix/title-templates:reorder` with `{ ids: number[] }` — reorder by ID array

### Production Title Templates
- `POST /api/admin/vmix/production/:id/titles/use-default` — clones all enabled global templates to the production
  - Clears existing production titles first
  - Returns cloned templates
- `GET /api/vmix/production/active/titles` — redirects to production's title endpoint
- `GET /api/vmix/production/:id/titles` — returns `[{ functionName, name }]` for vMix data source

### Title Part Source Types

| Source Type | Resolution Logic |
|-------------|-----------------|
| `COMMENTARY` | Person in Commentary position for this production |
| `PRESENTATION` | Person in Presentation position |
| `PRESENTATION_AND_ANALIST` | Presenter name + " & " + Analyst name |
| `TEAM_PLAYER` | Player from `teamSide` team; check InterviewSubject override first |
| `TEAM_COACH` | Coach from `teamSide` team; check InterviewSubject override first |
| `FREE_TEXT` | Returns `customName` or applies `customFunction` |

### InterviewSubject Override
- If an `InterviewSubject` exists for `(productionId, titleDefinitionId)`, use that player instead of club player lookup
- This allows the production to override which specific player appears in the lower-third

## Constraints

- `order` is unique per context (global vs per-production); managed by auto-renumber
- Disabled templates (`enabled=false`) are skipped in `/titles` resolution
- Parts within a template are ordered by their array index; order cannot be changed independently
- If a resolution fails (no player found, no person assigned), the name is returned as an empty string or placeholder
