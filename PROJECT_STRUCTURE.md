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
    ├── main.ts                # Express app: router mounting, organization context, static assets, OpenAPI/Swagger, Socket.io init
    ├── standardSet/           # Standard set for new organizations (skills, positions, title/callsheet/segment templates)
    ├── test-setup.ts          # Vitest setup (.env.test, Prisma lifecycle)
    ├── routes/                # Express routers mounted under /api/*
    │   ├── organizations.ts   # Organizations (global): public list for the start screen, CRUD, logo
    │   ├── matchSource.ts     # Match import source of the chosen organization (token never returned), test connection
    │   ├── apiKeys.ts         # API keys of the chosen organization (feeds): create once, list, revoke
    │   ├── sponsors.ts        # Sponsors CRUD, logo upload, Excel import/export
    │   ├── clubs.ts           # Clubs/teams, league import, club players
    │   ├── persons.ts         # Crew persons, person skills, match assignments
    │   ├── skills.ts          # Skills (capabilities) CRUD + JSON import/export
    │   ├── players.ts         # Players and player images
    │   ├── match.ts           # Match schedule fetch/import (via MatchScheduleProvider)
    │   ├── manual-matches.ts  # Manually entered matches
    │   ├── scoreboard.ts      # Proxy to venue scoreboard / shotclock
    │   ├── settings.ts        # App settings (vMix URL, sponsor/scoreboard/club config)
    │   ├── seasons.ts         # Seasons (seizoenen): list, create, delete, active season, indoor start date
    │   ├── vmix.ts            # vMix data sources (sponsors, staff, titles, callsheet timing) + admin title templates
    │   ├── reports.ts         # Cross-production reports (occupancy, interviews, crew roles)
    │   ├── backup.ts          # Per-entity JSON backup export/import, image zip (services/backupImages.ts)
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
    │   ├── appSettings.ts             # Settings per organization (OrganizationSetting) + global keys (Setting), cached (also "not set")
    │   ├── ownClub.ts                 # Own club = Organization.clubId (get/set for club-config, placeholders, restore)
    │   ├── apiErrorCodes.ts           # Stable error codes ({error, code}) for organization/key/origin refusals; kept in sync with the kit
    │   ├── organizationContext.ts     # AsyncLocalStorage organization context, runWithOrganization
    │   ├── tenantScope.ts             # Prisma extension: organizationId on every tenant query
    │   ├── standardSet.ts             # applyStandardSet(orgId): idempotent standard set
    │   ├── apiKeys.ts                 # API keys: generate, SHA-256 hash, lookup (5 s cache), revoke, lastUsedAt
    │   ├── season.ts                  # Season derivation (1 Jul–30 Jun), active season, seasonId resolution, asset dirs
    │   ├── seasonAssetMigration.ts    # Startup job: moves legacy player photos/team-responses into storage/seasons/<YYYY-YYYY>/
    │   ├── production.ts              # Production report data loading
    │   ├── reportSponsors.ts          # Match/ball sponsor name → sponsor logo (report page + PDF); pdfImage(): PNG/JPEG by magic bytes, else a note
    │   ├── productionStaffing.ts      # Minimum staffing summary for many productions at once (productions list "Bezetting")
    │   ├── productionState.ts         # In-memory live state per organization (active production/event, clocks)
    │   ├── matchChange.ts             # A moved match shifts its production's liveTime, callsheet item and planned event times (not while live)
    │   ├── socket.ts                  # Socket.io server, room org:<id> per handshake, emitToOrganization, broadcastState()
    │   ├── timeSyncService.ts         # Production time / countdown
    │   ├── venueClockSyncService.ts   # Sync with venue scoreboard clock
    │   └── matchSchedule/             # Match schedule adapters
    │       ├── MatchScheduleProvider.ts              # Provider interface + normalized types
    │       ├── VrijwilligersMatchScheduleProvider.ts # sportclubvrijwilligersmanagement.nl adapter
    │       ├── providerFactory.ts                    # Selects the provider of the organization's MatchSource
    │       └── index.ts                              # Exports the configured provider instance
    ├── schemas/               # Zod input schemas (sponsor, person, skill, capability, title, season)
    ├── utils/
    │   ├── logger.ts          # Logger
    │   ├── time.ts            # Europe/Amsterdam formatting/parsing (vMix text, reports, parseInstant), DST rules
    │   ├── sponsorRows.ts     # Sponsor row/slide generation (seeded mulberry32 RNG)
    │   ├── clubs.ts           # Team-name normalization, club lookup by team name
    │   └── array-utils.ts     # shuffle helper
    ├── domain/
    │   ├── positionSkill.ts   # Position name -> required skill code mapping
    │   ├── crewGroup.ts       # Crew/Entertainment group of a person from the categories of their skills' positions
    │   └── minimumStaffing.ts # Minimum staffing rule (roles, counts, skill codes) with a one-person-one-role matching
    └── middleware/
        ├── organizationContext.ts # X-Organization → organization context (401/403 with code), global routes exempt, 5 s slug cache
        ├── apiKey.ts          # API key (?key= / X-Api-Key) on feed routes (FEED_API_PATHS), kept out of logs
        └── error.ts           # Central Express error handler
```

## Frontend

```
apps/korfbal-stream-kit/src/
├── main.tsx                   # React entry; installs the organization fetch wrapper (X-Organization)
├── styles.css, styles/        # Tailwind entry + extra CSS (calendar)
├── app/
│   ├── app.tsx                # OrganizationGate (start screen), then LIVE (/) and Beheer (/admin/*)
│   ├── LiveApp.tsx            # LIVE nav + routes (incl. /vmix)
│   ├── AdminApp.tsx           # Beheer menu (Producties, Draaiboeken, Stamgegevens, Rapportages, Overig) + routes
│   ├── pages/CallsheetPage.tsx
│   ├── components/callsheet/GlobalClocks.tsx
│   └── hooks/useCallsheetSync.ts
├── pages/                     # Route-level pages
│   ├── ProductionsAdminPage.tsx, ProductionDetailPage.tsx, ActiveProductionPage.tsx
│   ├── CallSheetsPage.tsx, CallSheetEditPage.tsx, LiveCallsheetEntry.tsx
│   ├── CallSheetTemplatesPage.tsx, CallSheetTemplateDetailsPage.tsx
│   ├── SegmentTemplatesPage.tsx, SegmentDefaultsAdminPage.tsx
│   ├── PersonsAdminPage.tsx, SkillsAdminPage.tsx, PositionsAdminPage.tsx
│   ├── ProductionAttendancePage.tsx, ProductionStaffingPage.tsx, CrewReportPage.tsx
│   ├── ProductionReportPage.tsx, ProductionTimingReportPage.tsx, ReportsPage.tsx (/admin/rapportages/:tab)
│   ├── ProductionTitlesPage.tsx, LiveVmixPage.tsx (LIVE), InterviewsPage.tsx (LIVE → Interviews), VmixConnectionPage.tsx, VmixDatasourcesPage.tsx, VmixTemplatesPage.tsx
│   ├── SponsorsPage.tsx, SponsorSlidesPage.tsx
│   ├── ClubsPage.tsx, MatchSchedulePage.tsx, ManualMatchesAdminPage.tsx
│   ├── ScoreboardPage.tsx, QRAdminPage.tsx, AboutPage.tsx
│   ├── OrganizationsAdminPage.tsx # Beheer → Setup → Organisaties: list, create, edit, (de)activate, logo
│   ├── OrganizationAdminPage.tsx  # Beheer → Setup → Organisatie: logo, Wedstrijdimport, API-sleutels
│   ├── SettingsPage.tsx       # Tabbed settings page
│   └── settings/              # Settings tabs
│       ├── SeasonSettingsTab.tsx      # Active season, create/delete season, new-season imports
│       ├── ConnectionSettingsTab.tsx  # vMix / scoreboard connections
│       ├── SponsorSettingsTab.tsx     # Sponsor filter config
│       ├── ClubSettingsTab.tsx        # Own club config
│       └── BackupSettingsTab.tsx      # Backup export/import (for the chosen organization)
├── components/ShowCallerPhone.tsx # Show Caller on phones (< 768 px): now, next, later, controls at the bottom
├── components/InterviewAvatar.tsx, FallbackImage.tsx, InterviewPhotosToggle.tsx # Interview photos (photo / number / initials), the "Interviewfoto's" switch (hooks/useInterviewPhotos.ts)
├── handleiding/               # User manual: live/*.md and beheer/*.md, ManualView, HelpButton, helpTopics (route → chapter)
├── components/                # Feature components
│   ├── OrganizationGate.tsx   # Start screen, chosen organization context (useCurrentOrganization), OrganizationSwitcher (nav)
│   ├── OrganizationLogo.tsx   # Own logo → club logo → initials
│   ├── ApiKeys.tsx            # API key list/create/revoke, one-time key dialog, feed URLs with the key
│   ├── CallSheetView.tsx, CallSheetColumn.tsx, CallSheetItem.tsx, CallSheetTemplateSelector.tsx
│   ├── ShowControl.tsx, ShowCallerView.tsx, TimeControls.tsx, TimeDisplay.tsx
│   ├── SegmentFormModal.tsx, SegmentAssignmentsCard.tsx, SegmentOverridesManager.tsx,
│   │   SegmentTemplateSelector.tsx, CopyAssignmentsModal.tsx, PositionSelector.tsx
│   ├── PersonsTable.tsx, PlayerCard.tsx, TitlesManager.tsx
│   ├── SponsorsTable.tsx, SponsorFormModal.tsx
│   ├── ProductionLayout.tsx   # Tabs of one production: Draaiboek, Beschikbaarheid, Bezetting, vMix-titels, Rapport
│   ├── ProductionWideAssignmentsCard.tsx
│   ├── MatchHeader.tsx, ProductionHeader.tsx, ClubLogo.tsx, AppLogo.tsx, AppIcon.tsx
│   ├── IconButton.tsx, MultiSelect.tsx, SimpleCalendar.tsx, ErrorBoundary.tsx
│   └── ui/                    # Base UI primitives (button, card, input)
├── hooks/                     # TanStack Query hooks per domain + live state
│   ├── useProductions.ts, useCallsheet.ts, useCallSheetTemplates.ts, useCallSheetSync.ts
│   ├── useSegmentTemplates.ts, usePositions.ts, usePersons.ts, useInterviews.ts, useTitles.ts
│   ├── useSponsors.ts, useClubs.ts, useMatch.ts, useMatchSchedule.ts, useManualMatches.ts
│   ├── useReports.ts, useProductionReport.ts, useSettings.ts
│   ├── useSeasons.ts          # Seasons + active season (invalidates all queries on change)
│   ├── useOrganizations.ts    # Organizations, match source, API keys, vMix endpoints
│   ├── useLiveState.ts        # Socket.io live production state
│   └── useFontSize.ts         # UI font-size preference
├── lib/
│   ├── api.ts                 # API base URL / fetch helpers
│   ├── organization.ts        # Chosen organization (localStorage), fetch wrapper adding X-Organization, socket auth, slug rename
│   ├── apiErrorCodes.ts       # The API's stable error codes (kept in sync with the API)
│   ├── socket.ts              # Shared Socket.io connection (handshake auth.organization), reconnect on switch
│   ├── adminPaths.ts          # All Beheer URLs
│   ├── download.ts            # File downloads; downloadFromApi for exports (fetch, so the header goes along)
│   ├── time.ts                # Show/enter times in Europe/Amsterdam on any device (formatTime, datetime-local values)
│   └── sponsorUtils.ts        # Sponsor helpers
├── config/
│   └── scoreboardLabels.ts    # Scoreboard display labels
└── theme/
    └── ThemeProvider.tsx      # Light/dark theme context
```

## API Endpoints

No login (internal LAN tool), but every `/api` request needs an organization: `X-Organization: <slug>` (401 "Kies een organisatie" without, 403 for an unknown or inactive one). Global routes work without: `/api/health`, `/api/organizations`, `/api/seasons`, `/api/clubs`, `/api/players`, docs. Feed routes (`/api/vmix` data sources and triggers, `/api/scoreboard/*`) take an API key of the organization instead (`?key=` or `X-Api-Key`). Swagger UI at `/api/docs`, OpenAPI JSON at `/api/openapi.json`.

### Core (`main.ts`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET | /api/openapi.json | OpenAPI document |
| GET | /assets/\*, /uploads/\*, /storage/\* | Static files from `ASSETS_DIR` |

### Organizations (`/api/organizations`, global), match source and API keys

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/organizations | Active organizations (start screen); `?all=true` also the inactive ones |
| GET | /api/organizations/:id | One organization |
| POST | /api/organizations | Create (name, slug, clubId) with the standard set |
| PUT | /api/organizations/:id | Update name, slug, clubId, isActive |
| POST | /api/organizations/:id/logo | Upload logo (multipart `file`, png/jpg/gif/webp) |
| DELETE | /api/organizations/:id/logo | Remove the own logo |
| GET | /api/match-source | Match import source of the chosen organization (`hasApiToken`, never the token) |
| PUT | /api/match-source | Save provider, baseUrl, isEnabled, apiToken (absent keeps, null removes) |
| POST | /api/match-source/test | Test the stored source (asks for `1-weeks`): `{ok: true, matches}` or `{ok: false, error, code, hint}` with a category code (`SOURCE_*`, see `services/apiErrorCodes.ts`) |
| GET | /api/organization/api-keys | API keys (name, prefix, createdAt, lastUsedAt, revokedAt) |
| POST | /api/organization/api-keys | Create a key `{name}`: the full key is in this answer only |
| DELETE | /api/organization/api-keys/:id | Revoke a key |

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
| PUT | /api/clubs/:slug | Edit name, short name, abbreviation, `primaryColor`/`secondaryColor` (#rrggbb, empty removes) (slug never changes) |
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
| GET | /api/production | List productions, each with `staffing` (`{presentCount, met, shortfall, roles}`, `services/productionStaffing.ts`: the people present of all productions in one query) |
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
| GET | /api/production/:id/attendance | Beschikbaarheid: every person of the organization with group (`crew`/`entertainment`, `domain/crewGroup.ts`), skills and presence (`productionPersonId`), plus the minimum staffing of the people present (`domain/minimumStaffing.ts`) |
| POST | /api/production/:id/persons | Attach person to production |
| DELETE | /api/production/:id/persons/:productionPersonId | Detach person |
| GET | /api/production/:id/person-positions | List person-position assignments |
| POST | /api/production/:id/person-positions | Create person-position assignment |
| PUT | /api/production/:id/person-positions | Replace person-position assignments |
| DELETE | /api/production/:id/person-positions/:personPositionId | Delete person-position assignment |
| GET | /api/production/:id/crew | Crew overview |
| GET | /api/production/active | The active production with its match, independent of the active season (`{item}` or `{item: null}`) |
| GET | /api/production/:id/crew-report | Crew report: effective crew per segment (production-wide + per segment, `services/crewReport.ts`), filled positions per category, callsheets with `positionIds` |
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
| GET | /api/production/:id/interview-names | Selected interview names per side/role + own club side (for `{coach-uit}` placeholders), plus `people` (name, shirtNo, photoUrl) for the photos next to them |
| GET | /api/production/:id/interview-cards | The chosen interviews for LIVE → Interviews: `{items: [{id, side, role, title, name, shirtNo, photoUrl, teamName}]}`. PUT `/interviews` emits socket `interviews_updated` `{productionId}` to the organization |
| PUT | /api/production/:id/interviews | Replace interview subjects |
| GET | /api/production/:id/interviews/options | Interview subject options |
| GET | /api/production/:id/report | Get production report |
| POST | /api/production/:id/report | Save production report (match sponsor, ball sponsor, rationale, remarks) |
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
| POST | /api/match/matches/schedule/import | Import match schedule. An updated match whose date moved shifts its production's times (`services/matchChange.ts`). `?date=` DD-MM-YYYY or YYYY-MM-DD (from that day), `N-weeks` (from the current week; default `30-weeks`) or `indoor` (from `Season.indoorStartDate` of the active season). Failures: `{ok: false, error, code, hint}` (`INVALID_DATE`, `SOURCE_*`) |
| GET | /api/manual-matches | List manual matches |
| POST | /api/manual-matches | Create manual match |
| PUT | /api/manual-matches/:id | Update manual match; a moved date shifts the production's `liveTime`, callsheet item times and planned event times by the same delta (`services/matchChange.ts`, not while that production is live) |
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
| GET | /api/settings/vmix-url | Get the URL of the first vMix instance |
| PUT | /api/settings/vmix-url | Set the URL of the first vMix instance |
| GET | /api/settings/vmix-instances | Get the vMix instances (name, URL) and which one each function (countdown, callsheet) uses |
| PUT | /api/settings/vmix-instances | Set the vMix instances and function targets |
| GET | /api/settings/vmix-callsheet-push | Get callsheet → vMix push config (title, fields, colours, positions) |
| PUT | /api/settings/vmix-callsheet-push | Set callsheet → vMix push config |
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
| PUT | /api/seasons/:id | Set the indoor competition start date `{ indoorStartDate: "DD-MM-YYYY" \| null }` (within the season) |
| DELETE | /api/seasons/:id | Delete an empty, non-active season (409 otherwise) |

### vMix (`/api/vmix`, `/api/admin/vmix`)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/vmix/sync/activate-event | Activate event from vMix |
| POST | /api/vmix/production/trigger-manual | Manually trigger production event |
| POST | /api/vmix/set-timer | Set the countdown in the vMix chosen for it (`instanceId` overrides); feed (API key, Stream Deck) |
| GET | /api/vmix/callsheet/timing?position=A,B | Current + next callsheet item for positions (remaining time, vMix timer format, start times, colour state) |
| POST | /api/vmix/callsheet/push | Push current/next item to the configured vMix title now; `warnings`: input or text fields vMix doesn't have (checked against its XML state) |
| GET | /api/vmix/inputs | Inputs of the vMix for `?function=` (callsheet/countdown, `instanceId` overrides): number, key, type, title, text fields; 502 when unreachable |
| POST | /api/vmix/sponsor-rows | Sponsor rows data source (seeded) |
| GET | /api/vmix/sponsor-slides | Sponsor slides data source (seeded) |
| GET | /api/vmix/sponsor-names | Sponsor names data source |
| GET | /api/vmix/sponsor-carrousel | Sponsor carrousel data source |
| GET | /api/vmix/active-production/match | Match of the active production as one vMix row: teams, club logos, date/kickoff/attendance/live time, venue, referees, score, match + ball sponsor with logo (`services/vmixMatchInfo.ts`) |
| GET | /api/vmix/active-production/staff | Staff of active production |
| GET | /api/vmix/endpoints | List vMix data-source endpoints |
| GET | /api/vmix/production/active/titles | Titles of active production |
| GET | /api/vmix/production/active/titles/:role | One title of the active production by role (`presentatie`, `presentatie-analist`, `commentaar`, `coach-thuis`, `coach-uit`, `speler-thuis`, `speler-uit`); an empty row when there is none |
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
| GET | /api/reports/crew-roles | Crew roles per production: speaker, regisseur, presentator, analist, commentaar |
| GET | /api/reports/production-dates | Production dates |
| GET | /api/reports/next-production-date | Next production date |

### Show control and time (`/api/show`, `/api/time`)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/show/start/:productionId | Start show |
| POST | /api/show/next | Next event; feed (API key, Stream Deck) |
| POST | /api/show/previous | Previous event; feed (API key, Stream Deck) |
| POST | /api/show/remaining | Set the active item's remaining time (`{seconds}`, 1–3600): its duration becomes elapsed + seconds; auto-advance and the following items move along; feed (API key, Stream Deck) |
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
| GET | /api/backup/images | Zip of the chosen organization's images (sponsors/<slug>/, organizations/<slug>.<ext>, used club logos and player photos), paths relative to ASSETS_DIR |
