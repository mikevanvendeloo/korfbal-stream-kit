import {Router} from 'express';
import {prisma} from '../../services/prisma';

export const segmentsRouter: Router = Router();

// ---------------- Segments CRUD ----------------
// List segments for a production
segmentsRouter.get('/:id/segments', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Not found' });
    const items = await prisma.productionSegment.findMany({ where: { productionId: id }, orderBy: { volgorde: 'asc' } });
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});

// Create a segment
segmentsRouter.post('/:id/segments', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const naam = String(req.body?.naam || '').trim();
    const duurInMinuten = Number(req.body?.duurInMinuten);
    let volgorde = req.body?.volgorde != null ? Number(req.body.volgorde) : NaN;
    const isTimeAnchor = !!req.body?.isTimeAnchor;
    if (!naam || !Number.isInteger(duurInMinuten) || duurInMinuten < 0) {
      return res.status(400).json({ error: 'Invalid naam or duurInMinuten' });
    }

    // determine volgorde if not provided
    const providedVolgorde = Number.isInteger(volgorde) && volgorde > 0;
    const maxRow = await prisma.productionSegment.aggregate({ _max: { volgorde: true }, where: { productionId: id } });
    const maxExisting = maxRow._max.volgorde || 0;
    if (!providedVolgorde) {
      // append to end
      volgorde = maxExisting + 1;
    } else {
      // clamp provided target to [1..max+1]
      volgorde = Math.max(1, Math.min(volgorde, maxExisting + 1));
    }

    const created = await prisma.$transaction(async (tx) => {
      if (isTimeAnchor) {
        await tx.productionSegment.updateMany({ where: { productionId: id, isTimeAnchor: true }, data: { isTimeAnchor: false } });
      }
      // If inserting at a specific position (not append), make room without violating unique constraints.
      // We use a two-phase shift to avoid collisions on (productionId, volgorde) in SQLite/Postgres.
      if (providedVolgorde && volgorde <= maxExisting) {
        const BUMP = 1000; // safe large offset within transaction
        // Phase 1: bump impacted rows out of the way
        await tx.productionSegment.updateMany({
          where: { productionId: id, volgorde: { gte: volgorde } },
          data: { volgorde: { increment: BUMP } as any },
        });
        // Create the new row in the freed spot
        const createdRow = await tx.productionSegment.create({ data: { productionId: id, naam, duurInMinuten, volgorde, isTimeAnchor } });
        // Phase 2: bring bumped rows back down by BUMP-1 → net effect: +1
        await tx.productionSegment.updateMany({
          where: { productionId: id, volgorde: { gte: volgorde + BUMP } },
          data: { volgorde: { decrement: BUMP - 1 } as any },
        });
        return createdRow;
      }
      // Simple append or inserting at max+1
      return tx.productionSegment.create({ data: { productionId: id, naam, duurInMinuten, volgorde, isTimeAnchor } });
    });

    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Volgorde must be unique per production' });
    return next(err);
  }
});

// Get a segment
segmentsRouter.get('/segments/:segmentId', async (req, res, next) => {
  try {
    const segmentId = Number(req.params.segmentId);
    if (!Number.isInteger(segmentId) || segmentId <= 0) return res.status(400).json({ error: 'Invalid segment id' });
    const seg = await prisma.productionSegment.findUnique({ where: { id: segmentId } });
    if (!seg) return res.status(404).json({ error: 'Not found' });
    return res.json(seg);
  } catch (err) {
    return next(err);
  }
});

// Update a segment
segmentsRouter.put('/segments/:segmentId', async (req, res, next) => {
  try {
    const segmentId = Number(req.params.segmentId);
    if (!Number.isInteger(segmentId) || segmentId <= 0) return res.status(400).json({ error: 'Invalid segment id' });
    const seg = await prisma.productionSegment.findUnique({ where: { id: segmentId } });
    if (!seg) return res.status(404).json({ error: 'Not found' });

    const naam = req.body?.naam != null ? String(req.body.naam).trim() : seg.naam;
    const duurInMinuten = req.body?.duurInMinuten != null ? Number(req.body.duurInMinuten) : seg.duurInMinuten;
    const desiredVolgorde = req.body?.volgorde != null ? Number(req.body.volgorde) : seg.volgorde;
    const isTimeAnchor = req.body?.isTimeAnchor != null ? !!req.body.isTimeAnchor : seg.isTimeAnchor;

    if (!naam || !Number.isInteger(duurInMinuten) || duurInMinuten < 0 || !Number.isInteger(desiredVolgorde) || desiredVolgorde <= 0) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (isTimeAnchor) {
        await tx.productionSegment.updateMany({ where: { productionId: seg.productionId, isTimeAnchor: true, NOT: { id: seg.id } }, data: { isTimeAnchor: false } });
      }

      const current = seg.volgorde;
      const target = desiredVolgorde;
      // Normalize: find max to clamp target within [1..max]
      const maxRow = await tx.productionSegment.aggregate({ _max: { volgorde: true }, where: { productionId: seg.productionId } });
      const max = maxRow._max.volgorde || 0;
      const clampedTarget = Math.max(1, Math.min(target, max));

      if (clampedTarget !== current) {
        const BUMP = 1000; // safe large offset within transaction
        if (clampedTarget < current) {
          // Move up: shift down (+1) all in [clampedTarget, current-1]
          // Phase 1: bump impacted rows out of the way
          await tx.productionSegment.updateMany({
            where: { productionId: seg.productionId, NOT: { id: seg.id }, volgorde: { gte: clampedTarget, lte: current - 1 } },
            data: { volgorde: { increment: BUMP } as any },
          });
          // Place moving row at target
          await tx.productionSegment.update({ where: { id: seg.id }, data: { naam, duurInMinuten, volgorde: clampedTarget, isTimeAnchor } });
          // Phase 2: bring bumped rows back down by BUMP-1 → net effect: +1
          await tx.productionSegment.updateMany({
            where: { productionId: seg.productionId, volgorde: { gte: clampedTarget + BUMP } },
            data: { volgorde: { decrement: BUMP - 1 } as any },
          });
        } else if (clampedTarget > current) {
          // Move down: shift up (-1) all in [current+1, clampedTarget]
          // Phase 1: bump impacted rows out of the way (to negative side)
          await tx.productionSegment.updateMany({
            where: { productionId: seg.productionId, NOT: { id: seg.id }, volgorde: { gte: current + 1, lte: clampedTarget } },
            data: { volgorde: { decrement: BUMP } as any },
          });
          // Place moving row at target
          await tx.productionSegment.update({ where: { id: seg.id }, data: { naam, duurInMinuten, volgorde: clampedTarget, isTimeAnchor } });
          // Phase 2: bring bumped rows back up by BUMP-1 → net effect: -1
          await tx.productionSegment.updateMany({
            where: { productionId: seg.productionId, volgorde: { lte: clampedTarget - BUMP } },
            data: { volgorde: { increment: BUMP - 1 } as any },
          });
        }
      } else {
        // No position change, just update fields
        await tx.productionSegment.update({ where: { id: seg.id }, data: { naam, duurInMinuten, isTimeAnchor } });
      }

      // Return the latest state
      return tx.productionSegment.findUnique({ where: { id: seg.id } });
    });

    return res.json(updated);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Volgorde must be unique per production' });
    return next(err);
  }
});

// Delete a segment and normalize order
segmentsRouter.delete('/segments/:segmentId', async (req, res, next) => {
  try {
    const segmentId = Number(req.params.segmentId);
    if (!Number.isInteger(segmentId) || segmentId <= 0) return res.status(400).json({ error: 'Invalid segment id' });
    const seg = await prisma.productionSegment.findUnique({ where: { id: segmentId } });
    if (!seg) return res.status(404).json({ error: 'Not found' });

    await prisma.$transaction(async (tx) => {
      await tx.segmentRoleAssignment.deleteMany({ where: { productionSegmentId: seg.id } });
      await tx.productionSegment.delete({ where: { id: seg.id } });
      // Renumber volgorde for remaining
      const rest = await tx.productionSegment.findMany({ where: { productionId: seg.productionId }, orderBy: { volgorde: 'asc' } });
      for (let i = 0; i < rest.length; i++) {
        if (rest[i].volgorde !== i + 1) {
          await tx.productionSegment.update({ where: { id: rest[i].id }, data: { volgorde: i + 1 } });
        }
      }
    });

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});
