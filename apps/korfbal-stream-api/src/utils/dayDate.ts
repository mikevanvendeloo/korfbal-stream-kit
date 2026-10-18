/**
 * Calendar days as people type them: "08-02-2026" (DD-MM-YYYY, also with / or . and without leading
 * zeros) or ISO "2026-02-08". Internally a day is always ISO `YYYY-MM-DD`.
 */

export type DayParseResult = {ok: true; iso: string} | {ok: false; reason: 'format' | 'impossible'};

const DUTCH_DAY = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Whether year-month-day exists in the calendar (rejects 31-02-2026, 00-01-2026, 29-02-2027). */
function exists(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** Parses DD-MM-YYYY or YYYY-MM-DD into ISO `YYYY-MM-DD`. */
export function parseDay(raw: string): DayParseResult {
  const text = raw.trim();
  const dutch = DUTCH_DAY.exec(text);
  const iso = ISO_DAY.exec(text);
  let year: number, month: number, day: number;
  if (dutch) [year, month, day] = [Number(dutch[3]), Number(dutch[2]), Number(dutch[1])];
  else if (iso) [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else return {ok: false, reason: 'format'};
  if (!exists(year, month, day)) return {ok: false, reason: 'impossible'};
  return {ok: true, iso: `${year}-${pad(month)}-${pad(day)}`};
}

/** A DATE column (UTC midnight) as ISO `YYYY-MM-DD`, or null. */
export function dateColumnToIsoDay(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/** ISO `YYYY-MM-DD` as the Date Prisma stores in a DATE column. */
export function isoDayToDateColumn(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
