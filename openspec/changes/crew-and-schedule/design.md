## Overview

The crew and schedule system manages the match calendar and the people who work the broadcasts. Skills define capabilities (e.g., "Commentaar", "Camera"); Positions are named roles (e.g., "Commentator 1") that require a skill. Persons are individuals with a list of skills. Match schedules come from the external KNKV API or are created manually.

## Data Model

```
MatchSchedule
  id                  Int (PK)
  externalId          String? (from KNKV API)
  date                DateTime
  homeTeamName        String
  awayTeamName        String
  accommodationName   String?
  homeScore           Int?
  awayScore           Int?
  color               String?
  isManual            Boolean
  isHomeMatch         Boolean
  isCompetitiveMatch  Boolean
  isPracticeMatch     Boolean
  fieldName           String?
  refereeName         String?
  reserveRefereeName  String?

Skill
  id          Int (PK)
  code        String (unique)
  nameMale    String
  nameFemale  String
  name        String
  type        SkillType (crew | entertainment)

Position
  id          Int (PK)
  name        String (unique)
  skillId     Int? (FK → Skill)
  isStudio    Boolean
  category    PositionCategory (GENERAL | TECHNICAL | ENTERTAINMENT)
  sortOrder   Int

Person
  id      Int (PK)
  name    String
  gender  Gender (male | female)

PersonSkill (join table)
  personId  Int
  skillId   Int

Club
  id        Int (PK)
  name      String
  shortName String
  slug      String (unique)
  logoUrl   String?

Player
  id          Int (PK)
  clubId      Int
  name        String
  shirtNo     String?
  gender      Gender
  photoUrl    String?
  externalId  String (unique)
  function    String?
  personType  String?
```

## API Routes

### Match Schedule
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/match/matches/schedule/import` | Import from KNKV API |
| GET | `/api/match/matches/schedule` | List matches by date and location |

### Manual Matches
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/manual-matches` | List manual matches |
| POST | `/api/manual-matches` | Create manual match |
| PUT | `/api/manual-matches/:id` | Update manual match |
| DELETE | `/api/manual-matches/:id` | Delete manual match |

### Skills
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/skills` | List all skills |
| POST | `/api/skills` | Create skill |
| PUT | `/api/skills/:id` | Update skill |
| DELETE | `/api/skills/:id` | Delete skill |

### Positions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/production/positions` | List all positions |
| POST | `/api/production/positions` | Create position |
| PUT | `/api/production/positions/:id` | Update position |
| DELETE | `/api/production/positions/:id` | Delete position |

### Persons
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/persons` | Paginated list; search, gender filter |
| POST | `/api/persons` | Create person |
| PUT | `/api/persons/:id` | Update person |
| DELETE | `/api/persons/:id` | Delete person |

### Clubs & Players
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/clubs` | List clubs |
| POST | `/api/clubs` | Create club |
| PUT | `/api/clubs/:id` | Update club |
| DELETE | `/api/clubs/:id` | Delete club |
| GET | `/api/clubs/:id/players` | List players for club |
| POST | `/api/players` | Create player |
| PUT | `/api/players/:id` | Update player |
| DELETE | `/api/players/:id` | Delete player |
| POST | `/api/players/:id/photo` | Upload player photo |

## Match Import Logic

`POST /api/match/matches/schedule/import`:
1. Calls `config.matchScheduleBaseUrl/matches` with date range and optional filters
2. Maps external match data to `MatchSchedule` fields
3. Team color assignment: maps specific team names to colors (Fortuna/Ruitenheer divisions)
4. Referee privacy: respects `privacyLevel` (FULL_NAME / FIRST_NAME / LAST_NAME / HIDDEN)
5. Filters out non-referee officials (Juryvoorzitter, Schotklokbediener, Tijdwaarnemer)
6. Cleans field names: removes prefix before hyphen
7. Upserts by `externalId`; returns `{ ok, inserted, updated, total }`
