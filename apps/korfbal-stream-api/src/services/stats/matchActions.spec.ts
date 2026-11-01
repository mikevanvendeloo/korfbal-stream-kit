import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {derivePlayerStats, listMatchTables, normalizeActionRow, parseMatchTableName, teamNamesOf} from './matchActions';
import {readCsv} from './testCsv';
import {decodeStatsPage, parseTweedeScherm} from './tweedeScherm';

const dir = path.join(__dirname, '../../test-fixtures/stats');

const rows = readCsv('Fortuna Koog Zaandijk_31_10_2026.csv').map(normalizeActionRow);
const players = derivePlayerStats(rows);
const find = (name: string) => players.find((p) => p.name === name) as (typeof players)[number];

describe('derivePlayerStats', () => {
  it('matches the whole-match numbers of the statistics page', () => {
    const roos = find('Roos van Groen');
    expect(roos.afstand).toEqual({goals: 3, attempts: 7});
    expect(roos.doorloop).toEqual({goals: 0, attempts: 1});
    expect(roos.rebound).toEqual({won: 1, total: 1});
    const zoe = find('Zoë Engel');
    expect(zoe.afstand).toEqual({goals: 1, attempts: 13});
    expect(zoe.strafworp).toEqual({goals: 1, attempts: 1});
    expect(zoe.aangeef).toBe(1);
    expect(zoe.rebound).toEqual({won: 0, total: 1});
    expect(find('Thomas Uitvlugt').rebound).toEqual({won: 12, total: 16});
    expect(find('Merijn Mensink').rebound).toEqual({won: 12, total: 15});
  });

  it('puts the opponents on their own side', () => {
    expect(find('Zoë Engel').side).toBe('opponent');
    expect(find('Roos van Groen').side).toBe('own');
  });

  it('agrees with the page for every player that appears in both (summed over the vakken)', () => {
    const page = parseTweedeScherm(decodeStatsPage(fs.readFileSync(path.join(dir, 'tweede-scherm.html'))));
    const sum = (team: typeof page.home, name: string, key: 'afstand' | 'doorloop' | 'strafworp') =>
      team.vakken.flatMap((v) => v.players).filter((p) => p.name === name).reduce((a, p) => ({goals: a.goals + p[key].goals, attempts: a.attempts + p[key].attempts}), {goals: 0, attempts: 0});
    let compared = 0;
    for (const [team, side] of [[page.home, 'own'], [page.away, 'opponent']] as const) {
      for (const name of new Set(team.vakken.flatMap((v) => v.players.map((p) => p.name)))) {
        const derived = players.find((p) => p.name === name && p.side === side);
        if (!derived) continue;
        if (name === 'Jordi van Elburg') continue; // the page fixture is an older snapshot than the database: his later shots aren't on it yet
        expect(derived.afstand, name).toEqual(sum(team, name, 'afstand'));
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(12);
  });

  it('ignores definition rows', () => {
    expect(rows.some((r) => r.optelveld === 0)).toBe(true);
    expect(players.every((p) => p.name !== 'NN')).toBe(true);
  });

  it('reads the team names from the definition row', () => {
    expect(teamNamesOf(rows)).toEqual({own: 'Fortuna/Ruitenheer', opponent: 'KZ/Keukensale.com'});
  });
});

describe('match table names', () => {
  it('parses the date and splits the teams', () => {
    expect(parseMatchTableName('Fortuna Koog Zaandijk_31_10_2026')).toEqual({table: 'Fortuna Koog Zaandijk_31_10_2026', home: 'Fortuna', away: 'Koog Zaandijk', date: '2026-10-31'});
    expect(parseMatchTableName('spelersover')).toBeNull();
  });

  it('lists newest first and leaves other tables out', () => {
    const list = listMatchTables(['spelersover', 'DVO DOS46_01_11_2026', 'Fortuna Koog Zaandijk_31_10_2026']);
    expect(list.map((t) => t.date)).toEqual(['2026-11-01', '2026-10-31']);
  });
});
