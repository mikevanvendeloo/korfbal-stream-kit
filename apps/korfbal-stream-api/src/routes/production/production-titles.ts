import {Router} from 'express';
import {z} from 'zod';
import {prisma} from '../../services/prisma';
import {
  CreateTitleDefinitionSchema,
  ReorderTitleDefinitionsSchema,
  UpdateTitleDefinitionSchema
} from '../../schemas/title';

export const productionTitlesRouter: Router = Router();

// ---------------- Titles configuration (per production) ----------------

// List title definitions (with parts) for a production
productionTitlesRouter.get('/:id/titles', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const defs = await (prisma as any).titleDefinition.findMany({
      where: { productionId: id },
      orderBy: { order: 'asc' },
      include: { parts: { orderBy: { id: 'asc' } } },
    });
    return res.json(defs);
  } catch (err) {
    return next(err);
  }
});

// Create a title definition with parts
productionTitlesRouter.post('/:id/titles', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const parsed = CreateTitleDefinitionSchema.parse(req.body);

    const created = await prisma.$transaction(async (tx) => {
      const maxRow = await (tx as any).titleDefinition.aggregate({ _max: { order: true }, where: { productionId: id } });
      const nextOrder = (maxRow?._max?.order || 0) + 1;
      const order = parsed.order && parsed.order > 0 ? parsed.order : nextOrder;

      // If order is within existing range, shift others down to make room
      if (order <= (maxRow?._max?.order || 0)) {
        await (tx as any).titleDefinition.updateMany({
          where: { productionId: id, order: { gte: order } },
          data: { order: { increment: 1 } as any },
        });
      }

      const def = await (tx as any).titleDefinition.create({
        data: {
          productionId: id,
          name: parsed.name,
          order,
          enabled: parsed.enabled ?? true,
        },
      });
      for (const p of parsed.parts) {
        await (tx as any).titlePart.create({
          data: {
            titleDefinitionId: def.id,
            sourceType: p.sourceType,
            teamSide: p.teamSide ?? 'NONE',
            limit: p.limit ?? null,
            filters: p.filters as any,
            customFunction: (p as any).customFunction ?? null,
            customName: (p as any).customName ?? null,
          },
        });
      }
      return def;
    });

    // Return created with parts
    const full = await (prisma as any).titleDefinition.findUnique({
      where: { id: created.id },
      include: { parts: { orderBy: { id: 'asc' } } },
    });
    return res.status(201).json(full);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid payload' });
    return next(err);
  }
});

// Update a title definition (and replace parts if provided)
productionTitlesRouter.put('/:id/titles/:titleId', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const titleId = Number(req.params.titleId);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(titleId) || titleId <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const def = await (prisma as any).titleDefinition.findUnique({ where: { id: titleId } });
    if (!def || def.productionId !== id) return res.status(404).json({ error: 'Not found' });

    const parsed = UpdateTitleDefinitionSchema.parse(req.body);

    await prisma.$transaction(async (tx) => {
      await (tx as any).titleDefinition.update({
        where: { id: titleId },
        data: {
          name: parsed.name ?? undefined,
          enabled: parsed.enabled ?? undefined,
        },
      });
      if (parsed.parts) {
        await (tx as any).titlePart.deleteMany({ where: { titleDefinitionId: titleId } });
        for (const p of parsed.parts) {
          await (tx as any).titlePart.create({
            data: {
              titleDefinitionId: titleId,
              sourceType: p.sourceType,
              teamSide: p.teamSide ?? 'NONE',
              limit: p.limit ?? null,
              filters: p.filters as any,
              customFunction: (p as any).customFunction ?? null,
              customName: (p as any).customName ?? null,
            },
          });
        }
      }
    });

    const full = await (prisma as any).titleDefinition.findUnique({
      where: { id: titleId },
      include: { parts: { orderBy: { id: 'asc' } } },
    });
    return res.json(full);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid payload' });
    return next(err);
  }
});

// Delete a title definition and renumber remaining orders
productionTitlesRouter.delete('/:id/titles/:titleId', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const titleId = Number(req.params.titleId);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(titleId) || titleId <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const def = await (prisma as any).titleDefinition.findUnique({ where: { id: titleId } });
    if (!def || def.productionId !== id) return res.status(404).json({ error: 'Not found' });

    await prisma.$transaction(async (tx) => {
      await (tx as any).titlePart.deleteMany({ where: { titleDefinitionId: titleId } });
      await (tx as any).titleDefinition.delete({ where: { id: titleId } });
      // Renumber
      const rest = await (tx as any).titleDefinition.findMany({ where: { productionId: id }, orderBy: { order: 'asc' } });
      for (let i = 0; i < rest.length; i++) {
        if (rest[i].order !== i + 1) {
          await (tx as any).titleDefinition.update({ where: { id: rest[i].id }, data: { order: i + 1 } });
        }
      }
    });

    return res.status(204).send();
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid payload' });
    return next(err);
  }
});

// Reorder title definitions
productionTitlesRouter.patch('/:id/titles:reorder', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const parsed = ReorderTitleDefinitionsSchema.parse(req.body);

    await prisma.$transaction(async (tx) => {
      // Validate that all ids belong to this production
      const existing = await (tx as any).titleDefinition.findMany({ where: { productionId: id }, select: { id: true } });
      const idsSet = new Set(existing.map((e: any) => e.id));
      for (const i of parsed.ids) {
        if (!idsSet.has(i)) throw new Error('Invalid title id in ordering');
      }
      for (let index = 0; index < parsed.ids.length; index++) {
        const titleId = parsed.ids[index];
        await (tx as any).titleDefinition.update({ where: { id: titleId }, data: { order: index + 1 } });
      }
    });

    return res.status(204).send();
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid payload' });
    return next(err);
  }
});
