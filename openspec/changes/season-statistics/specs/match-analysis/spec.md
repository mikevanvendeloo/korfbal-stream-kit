## MODIFIED Requirements

### Requirement: Figures per vak
Vak 1 SHALL be the four duel pairs that start in `AANVAL` and vak 2 the four others. A substitute SHALL take the vak of the player replaced (own `5000`/`5001`, opponent `-5000`/`-5001`). A possession SHALL be a run of consecutive actions with one `opstelling` and belong to the vak of its first own player. Per vak and half the bridge SHALL give attacks, attacks with a goal, goal %, attempts, attempts per attack, attacks without an attempt, the attacks per number of attempts (0, 1, 2, 3, 4, 5+), turnovers and rebound %, for the vak's attack and its defence, and the same per team.

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

#### Scenario: Attacks per number of attempts
- **WHEN** a team has attacks with 0, 1, 1 and 6 attempts
- **THEN** `withoutAttempt` is 1 and `byAttempts` is `[1, 2, 0, 0, 0, 1]` (the last entry counts 5 or more), and the entries add up to `attacks`

## ADDED Requirements

### Requirement: One derivation for bridge and API
The derivation of the match figures from the action rows SHALL be shared by the bridge and the API, so a match stored in the API gives the same figures as the live analysis of the same rows.

#### Scenario: Same rows, same figures
- **WHEN** the bridge analyses the fixture `Fortuna Koog Zaandijk_31_10_2026` live and the API derives a stored copy of the same rows
- **THEN** both give the same analysis
