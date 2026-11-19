## Purpose

Keeps the matches of the own team from the statistics database in the API, so their figures stay available after the match and without the statistics PC, and gives the season overview: the own club's top scorers, the team figures and the matches they are based on, on LIVE Statistieken and as a vMix datasource.

## ADDED Requirements

### Requirement: Matches kept from the statistics database
The API SHALL keep, per organization and team number, every match table of the own team that the venue-bridge reads from the statistics database: its table name, date, team names, all its rows (definition and action rows) and when it was synced. A stored match SHALL stay when the table later disappears from the database or the database cannot be read.

#### Scenario: Match kept
- **WHEN** the bridge reads a database of team 1 with the table `Fortuna DOS46_24_10_2026` (own club in the definition row)
- **THEN** the API stores that match for team 1 with its rows, date 2026-10-24 and teams `Fortuna/Ruitenheer` and `DOS 46/VDK Groep`

#### Scenario: Database gone after the match
- **WHEN** a match was stored and the bridge can no longer read the database
- **THEN** the stored match and its rows stay unchanged

### Requirement: Only the database file
Matches SHALL only be synced from the database file itself (read from the share or the bridge's local copy). When the bridge answers from the statistics page or says the database is disabled or unreachable, the API SHALL store nothing and change nothing.

#### Scenario: Only the statistics page
- **WHEN** the bridge runs with the variant `page-only` or with "Database gebruiken" off
- **THEN** no match is stored or changed, and the season shows `database: 'unavailable'`

### Requirement: Own team's matches only
A table SHALL be kept only when the definition row (`aktnummer` 8000) has the own club in `speler`, and the table name gives the own club no team number or the team number of the database. The own club is matched like the statistics team: on the own club's name or short name, or the organization's name, at the start of the team name, ignoring case and spaces.

#### Scenario: Other team of the own club
- **WHEN** the database of team 1 has the table `DVO2 Fortuna2_07_11_2026`
- **THEN** that table is not stored

#### Scenario: Match of two other clubs
- **WHEN** the database has the table `DVO DOS46_01_11_2026` whose definition row names neither team as the own club
- **THEN** that table is not stored

### Requirement: Sync moment
The API SHALL sync the matches of a connected bridge when it connects and every 60 seconds, for the team of the organization's active production (team 1 without one). A table SHALL be fetched again only when its number of rows or its last action time differs from the stored match; one sync per organization SHALL run at a time.

#### Scenario: Live match updated
- **WHEN** actions are added to the current match table between two syncs
- **THEN** the next sync stores the new rows of that match and fetches no unchanged table

#### Scenario: Bridge offline
- **WHEN** no bridge is connected for the organization
- **THEN** no sync runs and the stored matches stay available

### Requirement: Figures from the stored rows
The figures of a stored match SHALL be derived from its stored rows with the same derivation as the live match analysis. When the derivation changes, matches stored before SHALL get the new figures from their rows without the database.

#### Scenario: Same figures as live
- **WHEN** a match is stored from the fixture `Fortuna Koog Zaandijk_31_10_2026`
- **THEN** its score, players and attack figures equal those of the live analysis of that fixture

### Requirement: Season range
The season SHALL be the active season: matches dated on or after its `indoorStartDate` (without one, 1 July of its start year), for the team of the active production (team 1 without one). Matches of another team number SHALL not count.

#### Scenario: From the indoor start
- **WHEN** the active season has `indoorStartDate` 2026-11-07 and matches are stored on 2026-10-31 and 2026-11-14
- **THEN** only the match of 2026-11-14 counts

### Requirement: Season overview route
`GET /api/stats/season` SHALL answer `{season: {id, name, from}, team, database, lastSyncAt, matches, topScorers, totals}`. `matches` lists every counted match, newest first, with date, opponent, score, attacks, attacks without a shot, shots per attack, goal % of the attacks, turnovers and turnovers per vak. `database` SHALL be `'ok'`, `'unavailable'` or `'offline'` (no bridge) at the last sync attempt.

#### Scenario: Overview without the database
- **WHEN** matches are stored and the bridge is offline
- **THEN** the route answers 200 with those matches and `database: 'offline'`

#### Scenario: Nothing stored
- **WHEN** no match of the season is stored
- **THEN** the route answers 200 with empty `matches` and `topScorers` and zeroed `totals`

### Requirement: Season top scorers
`topScorers` SHALL list the own club's players over the counted matches, most goals first (then fewest attempts, then name), with `rank` (equal goals and attempts share a rank), `name`, `goals`, `attempts`, `goalPct` (whole percent, null without attempts), `matches` (number of counted matches with an attempt) and `strafworpGoals`. A name SHALL count as one player only when it is written exactly the same.

#### Scenario: Goals over two matches
- **WHEN** a player scores 8 of 57 attempts over two counted matches
- **THEN** her row has `goals` 8, `attempts` 57, `goalPct` 14 and `matches` 2

### Requirement: Season team figures
`totals` SHALL give for the own team and the opponents together: matches, goals, attempts, goal %, attacks, attacks with a goal, attacks without a shot, shots per attack, the number of attacks per number of shots (0, 1, 2, 3, 4, 5+) and the turnovers by kind (steal, bal over, schotklok, onnodige fout, total), summed over the counted matches.

#### Scenario: Totals add up
- **WHEN** two matches are counted
- **THEN** every count in `totals` equals the sum of those two matches' counts

### Requirement: Season top scorers datasource
`GET /api/stats/season/top-scorers` SHALL be a feed route (organization API key, or `X-Organization`) answering the season top scorers as flat rows `{rank, name, goals, attempts, goalPct, matches}` with `goalPct` as text (`"14%"`, `"–"` without attempts); `?limit=` (1–50) SHALL cut the list. The vMix datasource list SHALL include it as "Statistieken: topscorers seizoen".

#### Scenario: Top five for a title
- **WHEN** vMix asks `/api/stats/season/top-scorers?key=<key>&limit=5`
- **THEN** it gets at most five rows, best scorer first

#### Scenario: Without key or organization
- **WHEN** the route is asked without an API key and without `X-Organization`
- **THEN** it answers 401 like the other feed routes

### Requirement: Organization isolation
Stored matches SHALL belong to one organization: the season routes SHALL only use the asking organization's matches, and a sync SHALL only store into the organization of the bridge's API key.

#### Scenario: Other organization
- **WHEN** organization A has stored matches and organization B asks `/api/stats/season`
- **THEN** B gets none of A's matches

### Requirement: LIVE Statistieken tab Seizoen
LIVE Statistieken SHALL have a tab "Seizoen", also usable while the bridge is offline, with the own club's top scorers, the team figures (own and opponents) and the list of matches the figures are based on, readable at 360 px wide. It SHALL refresh every 60 seconds and say "Wedstrijden worden niet bijgewerkt: het statistiekenbestand is niet bereikbaar" when `database` is `'unavailable'` (and "… de venue-bridge is offline." when `'offline'`).

#### Scenario: Season tab
- **WHEN** two matches of the season are stored and the bridge is offline
- **THEN** the tab lists both matches and the top scorers over both

#### Scenario: Database not readable
- **WHEN** the season answers `database: 'unavailable'`
- **THEN** the tab still shows the stored figures and the message that the matches are not updated
