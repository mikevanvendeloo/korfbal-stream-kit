import {PositionCategory} from '@prisma/client';

const CATEGORY_ORDER: PositionCategory[] = ['GENERAL', 'TECHNICAL', 'ENTERTAINMENT'];

type PositionLike = { id: number; name: string; category: PositionCategory; sortOrder: number };
type Assignment = { personId: number; personName: string; position: PositionLike };

export type CrewCell = { segmentId: number; positionId: number; personName: string; type: 'segment' | 'production' };

/**
 * Who does what per segment, as on the Bezetting tab: the production-wide positions of each person,
 * plus the positions assigned for that segment only.
 */
export function buildCrewCells(
  segmentIds: number[],
  productionWide: Assignment[],
  perSegment: Array<Assignment & { segmentId: number }>,
): CrewCell[] {
  const cells: CrewCell[] = [];
  for (const segmentId of segmentIds) {
    const seen = new Set<string>();
    const add = (a: Assignment, type: CrewCell['type']) => {
      const key = `${a.personId}|${a.position.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      cells.push({segmentId, positionId: a.position.id, personName: a.personName, type});
    };
    perSegment.filter((a) => a.segmentId === segmentId).forEach((a) => add(a, 'segment'));
    productionWide.forEach((a) => add(a, 'production'));
  }
  return cells;
}

/** The positions that are filled in this production, grouped by category for the table header. */
export function groupPositions(positions: PositionLike[]) {
  const sorted = [...positions].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'nl'));
  return CATEGORY_ORDER
    .map((category) => ({category, positions: sorted.filter((p) => p.category === category)}))
    .filter((group) => group.positions.length > 0);
}
