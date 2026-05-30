# Glossary

Shared vocabulary for this project. Managed via the `/glossary` skill.

Consult this file before using domain terms in specs, designs, and code. If a term is missing or ambiguous, use `/glossary add <term>` to propose a definition.

---

## Production & Show

**Production**
A single live broadcast event. Links a MatchSchedule to all resources needed to produce the show: crew, callsheets, segments, production events, and vMix titles. A match can exist without a production, but a production always references exactly one match.

**Active Production**
The one production with `isActive=true`. At most one production can be active at a time. All show control operations and Socket.io live state are scoped to the active production. Activation is transactional — activating one production atomically deactivates all others.

**Segment**
A named macro time block within a production (e.g. "Voorbeschouwing", "Eerste helft", "Rust"). Ordered by `volgorde`. Segments define the high-level structure of the broadcast; they do not contain individual cues — those live in CallSheetItems and ProductionEvents.

**Volgorde**
Dutch for "sequence". The ordering field for Segments within a production. Unique per production (DB constraint). Reordering uses a 2-phase approach to avoid constraint violations: bump the conflicting value by 1000, re-insert, then renumber all sequentially.

**ProductionEvent**
A single entry in the live show timeline — a "cue" that the show caller steps through during the broadcast. Has a status (WAITING → ACTIVE → COMPLETED), an optional vMix input name for automatic triggering, and optional auto-advance. Not the same as a CallSheetItem, though items can be promoted to events via sync.

**Show Control**
The set of operations that advance the live show through its ProductionEvents: start, next, previous, and stop. Operated via the `/api/show` endpoints. Show control also drives the production clock and triggers Socket.io broadcasts.

**Time Anchor**
The single reference point for absolute time calculations within a production. One segment or callsheet item is marked `isTimeAnchor=true`. Its time is set to a known absolute value (e.g. match kick-off); all other items are calculated relative to it — backwards for items before the anchor, forwards for items after.

**Auto-Advance**
A flag on a ProductionEvent (`autoAdvance=true` with a `durationSec > 0`) that causes the show to automatically advance to the next event after the configured duration expires, without manual intervention. A scheduled timer is set on event activation and cancelled if the operator advances or stops manually.

**Production Time**
The server-side elapsed time (in seconds) since the show was started, incremented every second by the server's clock interval. Broadcast to all clients via Socket.io. Distinct from Scoreboard Time.

**Scoreboard Time**
The clock value received from the venue scoreboard hardware (e.g. the match clock). Injected via `POST /api/show/clock` and propagated to all clients as a separate value alongside Production Time.

---

## Callsheet

**CallSheet**
A named run-of-show document within a production. A production can have multiple callsheets (e.g. one per crew role or one for venue, one for livestream). Contains an ordered list of CallSheetItems.

**CallSheetItem**
A single cue entry in a callsheet. Has a title, optional cue code, timing fields (`timeStart`, `timeEnd`, `durationSec`), position assignments (which crew roles see this item), and visibility flags (`isInVenue`, `isInLivestream`). Can be promoted to a ProductionEvent via the sync operation.

---

## Crew & Roles

**Position**
A named crew seat for a production (e.g. "Commentator 1", "Camera links"). Positions are what crew members are assigned *to*. Each position optionally requires a Skill and belongs to a category (GENERAL, TECHNICAL, ENTERTAINMENT).

**Skill**
A crew capability (e.g. "Commentaar", "Camera", "Presentatie"). Skills are what Persons *have*. Positions *require* a skill. Skills have gendered name variants (`nameMale`, `nameFemale`) for display.

**Person**
A real crew member identified by name and gender. Persons are marked as present in a production (presence) and assigned to specific Positions within that production (assignment). Person data is shared across productions.

**InterviewSubject**
A specific player or coach selected by the production to appear in a vMix lower-third title for a given production. Overrides the default club roster lookup when resolving TitleDefinition names. Linked to a production, a player, and a TitleDefinition.

---

## vMix Integration

**TitleDefinition**
A named vMix data source definition that resolves to one or more person names at runtime. Can be defined globally (as a template) or per-production. Each definition has one or more TitleParts, each with a SourceType that determines how the name is resolved (from crew, team players, free text, etc.).

**TitlePart**
A single name source within a TitleDefinition. The SourceType determines resolution logic: `COMMENTARY` pulls the crew commentator, `TEAM_PLAYER` looks up a player from the match team, `FREE_TEXT` returns a fixed string, `PRESENTATION_AND_ANALIST` merges presenter and analyst names.

**vMix Input Name**
The name of an input in the vMix software project (e.g. "Sponsor Ticker", "Intro Sting"). When a ProductionEvent has a `vMixInputName` set and that input goes live, vMix calls `/api/vmix/sync/activate-event?inputName=<name>` to automatically advance the show to that event.

**Sponsor Feed**
A vMix HTTP data source endpoint that returns sponsor data formatted for a specific graphic context: ticker (`/sponsor-names`), carousel (`/sponsor-carrousel`), logo grid (`/sponsor-rows`), or slides (`/sponsor-slides`). Each feed filters sponsors by a configurable set of sponsor tiers.

**Sponsor Tier**
The classification of a sponsor: `premium`, `goud`, `zilver`, `brons`, or `event`. Determines sort order in feeds (premium first) and which sponsors appear in which feed contexts (configured via Settings).

**DisplayName**
An optional override on a Sponsor that replaces the canonical `name` in vMix feed outputs (ticker, carousel). Does not affect the sponsor's identity or how it is referenced elsewhere in the system.
