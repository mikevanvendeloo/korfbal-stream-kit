# E2E Test Plan

Comprehensive end-to-end test plan for Playwright testing against the live application. This is a living document — new test cases are added with every feature that goes through e2e testing.

---

## Setup

This application has no authentication. All pages are publicly accessible. Tests run against the full stack: `npm run dev` (API on 3333, frontend on 4200) with a seeded test database.

**Prerequisites:**
- PostgreSQL running: `npm run db:up`
- Database seeded: `npm run prisma:seed`
- Full stack running: `npm run dev`

---

## Test Phases

### Phase 0: Setup (sequential)

Seed the database with:
- At least 2 matches (one past, one upcoming)
- A set of sponsors (premium, goud, zilver)
- Skill and position catalog
- At least 3 crew members with skills
- One active production linked to the upcoming match

### Phase 1: Feature Tests (parallel)

Each group tests independent features. Safe to parallelize.

### Phase 2: Live Show Tests (sequential)

Tests that advance show state (start/next/stop) must run sequentially to avoid state conflicts.

---

## Test Angles

Every feature should be tested from multiple angles:

1. **Happy path** — the primary user flow as designed
2. **Error and edge cases** — empty states, boundary values, missing data
3. **State persistence** — refresh, navigate away and back
4. **Real-time** — Socket.io-driven updates reflect on screen without refresh

---

## Test Groups

### Group 1: Productions

| # | Scenario | Angle | Steps | Expected |
|---|----------|-------|-------|----------|
| 1.1 | Create a production | Happy path | Navigate to /admin/productions, click "Nieuwe productie", select a match, submit | Production appears in list with match name and date |
| 1.2 | Activate a production | Happy path | From production list, click "Activeer" on an inactive production | Production shows "Actief" badge; previous active production shows inactive |
| 1.3 | View production detail | Happy path | Click on production in list | Detail page shows segments, crew, and callsheet list |
| 1.4 | Add a segment | Happy path | On production detail, click "Segment toevoegen", fill name + duration, submit | Segment appears in list with correct volgorde |
| 1.5 | Reorder segments | Happy path | Drag segment to different position | Segment volgorde updates; other segments renumber |
| 1.6 | Create without a match | Error | Click "Nieuwe productie", submit without selecting a match | Validation error shown |

### Group 2: Callsheets

| # | Scenario | Angle | Steps | Expected |
|---|----------|-------|-------|----------|
| 2.1 | Open callsheet editor | Happy path | Navigate to production → Callsheets → open "Callsheet" | Items listed in order with timing |
| 2.2 | Add callsheet item | Happy path | Click "Item toevoegen", fill title + duration, select positions, submit | Item appears with correct positions |
| 2.3 | Calculate times | Happy path | Click "Bereken tijden" | All items show calculated timeStart/timeEnd |
| 2.4 | Edit item | Happy path | Click edit on item, change title, save | Updated title shown |
| 2.5 | Delete item | Happy path | Click delete on item, confirm | Item removed |
| 2.6 | Callsheet with no anchor | Edge case | Remove isTimeAnchor from all items, calculate times | Times shown as relative or error handled gracefully |

### Group 3: Live Show Control

| # | Scenario | Angle | Steps | Expected |
|---|----------|-------|-------|----------|
| 3.1 | Start show | Happy path | Navigate to show-caller with active production, click "Start" | First event becomes ACTIVE; clock starts counting |
| 3.2 | Advance to next event | Happy path | Click "Volgende" | Previous event COMPLETED; next event ACTIVE; clock resets |
| 3.3 | Go to previous event | Happy path | Click "Vorige" | Previous event reactivated |
| 3.4 | Stop show | Happy path | Click "Stop" | All events reset; clock stops |
| 3.5 | Real-time sync across tabs | Real-time | Open show-caller in two tabs; advance in one | Other tab updates without refresh |
| 3.6 | Auto-advance | Happy path | Set event with autoAdvance=true, durationSec=5; start show | After 5 seconds, automatically advances to next event |

### Group 4: Sponsors

| # | Scenario | Angle | Steps | Expected |
|---|----------|-------|-------|----------|
| 4.1 | List sponsors | Happy path | Navigate to /sponsors | Sponsors listed with logo, type, name |
| 4.2 | Create sponsor | Happy path | Click "Toevoegen", fill name + type, submit | Sponsor appears in list |
| 4.3 | Upload sponsor logo | Happy path | Edit sponsor, upload image | Logo thumbnail visible |
| 4.4 | Disable sponsor | Happy path | Edit sponsor, toggle enabled off | Sponsor shows as disabled; excluded from vMix feeds |
| 4.5 | Export to Excel | Happy path | Click "Exporteer Excel" | Excel file downloads with all sponsors |
| 4.6 | Import from Excel | Happy path | Upload a valid Excel with sponsor data | Import result shows created/updated counts |
| 4.7 | Import with invalid type | Error | Upload Excel with unknown type value | Problems array contains the bad row |

### Group 5: Crew & Configuration

| # | Scenario | Angle | Steps | Expected |
|---|----------|-------|-------|----------|
| 5.1 | Add a person | Happy path | Navigate to /admin/persons, click "Toevoegen", fill name + gender | Person in list |
| 5.2 | Assign skill to person | Happy path | Edit person, add skill | Skill badge on person card |
| 5.3 | Create position | Happy path | Navigate to /admin/positions, create position with category GENERAL | Position in list |
| 5.4 | Import match schedule | Happy path | Navigate to /matches/schedule, click "Importeer", pick date range | Matches appear in schedule list |

### Group 6: vMix Feeds

| # | Scenario | Angle | Steps | Expected |
|---|----------|-------|-------|----------|
| 6.1 | Sponsor ticker endpoint | Happy path | GET /api/vmix/sponsor-names | Returns valid JSON array with "sponsor-names" key |
| 6.2 | Sponsor carousel endpoint | Happy path | GET /api/vmix/sponsor-carrousel | Returns array with name, commercial, type, website |
| 6.3 | Titles for active production | Happy path | GET /api/vmix/production/active/titles | Returns array with functionName + name pairs |
| 6.4 | vMix endpoints list | Happy path | Navigate to /admin/vmix/datasources | All endpoints listed with URLs |

---

## Bug-Found Protocol

When an e2e test finds a bug, follow this process before fixing:

1. **Document the finding** — spec, scenario, expected vs. actual, severity, screenshot
2. **Write a unit test first** — capture the failure at the unit level. This test should FAIL with current code.
3. **Fix the bug** — minimal fix targeting only the broken code path
4. **Verify the unit test passes** — run the unit test suite
5. **Re-run the e2e scenario** — verify it passes through the real UI
6. **Continue testing** — only after both unit and e2e tests pass
