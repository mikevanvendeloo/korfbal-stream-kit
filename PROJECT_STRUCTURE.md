# Project Structure

Authoritative reference for this project's directory layout and API endpoints.

Use this to locate backend packages, frontend components/pages, and API routes for any feature area. Search by domain keyword (e.g., `order`, `user`, `payment`) to find related files.

---

## Backend

```
apps/korfbal-stream-api/
├── prisma/
│   ├── schema.prisma          # Prisma data model (PostgreSQL)
│   ├── migrations/            # Prisma migrations (never edit the DB directly)
│   ├── seed.ts                # Seed entrypoint (npm run prisma:seed)
│   ├── seed-data.ts           # Seed data definitions
│   └── seed-data/
│       ├── callsheets/        # Callsheet template seeds (JSON)
│       └── segments/          # Segment template seeds (JSON)
└── src/
    ├── main.ts                # Express app: router mounting, static assets, upload, OpenAPI/Swagger, Socket.io init
    ├── test-setup.ts          # Vitest setup (.env.test, Prisma lifecycle)
    ├── routes/                # Express routers mounted under /api/*
    │   ├── sponsors.ts        # Sponsors CRUD, logo upload, Excel import/export
    │   ├── clubs.ts           # Clubs/teams, league import, club players
    │   ├── persons.ts         # Crew persons, person skills, match assignments
    │   ├── skills.ts          # Skills (capabilities) CRUD + JSON import/export
    │   ├── players.ts         # Players and player images
    │   ├── match.ts           # Match schedule fetch/import (via MatchScheduleProvider)
    │   ├── manual-matches.ts  # Manually entered matches
    │   ├── scoreboard.ts      # Proxy to venue scoreboard / shotclock
    │   ├── settings.ts        # App settings (vMix URL, sponsor/scoreboard/club config)
    │   ├── seasons.ts         # Seasons (seizoenen): list, create, delete, active season
    │   ├── vmix.ts            # vMix data sources (sponsors, staff, titles) + admin title templates
    │   ├── reports.ts         # Cross-production reports (occupancy, interviews, crew roles)
    │   ├── backup.ts          # Per-entity JSON backup export/import
    │   ├── show-control.ts    # Live show control (start/next/previous/reset/stop, clock)
    │   ├── time.ts            # Production time / countdown / venue clock
    │   ├── production.ts      # Production CRUD + activate; mounts production/* sub-routers
    │   └── production/        # Sub-routers nested under /api/production
    │       ├── production-persons.ts          # Persons attached to a production
    │       ├── production-person-positions.ts # Person-to-position assignments per production
    │       ├── production-crew.ts             # Crew overview
    │       ├── production-crew-report.ts      # Crew report
    │       ├── production-timing.ts           # Timing, clocks, production dates
    │       ├── production-titles.ts           # vMix title definitions per production
    │       ├── production-interviews.ts       # Interview subjects per production
    │       ├── production-callsheets.ts       # Callsheets + items, time calculation, sync to events
    │       ├── callsheet-controls.ts          # Live callsheet navigation (set-active/next/previous)
    │       ├── callsheet-templates.ts         # Callsheet templates (mounted at /api/callsheets/templates)
    │       ├── production-events.ts           # Production events (WAITING -> ACTIVE -> COMPLETED)
    │       ├── production-reports.ts          # Production report (PDF/Markdown/WhatsApp)
    │       ├── production-export-import.ts    # Full production export/import
    │       ├── segments.ts                    # Production segments (volgorde ordering)
    │       ├── segment-assignments.ts         # Crew assignments per segment
    │       ├── segment-default-positions.ts   # Default positions per segment name
    │       ├── segment-templates.ts           # Segment templates (mounted at /api/production/segment-templates)
    │       └── positions.ts                   # Positions CRUD + import/export
    ├── services/
    │   ├── prisma.ts                  # Shared PrismaClient wrapper
    │   ├── config.ts                  # Zod-validated env config, assets root
    │   ├── appSettings.ts             # Cached Setting table access
    │   ├── season.ts                  # Season derivation (1 Jul–30 Jun), active season, seasonId resolution, asset dirs
    │   ├── seasonAssetMigration.ts    # Startup job: moves legacy player photos/team-responses into storage/seasons/<YYYY-YYYY>/
    │   ├── production.ts              # Production report data loading
    │   ├── productionState.ts         # In-memory live state (active production/event, clocks)
    │   ├── socket.ts                  # Socket.io server + broadcastState()
    │   ├── timeSyncService.ts         # Production time / countdown
    │   ├── venueClockSyncService.ts   # Sync with venue scoreboard clock
    │   └── matchSchedule/             # Match schedule adapters
    │       ├── MatchScheduleProvider.ts              # Provider interface + normalized types
    │       ├── VrijwilligersMatchScheduleProvider.ts # sportclubvrijwilligersmanagement.nl adapter
    │       ├── providerFactory.ts                    # Selects provider via MATCH_SCHEDULE_PROVIDER
    │       └── index.ts                              # Exports the configured provider instance
    ├── schemas/               # Zod input schemas (sponsor, person, skill, capability, title, season)
    ├── utils/
    │   ├── logger.ts          # Logger
    │   ├── sponsorRows.ts     # Sponsor row/slide generation (seeded mulberry32 RNG)
    │   ├── clubs.ts           # Team-name normalization, club lookup by team name
    │   └── array-utils.ts     # shuffle helper
    ├── domain/
    │   └── positionSkill.ts   # Position name -> required skill code mapping
    └── middleware/
        └── error.ts           # Central Express error handler
```

## Frontend

```
apps/korfbal-stream-kit/src/
├── main.tsx                   # React entry
├── styles.css, styles/        # Tailwind entry + extra CSS (calendar)
├── app/
│   ├── app.tsx                # App shell, navigation, React Router routes
│   ├── pages/CallsheetPage.tsx
│   ├── components/callsheet/GlobalClocks.tsx
│   └── hooks/useCallsheetSync.ts
├── pages/                     # Route-level pages
│   ├── ProductionsAdminPage.tsx, ProductionDetailPage.tsx, ActiveProductionPage.tsx
│   ├── CallSheetsPage.tsx, CallSheetEditPage.tsx, LiveCallsheetEntry.tsx
│   ├── CallSheetTemplatesPage.tsx, CallSheetTemplateDetailsPage.tsx
│   ├── SegmentTemplatesPage.tsx, SegmentDefaultsAdminPage.tsx, SegmentAssignmentsPage.tsx
│   ├── PersonsAdminPage.tsx, SkillsAdminPage.tsx, PositionsAdminPage.tsx
│   ├── ProductionAttendancePage.tsx, CrewReportPage.tsx
│   ├── ProductionReportPage.tsx, ProductionTimingReportPage.tsx, ReportsPage.tsx
│   ├── ProductionTitlesPage.tsx, VmixControlPage.tsx, VmixDatasourcesPage.tsx, VmixTemplatesPage.tsx
│   ├── SponsorsPage.tsx, SponsorSlidesPage.tsx
│   ├── ClubsPage.tsx, MatchSchedulePage.tsx, ManualMatchesAdminPage.tsx, MatchProgramPage.tsx
│   ├── ScoreboardPage.tsx, QRAdminPage.tsx, AboutPage.tsx
│   ├── SettingsPage.tsx       # Tabbed settings page
│   └── settings/              # Settings tabs
│       ├── SeasonSettingsTab.tsx      # Active season, create/delete season, new-season imports
│       ├── ConnectionSettingsTab.tsx  # vMix / scoreboard connections
│       ├── SponsorSettingsTab.tsx     # Sponsor filter config
│       ├── ClubSettingsTab.tsx        # Own club config
│       └── BackupSettingsTab.tsx      # Backup export/import
├── components/                # Feature components
│   ├── CallSheetView.tsx, CallSheetColumn.tsx, CallSheetItem.tsx, CallSheetTemplateSelector.tsx
│   ├── ShowControl.tsx, ShowCallerView.tsx, TimeControls.tsx, TimeDisplay.tsx
│   ├── SegmentFormModal.tsx, SegmentAssignmentsCard.tsx, SegmentOverridesManager.tsx,
│   │   SegmentTemplateSelector.tsx, CopyAssignmentsModal.tsx, PositionSelector.tsx
│   ├── PersonsTable.tsx, PlayerCard.tsx, TitlesManager.tsx
│   ├── SponsorsTable.tsx, SponsorFormModal.tsx
│   ├── MatchHeader.tsx, ProductionHeader.tsx, ClubLogo.tsx, AppLogo.tsx, AppIcon.tsx
│   ├── IconButton.tsx, MultiSelect.tsx, SimpleCalendar.tsx, ErrorBoundary.tsx
│   └── ui/                    # Base UI primitives (button, card, input)
├── hooks/                     # TanStack Query hooks per domain + live state
│   ├── useProductions.ts, useCallsheet.ts, useCallSheetTemplates.ts, useCallSheetSync.ts
│   ├── useSegmentTemplates.ts, usePositions.ts, usePersons.ts, useInterviews.ts, useTitles.ts
│   ├── useSponsors.ts, useClubs.ts, useMatch.ts, useMatchSchedule.ts, useManualMatches.ts
│   ├── useReports.ts, useProductionReport.ts, useSettings.ts
│   ├── useSeasons.ts          # Seasons + active season (invalidates all queries on change)
│   ├── useLiveState.ts        # Socket.io live production state
│   └── useFontSize.ts         # UI font-size preference
├── lib/
│   ├── api.ts                 # API base URL / fetch helpers
│   ├── download.ts            # File download helper
│   └── sponsorUtils.ts        # Sponsor helpers
├── config/
│   └── scoreboardLabels.ts    # Scoreboard display labels
└── theme/
    └── ThemeProvider.tsx      # Light/dark theme context
```

## API Endpoints

No authentication: all endpoints are open (internal LAN tool). Swagger UI at `/api/docs`, OpenAPI JSON at `/api/openapi.json`.

### Core (`main.ts`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET | /api/openapi.json | OpenAPI document |
| POST | /api/upload | Generic file upload (multer) |
| GET | /assets/\*, /uploads/\*, /storage/\* | Static files from `ASSETS_DIR` |

### Sponsors (`/api/sponsors`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/sponsors | List sponsors |
| GET | /api/sponsors/export-excel | Export sponsors to Excel |
| GET | /api/sponsors/:id | Get sponsor |
| POST | /api/sponsors | Create sponsor |
| POST | /api/sponsors/:id/logo | Upload sponsor logo |
| PUT | /api/sponsors/:id | Update sponsor |
| DELETE | /api/sponsors/:id | Delete sponsor |
| POST | /api/sponsors/upload-excel | Import sponsors from Excel |

### Clubs (`/api/clubs`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/clubs | List clubs |
| POST | /api/clubs | Create club |
| POST | /api/clubs/import | Import clubs |
| POST | /api/clubs/import/league-teams | Import league teams |
| GET | /api/clubs/:id/teams | List teams of a club |
| GET | /api/clubs/:slug/players | List players of a club |
| DELETE | /api/clubs/:slug | Delete club |

### Players (`/api/players`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/players/images | List player images |
| POST | /api/players/images | Upload player image |
| DELETE | /api/players/images/:id | Delete player image |
| POST | /api/players | Create player |
| PUT | /api/players/:id | Update player |
| DELETE | /api/players/:id | Delete player |

### Persons (`/api/persons`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/persons/functions | List person functions |
| GET | /api/persons | List persons |
| GET | /api/persons/export-json | Export persons (JSON) |
| POST | /api/persons/import-json | Import persons (JSON) |
| GET | /api/persons/:id | Get person |
| POST | /api/persons | Create person |
| PUT | /api/persons/:id | Update person |
| DELETE | /api/persons/:id | Delete person |
| GET | /api/persons/:id/skills | List skills of a person |
| POST | /api/persons/:id/skills | Add skill to person |
| DELETE | /api/persons/:id/skills/:skillId | Remove skill from person |
| GET | /api/persons/matches/:matchId/assignments | List match assignments |
| POST | /api/persons/matches/:matchId/assignments | Create match assignment |
| PATCH | /api/persons/matches/:matchId/assignments/:assignmentId | Update match assignment |
| DELETE | /api/persons/matches/:matchId/assignments/:assignmentId | Delete match assignment |

### Skills (`/api/skills`, also nested at `/api/production/skills`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/skills | List skills |
| GET | /api/skills/export-json | Export skills (JSON) |
| POST | /api/skills/import-json | Import skills (JSON) |
| GET | /api/skills/:id | Get skill |
| POST | /api/skills | Create skill |
| PUT | /api/skills/:id | Update skill |
| DELETE | /api/skills/:id | Delete skill |

### Production (`/api/production`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/production | List productions |
| POST | /api/production | Create production |
| GET | /api/production/matches | List matches available for productions |
| GET | /api/production/:id | Get production |
| PUT | /api/production/:id | Update production |
| DELETE | /api/production/:id | Delete production |
| POST | /api/production/:id/activate | Activate production (deactivates all others) |
| GET | /api/production/:id/export | Export full production |
| POST | /api/production/import | Import full production |

#### Production persons, positions and crew

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/production/:id/persons | List persons attached to production |
| POST | /api/production/:id/persons | Attach person to production |
| DELETE | /api/production/:id/persons/:productionPersonId | Detach person |
| GET | /api/production/:id/person-positions | List person-position assignments |
| POST | /api/production/:id/person-positions | Create person-position assignment |
| PUT | /api/production/:id/person-positions | Replace person-position assignments |
| DELETE | /api/production/:id/person-positions/:personPositionId | Delete person-position assignment |
| GET | /api/production/:id/crew | Crew overview |
| GET | /api/production/:id/crew-report | Crew report |
| GET | /api/production/positions | List positions |
| POST | /api/production/positions | Create position |
| PUT | /api/production/positions/:id | Update position |
| DELETE | /api/production/positions/:id | Delete position |
| GET | /api/production/export/positions | Export positions |
| POST | /api/production/import/positions | Import positions |

#### Segments

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/production/:id/segments | List segments of production |
| POST | /api/production/:id/segments | Create segment |
| GET | /api/production/segments/:segmentId | Get segment |
| PUT | /api/production/segments/:segmentId | Update segment (incl. reorder) |
| DELETE | /api/production/segments/:segmentId | Delete segment |
| GET | /api/production/segments/:segmentId/persons | Persons available for segment |
| GET | /api/production/segments/:segmentId/assignments | List segment assignments |
| POST | /api/production/segments/:segmentId/assignments | Create segment assignment |
| DELETE | /api/production/segments/:segmentId/assignments/:assignmentId | Delete segment assignment |
| POST | /api/production/segments/:segmentId/assignments/copy | Copy assignments to other segments |
| GET | /api/production/segments/:segmentId/positions | Positions for segment |
| GET | /api/production/segment-default-positions | List default positions per segment |
| GET | /api/production/segment-default-positions/names | List segment names with defaults |
| PUT | /api/production/segment-default-positions | Update default positions |

#### Segment templates (`/api/production/segment-templates`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/production/segment-templates | List segment templates |
| POST | /api/production/segment-templates | Create segment template |
| GET | /api/production/segment-templates/:id | Get segment template |
| PUT | /api/production/segment-templates/:id | Update segment template |
| DELETE | /api/production/segment-templates/:id | Delete segment template |
| PUT | /api/production/segment-templates/:id/set-default | Mark template as default |
| POST | /api/production/segment-templates/:id/items | Add template item |
| PUT | /api/production/segment-templates/items/:itemId | Update template item |
| DELETE | /api/production/segment-templates/items/:itemId | Delete template item |
| POST | /api/production/segment-templates/apply/:templateId/to/:productionId | Apply template to production |
| POST | /api/production/segment-templates/from-production/:productionId | Create template from production |
| GET | /api/production/segment-templates/:id/export-json | Export template (JSON) |
| POST | /api/production/segment-templates/import-json | Import template (JSON) |

#### Timing, events and live callsheet controls

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/production/:id/timing | Production timing |
| GET | /api/production/:id/clocks | Production clocks |
| GET | /api/production/next-date | Next production date |
| GET | /api/production/dates | Production dates |
| POST | /api/production/:id/events | Create production event |
| GET | /api/production/:id/events | List production events |
| GET | /api/production/:id/events/positions | Positions per event |
| GET | /api/production/:id/events/:eventId | Get production event |
| DELETE | /api/production/:id/events/:eventId | Delete production event |
| POST | /api/production/callsheet/set-active/:id | Set active callsheet item |
| POST | /api/production/callsheet/next | Go to next callsheet item |
| POST | /api/production/callsheet/previous | Go to previous callsheet item |
| POST | /api/production/callsheet/update-scoreboard-time | Update scoreboard time |

#### Callsheets

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/production/:id/callsheets | List callsheets of production |
| POST | /api/production/:id/callsheets | Create callsheet |
| POST | /api/production/:id/callsheets/import-excel | Import callsheet from Excel |
| GET | /api/production/callsheets/:callSheetId | Get callsheet |
| PUT | /api/production/callsheets/:callSheetId | Update callsheet |
| DELETE | /api/production/callsheets/:callSheetId | Delete callsheet |
| POST | /api/production/callsheets/:callSheetId/calculate-times | Recalculate item times from time anchor |
| POST | /api/production/callsheets/:callSheetId/sync-to-events | Sync callsheet to production events |
| POST | /api/production/callsheets/:callSheetId/items | Add callsheet item |
| PUT | /api/production/callsheet-items/:itemId | Update callsheet item |
| DELETE | /api/production/callsheet-items/:itemId | Delete callsheet item |

#### Titles, interviews and reports

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/production/:id/titles | List title definitions |
| POST | /api/production/:id/titles | Create title definition |
| PUT | /api/production/:id/titles/:titleId | Update title definition |
| DELETE | /api/production/:id/titles/:titleId | Delete title definition |
| PATCH | /api/production/:id/titles:reorder | Reorder title definitions |
| GET | /api/production/:id/interviews | List interview subjects |
| PUT | /api/production/:id/interviews | Replace interview subjects |
| GET | /api/production/:id/interviews/options | Interview subject options |
| GET | /api/production/:id/report | Get production report |
| POST | /api/production/:id/report | Save production report |
| DELETE | /api/production/:id/report | Delete production report |
| GET | /api/production/:id/report/pdf | Report as PDF |
| GET | /api/production/:id/report/markdown | Report as Markdown |
| GET | /api/production/:id/report/whatsapp | Report as WhatsApp text |

### Callsheet templates (`/api/callsheets/templates`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/callsheets/templates | List callsheet templates |
| POST | /api/callsheets/templates | Create callsheet template |
| GET | /api/callsheets/templates/:id | Get callsheet template |
| PUT | /api/callsheets/templates/:id | Update callsheet template |
| DELETE | /api/callsheets/templates/:id | Delete callsheet template |
| POST | /api/callsheets/templates/:id/items | Add template item |
| PUT | /api/callsheets/templates/items/:itemId | Update template item |
| DELETE | /api/callsheets/templates/items/:itemId | Delete template item |
| PUT | /api/callsheets/templates/:id/reorder | Reorder template items |
| POST | /api/callsheets/templates/:id/apply/:productionId | Apply template to production |
| GET | /api/callsheets/templates/:id/export | Export template |
| POST | /api/callsheets/templates/import | Import template |
| GET | /api/callsheets/templates/:id/export-json | Export template (JSON) |
| POST | /api/callsheets/templates/import-json | Import template (JSON) |

### Matches (`/api/match`, `/api/manual-matches`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/match/matches/schedule | Fetch match schedule from provider |
| POST | /api/match/matches/schedule/import | Import match schedule |
| GET | /api/manual-matches | List manual matches |
| POST | /api/manual-matches | Create manual match |
| PUT | /api/manual-matches/:id | Update manual match |
| DELETE | /api/manual-matches/:id | Delete manual match |

### Scoreboard (`/api/scoreboard`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/scoreboard | Current score (venue scoreboard proxy) |
| GET | /api/scoreboard/shotclock | Shotclock state |
| GET | /api/scoreboard/clock | Match clock |

### Settings (`/api/settings`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/settings/version | App version |
| GET | /api/settings/vmix-url | Get vMix URL |
| PUT | /api/settings/vmix-url | Set vMix URL |
| GET | /api/settings/sponsor-config | Get sponsor config |
| PUT | /api/settings/sponsor-config | Set sponsor config |
| GET | /api/settings/scoreboard-config | Get scoreboard config |
| PUT | /api/settings/scoreboard-config | Set scoreboard config |
| GET | /api/settings/club-config | Get club config |
| PUT | /api/settings/club-config | Set club config |

### Seasons (`/api/seasons`)

Season-bound endpoints (`GET /api/production`, `/api/production/matches`, `/api/manual-matches`, club rosters/teams, reports over productions, club imports) default to the active season and accept an optional `?seasonId=` (400 if invalid, 404 if unknown).

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/seasons | List seasons (with match/player counts, isActive), newest first |
| GET | /api/seasons/active | Active season (falls back to the season containing today) |
| GET | /api/seasons/suggest-next | Suggested next season `{ startYear, name }` |
| POST | /api/seasons | Create season `{ name: "2027/2028", activate? }` (409 if exists) |
| PUT | /api/seasons/active | Set active season `{ seasonId }` |
| DELETE | /api/seasons/:id | Delete an empty, non-active season (409 otherwise) |

### vMix (`/api/vmix`, `/api/admin/vmix`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/vmix/sync/activate-event | Activate event from vMix |
| POST | /api/vmix/production/trigger-manual | Manually trigger production event |
| POST | /api/vmix/set-timer | Set vMix timer |
| POST | /api/vmix/sponsor-rows | Sponsor rows data source (seeded) |
| GET | /api/vmix/sponsor-slides | Sponsor slides data source (seeded) |
| GET | /api/vmix/sponsor-names | Sponsor names data source |
| GET | /api/vmix/sponsor-carrousel | Sponsor carrousel data source |
| GET | /api/vmix/active-production/staff | Staff of active production |
| GET | /api/vmix/endpoints | List vMix data-source endpoints |
| GET | /api/vmix/production/active/titles | Titles of active production |
| GET | /api/vmix/production/:id/titles | Titles of a production |
| GET | /api/admin/vmix/title-templates | List title templates |
| POST | /api/admin/vmix/title-templates | Create title template |
| PUT | /api/admin/vmix/title-templates/:id | Update title template |
| DELETE | /api/admin/vmix/title-templates/:id | Delete title template |
| PATCH | /api/admin/vmix/title-templates:reorder | Reorder title templates |
| POST | /api/admin/vmix/production/:id/titles/use-default | Apply default titles to production |

### Reports (`/api/reports`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/reports/daily-occupancy | Daily crew occupancy |
| GET | /api/reports/daily-occupancy-by-position | Daily occupancy per position |
| GET | /api/reports/interviews | Interview report |
| GET | /api/reports/crew-roles | Crew roles report |
| GET | /api/reports/production-dates | Production dates |
| GET | /api/reports/next-production-date | Next production date |

### Show control and time (`/api/show`, `/api/time`)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/show/start/:productionId | Start show |
| POST | /api/show/next | Next event |
| POST | /api/show/previous | Previous event |
| POST | /api/show/recalculate/:productionId | Recalculate show timing |
| POST | /api/show/reset/:productionId | Reset show |
| POST | /api/show/stop/:productionId | Stop show |
| POST | /api/show/clock | Control show clock |
| POST | /api/time/start | Start production time |
| POST | /api/time/stop | Stop production time |
| POST | /api/time/countdown | Start countdown |
| POST | /api/time/venue-clock | Set venue clock |

### Backup (`/api/backup`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/backup/{entity}/export | Export entity as JSON; entity = segment-templates, persons, skills, positions, matches, producties, clubs, sponsors, settings |
| POST | /api/backup/{entity}/import | Import entity from JSON; same entities |
