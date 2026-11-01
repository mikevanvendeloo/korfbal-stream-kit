# Spec Delta

## Purpose

Gives the analist, in the rust and during the match, an analysis of the current match that explains what is happening: score progression and runs, the figures per vak, the duels, the shot zones and the turnovers, derived from the action rows of the statistics database. Home is always the own team.

## ADDED Requirements

### Requirement: Analysis route of the bridge
The statistics bridge SHALL answer `GET /analysis` with the analysis of the match with the latest action in the statistics database, the same match that `/current/players` uses. The answer SHALL carry `X-Stats-Source` (`share` or `copy`), `X-Stats-Read-At` and `X-Stats-Team`, and it SHALL be computed at most once per read of the database file.

#### Scenario: Current match analysed
- **WHEN** the database holds several match tables and one of them has the latest entered action
- **THEN** `/analysis` answers 200 with the analysis of that match, its team names (`teams.own`, `teams.opponent`), `source` and `readAt`

#### Scenario: Polls reuse the result
- **WHEN** `/analysis` is requested twice while the database file has not been read again
- **THEN** the second answer is the same result without deriving it again

### Requirement: Analysis needs the database
The analysis SHALL come only from the statistics database: the live statistics page has no match times, duels or shot zones. Without a usable database the bridge SHALL answer 503 `{error: 'De analyse heeft het statistiekenbestand nodig'}`; a refused database path SHALL stay a 400.

#### Scenario: Database switched off
- **WHEN** the bridge runs with `MDB_ENABLED=false`
- **THEN** `/analysis` answers 503 with `De analyse heeft het statistiekenbestand nodig`

#### Scenario: No played match
- **WHEN** the database has no match table with an entered action
- **THEN** `/analysis` answers 503 with the same message

### Requirement: Score and progression
The score SHALL be derived from the goal actions (codes 3001–3004 and 3012), because the score columns of the action rows stay 0. A goal in `AANVAL` SHALL count for the own team, a goal in `VERDEDIGING` for the opponent. `progression` SHALL list every goal in order with its match time, side, scorer and the score after it.

#### Scenario: Final score of the fixture
- **WHEN** the analysis is derived from the fixture `Fortuna Koog Zaandijk_31_10_2026.csv`
- **THEN** `score` equals the final score of that match and the last `progression` entry has the same score

### Requirement: Halves
The first half SHALL be the actions before `RUST` (all actions while there is no `RUST` yet), and the second half the actions from `START TWEEDE HELFT`. Every figure that the page splits by half SHALL be given as `total`, `firstHalf` and `secondHalf`, where `total` equals the sum of the halves.

#### Scenario: During the first half
- **WHEN** the match has no `RUST` row yet
- **THEN** `clock.half` is 1, `clock.halftimeAt` is null and every `secondHalf` figure is zero

#### Scenario: Halves add up
- **WHEN** the match has both halves
- **THEN** for every split figure `firstHalf + secondHalf` equals `total`

### Requirement: Runs and droughts
A run SHALL be three or more consecutive goals by one team, with its start and end time and the score before and after it. Per team the drought SHALL be the longest time without an own goal: from the start to the first goal, between two goals, or from the last goal to the last action.

#### Scenario: Run of three
- **WHEN** one team scores three goals in a row without a goal of the other team in between
- **THEN** `runs` contains one entry for that team with `goals` 3 and the score before and after

#### Scenario: No goals yet
- **WHEN** a team has not scored yet
- **THEN** its drought runs from the start to the last action

### Requirement: Figures per vak
Vak 1 SHALL be the four duel pairs that start in `AANVAL` and vak 2 the four others. A substitute SHALL take the vak of the player replaced (own `5000`/`5001`, opponent `-5000`/`-5001`). A possession SHALL be a run of consecutive actions with one `opstelling` and belong to the vak of its first own player. Per vak and half the bridge SHALL give attacks, attacks with a goal, goal %, attempts, attempts per attack, turnovers and rebound %, for the vak's attack and its defence, and the same per team.

#### Scenario: Vakken add up to the team
- **WHEN** every possession of the match has a known first actor
- **THEN** the attacks of vak 1 and vak 2 together equal the own team's attacks, and `attacksWithoutVak` is 0

#### Scenario: A goal ends the possession
- **WHEN** a team scores and the next action has the other `opstelling` without a `NAAR ANDER VAK` row in between
- **THEN** the goal ends that possession and the next action starts a possession of the other team

#### Scenario: Substitute keeps the vak
- **WHEN** an own player of vak 2 is replaced (`GEWISSELD` followed by `INGEVALLEN`)
- **THEN** the actions of the substitute count for vak 2

#### Scenario: Possession without a known actor
- **WHEN** a possession has no action with a player
- **THEN** it counts in the team totals and in `attacksWithoutVak`, not in a vak

### Requirement: Duels
For every duel pair (own player and direct opponent) the bridge SHALL give `for`, the own player's goals and attempts in `AANVAL`, and `against`, the direct opponent's goals and attempts in `VERDEDIGING` against that player, per half and with the vak of the pair. A substitution SHALL start a new pair.

#### Scenario: Duel figures
- **WHEN** an own player scores 2 of 5 attempts and the direct opponent scores 1 of 4 against that player
- **THEN** that pair's `for` is 2/5 and its `against` is 1/4

### Requirement: Shot zones and types
Per team the bridge SHALL give goal % per shot kind (afstand, halve afstand, kort, doorloop) and zone (`voor`, `achter`, `links`, `rechts` or a combination) read from the action description, and goal % per shot type (afstand, kort, doorloop, vrije bal, strafworp). A description without a direction SHALL count as zone `midden`; an unrecognised description SHALL count as `onbekend` and SHALL never be dropped.

#### Scenario: Zone from the description
- **WHEN** an action is `AFSTAND SCHOT  voor rechts GOAL`
- **THEN** it counts as a goal for kind `afstand`, zone `voor rechts`

#### Scenario: Every shot counted
- **WHEN** the shot map of a team is summed over all zones
- **THEN** the attempts equal that team's total attempts

### Requirement: Turnovers by kind
Per team and half the bridge SHALL count the turnovers by kind: steal (2014/3014), bal over (2021/3021/4021), schotklok (2015) and onnodige fout (2025/3025). The own team SHALL have lost the ball on a minus in `AANVAL` and the opponent on a plus in `VERDEDIGING` (signs from the own club's view, as with rebounds); a neutral code SHALL count for the attacking side, and a defender's action SHALL not count.

#### Scenario: Steals in the fixture
- **WHEN** the analysis is derived from the fixture
- **THEN** the own steals equal the `STEAL -` rows in AANVAL and the opponent's the `STEAL +` rows in VERDEDIGING

#### Scenario: Defender's foul
- **WHEN** an own defender makes an unnecessary foul (`ONNODIGE FOUT -` in VERDEDIGING)
- **THEN** no turnover is counted

### Requirement: API forward
The API SHALL forward `GET /api/stats/analysis` to the bridge with `?team=` of the active production, like the other statistics routes. It SHALL be a feed route: an organization API key or `X-Organization` is required. An offline bridge SHALL give 503 `STATS_BRIDGE_OFFLINE`, and the bridge's own 503 with `error` SHALL pass through.

#### Scenario: Without key or organization
- **WHEN** `/api/stats/analysis` is requested without API key and without `X-Organization`
- **THEN** the API answers 401 `API-sleutel ontbreekt`

#### Scenario: Database message passes through
- **WHEN** the bridge answers 503 `De analyse heeft het statistiekenbestand nodig`
- **THEN** the API answers 503 with the same message

### Requirement: LIVE page Analyse
The kit SHALL have a LIVE page Analyse (`/analyse`, nav item "Analyse") with four cards: Verloop, Per vak, Duels, and Schotkaart en balverlies. Cards with halves SHALL have a switch between total, 1e helft and 2e helft. The page SHALL poll every 15 s, show the source line as on Statistieken, and show times as "tijd volgens de statistiek-pc", not as scoreboard playing time.

#### Scenario: Readable on a phone
- **WHEN** the page is shown 360 px wide
- **THEN** the cards are stacked, tables scroll inside their card and the page itself does not scroll sideways

#### Scenario: Bridge offline
- **WHEN** the statistics bridge is offline
- **THEN** the page shows `De statistics bridge is offline` instead of the cards

#### Scenario: Database not available
- **WHEN** the API answers 503 `De analyse heeft het statistiekenbestand nodig`
- **THEN** the page shows that message instead of the cards

#### Scenario: Half switch
- **WHEN** the analist chooses 1e helft on the Per vak card
- **THEN** the card shows only the first-half figures
