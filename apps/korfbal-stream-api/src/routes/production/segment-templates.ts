import {Router} from 'express';
import {prisma} from '../../services/prisma';

export const segmentTemplatesRouter: Router = Router();

// --- Default Template Management ---

// Set a template as default
segmentTemplatesRouter.put('/:id/set-default', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.$transaction([
      prisma.segmentTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      }),
      prisma.segmentTemplate.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);
    return res.json({ message: 'Template set as default' });
  } catch (err) {
    return next(err);
  }
});

// JSON version for import/export compatibility
const SEGMENT_TEMPLATE_JSON_VERSION = 1 as const;

// --- SegmentTemplate CRUD ---

// List all templates
segmentTemplatesRouter.get('/', async (_req, res, next) => {
  try {
    const templates = await prisma.segmentTemplate.findMany({
      include: { items: { orderBy: { volgorde: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return res.json(templates);
  } catch (err) {
    return next(err);
  }
});

// Create a template
segmentTemplatesRouter.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const created = await prisma.segmentTemplate.create({
      data: { name },
    });
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Template name must be unique' });
    return next(err);
  }
});

// Get a single template
segmentTemplatesRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const template = await prisma.segmentTemplate.findUnique({
      where: { id },
      include: { items: { orderBy: { volgorde: 'asc' } } },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    return res.json(template);
  } catch (err) {
    return next(err);
  }
});

// Update a template
segmentTemplatesRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const updated = await prisma.segmentTemplate.update({
      where: { id },
      data: { name },
    });
    return res.json(updated);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Template name must be unique' });
    return next(err);
  }
});

// Delete a template
segmentTemplatesRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.segmentTemplate.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// --- SegmentTemplateItem CRUD ---

// Add item to template
segmentTemplatesRouter.post('/:id/items', async (req, res, next) => {
  try {
    const templateId = Number(req.params.id);
    const { naam, duurInMinuten, isTimeAnchor } = req.body;
    let { volgorde } = req.body;

    if (!naam || duurInMinuten === undefined) {
      return res.status(400).json({ error: 'Naam and duurInMinuten are required' });
    }

    const maxItem = await prisma.segmentTemplateItem.aggregate({
      _max: { volgorde: true },
      where: { templateId },
    });
    const maxExisting = maxItem._max.volgorde || 0;

    if (volgorde === undefined) {
      volgorde = maxExisting + 1;
    }

    const created = await prisma.$transaction(async (tx) => {
      if (isTimeAnchor) {
        await tx.segmentTemplateItem.updateMany({
          where: { templateId, isTimeAnchor: true },
          data: { isTimeAnchor: false },
        });
      }

      if (volgorde <= maxExisting) {
        const BUMP = 1000;
        await tx.segmentTemplateItem.updateMany({
          where: { templateId, volgorde: { gte: volgorde } },
          data: { volgorde: { increment: BUMP } as any },
        });

        const newItem = await tx.segmentTemplateItem.create({
          data: { templateId, naam, duurInMinuten, volgorde, isTimeAnchor: !!isTimeAnchor },
        });

        await tx.segmentTemplateItem.updateMany({
          where: { templateId, volgorde: { gte: volgorde + BUMP } },
          data: { volgorde: { decrement: BUMP - 1 } as any },
        });
        return newItem;
      }

      return tx.segmentTemplateItem.create({
        data: { templateId, naam, duurInMinuten, volgorde, isTimeAnchor: !!isTimeAnchor },
      });
    });

    return res.status(201).json(created);
  } catch (err) {
    return next(err);
  }
});

// Update template item
segmentTemplatesRouter.put('/items/:itemId', async (req, res, next) => {
  try {
    const itemId = Number(req.params.itemId);
    const { naam, duurInMinuten, volgorde, isTimeAnchor } = req.body;

    const item = await prisma.segmentTemplateItem.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const updated = await prisma.$transaction(async (tx) => {
      if (isTimeAnchor) {
        await tx.segmentTemplateItem.updateMany({
          where: { templateId: item.templateId, isTimeAnchor: true, NOT: { id: itemId } },
          data: { isTimeAnchor: false },
        });
      }

      const current = item.volgorde;
      const target = volgorde !== undefined ? volgorde : current;

      if (target !== current) {
        const maxRow = await tx.segmentTemplateItem.aggregate({
          _max: { volgorde: true },
          where: { templateId: item.templateId },
        });
        const max = maxRow._max.volgorde || 0;
        const clampedTarget = Math.max(1, Math.min(target, max));

        const BUMP = 1000;
        if (clampedTarget < current) {
          await tx.segmentTemplateItem.updateMany({
            where: { templateId: item.templateId, NOT: { id: itemId }, volgorde: { gte: clampedTarget, lte: current - 1 } },
            data: { volgorde: { increment: BUMP } as any },
          });
          await tx.segmentTemplateItem.update({
            where: { id: itemId },
            data: { naam, duurInMinuten, volgorde: clampedTarget, isTimeAnchor: !!isTimeAnchor },
          });
          await tx.segmentTemplateItem.updateMany({
            where: { templateId: item.templateId, volgorde: { gte: clampedTarget + BUMP } },
            data: { volgorde: { decrement: BUMP - 1 } as any },
          });
        } else {
          await tx.segmentTemplateItem.updateMany({
            where: { templateId: item.templateId, NOT: { id: itemId }, volgorde: { gte: current + 1, lte: clampedTarget } },
            data: { volgorde: { decrement: BUMP } as any },
          });
          await tx.segmentTemplateItem.update({
            where: { id: itemId },
            data: { naam, duurInMinuten, volgorde: clampedTarget, isTimeAnchor: !!isTimeAnchor },
          });
          await tx.segmentTemplateItem.updateMany({
            where: { templateId: item.templateId, volgorde: { lte: clampedTarget - BUMP } },
            data: { volgorde: { increment: BUMP - 1 } as any },
          });
        }
      } else {
        await tx.segmentTemplateItem.update({
          where: { id: itemId },
          data: { naam, duurInMinuten, isTimeAnchor: !!isTimeAnchor },
        });
      }
      return tx.segmentTemplateItem.findUnique({ where: { id: itemId } });
    });

    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

// Delete template item
segmentTemplatesRouter.delete('/items/:itemId', async (req, res, next) => {
  try {
    const itemId = Number(req.params.itemId);
    const item = await prisma.segmentTemplateItem.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    await prisma.$transaction(async (tx) => {
      await tx.segmentTemplateItem.delete({ where: { id: itemId } });
      const remaining = await tx.segmentTemplateItem.findMany({
        where: { templateId: item.templateId },
        orderBy: { volgorde: 'asc' },
      });
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].volgorde !== i + 1) {
          await tx.segmentTemplateItem.update({
            where: { id: remaining[i].id },
            data: { volgorde: i + 1 },
          });
        }
      }
    });

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// Apply template to production
segmentTemplatesRouter.post('/apply/:templateId/to/:productionId', async (req, res, next) => {
  try {
    const templateId = Number(req.params.templateId);
    const productionId = Number(req.params.productionId);

    const template = await prisma.segmentTemplate.findUnique({
      where: { id: templateId },
      include: { items: { orderBy: { volgorde: 'asc' } } },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const production = await prisma.production.findUnique({ where: { id: productionId } });
    if (!production) return res.status(404).json({ error: 'Production not found' });

    await prisma.$transaction(async (tx) => {
      // 1. Delete existing segments for this production
      const existingSegments = await tx.productionSegment.findMany({ where: { productionId } });
      for (const seg of existingSegments) {
        await tx.segmentRoleAssignment.deleteMany({ where: { productionSegmentId: seg.id } });
        await tx.productionSegment.delete({ where: { id: seg.id } });
      }

      // 2. Create new segments from template items
      for (const item of template.items) {
        await tx.productionSegment.create({
          data: {
            productionId,
            naam: item.naam,
            volgorde: item.volgorde,
            duurInMinuten: item.duurInMinuten,
            isTimeAnchor: item.isTimeAnchor,
          },
        });
      }
    });

    return res.status(200).json({ message: 'Template applied successfully' });
  } catch (err) {
    return next(err);
  }
});

// Create a template from an existing production's segments
segmentTemplatesRouter.post('/from-production/:productionId', async (req, res, next) => {
  try {
    const productionId = Number(req.params.productionId);
    const name = String(req.body?.name || '').trim();
    if (!Number.isInteger(productionId) || productionId <= 0) return res.status(400).json({ error: 'Invalid productionId' });
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const prod = await prisma.production.findUnique({ where: { id: productionId } });
    if (!prod) return res.status(404).json({ error: 'Production not found' });

    const segments = await prisma.productionSegment.findMany({ where: { productionId }, orderBy: { volgorde: 'asc' } });
    if (segments.length === 0) return res.status(400).json({ error: 'Production has no segments' });

    const created = await prisma.$transaction(async (tx) => {
      const tpl = await tx.segmentTemplate.create({ data: { name, isDefault: false } });
      for (const seg of segments) {
        await tx.segmentTemplateItem.create({
          data: {
            templateId: tpl.id,
            naam: seg.naam,
            volgorde: seg.volgorde,
            duurInMinuten: seg.duurInMinuten,
            isTimeAnchor: seg.isTimeAnchor,
          },
        });
      }
      return tx.segmentTemplate.findUnique({ where: { id: tpl.id }, include: { items: { orderBy: { volgorde: 'asc' } } } });
    });

    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Template name must be unique' });
    return next(err);
  }
});

// Export a segment template as JSON (versioned)
segmentTemplatesRouter.get('/:id/export-json', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const tpl = await prisma.segmentTemplate.findUnique({ where: { id }, include: { items: { orderBy: { volgorde: 'asc' } } } });
    if (!tpl) return res.status(404).json({ error: 'Template not found' });

    const payload = {
      version: SEGMENT_TEMPLATE_JSON_VERSION,
      name: tpl.name,
      items: tpl.items.map(i => ({
        naam: i.naam,
        volgorde: i.volgorde,
        duurInMinuten: i.duurInMinuten,
        isTimeAnchor: i.isTimeAnchor,
      })),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=segment-template-${tpl.name.replace(/\s+/g, '-').toLowerCase()}.json`);
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
});

// Import a segment template from JSON (supports version 1)
segmentTemplatesRouter.post('/import-json', async (req, res, next) => {
  try {
    const body = req.body || {};
    const version = Number(body.version ?? 1);
    if (!Number.isInteger(version) || version < 1) {
      return res.status(400).json({ error: 'Invalid or unsupported version' });
    }
    if (version > SEGMENT_TEMPLATE_JSON_VERSION) {
      return res.status(400).json({ error: `Unsupported version: ${version}` });
    }

    const name = String(body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return res.status(400).json({ error: 'No items to import' });

    const upserted = await prisma.$transaction(async (tx) => {
      const existing = await tx.segmentTemplate.findUnique({ where: { name } }).catch(() => null);
      let tplId: number;
      if (existing) {
        tplId = existing.id;
        await tx.segmentTemplateItem.deleteMany({ where: { templateId: tplId } });
      } else {
        const tpl = await tx.segmentTemplate.create({ data: { name } });
        tplId = tpl.id;
      }

      for (const raw of items) {
        const naam = String(raw.naam || '').trim();
        const volgorde = Number(raw.volgorde);
        const duurInMinuten = Number(raw.duurInMinuten);
        const isTimeAnchor = !!raw.isTimeAnchor;
        if (!naam || !Number.isInteger(volgorde) || volgorde <= 0 || !Number.isInteger(duurInMinuten) || duurInMinuten < 0) {
          continue; // skip invalid rows
        }
        await tx.segmentTemplateItem.create({
          data: { templateId: tplId, naam, volgorde, duurInMinuten, isTimeAnchor },
        });
      }

      return tx.segmentTemplate.findUnique({ where: { id: tplId }, include: { items: { orderBy: { volgorde: 'asc' } } } });
    });

    return res.status(200).json(upserted);
  } catch (err) {
    return next(err);
  }
});
