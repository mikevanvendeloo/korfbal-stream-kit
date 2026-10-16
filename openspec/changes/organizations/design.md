# Design: organizations

Step 1 of the multi-tenant design: organizations and data isolation, without login. Decisions marked **(user)** were made by the product owner. Those marked **(confirmed)** fill in details and still need confirmation.

## D1. Organization model (user)

```prisma
model Organization {
  id        Int      @id @default(autoincrement())
  slug      String   @unique          // "fortuna", "knkv"
  name      String
  logoUrl   String?                   // storage/organizations/<id>.<ext>
  clubId    Int?                      // optional link to the shared Club (logo fallback, own club)
  isActive  Boolean  @default(true)   // only active organizations are on the start screen
  createdAt DateTime @default(now())
}
```

- The migration creates Fortuna (`clubId` = the Fortuna club, when it exists) and KNKV. All existing rows get Fortuna's id.
- Logo: the uploaded logo, otherwise the linked club's logo, otherwise the initials. **(confirmed)**

## D2. Choosing the organization, same URLs (user)

- When no organization is chosen, LIVE and Beheer show a start screen with large buttons (logo + name) for every active organization. The choice is stored in `localStorage` (`organization` = slug).
- With exactly one active organization it is chosen automatically. **(confirmed)**
- The nav bar shows the current organization (logo/name), and clicking it opens the start screen again ("Wissel organisatie").
- URLs don't contain the organization. Later the organization will come from the login; someone with roles at more than one organization will get this same start screen.
- If the stored slug no longer exists or is inactive, the start screen is shown again.

## D3. Request context

- The browser sends `X-Organization: <slug>` on every `/api` request. This is added centrally with a fetch wrapper for same-origin `/api` URLs, so the 185 existing `fetch` calls don't need to change one by one. **(confirmed)** The Socket.io handshake sends the slug in `auth.organization`.
- Middleware `organizationContext` resolves the slug to an active organization and stores it in `AsyncLocalStorage` for the rest of the request.
- Routes for global data don't need an organization: `/api/health`, `/api/organizations` (list, start screen), `/api/seasons`, `/api/clubs`, `/api/players`, static assets. Every other `/api` route answers **401 "Kies een organisatie"** without one (later: not logged in), and **403** for an unknown or inactive organization. **(user)**

## D4. Isolation on every table (user)

- `organizationId` (FK, indexed) on **every** tenant table, including child tables: Production and all its children (segments, role assignments, callsheets, callsheet items and positions, events, event positions, report, interview subjects, production persons/positions, production title definitions and title parts), MatchSchedule, MatchRoleAssignment, Sponsor, Person, PersonSkill, Skill, Position, PositionLink, CallSheetTemplate and items/positions, SegmentTemplate and items, SegmentDefaultPosition, TitleDefinition, TitlePart, organization settings.
- Global (no `organizationId`): Season, Club, Player, PlayerImage, Organization, Setting (installation-wide).
- A **Prisma client extension** reads the organization from `AsyncLocalStorage` and, for every tenant model:
  - adds `organizationId` to `where` on find/count/aggregate/update/delete;
  - sets it on create/createMany/upsert;
  - throws when there is no organization in the context (so a forgotten context fails loudly instead of leaking).

  Code that runs outside a request (seed, migrations helper, background services, backup restore) sets the context explicitly with `runWithOrganization(orgId, fn)`. Raw SQL (`$queryRaw`, `$executeRaw`) is not filtered: every raw query must filter on organization by hand (checked in review).
- Foreign resources answer **404** (single resource) or are left out (lists), never 403.
- Unique constraints become per organization: `MatchSchedule(organizationId, externalId)`, `Skill(organizationId, code)`, `Position(organizationId, name)`, `CallSheetTemplate(organizationId, name)`, `SegmentTemplate(organizationId, name)`, `SegmentDefaultPosition(organizationId, segmentName, order)`, `OrganizationSetting(organizationId, key)`. `SegmentTemplate.isDefault` means default within the organization.
- **Leak test suite**: an integration spec creates the same scenario in two organizations and calls every tenant route as the other organization; each must answer 404 or an empty list. New routes must be added to this suite (route table in the spec, with a test that fails when a mounted route is missing from it). **(confirmed)**
- Global models (Season, Club, Player, Organization) are not scoped, but their relations into tenant tables are: `include`/`select` and `_count` of such a relation only see the organization in the context, nested writes into it (connect, set, update, delete, ...) only reach rows of that organization, and touching one without a context throws. A to-one relation from a global model into a tenant table (`Organization.matchSource`) and nested writes into the Organization's own relations (they would move rows between organizations) throw: query the tenant model itself. Relation filters in `where` (`matches: {some: …}`) are not scoped.
- `GET /api/seasons` is global: with an organization in the context `matchCount` counts only its own matches, without one it is 0 (no matches are counted). `season_changed` goes to every client and is built without an organization. Deleting a season that still has matches of any organization is refused by the database (409).
- Ids of `CallSheetItem` are global primary keys and are always generated by the server (`randomUUID()`); a client id (POST item, the ID column of an Excel import) is ignored, so an id of another organization can't collide or be probed.
- The error handler never sends internals: 503 only when the database can't be reached (P1xxx), P2025/P2003 → 404, P2002 → 409, every other error → 500 "Interne serverfout", details in the server log. Errors thrown on purpose with a 4xx `status` keep their message.
- The extension is the only enforcement in this step. Row Level Security can come later as an extra lock.

## D5. Settings

- New table `OrganizationSetting(organizationId, key, value)` for the per-organization keys: `vmixWebUrl`, `vmixInstances`, `vmixCallsheetPush`, `sponsorNamesTypes`, `sponsorRowsTypes`, `sponsorSlidesTypes`, `scoreboardUrl`, `shotclockUrl`, `ownClubId`, `productionTeamNames`.
- `Setting` stays for installation-wide keys: `activeSeasonId`.
- The settings cache is keyed by organization + key. `/api/settings` works on the chosen organization. **(confirmed)**
- The migration moves the existing per-organization keys to Fortuna.

## D6. Live state per organization (user)

- `productionState.ts` becomes a `Map<organizationId, LiveProductionState>`, with the clock interval and auto-advance timer per organization. Every exported function takes (or reads from context) the organization.
- "One active production" becomes **per organization**: activate (and the export/import that deactivates) only touches productions of the same organization. On startup, the active production of every organization is restored.
- Socket.io: clients join room `org:<id>` based on the handshake. Every live emit goes `io.to('org:<id>')`. `season_changed` and the heartbeat stay global. `timeSyncService` state is per organization.
- Background services (`vmixCallsheetPushService`, `venueClockSyncService`) loop over the organizations that have an active production and use that organization's settings.
- The vMix routes that search across productions (`/sync/activate-event`, `/production/trigger-manual`, `/active-production/staff`) are limited to the organization.
- Live state stays in memory (a restart resets it). Storing it in the database is a later step.

## D7. API keys for feeds (user)

- vMix data sources and other devices can't send a header or choose an organization. They identify themselves with an **API key of the organization**, as query parameter `?key=...` (vMix data sources are plain URLs). A header `X-Api-Key` is accepted too.
- Table `OrganizationApiKey(id, organizationId, name, keyHash, prefix, createdAt, lastUsedAt, revokedAt)`. The key (e.g. `sk_` + 32 random bytes, base64url) is shown **once** at creation, and only its SHA-256 hash is stored. **(confirmed)**
- Beheer → Organisatie → API-sleutels: create (with a name, e.g. "vMix stream-pc"), list (name, prefix, last used), revoke.
- A key only gives access to the feed routes (`/api/vmix/*` feeds, `/api/scoreboard/*`), not to Beheer routes. **(confirmed)**
- The vMix endpoints page shows the feed URLs with `key=<jouw-sleutel>`. Right after creating a key, it shows them filled in, ready to copy.
- **Breaking change**: existing vMix data sources without a key stop working, and get 401 "API-sleutel ontbreekt". After the update, Fortuna creates a key once and adds it to the vMix data sources. The release notes and the manual must say so. **(confirmed: no transition period without a key)**

## D8. Match import per organization (user)

- Table `MatchSource(id, organizationId, provider, baseUrl, apiToken, isEnabled, updatedAt)`. `provider` is `'vrijwilligers'` now and later `'sportlink'`; the provider factory gets the source instead of env vars.
- The token is stored in the database (needed to call the external API) and is **never returned**. The API only says whether it's set; a new value replaces it. Encryption at rest can come later. **(confirmed)**
- The token stays with the provider and origin it was entered for: when `provider` or the origin of `baseUrl` changes and the same request brings no new token, the stored token is removed (`hasApiToken: false`). Otherwise anyone could point the stored token at their own server. `baseUrl` must be `https:` (`http:` only outside production, for local mocks); a stored source with another address is not used.
- "Test verbinding" (`POST /api/match-source/test`) answers only ok or failed (generic message), nothing of the upstream answer: the address is chosen by the caller, so status, body or count would make it a probe for other servers.
- Beheer → Organisatie → Wedstrijdimport: provider, URL, token, and a "Test verbinding" button.
- The `MATCH_SCHEDULE_*` env vars are removed. On first startup after the migration, when they're set and Fortuna has no source yet, they're copied once into Fortuna's source. **(confirmed)**
- Fortuna-specific hard-coded values move to configuration: the team colour regex `Fortuna/Ruitenheer J(\d+)` in the volunteer adapter, and the `'Fortuna sponsor'` name in `routes/vmix.ts`. They're derived from the organization's name or `productionTeamNames`. **(confirmed)**

## D9. Standard set for new organizations (user)

- The standard set is defined in code (current `prisma/seed-data*`): 17 skills, 17 positions with links, 6 title templates, callsheet templates ("Alleen wedstrijd", "Draaiboek Korfbal League wedstrijd"), segment templates ("KorfbalLeague (Standaard)", "Oploopwedstrijd", "Reserve KorfbalLeague") and segment default positions.
- `applyStandardSet(organizationId)` adds it in one transaction, idempotently (it matches positions by name, as `findPositionByName` does). It's used by: creating an organization, the seed, and a startup check for organizations without positions (so KNKV gets it after the migration, even in environments that skip the seed). **(confirmed)**
- Fortuna's own data (sponsor Ruitenheer, named persons) stays seed data for Fortuna only, not part of the standard set.

## D10. Managing organizations

- Beheer → Overig → **Organisaties**: list, create (name, slug, logo, club link), edit, (de)activate. Creating applies the standard set.
- Beheer → Overig → **Organisatie** (the chosen one): logo, match import, API keys.
- Without login anyone can manage organizations in this step. That is acceptable for now; with login this becomes a platform administrator task.

## D11. Backup and restore per organization (user)

- Export contains the chosen organization's data (plus the shared reference data, as today) and its organization settings. API keys and the import token are **not** exported. **(confirmed)**
- Import restores into the chosen organization and only replaces that organization's data. An existing backup without organizations (like the 2025 backup) is imported into the chosen organization.
- `docker-compose-localtest.yml` restores a pg_dump, so it goes through the migration and ends up under Fortuna.

## D12. Files

- Directories are keyed on the **organization id, not the slug**: a slug can be renamed and then taken by a new organization, which would otherwise overwrite the old one's files.
- Sponsor logos go to `storage/sponsors/<organizationId>/<name>.<ext>`, stored as `<organizationId>/<file>`. Organization logos go to `storage/organizations/<organizationId>.<ext>`. Uploads accept only png/jpg/gif/webp, checked on the content.
- A sponsor's `logoUrl` is never derived from its name (that would resolve to a legacy shared file, possibly of another organization): it is null until an upload. A rename keeps the logo. A `logoUrl` sent by a client (POST/PUT, the Excel *Logo* column) is accepted only when it is the current value or lies in the organization's own directory; otherwise POST/PUT answer 400 and the Excel import ignores it.
- Existing (Fortuna) rows keep their flat file name (legacy, the shared `storage/sponsors/` directory); nothing new is written there, and no migration rewrites them. The backup restore (`/api/backup/sponsors/import`) also accepts such legacy file names, so a backup from before organizations (D11) keeps its logos; a logo in another organization's directory is not taken over.
- There is no generic upload endpoint: `/api/upload` (it kept any extension, e.g. `.html`/`.svg`, and served it same-origin) is removed.

## D13. Tests

- The global test setup creates a test organization (`test-org`). `createProductionScenario` and the test helpers run inside `runWithOrganization` and take an optional `organizationId`.
- Integration specs that create rows directly use the test organization context.
- e2e: the fixtures choose the organization (set `localStorage` before the page loads, send the header for API calls). One e2e test covers the start screen and switching organization.
- Leak test suite (D4) and per-organization live state test (two organizations live at the same time, each with its own active item).

## Implementation order

1. **Model & isolation**: migration (Organization, `organizationId` everywhere, per-org uniques, OrganizationSetting, MatchSource, OrganizationApiKey, Fortuna/KNKV), Prisma extension, context middleware, standard set, organizations API, test infrastructure, leak tests.
2. **Live per organization**: live state map, rooms, background services, vMix routes, API keys on feeds.
3. **Frontend**: start screen, fetch wrapper and socket handshake, Organisaties/Organisatie pages (logo, import, API keys), endpoints page with keys, backup per organization, manual chapters.

Steps 1 and 3 must be released together (without the header the API answers 401). The proposal is one branch with three commits and one PR, or three stacked PRs merged together.
