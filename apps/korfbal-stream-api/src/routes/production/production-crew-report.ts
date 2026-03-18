import {Router} from 'express';
import {prisma} from '../../services/prisma';

export const productionCrewReportRouter: Router = Router();

// -------- Crew report --------
productionCrewReportRouter.get('/:id/crew-report', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const [segments, positions, assignments, callsheets] = await Promise.all([
      prisma.productionSegment.findMany({ where: { productionId: id }, orderBy: { volgorde: 'asc' } }),
      prisma.position.findMany({ orderBy: { name: 'asc' } }),
      prisma.segmentRoleAssignment.findMany({
        where: { productionSegment: { productionId: id } },
        include: { person: true, position: true },
      }),
      prisma.callSheet.findMany({
        where: { productionId: id },
        include: {
          items: {
            orderBy: { orderIndex: 'asc' },
            include: {
              productionSegment: true,
            }
          }
        },
        orderBy: { id: 'asc' }
      }),
    ]);

    const cells = assignments.map((a) => ({
      segmentId: a.productionSegmentId,
      positionId: a.positionId,
      personName: a.person.name,
    }));

    return res.json({ segments, positions, cells, callsheets });
  } catch (err) {
    return next(err);
  }
});
