import {Router} from 'express';
import {prisma} from '../../services/prisma';
import {buildCrewCells, groupPositions} from '../../services/crewReport';

export const productionCrewReportRouter: Router = Router();

// -------- Crew report --------
productionCrewReportRouter.get('/:id/crew-report', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const [chapters, productionWide, assignments, callsheets, productionReport, productionEvents] = await Promise.all([
      prisma.productionChapter.findMany({ where: { productionId: id }, orderBy: { orderIndex: 'asc' } }),
      prisma.productionPersonPosition.findMany({
        where: { productionId: id },
        include: { person: true, position: true },
      }),
      prisma.chapterRoleAssignment.findMany({
        where: { productionSegment: { productionId: id } },
        include: { person: true, position: true },
      }),
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

    const cells = buildCrewCells(
      chapters.map((c) => c.id),
      productionWide.map((a) => ({ personId: a.personId, personName: a.person.name, position: a.position })),
      assignments.map((a) => ({ chapterId: a.productionSegmentId, personId: a.personId, personName: a.person.name, position: a.position })),
    );
    // Only the positions someone fills, so the table doesn't get a column for every position there is
    const filled = new Map([...productionWide, ...assignments].map((a) => [a.position.id, a.position]));

    return res.json({
      chapters,
      groupedPositions: groupPositions([...filled.values()]),
      cells,
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
