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

    const [callsheets, productionReport, productionEvents] = await Promise.all([
      prisma.callSheet.findMany({
        where: { productionId: id },
        include: {
          items: {
            orderBy: { orderIndex: 'asc' },
            include: {
              chapter: true,
              positions: { select: { positionId: true } },
            }
          }
        },
        orderBy: { id: 'asc' }
      }),
      prisma.productionReport.findUnique({ where: { productionId: id } }),
      prisma.productionEvent.findMany({
        where: { productionId: id },
        select: {
          callSheetItemId: true,
          actualStartTime: true,
          durationSec: true,
          status: true,
          plannedStartTime: true,
        }
      })
    ]);

    return res.json({
      callsheets: callsheets.map(({ items, ...cs }) => ({
        ...cs,
        items: items.map(({ positions, ...item }) => ({ ...item, positionIds: positions.map((p) => p.positionId) })),
      })),
      productionReport,
      productionEvents,
    });
  } catch (err) {
    return next(err);
  }
});
