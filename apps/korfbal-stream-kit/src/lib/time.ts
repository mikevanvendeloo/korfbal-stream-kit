/**
 * Dates and times on screen, always in Europe/Amsterdam, whatever zone the browser or device is set to.
 *
 * The API sends times as UTC (ISO with `Z`) and stores what we send as UTC. Every screen shows them in
 * Amsterdam time, and every field means Amsterdam time: typing 19:30 is 19:30 in Amsterdam, also on a
 * laptop set to another zone. So never use getHours(), setHours(), toLocaleString() without timeZone,
 * `new Date("2026-11-14T19:30")` or `iso.substring(0, 16)` for this: they follow the device's zone.
 *
 * Daylight saving time, for a typed time (the same rule as the API's utils/time.ts):
 * - the October switch repeats 02:00–02:59: the first occurrence counts (summer time);
 * - the March switch skips 02:00–02:59: the time moves forward by the gap (02:30 → 03:30).
 */

export const AMSTERDAM_TIME_ZONE = 'Europe/Amsterdam';

type DateLike = Date | string | number | null | undefined;

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

function toValidDate(value: DateLike): Date | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad = (n: number) => String(n).padStart(2, '0');

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

function offsetMs(instant: number): number {
  const p = amsterdamParts(new Date(instant));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant / 1000) * 1000;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The instant of an Amsterdam wall-clock time (month 1–12); DST as in the module comment. */
export function amsterdamToUtc(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  const before = offsetMs(naive - DAY_MS);
  const after = offsetMs(naive + DAY_MS);
  const candidates = [naive - before, naive - after].filter((t) => offsetMs(t) === naive - t);
  if (candidates.length > 0) return new Date(Math.min(...candidates));
  return new Date(naive - before);
}

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

const TIME: Intl.DateTimeFormatOptions = {hour: '2-digit', minute: '2-digit'};
const TIME_SECONDS: Intl.DateTimeFormatOptions = {hour: '2-digit', minute: '2-digit', second: '2-digit'};
const SHORT_DATE: Intl.DateTimeFormatOptions = {day: '2-digit', month: '2-digit', year: 'numeric'};

/** "19:30" (or "19:30:05" with seconds) in Amsterdam time; `fallback` ('') when empty or invalid. */
export function formatTime(value: DateLike, opts: {seconds?: boolean; fallback?: string} = {}): string {
  const d = toValidDate(value);
  return d ? formatter(opts.seconds ? TIME_SECONDS : TIME).format(d) : opts.fallback ?? '';
}

/**
 * "14-11-2026" in Amsterdam time; other Intl date options give other forms, e.g.
 * {weekday: 'short', day: '2-digit', month: 'short'} → "za 14 nov".
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

/** The Amsterdam day of an instant as ISO "YYYY-MM-DD"; '' when empty or invalid. */
export function amsterdamDay(value: DateLike): string {
  const d = toValidDate(value);
  if (!d) return '';
  const p = amsterdamParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Today in Amsterdam as "YYYY-MM-DD". */
export function todayAmsterdam(now: Date = new Date()): string {
  return amsterdamDay(now);
}

/** "YYYY-MM-DDTHH:mm" in Amsterdam time, for a datetime-local input; '' when empty or invalid. */
export function toAmsterdamInputValue(value: DateLike): string {
  const d = toValidDate(value);
  if (!d) return '';
  const p = amsterdamParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

const INPUT = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?)?$/;

/**
 * What a datetime-local (or date) input holds, read as Amsterdam time, as UTC ISO ("…Z");
 * null when it isn't such a value or doesn't exist (31-02, 24:00).
 */
export function fromAmsterdamInput(value: string): string | null {
  const m = INPUT.exec(String(value ?? '').trim());
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [hour, minute, second] = [Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0)];
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return amsterdamToUtc(year, month, day, hour, minute, second).toISOString();
}

/**
 * The instant at Amsterdam time `hhmm` ("19:30") on the Amsterdam day of `day` (an instant or
 * "YYYY-MM-DD"), as UTC ISO; null when one of them is invalid.
 */
export function atAmsterdamTime(day: DateLike, hhmm: string): string | null {
  const isoDay = typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : amsterdamDay(day);
  if (!isoDay || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  return fromAmsterdamInput(`${isoDay}T${hhmm}`);
}
