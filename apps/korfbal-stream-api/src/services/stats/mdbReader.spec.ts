import fs from 'node:fs';
import path from 'node:path';
import MDBReader from 'mdb-reader';
import {describe, expect, it} from 'vitest';
import {derivePlayerStats, listMatchTables, normalizeActionRow} from './matchActions';

const fixture = path.join(__dirname, '../../test-fixtures/stats/WEDSTRIJDEN.mdb');

describe('mdb-reader on the statistics database', () => {
  const db = new MDBReader(fs.readFileSync(fixture));

  it('lists the match tables', () => {
    expect(listMatchTables(db.getTableNames()).map((m) => m.table)).toContain('Fortuna Koog Zaandijk_31_10_2026');
  });

  it('gives the same player statistics as the CSV export', () => {
    const rows = db.getTable('Fortuna Koog Zaandijk_31_10_2026').getData().map(normalizeActionRow);
    const roos = derivePlayerStats(rows).find((p) => p.name === 'Roos van Groen');
    expect(roos?.afstand).toEqual({goals: 3, attempts: 7});
  });
});
