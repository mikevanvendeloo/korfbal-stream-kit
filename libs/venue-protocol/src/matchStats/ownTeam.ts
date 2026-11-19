import type {ActionRow} from './matchActions';

/**
 * Which match tables of a statistics database belong to the own team. A database holds the matches of one team
 * (F{team}/WEDSTRIJDEN.mdb), but test or scouting tables of other teams can be in it too.
 */

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
/** The first word of a club name, letters and digits only: `Fortuna/Ruitenheer` -> `fortuna`, `DOS'46` -> `dos46`. */
const clubKey = (name: string) => (name.trim().split(/[\s/]+/)[0] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The own club's team number in a match table name (`DVO2 Fortuna2_07_11_2026` -> 2, `Fortuna DOS46_24_10_2026` -> 1):
 * the word that starts with the club's first word, the digits after it, 1 without digits. Null when no word names
 * the own club.
 */
export function ownTeamNumberInTable(table: string, clubNames: string[]): number | null {
  const teams = table.replace(/_\d{2}_\d{2}_\d{4}$/, '');
  const keys = clubNames.map(clubKey).filter((k) => k.length >= 2);
  for (const word of teams.split(/\s+/)) {
    const w = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const key of keys) {
      if (!w.startsWith(key)) continue;
      const rest = w.slice(key.length);
      if (rest === '') return 1;
      if (/^\d{1,2}$/.test(rest)) return Number(rest);
    }
  }
  return null;
}

/** True when the definition row (aktnummer 8000) has the own club in `speler`: the column of the own team. */
export function ownClubInDefinition(rows: ActionRow[], clubNames: string[]): boolean {
  const own = rows.find((r) => r.aktnummer === 8000)?.speler;
  if (!own) return false;
  const names = clubNames.filter(Boolean).map(norm);
  return names.some((c) => c.length >= 2 && norm(own).startsWith(c));
}

/**
 * A table belongs to the database's team when the definition row names the own club and the table name gives the
 * own club no other team number. Without the rows, only the name is checked (false = surely another team).
 */
export function isOwnTeamTable(table: string, team: number, clubNames: string[], rows?: ActionRow[]): boolean {
  const number = ownTeamNumberInTable(table, clubNames);
  if (number !== null && number !== team) return false;
  return rows === undefined ? true : ownClubInDefinition(rows, clubNames);
}
