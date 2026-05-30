# Spec: skills-positions

## Overview

Skills and Positions form the crew role catalog. A Skill represents a capability (e.g., "Commentaar", "Camera"). A Position is a named seat that requires a skill (e.g., "Commentator 1" requires "Commentaar"). Positions can be linked to each other for callsheet synchronization.

## Requirements

### Skills CRUD
- `GET /api/skills` — list all skills
- `POST /api/skills` with `{ code, nameMale, nameFemale, name, type }` — create
- `PUT /api/skills/:id` — update
- `DELETE /api/skills/:id` — delete (only if no positions or persons link to it)

**Skill fields:**
- `code` — unique identifier (e.g., "COM" for commentaar)
- `nameMale` / `nameFemale` — gendered display names
- `name` — neutral display name
- `type` — `crew` (production crew) or `entertainment` (performers)

### Positions CRUD
- `GET /api/production/positions` — list all positions; supports category filter
- `POST /api/production/positions` with `{ name, skillId?, isStudio, category, sortOrder }` — create
- `PUT /api/production/positions/:id` — update
- `DELETE /api/production/positions/:id` — delete

**Position categories:** GENERAL, TECHNICAL, ENTERTAINMENT

### Position Linking
- Positions can be linked to other positions for callsheet item synchronization
- When a callsheet item is assigned to position A, linked positions also see the item
- Links are managed via the PositionsAdminPage

## Constraints

- Position `name` is unique globally
- Skill `code` is unique globally
- Deleting a skill used by positions is prevented
