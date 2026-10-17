# Tasks: organizations

> Status: phases 1, 2 and 3 done (backend and frontend; release them together). See design.md (D1–D13) for every decision. Order: phase 1 → 2 → 3, released together.

## Phase 1: Model & isolation (backend)

- [x] Migration: `Organization`; `organizationId` (FK, index) on every tenant table incl. children (D4); per-org unique constraints; `OrganizationSetting`, `MatchSource`, `OrganizationApiKey`; create Fortuna (link to Fortuna club when present) and KNKV; move all existing rows and per-org setting keys to Fortuna
- [x] `AsyncLocalStorage` organization context + `runWithOrganization(orgId, fn)`
- [x] Prisma client extension: filter/set `organizationId` on all tenant models, throw without context
- [x] Middleware `organizationContext`: `X-Organization` slug → 401 when missing, 403 when unknown/inactive; global routes exempt (D3)
- [x] Settings per organization (`OrganizationSetting`, cache keyed by org + key); `activeSeasonId` stays global
- [x] Standard set: `applyStandardSet(orgId)` from seed data, idempotent; used by organization create, seed and a startup check
- [x] `/api/organizations`: public list (active, for the start screen); CRUD, logo upload (`storage/organizations/`)
- [x] Match import per organization: `MatchSource`, provider factory reads the source, token never returned, one-time copy of `MATCH_SCHEDULE_*` env into Fortuna; remove Fortuna hard-coding (team colour regex, 'Fortuna sponsor')
- [x] Sponsor logo uploads to `storage/sponsors/<org-slug>/`
- [x] Backup/restore per organization (D11), old backups import into the chosen organization
- [x] Tests: test organization in global setup; `createProductionScenario`/helpers in org context; leak test suite over every tenant route (fails when a mounted route is missing from its table)

## Phase 2: Live per organization & API keys (backend)

- [x] `productionState`: `Map<orgId, state>`, clock/auto-advance timers per org, restore every org's active production on start
- [x] Activate / export-import deactivate only within the organization
- [x] Socket.io: handshake `auth.organization` → room `org:<id>`; live emits to the room; season/heartbeat global; `timeSyncService` per org
- [x] `vmixCallsheetPushService`, `venueClockSyncService`: per organization with an active production, with its settings
- [x] vMix cross-production lookups limited to the organization
- [x] API keys: create (shown once, SHA-256 stored), list, revoke, `lastUsedAt`; `?key=` / `X-Api-Key` on feed routes (`/api/vmix/*` feeds, `/api/scoreboard/*`) → 401 "API-sleutel ontbreekt"; keys don't open Beheer routes
- [x] `/api/vmix/endpoints` shows URLs with `key=`
- [x] Tests: two organizations live at the same time; API key access/denial

## Phase 3: Frontend

- [x] Start screen: large buttons with logo + name per active organization; auto-choose when only one; stored in `localStorage`; shown again when the stored one is gone/inactive
- [x] Central fetch wrapper adding `X-Organization` to same-origin `/api` requests; socket handshake with the organization; React Query cache cleared on switch
- [x] Current organization in LIVE and Beheer nav, click → switch
- [x] Beheer → Overig → Organisaties (list/create/edit/(de)activate, logo, club link)
- [x] Beheer → Overig → Organisatie: match import (provider, URL, token set/not set, test connection), API keys (create with copy-once dialog, list, revoke)
- [x] vMix endpoints page: feed URLs with key, filled in right after creating a key
- [x] Backup page: per organization wording
- [x] Manual: chapters for choosing an organization, organizations, API keys and the vMix key change (LIVE + Beheer)
- [x] Tests: component tests; e2e fixtures choose the organization; e2e for start screen + switching
- [x] Exports via fetch (`downloadExport`) instead of plain links, so they carry X-Organization; CallSheetEditPage no longer shows a client-made item id

## Docs

- [x] CLAUDE.md conventions (organization context, extension, raw SQL rule, settings, live per org, API keys, frontend start screen and fetch wrapper), PROJECT_STRUCTURE.md, GLOSSARY.md (Organisatie, Startscherm, API-sleutel, Standaardset, Wedstrijdbron), openspec config context
