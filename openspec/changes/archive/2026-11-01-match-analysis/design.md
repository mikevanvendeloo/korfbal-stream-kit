## Context

The statistics bridge (`apps/statistics-bridge`) already reads the match tables of `WEDSTRIJDEN.mdb` and derives per-player totals (`derivePlayerStats`) and team statistics (`teamStats.ts`) from the match with the latest action (`currentMatch`). The action rows carry more than those totals use. Observed in the fixture `Fortuna Koog Zaandijk_31_10_2026.csv`:

- `tijdtotaal`: match time in seconds (0 at `START WEDSTRIJD` 4300, `RUST` 4500, `START TWEEDE HELFT` 4400, `EINDE WEDSTRIJD` 4600).
- `opstelling`: `AANVAL` = the own club attacks, `VERDEDIGING` = the opponent attacks.
- `speler` / `tegenstander`: every action names a duel pair (own player and the direct opponent).
- Lineup rows (`optelveld` 0, `aktnummer` 0, before `START WEDSTRIJD`): four pairs with `AANVAL`, four with `VERDEDIGING` = the two vakken.
- Substitutions: `5000`/`5001` (GEWISSELD/INGEVALLEN) change the own player of a pair, `-5000`/`-5001` the opponent.
- `2022 NAAR ANDER VAK`: the ball goes to the other vak = end of a possession.
- Shots `2xxx` miss / `3xxx` goal, type in the last digits (001 afstand, 002 kort, 003 doorloop, 004 vrije bal, 012 strafworp); the zone is in `aktieomschrijving` (`AFSTAND SCHOT  voor rechts`, `HALVE AFSTAND  achter`).
- `doelpuntenvoor` / `doelpuntentegen` are always 0: the score must be derived from the goal actions.

## Goals / Non-Goals

**Goals:** one bridge route that answers the four analysis questions for the current match; a LIVE page that shows them readably in the rust; pure, unit-tested functions over the action rows.

**Non-Goals:** vMix data source shape (nested JSON for the kit, not flat rows); analysis from the live page; history over several matches; storing anything; charts libraries (simple SVG/Tailwind bars are enough).

## Decisions

1. **Database only.** The page has no times, duels or zones. Without a usable database `/analysis` answers 503 `{error: 'De analyse heeft het statistiekenbestand nodig'}`; a refused path stays 400. The API passes the bridge's 503 with `error` through (existing behaviour). Alternative (partial analysis from the page) rejected: half an analysis in the rust is misleading.
2. **Score from goal actions.** A `3001–3004`/`3012` row with `AANVAL` is an own goal, with `VERDEDIGING` an opponent goal. Running score per goal with its `tijdtotaal`.
3. **Halves from markers.** First half = before `RUST` (or everything when there is no `RUST` yet), second half = after `START TWEEDE HELFT`. Every count is given as `{total, firstHalf, secondHalf}` where the card shows halves.
4. **Vak = a fixed group of four places.** Vak 1 = the own players of the lineup pairs that start in `AANVAL`, vak 2 = the others. The lineup rows are the definition rows (`optelveld` 0, `aktnummer` 0) before `START WEDSTRIJD`; rows with `aktnummer` 0 during the match are not a lineup. A substitute takes the place, and so the vak, of the player replaced, so a player can change vak (in the fixture Jordi starts in vak 1 and comes back in vak 2). A possession belongs to the vak of the first own player (`speler`) in it, who attacks in AANVAL and defends in VERDEDIGING; possessions without a known player count only in the totals.
5. **Possession = a run of consecutive actions with one `opstelling`** (closed at the match markers too). The statistics PC changes `opstelling` at every change of possession, also after a goal, where no `2022 NAAR ANDER VAK` row follows (found while building: splitting on `NAAR ANDER VAK` put two goals in one possession). It ends in a goal when it contains a goal, otherwise as a turnover. Attempts per attack = shots in it. On the fixture this gives 73 own attacks with 46 turnovers, the same as the page's attack figures.
6. **Runs and droughts.** A run = three or more consecutive goals by one team (start/end time, score before and after). Drought = the longest time per team between two of its own goals, or from the start / to the last action (for a live match).
7. **Duels keyed by pair names.** For the own player: own attempts in `AANVAL` where `speler` is the actor; against: the opponent's attempts in `VERDEDIGING` where that pair's `tegenstander` is the actor. After a substitution a new pair starts.
8. **Zones parsed from `aktieomschrijving`.** Kind `afstand` vs `halveAfstand` for type 001, and the direction (`voor`, `achter`, `links`, `rechts`, combinations, or none). Unknown text counts as zone `onbekend`, never dropped.
9. **Turnovers by kind** from their codes and the sign convention of rebounds (`-`/`+` from the own club's view): steal (2014/3014), bal over (2021/3021/4021), schotklok (2015), onnodige fout (2025/3025). The own team lost the ball on a minus in `AANVAL`, the opponent on a plus in `VERDEDIGING`; a neutral 4xxx counts for the attacking side. A minus in `VERDEDIGING` or a plus in `AANVAL` is the defender's action (e.g. an own defender's foul) and no lost ball.
10. **Memoized like `currentMatch`** (`memoizedOnDatabase(team, 'analysis')`): computed once per read of the file; the kit polls every 15 s.
11. **Kit**: own LIVE page `/analyse` (nav item "Analyse" next to Statistieken), cards stacked at 360 px, two columns from `lg`. Own team colours as on the Statistieken page (home yellow, away red). Bridge offline: the same notice as Statistieken.

## Response shape

```
{
  teams: {own, opponent}, source, readAt,
  clock: {lastActionAt /* tijdtotaal s */, half: 1|2, halftimeAt: number|null},
  score: {own, opponent},
  progression: [{t, side: 'own'|'opponent', own, opponent, player: string|null}],
  runs: [{side, goals, from, to, scoreBefore: {own, opponent}, scoreAfter: {own, opponent}}],
  droughts: {own: {seconds, from, to}|null, opponent: {...}|null},
  attacks: {own: Split<AttackFigures>, opponent: Split<AttackFigures>},
  vakken: [{vak: 1|2, players: string[], opponents: string[], attack: Split<AttackFigures>, defence: Split<AttackFigures>}],
  attacksWithoutVak: number,
  duels: [{vak: 1|2|null, player, opponent, for: Split<Ratio>, against: Split<Ratio>}],
  shots: {own: ShotMap, opponent: ShotMap},
  turnovers: {own: Split<TurnoverKinds>, opponent: Split<TurnoverKinds>}
}
Split<T> = {total: T, firstHalf: T, secondHalf: T}
AttackFigures = {attacks, withGoal, goalPct, attempts, attemptsPerAttack, turnovers, reboundWon, reboundTotal, reboundPct}
Ratio = {goals, attempts, pct}
ShotMap = {byZone: [{kind: 'afstand'|'halveAfstand'|'kort'|'doorloop', zone, goals, attempts, pct}], byType: {afstand, kort, doorloop, vrijeBal, strafworp: Ratio}}
TurnoverKinds = {steal, balOver, schotklok, onnodigeFout, total}
```
Percentages have one decimal and are `null` without a base (as in `teamStats.ts`).

## Risks / Trade-offs

- [The sign of turnover codes may be read wrongly] → unit tests on the fixture, and a check with the analist before the first match; the card shows the counts per code kind so a wrong side is visible.
- [Vak assignment when the actor is unknown] → counted in totals, not in a vak; the card says "n aanvallen zonder vak".
- [`tijdtotaal` might include stopped time] → only used for ordering and durations; the card shows minutes as `mm:ss` of match time, same as the statistics PC.
- [Large tables] → linear passes over the rows, memoized per file read.

## Open Questions

- None open. Settled: a half is 25 minutes of pure playing time. `tijdtotaal` is the statistics PC's own clock and is longer than that. In the fixture the rust is at 1659 s and the end at 3311 s, so about 27.6 min per half: not every stoppage is recorded with `TIJD GESTOPT`. `tijdtotaal` is therefore used only for order, durations and the split into halves. The page shows it as "tijd volgens de statistiek-pc" (mm:ss from the start of the half), never as the playing time of the scoreboard, and it is not scaled to 25 minutes.
