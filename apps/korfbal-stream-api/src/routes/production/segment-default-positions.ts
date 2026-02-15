import {Router} from 'express';
import {z} from 'zod';
import {prisma} from '../../services/prisma';

export const segmentDefaultPositionsRouter: Router = Router();

// -------- Segment default positions configuration --------
// Reserved internal name for the global default set. UI will display this as "Algemeen".
const GLOBAL_SEGMENT_NAME = '__GLOBAL__';
const SegmentDefaultsSchema = z.object({
  segmentName: z.string().min(2).max(100),
  positions: z.array(z.object({ positionId: z.number().int().positive(), order: z.number().int().nonnegative() })),
});

// List defaults for a segment name
segmentDefaultPositionsRouter.get('/segment-default-positions', async (req, res, next) => {
  try {
    const name = String(req.query.segmentName || '').trim();
    if (!name) return res.status(400).json({ error: 'segmentName is required' });
    const items = await prisma.segmentDefaultPosition.findMany({
      where: { segmentName: name },
      orderBy: { order: 'asc' },
      include: { position: { include: { skill: true } } },
    });
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});

// List configured segment default names (distinct). Includes global when present.
segmentDefaultPositionsRouter.get('/segment-default-positions/names', async (_req, res, next) => {
  try {
    const rows = await prisma.segmentDefaultPosition.findMany({
      select: { segmentName: true },
      distinct: ['segmentName'],
      orderBy: { segmentName: 'asc' },
    });
    const names = Array.from(new Set(rows.map((r) => r.segmentName)));
    return res.json({ items: names, hasGlobal: names.includes(GLOBAL_SEGMENT_NAME) });
  } catch (err) {
    return next(err);
  }
});

// Upsert defaults for a segment name (replace all with provided list)
segmentDefaultPositionsRouter.put('/segment-default-positions', async (req, res, next) => {
  try {
    const parsed = SegmentDefaultsSchema.parse(req.body || {});
    // Allow the special global name
    const segmentName = parsed.segmentName === 'Algemeen' ? GLOBAL_SEGMENT_NAME : parsed.segmentName;
    // Validate positions exist
    const posIds = parsed.positions.map((p) => p.positionId);
    const uniquePosIds = Array.from(new Set(posIds));
    const positions = await prisma.position.findMany({ where: { id: { in: uniquePosIds } } });
    if (positions.length !== uniquePosIds.length) return res.status(422).json({ error: 'One or more positions not found' });

    await prisma.$transaction(async (tx) => {
      await tx.segmentDefaultPosition.deleteMany({ where: { segmentName } });
      if (parsed.positions.length > 0) {
        await tx.segmentDefaultPosition.createMany({
          data: parsed.positions.map((p) => ({ segmentName, positionId: p.positionId, order: p.order })),
          skipDuplicates: true,
        });
      }
    });
    const refreshed = await prisma.segmentDefaultPosition.findMany({
      where: { segmentName },
      orderBy: { order: 'asc' },
      include: { position: { include: { skill: true } } },
    });
    return res.json(refreshed);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors?.[0]?.message || 'Invalid input' });
    return next(err);
  }
});
