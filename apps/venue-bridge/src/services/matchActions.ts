/**
 * Pure functions over the action rows of one match table in the statistics database (WEDSTRIJDEN.mdb).
 * Codes (aktnummer): 2xxx = miss/minus, 3xxx = goal/plus; the last three digits are the type.
 */
import type {Ratio, ReboundRatio} from './tweedeScherm';

export type ActionRow = {
  aktienummer: number;
  speler: string | null;
  tegenstander: string | null;
  aktieomschrijving: string | null;
  opstelling: string | null; // AANVAL | VERDEDIGING
  doelpuntenvoor: number;
  doelpuntentegen: number;
  tijdtotaal: number;
  aktnummer: number;
  optelveld: number;
  absoluut: string | null;
};

export type TeamSide = 'own' | 'opponent';

export type DerivedPlayer = {
  /** 'own' = the club whose players are in `speler`; 'opponent' = the direct opponents in `tegenstander`. */
  side: TeamSide;
  name: string;
  afstand: Ratio;
  doorloop: Ratio;
  kortSchot: Ratio;
  vrijeBal: Ratio;
  strafworp: Ratio;
  totaal: Ratio;
  rebound: ReboundRatio;
  aangeef: number;
};

export type MatchTableName = {table: string; home: string; away: string; date: string | null};

const str = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v).trim());
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

/** One raw table row (mdb-reader or CSV, keys as in the database) to a typed action row. */
export function normalizeActionRow(raw: Record<string, unknown>): ActionRow {
  const abs = raw.absoluut;
  return {
    aktienummer: num(raw.aktienummer),
    speler: str(raw.speler),
    tegenstander: str(raw.tegenstander),
    aktieomschrijving: str(raw.aktieomschrijving),
    opstelling: str(raw.opstelling),
    doelpuntenvoor: num(raw.doelpuntenvoor),
    doelpuntentegen: num(raw.doelpuntentegen),
    tijdtotaal: num(raw.tijdtotaal),
    aktnummer: num(raw.aktnummer),
    optelveld: num(raw.optelveld),
    absoluut: abs instanceof Date ? abs.toISOString() : str(abs),
  };
}

/** `<home> <away>_DD_MM_YYYY`: the date is exact; the home/away split is a guess (first word | rest). */
export function parseMatchTableName(table: string): MatchTableName | null {
  const m = table.match(/^(.+)_(\d{2})_(\d{2})_(\d{4})$/);
  if (!m) return null;
  const words = m[1].trim().split(/\s+/);
  return {
    table,
    home: words[0],
    away: words.slice(1).join(' '),
    date: `${m[4]}-${m[3]}-${m[2]}`,
  };
}

/** Match tables, newest first (ties by name). Other tables (spelersover, settings) are left out. */
export function listMatchTables(tableNames: string[]): MatchTableName[] {
  return tableNames
    .map(parseMatchTableName)
    .filter((t): t is MatchTableName => t !== null)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.table.localeCompare(b.table));
}

/** The names on the definition row (aktnummer 8000): own club in speler, opponent in tegenstander. */
export function teamNamesOf(rows: ActionRow[]): {own: string | null; opponent: string | null} {
  const def = rows.find((r) => r.aktnummer === 8000);
  return {own: def?.speler ?? null, opponent: def?.tegenstander ?? null};
}

const zero = (): Ratio => ({goals: 0, attempts: 0});

function blank(side: TeamSide, name: string): DerivedPlayer {
  return {side, name, afstand: zero(), doorloop: zero(), kortSchot: zero(), vrijeBal: zero(), strafworp: zero(), totaal: zero(), rebound: {won: 0, total: 0}, aangeef: 0};
}

/** Only real actions: optelveld 0 rows are definitions. */
export function isAction(r: ActionRow): boolean {
  return r.optelveld !== 0 && r.aktnummer !== 0;
}

/**
 * When the last action of a match was entered, in ms (only for comparing matches); null without actions.
 * `absoluut` is an ISO time from mdb-reader or `MM/DD/YY hh:mm:ss` in a CSV export.
 */
export function lastActionAt(rows: ActionRow[]): number | null {
  let last: number | null = null;
  for (const r of rows) {
    if (!isAction(r) || !r.absoluut) continue;
    const m = r.absoluut.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4}) (\d{1,2}):(\d{2}):(\d{2})$/);
    const t = m
      ? Date.UTC(m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]), Number(m[1]) - 1, Number(m[2]), Number(m[4]), Number(m[5]), Number(m[6]))
      : Date.parse(r.absoluut);
    if (Number.isFinite(t) && (last === null || t > last)) last = t;
  }
  return last;
}

/**
 * Per-player totals for the whole match. The actor of a shot/aangeef/rebound is `speler` for AANVAL and
 * `tegenstander` for VERDEDIGING. Shots: 3xxx is a goal on either side. Rebounds: + and - are from the own
 * club's view, so for the opponent a 2008 is a won rebound and a 3008 a lost one.
 */
export function derivePlayerStats(rows: ActionRow[]): DerivedPlayer[] {
  const players = new Map<string, DerivedPlayer>();
  const get = (side: TeamSide, name: string) => {
    const key = `${side}:${name}`;
    let p = players.get(key);
    if (!p) players.set(key, (p = blank(side, name)));
    return p;
  };

  for (const r of rows) {
    if (!isAction(r)) continue;
    const family = Math.floor(r.aktnummer / 1000);
    if (family !== 2 && family !== 3) continue;
    const type = r.aktnummer % 1000;
    const defending = (r.opstelling ?? '').toUpperCase() === 'VERDEDIGING';
    const actor = defending ? r.tegenstander : r.speler;
    if (!actor) continue;
    const p = get(defending ? 'opponent' : 'own', actor);
    const goal = family === 3;
    const shot = (target: Ratio) => {
      target.attempts += 1;
      if (goal) target.goals += 1;
      p.totaal.attempts += 1;
      if (goal) p.totaal.goals += 1;
    };
    if (type === 1) shot(p.afstand);
    else if (type === 2) shot(p.kortSchot);
    else if (type === 3) shot(p.doorloop);
    else if (type === 4) shot(p.vrijeBal);
    else if (type === 12) shot(p.strafworp);
    else if (type === 8) {
      const won = defending ? !goal : goal;
      p.rebound.total += 1;
      if (won) p.rebound.won += 1;
    } else if (type === 601 && family === 2) p.aangeef += 1;
  }
  return [...players.values()].sort((a, b) => a.side.localeCompare(b.side) || a.name.localeCompare(b.name));
}

export const ratioText = (r: Ratio) => `${r.goals}/${r.attempts}`;
