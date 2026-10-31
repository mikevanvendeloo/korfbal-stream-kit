import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(__dirname, '../../test-fixtures/stats');

/** Minimal CSV reader for the mdb-export fixtures (quoted fields, no embedded newlines). */
export function readCsv(file: string): Record<string, unknown>[] {
  const [head, ...lines] = fs.readFileSync(path.join(dir, file), 'utf8').split(/\r?\n/).filter(Boolean);
  const split = (l: string) => [...l.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)].slice(0, -1).map((m) => (m[2] !== undefined ? m[2] : m[1]));
  const keys = split(head);
  return lines.map((l) => Object.fromEntries(split(l).map((v, i) => [keys[i], v === '' ? null : /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v])));
}
