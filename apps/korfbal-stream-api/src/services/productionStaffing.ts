import {prisma} from './prisma';
import {computeMinimumStaffing, StaffingResult} from '../domain/minimumStaffing';

/** What the productions list shows per production in its "Bezetting" column. */
export type StaffingSummary = {
  /** People marked present (ProductionPerson) */
  presentCount: number;
  met: boolean;
  shortfall: StaffingResult['shortfall'];
  /** The checklist, without the person ids */
  roles: Array<{key: string; label: string; required: number; filled: number; optional: boolean; met: boolean}>;
};

/**
 * The minimum staffing (domain/minimumStaffing.ts) of several productions at once: the people present
 * at all of them and their skills in one query (plus one for the organization's skill codes), however
 * many productions there are. Runs in the organization of the context, like every tenant query.
 */
export async function staffingSummaries(productionIds: number[]): Promise<Map<number, StaffingSummary>> {
  const summaries = new Map<number, StaffingSummary>();
  if (productionIds.length === 0) return summaries;

  const [presences, skills] = await Promise.all([
    prisma.productionPerson.findMany({
      where: {productionId: {in: productionIds}},
      select: {productionId: true, personId: true, person: {select: {skills: {select: {skill: {select: {code: true}}}}}}},
    }),
    prisma.skill.findMany({select: {code: true}}),
  ]);
  const skillCodes = skills.map((s) => s.code);

  const peopleByProduction = new Map<number, Array<{id: number; skillCodes: string[]}>>();
  for (const presence of presences) {
    const people = peopleByProduction.get(presence.productionId) ?? [];
    people.push({id: presence.personId, skillCodes: presence.person.skills.map((s) => s.skill.code)});
    peopleByProduction.set(presence.productionId, people);
  }

  for (const productionId of productionIds) {
    const people = peopleByProduction.get(productionId) ?? [];
    const staffing = computeMinimumStaffing(people, skillCodes);
    summaries.set(productionId, {
      presentCount: people.length,
      met: staffing.met,
      shortfall: staffing.shortfall,
      roles: staffing.roles.map(({key, label, required, filled, optional, met}) => ({key, label, required, filled, optional, met})),
    });
  }
  return summaries;
}
