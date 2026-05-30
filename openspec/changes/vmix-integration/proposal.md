## Why

The broadcast uses vMix software for live graphics. StreamKit needs to push dynamic data to vMix data sources (sponsor ticker, carousel, logo rows, crew titles) and receive trigger signals from vMix when a specific input goes live. Title templates allow the production team to configure what names appear in lower-thirds without editing code.

## What Changes

- vMix data feed endpoints (sponsor ticker, carousel, logo rows, slides)
- vMix title template system (configurable lower-third definitions)
- vMix event sync (vMix activates an event by input name)
- vMix timer control
- Crew/staff endpoint for upcoming production
- Endpoint to list all vMix data source URLs for vMix configuration

## Capabilities

### New Capabilities

- `vmix-sponsor-feeds`: HTTP endpoints that return sponsor data formatted for vMix data sources
- `vmix-title-templates`: Configurable title definitions with typed data sources per part
- `vmix-event-sync`: vMix triggers event activation by input name
- `vmix-endpoints`: Self-describing endpoint list for vMix data source setup

### Modified Capabilities

## Impact

- `apps/korfbal-stream-api/src/routes/vmix.ts`
- `apps/korfbal-stream-api/prisma/schema.prisma` — TitleDefinition, TitlePart models
- Frontend: `VmixTemplatesPage`, `VmixDatasourcesPage`, `VmixControlPage`, `useTitles`
