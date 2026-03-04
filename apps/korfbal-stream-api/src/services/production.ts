import {prisma} from './prisma';
import {PositionCategory} from '@prisma/client';

export async function getProductionReportData(productionId: number) {
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    include: {
      matchSchedule: true,
      productionReport: true,
      productionPersons: { include: { person: true } },
      // Fetch all production-wide assignments, and critically, order them here.
      productionPositions: {
        include: {
          person: true,
          position: true,
        },
        orderBy: [
          { position: { sortOrder: 'asc' } },
          { position: { name: 'asc' } }
        ],
      },
      interviewSubjects: {
        include: {
          player: true,
        },
      },
    },
  });

  if (!production) {
    throw new Error('Production not found');
  }

  // --- ATTENDEES ---
  const assignedPersonIds = new Set(production.productionPositions.map(p => p.personId));
  const attendees = production.productionPersons
    .map(pp => ({
      name: pp.person.name,
      isAssigned: assignedPersonIds.has(pp.person.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- CREW BY CATEGORY (SORTED) ---
  const crewByCategory: Record<PositionCategory, { positionName: string; personNames: string[] }[]> = {
    [PositionCategory.ENTERTAINMENT]: [],
    [PositionCategory.TECHNICAL]: [],
    [PositionCategory.GENERAL]: [],
  };

  // Use a map to group persons by position, respecting the pre-sorted order.
  const positionToPersonMap = new Map<number, { name: string; category: PositionCategory; persons: Set<string> }>();
  for (const assignment of production.productionPositions) {
    if (!positionToPersonMap.has(assignment.positionId)) {
      positionToPersonMap.set(assignment.positionId, {
        name: assignment.position.name,
        category: assignment.position.category,
        persons: new Set(),
      });
    }
    positionToPersonMap.get(assignment.positionId)!.persons.add(assignment.person.name);
  }

  // Populate the categories. The order is preserved because we iterate over the sorted assignments.
  production.productionPositions.forEach(assignment => {
    const posId = assignment.positionId;
    const posData = positionToPersonMap.get(posId);
    if (posData && posData.persons.size > 0) {
      const category = posData.category;
      // Ensure we only add each position once
      if (!crewByCategory[category].some(p => p.positionName === posData.name)) {
        crewByCategory[category].push({
          positionName: posData.name,
          personNames: Array.from(posData.persons),
        });
      }
    }
  });


  // --- INTERVIEWS ---
  const interviews = {
    home: {
      players: production.interviewSubjects.filter(s => s.side === 'HOME' && s.role === 'PLAYER').map(s => s.player),
      coaches: production.interviewSubjects.filter(s => s.side === 'HOME' && s.role === 'COACH').map(s => s.player),
    },
    away: {
      players: production.interviewSubjects.filter(s => s.side === 'AWAY' && s.role === 'PLAYER').map(s => s.player),
      coaches: production.interviewSubjects.filter(s => s.side === 'AWAY' && s.role === 'COACH').map(s => s.player),
    },
  };

  // --- SPONSORS ---
  const sponsors = await prisma.sponsor.findMany({ orderBy: { name: 'asc' } });

  return {
    production,
    attendees,
    crewByCategory,
    interviews,
    sponsors,
  };
}
