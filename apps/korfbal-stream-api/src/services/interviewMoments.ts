import {prisma} from './prisma';
import {formatTime} from '../utils/time';
import {loadInterviewNames, resolveInterviewPlaceholders, splitInterviewPlaceholders, type InterviewNames, type Role, type Side} from './interviewPlaceholders';

/**
 * The interviews in the order of the draaiboek: every live item whose title has an interview placeholder
 * ({coach-uit}, {speler-eigen}, …) is a moment, with its hoofdstuk and the people it names. The same person can
 * come twice (the away coach before and after the match), so the order comes from the draaiboek, not from the
 * chosen people.
 */
export type InterviewMomentPerson = {side: Side; role: Role; name: string | null};
export type InterviewMoment = {
  /** 1, 2, 3 … in draaiboek order */
  position: number;
  itemId: string;
  /** The item title with the names filled in */
  title: string;
  chapter: string | null;
  plannedStartTime: string | null;
  people: InterviewMomentPerson[];
};

type MomentItem = {id: string; title: string; plannedStartTime: Date | null; chapter: {name: string} | null};

/** Pure: the moments of items already in draaiboek order. */
export function interviewMomentsOf(items: MomentItem[], names: InterviewNames | null): InterviewMoment[] {
  const moments: InterviewMoment[] = [];
  for (const item of items) {
    const people: InterviewMomentPerson[] = [];
    for (const segment of splitInterviewPlaceholders(item.title, names)) {
      if (segment.resolved === null || !segment.side || !segment.role) continue;
      if (people.some((p) => p.side === segment.side && p.role === segment.role)) continue;
      people.push({side: segment.side, role: segment.role, name: names?.names[segment.side][segment.role] ?? null});
    }
    if (!people.length) continue;
    moments.push({
      position: moments.length + 1,
      itemId: item.id,
      title: resolveInterviewPlaceholders(item.title, names),
      chapter: item.chapter?.name ?? null,
      plannedStartTime: item.plannedStartTime ? item.plannedStartTime.toISOString() : null,
      people,
    });
  }
  return moments;
}

/** The interview moments of a production's live items, in draaiboek order. */
export async function loadInterviewMoments(productionId: number): Promise<InterviewMoment[]> {
  const [names, items] = await Promise.all([
    loadInterviewNames(productionId),
    prisma.productionEvent.findMany({
      where: {productionId},
      orderBy: {order: 'asc'},
      select: {id: true, title: true, plannedStartTime: true, chapter: {select: {name: true}}},
    }),
  ]);
  return interviewMomentsOf(items, names);
}

/** "1. Voorbeschouwing · 19:35 — Interview Kees Uit": one line per moment for the reports (time in Amsterdam). */
export function interviewMomentLine(moment: InterviewMoment): string {
  const where = [moment.chapter, moment.plannedStartTime ? formatTime(moment.plannedStartTime) : null].filter(Boolean).join(' · ');
  return `${moment.position}. ${where ? `${where} — ` : ''}${moment.title}`;
}
