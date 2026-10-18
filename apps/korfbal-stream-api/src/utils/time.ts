/**
 * Times in Europe/Amsterdam, independent of the server's time zone (Docker runs with TZ=UTC).
 *
 * Times are stored and sent as UTC instants (ISO with `Z`). Text for clients that can't convert
 * (vMix titles and data sources, PDF/Markdown/WhatsApp reports, file names) is formatted here, always
 * in Amsterdam time. A time typed without zone ("2026-11-14T19:30") means Amsterdam time.
 *
 * Never use getHours(), toLocaleTimeString() without timeZone, toTimeString() or setHours() for this:
 * they follow the server's zone.
 *
 * Daylight saving time, for a local time without zone (Temporal's "compatible" rule):
 * - the October switch repeats 02:00–02:59 (e.g. 2026-10-25 02:30): the first occurrence counts,
 *   i.e. summer time (CEST, +02:00) → 2026-10-25T00:30:00Z;
 * - the March switch skips 02:00–02:59 (e.g. 2027-03-28 02:30): the time is moved forward by the gap,
 *   02:30 → 03:30 CEST → 2027-03-28T01:30:00Z.
 */

export const AMSTERDAM_TIME_ZONE = 'Europe/Amsterdam';

export interface AmsterdamParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: AMSTERDAM_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});

type DateLike = Date | string | number | null | undefined;

function toValidDate(value: DateLike): Date | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The wall-clock parts of an instant in Amsterdam. */
export function amsterdamParts(date: Date): AmsterdamParts {
  const p = Object.fromEntries(partsFormatter.formatToParts(date).map((x) => [x.type, x.value])) as Record<string, string>;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

/** Amsterdam's offset from UTC at an instant, in ms (+1h in winter, +2h in summer). */
function offsetMs(instant: number): number {
  const p = amsterdamParts(new Date(instant));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The UTC instant of an Amsterdam wall-clock time (month 1–12). DST: see the module comment
 * (repeated hour → first occurrence, skipped hour → moved forward).
 */
export function amsterdamToUtc(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  // The offset a day before and a day after: there is at most one switch in between
  const before = offsetMs(naive - DAY_MS);
  const after = offsetMs(naive + DAY_MS);
  const candidates = [naive - before, naive - after].filter((t) => offsetMs(t) === naive - t);
  if (candidates.length > 0) return new Date(Math.min(...candidates));
  // In the gap: read with the offset from before the switch, which lands after it
  return new Date(naive - before);
}

const pad = (n: number) => String(n).padStart(2, '0');

const TIME: Intl.DateTimeFormatOptions = {hour: '2-digit', minute: '2-digit'};
const TIME_SECONDS: Intl.DateTimeFormatOptions = {hour: '2-digit', minute: '2-digit', second: '2-digit'};
const SHORT_DATE: Intl.DateTimeFormatOptions = {day: '2-digit', month: '2-digit', year: 'numeric'};

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('nl-NL', {...options, timeZone: AMSTERDAM_TIME_ZONE, hourCycle: 'h23'});
    formatters.set(key, f);
  }
  return f;
}

/** "19:30" (or "19:30:05" with seconds) in Amsterdam time; '' when empty or invalid. */
export function formatTime(value: DateLike, opts: {seconds?: boolean} = {}): string {
  const d = toValidDate(value);
  return d ? formatter(opts.seconds ? TIME_SECONDS : TIME).format(d) : '';
}

/**
 * "14-11-2026" in Amsterdam time; other Intl date options give other forms, e.g.
 * {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'} → "zaterdag 14 november 2026".
 */
export function formatDate(value: DateLike, options: Intl.DateTimeFormatOptions = SHORT_DATE): string {
  const d = toValidDate(value);
  return d ? formatter(options).format(d) : '';
}

/** "14-11-2026 19:30" in Amsterdam time. */
export function formatDateTime(value: DateLike): string {
  const d = toValidDate(value);
  return d ? `${formatDate(d)} ${formatTime(d)}` : '';
}

/** The Amsterdam day of an instant as ISO "YYYY-MM-DD" (e.g. for a file name or a day filter). */
export function amsterdamDay(value: DateLike): string {
  const d = toValidDate(value);
  if (!d) return '';
  const p = amsterdamParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "YYYY-MM-DDTHH:mm" in Amsterdam time, for a datetime-local input; '' when empty or invalid. */
export function toAmsterdamInputValue(value: DateLike): string {
  const d = toValidDate(value);
  if (!d) return '';
  const p = amsterdamParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

const INPUT = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/i;

type ParsedInput = {year: number; month: number; day: number; hour: number; minute: number; second: number; ms: number; zone?: string};

/**
 * Splits "YYYY-MM-DD[THH:mm[:ss[.sss]][Z|±hh:mm]]"; null when it isn't such a text or the day or time
 * doesn't exist (31-02, 24:00). JavaScript's own Date parsing would roll 31-02 over to 3 March.
 */
function parseInput(value: unknown): ParsedInput | null {
  if (typeof value !== 'string' || value.length > 40) return null;
  const m = INPUT.exec(value.trim());
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [hour, minute, second] = [Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0)];
  const ms = m[7] ? Number(m[7].slice(0, 3).padEnd(3, '0')) : 0;
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return {year, month, day, hour, minute, second, ms, zone: m[8]?.toUpperCase()};
}

/**
 * An Amsterdam time without zone ("2026-11-14T19:30", "2026-11-14 19:30:00" or a day "2026-11-14")
 * as a UTC instant; null when it isn't such a time, has a zone, or doesn't exist (31-02, 24:00).
 */
export function amsterdamInputToDate(value: unknown): Date | null {
  const p = parseInput(value);
  if (!p || p.zone) return null;
  return amsterdamToUtc(p.year, p.month, p.day, p.hour, p.minute, p.second, p.ms);
}

/** Like amsterdamInputToDate, as an ISO string with `Z`. */
export function fromAmsterdamInput(value: unknown): string | null {
  return amsterdamInputToDate(value)?.toISOString() ?? null;
}

/**
 * An instant from outside (request body, backup file, upstream API): a Date, an ISO time with `Z` or
 * an offset, or an Amsterdam time without zone. Anything else (garbage, numbers, 31-02) → null, so
 * routes can answer 400 instead of failing in the database.
 */
export function parseInstant(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const p = parseInput(value);
  if (!p) return null;
  if (!p.zone) return amsterdamToUtc(p.year, p.month, p.day, p.hour, p.minute, p.second, p.ms);
  const utc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, p.ms);
  if (p.zone === 'Z') return new Date(utc);
  const z = /^([+-])(\d{2}):?(\d{2})$/.exec(p.zone);
  if (!z || Number(z[2]) > 14 || Number(z[3]) > 59) return null;
  const offset = (z[1] === '-' ? -1 : 1) * (Number(z[2]) * 60 + Number(z[3])) * 60_000;
  return new Date(utc - offset);
}

/** An optional time field of a request: empty → null, a time → Date (see parseInstant), anything else → 'invalid'. */
export function parseOptionalInstant(value: unknown): Date | null | 'invalid' {
  if (value == null || value === '') return null;
  return parseInstant(value) ?? 'invalid';
}

/**
 * A date cell from Excel: ExcelJS reads its wall-clock time as UTC (a cell showing 19:30 becomes
 * 19:30Z), while the crew means Amsterdam time.
 */
export function excelCellToDate(cell: Date): Date | null {
  if (Number.isNaN(cell.getTime())) return null;
  return amsterdamToUtc(
    cell.getUTCFullYear(), cell.getUTCMonth() + 1, cell.getUTCDate(),
    cell.getUTCHours(), cell.getUTCMinutes(), cell.getUTCSeconds(), cell.getUTCMilliseconds(),
  );
}

/** The UTC range of an Amsterdam day ("YYYY-MM-DD"): from its midnight up to the next one (exclusive). */
export function amsterdamDayRange(isoDay: string): {start: Date; end: Date} {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay);
  if (!m) throw new Error(`Invalid day: ${isoDay}`);
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const start = amsterdamToUtc(year, month, day);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const end = amsterdamToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
  return {start, end};
}
