import { Router } from 'express';
import { prisma } from '../services/prisma';
import { logger } from '../utils/logger';
import { CapabilityInputSchema, CapabilityQuerySchema, CapabilityUpdateSchema } from '../schemas/capability';

export const capabilitiesRouter = Router();

// List capabilities with optional search + pagination
capabilitiesRouter.get('/', async (req, res, next) => {
  try {
    const { q, page, limit } = CapabilityQuerySchema.parse(req.query);
    const where: any = {};
    if (q && q.trim()) {
      const s = q.trim();
      where.OR = [
        { code: { contains: s, mode: 'insensitive' } },
        { functionName: { contains: s, mode: 'insensitive' } },
        { nameMale: { contains: s, mode: 'insensitive' } },
        { nameFemale: { contains: s, mode: 'insensitive' } },
      ];
    }
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.capability.findMany({ where, orderBy: { code: 'asc' }, skip, take: limit }),
      prisma.capability.count({ where }),
    ]);
    return res.json({ items, page, limit, total, pages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    logger.error('GET /capabilities failed', err as any);
    return next(err);
  }
});

capabilitiesRouter.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
  try {
    const cap = await prisma.capability.findUnique({ where: { id } });
    if (!cap) return res.status(404).json({ error: 'Not found' });
    return res.json(cap);
  } catch (err) {
    logger.error('GET /capabilities/:id failed', err as any);
    return next(err);
  }
});

capabilitiesRouter.post('/', async (req, res, next) => {
  try {
    const input = CapabilityInputSchema.parse(req.body);
    const created = await prisma.capability.create({ data: input as any });
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'code already exists' });
    logger.error('POST /capabilities failed', err);
    return next(err);
  }
});

capabilitiesRouter.put('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
  try {
    const input = CapabilityUpdateSchema.parse(req.body);
    const existing = await prisma.capability.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.capability.update({ where: { id }, data: input as any });
    return res.json(updated);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'code already exists' });
    logger.error('PUT /capabilities/:id failed', err);
    return next(err);
  }
});

capabilitiesRouter.delete('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
  try {
    const existing = await prisma.capability.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.capability.delete({ where: { id } });
    return res.status(204).send();
  } catch (err: any) {
    if (err?.code === 'P2003') return res.status(409).json({ error: 'Capability is in use' });
    logger.error('DELETE /capabilities/:id failed', err);
    return next(err);
  }
});
