import {z} from 'zod';
import {prisma} from './prisma';
import {getSetting, setSetting} from './appSettings';
import {amsterdamDay, amsterdamDayRange} from '../utils/time';

/**
 * The day planning: when the crew builds up (opbouw, only before the day's first stream), gathers
 * (verzamelen, before each stream) and when each stream is live. A production's own setupTime /
 * crewCallTime wins; null means the organization's default, counted back from the stream's start.
 */
export const DAY_PLANNING_KEY = 'dayPlanning';

export const DayPlanningSettingsSchema = z.object({
  /** Verzamelen: minutes before the stream goes live */
  crewCallMinutes: z.number().int().min(0).max(24 * 60),
  /** Opbouw: minutes before the day's first stream goes live */
  setupMinutes: z.number().int().min(0).max(24 * 60),
});
export type DayPlanningSettings = z.infer<typeof DayPlanningSettingsSchema>;

export const DEFAULT_DAY_PLANNING: DayPlanningSettings = {crewCallMinutes: 30, setupMinutes: 150};

export async function getDayPlanningSettings(): Promise<DayPlanningSettings> {
  const stored = DayPlanningSettingsSchema.safeParse(await getSetting(DAY_PLANNING_KEY));
  return stored.success ? stored.data : DEFAULT_DAY_PLANNING;
}

export async function setDayPlanningSettings(settings: DayPlanningSettings): Promise<void> {
  await setSetting(DAY_PLANNING_KEY, settings);
}

export type PlanningInput = {
  id: number;
  liveTime: Date | null;
  setupTime: Date | null;
  crewCallTime: Date | null;
  matchSchedule: { date: Date };
};

export type PlannedTimes = {
  /** When the stream goes live: liveTime, else the match start */
  liveStart: Date;
  crewCallTime: Date;
  crewCallIsDefault: boolean;
  /** Only for the day's first stream */
  isFirstOfDay: boolean;
  setupTime: Date | null;
  setupIsDefault: boolean;
};

const minutesBefore = (date: Date, minutes: number) => new Date(date.getTime() - minutes * 60_000);

/** The planned times of the productions of one day, by production id. */
export function planDay(productions: PlanningInput[], settings: DayPlanningSettings): Map<number, PlannedTimes> {
  const liveStart = (p: PlanningInput) => p.liveTime ?? p.matchSchedule.date;
  const sorted = [...productions].sort((a, b) => liveStart(a).getTime() - liveStart(b).getTime() || a.id - b.id);
  const planned = new Map<number, PlannedTimes>();
  sorted.forEach((p, index) => {
    const start = liveStart(p);
    const isFirstOfDay = index === 0;
    planned.set(p.id, {
      liveStart: start,
      crewCallTime: p.crewCallTime ?? minutesBefore(start, settings.crewCallMinutes),
      crewCallIsDefault: !p.crewCallTime,
      isFirstOfDay,
      setupTime: isFirstOfDay ? (p.setupTime ?? minutesBefore(start, settings.setupMinutes)) : null,
      setupIsDefault: isFirstOfDay && !p.setupTime,
    });
  });
  return planned;
}

/** The planned times of one production, among the productions on its match's (Amsterdam) day. */
export async function plannedTimesOf(productionId: number, matchDate: Date): Promise<PlannedTimes | null> {
  const {start, end} = amsterdamDayRange(amsterdamDay(matchDate));
  const [sameDay, settings] = await Promise.all([
    prisma.production.findMany({
      where: {matchSchedule: {date: {gte: start, lt: end}}},
      select: {id: true, liveTime: true, setupTime: true, crewCallTime: true, matchSchedule: {select: {date: true}}},
    }),
    getDayPlanningSettings(),
  ]);
  return planDay(sameDay, settings).get(productionId) ?? null;
}
