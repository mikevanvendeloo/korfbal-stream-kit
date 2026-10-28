import type {Prisma} from '@prisma/client';
import {getActiveProductionId} from './productionState';
import {logger} from '../utils/logger';

export type MatchDateShift = {
  /** Productions whose times moved along */
  shifted: number[];
  /** Productions left alone because their show is running right now */
  skippedLive: number[];
};

const shift = (date: Date | null, deltaMs: number) => (date ? new Date(date.getTime() + deltaMs) : null);

/**
 * When a match moves (manual edit or match import), the stored absolute times of its production move
 * along by the same delta, so the broadcast keeps its place relative to the kickoff: the production's
 * `liveTime`, `setupTime` and `crewCallTime`, the callsheet items' `timeStart`/`timeEnd` and the LIVE
 * events' `plannedStartTime`/`plannedEndTime` (all are written as absolute instants when the times are calculated from the anchor,
 * see production-callsheets.ts and callsheet-templates.ts). `actualStartTime` is what happened and stays.
 *
 * The delta is between two UTC instants, so it is exact across a DST change (Sat 19:30 winter time →
 * Sun 20:00 summer time is the real difference in milliseconds). A production whose show runs right now
 * (the live state in memory) is left alone, with a warning. Call it inside the transaction that changes
 * the match date, in the organization's context (the Prisma extension scopes every query).
 */
export async function shiftProductionTimesForMatchDateChange(
  tx: Prisma.TransactionClient,
  matchId: number,
  previousDate: Date,
  newDate: Date,
): Promise<MatchDateShift> {
  const result: MatchDateShift = {shifted: [], skippedLive: []};
  const deltaMs = newDate.getTime() - previousDate.getTime();
  if (deltaMs === 0) return result;

  const productions = await tx.production.findMany({
    where: {matchScheduleId: matchId},
    select: {id: true, liveTime: true, setupTime: true, crewCallTime: true},
  });
  const liveProductionId = productions.length ? getActiveProductionId() : null;
  for (const production of productions) {
    if (production.id === liveProductionId) {
      logger.warn('Match date changed while its production is live; production times left as they are', {matchId, productionId: production.id, deltaMs});
      result.skippedLive.push(production.id);
      continue;
    }
    if (production.liveTime || production.setupTime || production.crewCallTime) {
      await tx.production.update({
        where: {id: production.id},
        data: {
          liveTime: shift(production.liveTime, deltaMs),
          setupTime: shift(production.setupTime, deltaMs),
          crewCallTime: shift(production.crewCallTime, deltaMs),
        },
      });
    }

    const items = await tx.callSheetItem.findMany({
      where: {callSheet: {productionId: production.id}, OR: [{timeStart: {not: null}}, {timeEnd: {not: null}}]},
      select: {id: true, timeStart: true, timeEnd: true},
    });
    for (const item of items) {
      await tx.callSheetItem.update({where: {id: item.id}, data: {timeStart: shift(item.timeStart, deltaMs), timeEnd: shift(item.timeEnd, deltaMs)}});
    }

    const events = await tx.productionEvent.findMany({
      where: {productionId: production.id, OR: [{plannedStartTime: {not: null}}, {plannedEndTime: {not: null}}]},
      select: {id: true, plannedStartTime: true, plannedEndTime: true},
    });
    for (const event of events) {
      await tx.productionEvent.update({
        where: {id: event.id},
        data: {plannedStartTime: shift(event.plannedStartTime, deltaMs), plannedEndTime: shift(event.plannedEndTime, deltaMs)},
      });
    }
    result.shifted.push(production.id);
  }
  if (result.shifted.length) logger.info('Production times moved with the match', {matchId, productionIds: result.shifted, deltaMs});
  return result;
}
