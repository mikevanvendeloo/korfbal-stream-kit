import fs from 'node:fs';
import path from 'node:path';
import MDBReader from 'mdb-reader';
import {describe, expect, it} from 'vitest';
import {openMdbInWorker} from './mdbReader';
import {derivePlayerStats, lastActionAt, listMatchTables, normalizeActionRow} from './matchActions';

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

  it('finds the current match by its latest action, not by the newest date', () => {
    // DVO DOS46_01_11_2026 has a later date but only old test input (12 October)
    const latest = listMatchTables(db.getTableNames())
      .map((m) => ({table: m.table, at: lastActionAt(db.getTable(m.table).getData().map(normalizeActionRow))}))
      .filter((m) => m.at !== null)
      .sort((a, b) => (b.at as number) - (a.at as number))[0];
    expect(latest.table).toBe('Fortuna Koog Zaandijk_31_10_2026');
  });

  it('parses the real fixture in a worker thread with the same rows', async () => {
    const viaWorker = await openMdbInWorker(fs.readFileSync(fixture));
    expect(viaWorker.getTableNames()).toEqual(db.getTableNames());
    const table = 'Fortuna Koog Zaandijk_31_10_2026';
    expect(viaWorker.getTable(table).getData()).toHaveLength(db.getTable(table).getData().length);
    const roos = derivePlayerStats(viaWorker.getTable(table).getData().map(normalizeActionRow)).find((p) => p.name === 'Roos van Groen');
    expect(roos?.afstand).toEqual({goals: 3, attempts: 7});
    expect(viaWorker.getTable('spelersover').getData().length).toBeGreaterThan(0);
  });

  it('terminates a parse that never returns and answers 502', async () => {
    const started = Date.now();
    await expect(openMdbInWorker(Buffer.from('x'), {timeoutMs: 200, source: 'setInterval(() => undefined, 1000);'})).rejects.toMatchObject({status: 502});
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('answers 502 for a file that is no database', async () => {
    await expect(openMdbInWorker(Buffer.from('geen access'))).rejects.toMatchObject({status: 502});
  });
});
