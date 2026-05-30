# Spec: vmix-sponsor-feeds

## Overview

HTTP data source endpoints that vMix polls to populate graphics with sponsor data. Each endpoint returns JSON formatted for a specific vMix use case.

## Requirements

### Sponsor Ticker
- `GET /api/vmix/sponsor-names`
- Returns `[{ "sponsor-names": "<Name1>   |   <Name2>   |   ..." }]`
- Sponsors filtered by `sponsorNamesTypes` setting (default: premium, goud, zilver)
- Premium sponsors first, others shuffled randomly within type
- Separator between names is `"   |   "` (3 spaces, pipe, 3 spaces) with trailing separator
- Uses `displayName` if set, otherwise `name`
- Only `enabled=true` sponsors included

### Sponsor Carousel
- `GET /api/vmix/sponsor-carrousel`
- Returns `[{ name, commercial: logoUrl, type, website }]`
- Same filtering as ticker
- Always includes a hardcoded Fortuna entry at the start

### Sponsor Logo Rows
- `GET /api/vmix/sponsor-rows?sponsorIds[]=1&sponsorIds[]=2&seed=abc`
- Optional `sponsorIds[]` filters to specific sponsors; if omitted uses `sponsorRowsTypes` setting
- `seed` parameter enables reproducible randomization (same seed → same result)
- Returns `[{ subject: string, image1: logoUrl, image2: logoUrl, image3: logoUrl }]`
- Grouping algorithm:
  - If ≥6 unique sponsors: groups in steps of 3 (guarantees no overlap between rows)
  - If <6: partitioned fallback (minimizes overlap)
- Paired with player image subjects from `PlayerImage` table

### Sponsor Slides
- `GET /api/vmix/sponsor-slides`
- Similar to sponsor-rows but uses `sponsorSlidesTypes` setting

## Constraints

- All feed endpoints are unauthenticated (vMix polls them directly)
- The seeded RNG uses `mulberry32` algorithm with `hashSeed(seed string → number)`
- If no sponsors match the configured types, endpoints return empty arrays (not errors)
