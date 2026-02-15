import {Router} from 'express';
import {prisma} from '../../services/prisma';

export const productionCrewRouter: Router = Router();

// Type definition for crew member with positions
export type CrewMember = {
  personId: number;
  personName: string;
  positions: Array<{
    positionId: number;
    positionName: string;
    skillId: number | null;
    skillName: string | null;
    skillType: string | null;
    isStudio: boolean;
    source: 'production' | 'segment';
    segmentId?: number;
    segmentName?: string;
  }>;
};

/**
 * GET /api/production/:id/crew
 *
 * Returns all crew members with their positions for a production.
 * Includes both production-wide positions and segment-specific overrides.
 *
 * Response format:
 * [
 *   {
 *     personId: 1,
 *     personName: "John Doe",
 *     positions: [
 *       {
 *         positionId: 5,
 *         positionName: "Commentator",
 *         skillId: 10,
 *         skillName: "COMMENTAAR",
 *         skillType: "on_stream",
 *         isStudio: false,
 *         source: "production"
 *       },
 *       {
 *         positionId: 6,
 *         positionName: "Presentatie",
 *         skillId: 11,
 *         skillName: "PRESENTATIE",
 *         skillType: "on_stream",
 *         isStudio: false,
 *         source: "segment",
 *         segmentId: 3,
 *         segmentName: "Rust"
 *       }
 *     ]
 *   }
 * ]
 */
productionCrewRouter.get('/:id/crew', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid production id' });
    }

    const production = await prisma.production.findUnique({ where: { id } });
    if (!production) {
      return res.status(404).json({ error: 'Production not found' });
    }

    // Fetch production-wide person-position assignments
    const productionPositions = await prisma.productionPersonPosition.findMany({
      where: { productionId: id },
      include: {
        person: true,
        position: {
          include: {
            skill: true,
          },
        },
      },
    });

    // Fetch segment-specific assignments
    const segments = await prisma.productionSegment.findMany({
      where: { productionId: id },
      include: {
        bezetting: {
          include: {
            person: true,
            position: {
              include: {
                skill: true,
              },
            },
          },
        },
      },
      orderBy: { volgorde: 'asc' },
    });

    // Build crew map: personId -> CrewMember
    const crewMap = new Map<number, CrewMember>();

    // Add production-wide positions
    for (const pp of productionPositions) {
      if (!crewMap.has(pp.personId)) {
        crewMap.set(pp.personId, {
          personId: pp.personId,
          personName: pp.person.name,
          positions: [],
        });
      }
      crewMap.get(pp.personId)!.positions.push({
        positionId: pp.positionId,
        positionName: pp.position.name,
        skillId: pp.position.skillId,
        skillName: pp.position.skill?.name || null,
        skillType: pp.position.skill?.type || null,
        isStudio: pp.position.isStudio,
        source: 'production',
      });
    }

    // Add segment-specific positions
    for (const segment of segments) {
      for (const assignment of segment.bezetting) {
        if (!crewMap.has(assignment.personId)) {
          crewMap.set(assignment.personId, {
            personId: assignment.personId,
            personName: assignment.person.name,
            positions: [],
          });
        }
        crewMap.get(assignment.personId)!.positions.push({
          positionId: assignment.positionId,
          positionName: assignment.position.name,
          skillId: assignment.position.skillId,
          skillName: assignment.position.skill?.name || null,
          skillType: assignment.position.skill?.type || null,
          isStudio: assignment.position.isStudio,
          source: 'segment',
          segmentId: segment.id,
          segmentName: segment.naam,
        });
      }
    }

    // Convert map to array and sort by person name
    const crew = Array.from(crewMap.values()).sort((a, b) =>
      a.personName.localeCompare(b.personName, 'nl', { sensitivity: 'base' })
    );

    return res.json(crew);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/production/:id/crew/on-stream
 *
 * Returns only crew members with on-stream positions (positions linked to skills with type 'on_stream').
 * Includes both production-wide and segment-specific assignments.
 *
 * Optional query parameters:
 * - segmentId: Filter to only show crew for a specific segment
 *
 * Response format: Same as /crew but filtered to on-stream positions only
 */
productionCrewRouter.get('/:id/crew/on-stream', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid production id' });
    }

    const segmentIdParam = req.query.segmentId;
    const segmentId = segmentIdParam ? Number(segmentIdParam) : null;

    const production = await prisma.production.findUnique({ where: { id } });
    if (!production) {
      return res.status(404).json({ error: 'Production not found' });
    }

    // If segmentId is provided, validate it exists
    if (segmentId !== null) {
      if (!Number.isInteger(segmentId) || segmentId <= 0) {
        return res.status(400).json({ error: 'Invalid segmentId' });
      }
      const segment = await prisma.productionSegment.findUnique({
        where: { id: segmentId },
      });
      if (!segment || segment.productionId !== id) {
        return res.status(404).json({ error: 'Segment not found' });
      }
    }

    // Fetch production-wide person-position assignments with on-stream skills
    const productionPositions = await prisma.productionPersonPosition.findMany({
      where: {
        productionId: id,
        position: {
          skill: {
            type: 'on_stream',
          },
        },
      },
      include: {
        person: true,
        position: {
          include: {
            skill: true,
          },
        },
      },
    });

    // Fetch segment-specific assignments with on-stream skills
    const segmentFilter: any = { productionId: id };
    if (segmentId !== null) {
      segmentFilter.id = segmentId;
    }

    const segments = await prisma.productionSegment.findMany({
      where: segmentFilter,
      include: {
        bezetting: {
          where: {
            position: {
              skill: {
                type: 'on_stream',
              },
            },
          },
          include: {
            person: true,
            position: {
              include: {
                skill: true,
              },
            },
          },
        },
      },
      orderBy: { volgorde: 'asc' },
    });

    // Build crew map: personId -> CrewMember
    const crewMap = new Map<number, CrewMember>();

    // Add production-wide on-stream positions (only if no segment filter)
    if (segmentId === null) {
      for (const pp of productionPositions) {
        if (!crewMap.has(pp.personId)) {
          crewMap.set(pp.personId, {
            personId: pp.personId,
            personName: pp.person.name,
            positions: [],
          });
        }
        crewMap.get(pp.personId)!.positions.push({
          positionId: pp.positionId,
          positionName: pp.position.name,
          skillId: pp.position.skillId,
          skillName: pp.position.skill?.name || null,
          skillType: pp.position.skill?.type || null,
          isStudio: pp.position.isStudio,
          source: 'production',
        });
      }
    }

    // Add segment-specific on-stream positions
    for (const segment of segments) {
      for (const assignment of segment.bezetting) {
        if (!crewMap.has(assignment.personId)) {
          crewMap.set(assignment.personId, {
            personId: assignment.personId,
            personName: assignment.person.name,
            positions: [],
          });
        }
        crewMap.get(assignment.personId)!.positions.push({
          positionId: assignment.positionId,
          positionName: assignment.position.name,
          skillId: assignment.position.skillId,
          skillName: assignment.position.skill?.name || null,
          skillType: assignment.position.skill?.type || null,
          isStudio: assignment.position.isStudio,
          source: 'segment',
          segmentId: segment.id,
          segmentName: segment.naam,
        });
      }
    }

    // Convert map to array and sort by person name
    const crew = Array.from(crewMap.values()).sort((a, b) =>
      a.personName.localeCompare(b.personName, 'nl', { sensitivity: 'base' })
    );

    return res.json(crew);
  } catch (err) {
    return next(err);
  }
});
