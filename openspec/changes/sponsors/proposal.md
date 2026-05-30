## Why

The broadcast needs to display sponsor logos, names, and links in various vMix graphics (ticker, carousel, logo grid). Sponsors must be manageable without developer access — through a web UI and Excel import. Different display contexts (ticker vs carousel vs logo grid) use different sponsor tier subsets.

## What Changes

- Sponsor CRUD with logo upload
- Excel import/export for bulk management
- Sponsor type/tier system (premium, goud, zilver, brons, event)
- `displayName` override field for ticker/carousel display
- Enabled/disabled flag to temporarily hide sponsors from feeds
- Pagination and type-based filtering

## Capabilities

### New Capabilities

- `sponsor-crud`: Create, read, update, delete sponsors with logo upload
- `sponsor-excel`: Import from and export to Excel (.xlsx)
- `sponsor-feed-filter`: Type-based filtering for different vMix contexts

### Modified Capabilities

## Impact

- `apps/korfbal-stream-api/src/routes/sponsors.ts`
- `apps/korfbal-stream-api/src/schemas/sponsor.ts`
- `apps/korfbal-stream-api/prisma/schema.prisma` — Sponsor model
- `storage/sponsors/` — logo file storage
- Frontend: `SponsorsPage`, `SponsorFormModal`, `useSponsors`
