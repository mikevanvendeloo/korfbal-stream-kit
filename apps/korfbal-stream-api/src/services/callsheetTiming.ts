import {prisma} from './prisma';
import {getCurrentState} from './productionState';
import {formatTime} from '../utils/time';
import {loadInterviewNames, resolveInterviewPlaceholders} from './interviewPlaceholders';

export type TimingState = 'normal' | 'warning' | 'overtime';

export type TimingEvent = {
  id: string;
  order: number;
  title: string;
  status: string;
  durationSec: number | null;
  actualStartTime: Date | null;
  plannedStartTime: Date | null;
  positions: Array<{ position: { name: string } }>;
};

/** The current and next callsheet item for a set of positions, as flat strings for vMix. */
export type CallsheetTiming = {
  productionId: number | null;
  positions: string;
  currentId: string;
  currentTitle: string;
  currentDuration: string;
  currentDurationVmix: string;
  currentRemaining: string;
  currentRemainingSeconds: number | null;
  /** Remaining time in the vMix countdown format (hh:mm:ss, never negative), for SetCountdown */
  currentTimerVmix: string;
  currentStartTime: string;
  currentState: TimingState;
  nextId: string;
  nextTitle: string;
  nextDuration: string;
  nextDurationVmix: string;
  nextStartsIn: string;
  nextStartsInSeconds: number | null;
  nextStartsInVmix: string;
  nextStartTime: string;
  nextState: TimingState;
};

const pad = (n: number) => String(n).padStart(2, '0');

/** "04:32", "-00:12" or "1:02:03": the way the callsheet shows a time. */
export function formatClock(seconds: number | null): string {
  if (seconds == null) return '';
  const abs = Math.abs(Math.trunc(seconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const body = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return seconds < 0 ? `-${body}` : body;
}

/** "00:04:32": the value vMix SetCountdown expects. Negative times become 00:00:00. */
export function formatVmixTimer(seconds: number | null): string {
  if (seconds == null) return '';
  const abs = Math.max(0, Math.trunc(seconds));
  return `${pad(Math.floor(abs / 3600))}:${pad(Math.floor((abs % 3600) / 60))}:${pad(abs % 60)}`;
}

/** "19:30": a start time in Amsterdam time, whatever the server's zone. */
export function formatStartTime(date: Date | null): string {
  return formatTime(date);
}

export function timingState(seconds: number | null, warningSeconds: number): TimingState {
  if (seconds == null) return 'normal';
  if (seconds < 0) return 'overtime';
  if (seconds <= warningSeconds) return 'warning';
  return 'normal';
}

/** Splits "Presentatie,Analist" (names or slugs like "in-ear-ondersteuning") into a list. */
export function parsePositions(raw: unknown): string[] {
  const values = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  return values.flatMap((v) => String(v).split(',')).map((v) => v.trim()).filter(Boolean);
}

const normalize = (name: string) => name.toLowerCase().replace(/ & /g, '-').replace(/[\s_]+/g, '-');

/**
 * Same rule as the Show Caller per position: an item counts when one of the positions is on it,
 * or when it has no positions at all. No positions given means every item counts.
 */
export function isRelevant(event: TimingEvent, positions: string[]): boolean {
  if (positions.length === 0 || event.positions.length === 0) return true;
  const wanted = new Set(positions.map(normalize));
  return event.positions.some((p) => wanted.has(normalize(p.position.name)));
}

/**
 * The current item is the active event when it's relevant for the positions; the next item is the first
 * relevant event after the active one (or the first waiting one when nothing is active). The Zaal item running
 * in the hall lane (parallel-lanes D4) is the current item for the positions that are on it by name, and
 * for the others when the active stream item isn't theirs.
 */
export function selectCurrentAndNext(events: TimingEvent[], activeEventId: string | null, positions: string[], activeVenueEventId: string | null = null) {
  const sorted = [...events].sort((a, b) => a.order - b.order);
  const active = activeEventId ? sorted.find((e) => e.id === activeEventId) ?? null : null;
  const venue = activeVenueEventId ? sorted.find((e) => e.id === activeVenueEventId) ?? null : null;
  const venueIsTheirs = venue != null && positions.length > 0 && venue.positions.length > 0 && isRelevant(venue, positions);
  const current = venueIsTheirs ? venue
    : active && isRelevant(active, positions) ? active
      : venue && isRelevant(venue, positions) ? venue : null;
  const from = Math.max(active?.order ?? -Infinity, current?.order ?? -Infinity);
  const candidates = active || current
    ? sorted.filter((e) => e.order > from && (venue == null || e.status === 'WAITING'))
    : sorted.filter((e) => e.status === 'WAITING');
  const next = candidates.find((e) => isRelevant(e, positions)) ?? null;
  return {current, next};
}

export function buildCallsheetTiming(input: {
  productionId: number | null;
  events: TimingEvent[];
  activeEventId: string | null;
  activeVenueEventId?: string | null;
  positions: string[];
  warningSeconds: number;
  now: Date;
}): CallsheetTiming {
  const {current, next} = selectCurrentAndNext(input.events, input.activeEventId, input.positions, input.activeVenueEventId ?? null);
  const nowMs = input.now.getTime();

  const remaining = current?.durationSec != null && current.actualStartTime
    ? current.durationSec - Math.floor((nowMs - current.actualStartTime.getTime()) / 1000)
    : current?.durationSec ?? null;
  const startsIn = next?.plannedStartTime
    ? Math.ceil((next.plannedStartTime.getTime() - nowMs) / 1000)
    : null;

  return {
    productionId: input.productionId,
    positions: input.positions.join(', '),
    currentId: current?.id ?? '',
    currentTitle: current?.title ?? '',
    currentDuration: formatClock(current?.durationSec ?? null),
    currentDurationVmix: formatVmixTimer(current?.durationSec ?? null),
    currentRemaining: formatClock(remaining),
    currentRemainingSeconds: remaining,
    currentTimerVmix: formatVmixTimer(remaining),
    currentStartTime: formatStartTime(current?.actualStartTime ?? null),
    currentState: timingState(current ? remaining : null, input.warningSeconds),
    nextId: next?.id ?? '',
    nextTitle: next?.title ?? '',
    nextDuration: formatClock(next?.durationSec ?? null),
    nextDurationVmix: formatVmixTimer(next?.durationSec ?? null),
    nextStartsIn: formatClock(startsIn),
    nextStartsInSeconds: startsIn,
    nextStartsInVmix: formatVmixTimer(startsIn),
    nextStartTime: formatStartTime(next?.plannedStartTime ?? null),
    nextState: timingState(next ? startsIn : null, input.warningSeconds),
  };
}

/** Loads the active production (in-memory state first, the database as fallback) and builds its timing. */
export async function loadCallsheetTiming(positions: string[], warningSeconds: number, now = new Date()): Promise<CallsheetTiming> {
  const state = getCurrentState();
  let productionId = state.productionId;
  if (!productionId) {
    const active = await prisma.production.findFirst({where: {isActive: true}, orderBy: {createdAt: 'desc'}, select: {id: true}});
    productionId = active?.id ?? null;
  }

  const rawEvents: TimingEvent[] = productionId
    ? await prisma.productionEvent.findMany({
      where: {productionId},
      select: {
        id: true, order: true, title: true, status: true, durationSec: true, actualStartTime: true, plannedStartTime: true,
        positions: {select: {position: {select: {name: true}}}},
      },
      orderBy: {order: 'asc'},
    })
    : [];
  // "Interview {coach-uit}" becomes "Interview Jan Jansen", like in the callsheet
  const hasPlaceholders = productionId != null && rawEvents.some((e) => e.title.includes('{'));
  const names = hasPlaceholders ? await loadInterviewNames(productionId as number) : null;
  const events = hasPlaceholders ? rawEvents.map((e) => ({...e, title: resolveInterviewPlaceholders(e.title, names)})) : rawEvents;

  const activeEventId = state.productionId === productionId && state.activeEventId
    ? state.activeEventId
    : events.find((e) => e.status === 'ACTIVE')?.id ?? null;

  const activeVenueEventId = state.productionId === productionId ? state.activeVenueEventId : null;
  return buildCallsheetTiming({productionId, events, activeEventId, activeVenueEventId, positions, warningSeconds, now});
}
