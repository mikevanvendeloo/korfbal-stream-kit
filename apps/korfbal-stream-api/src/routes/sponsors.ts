import {Router} from 'express';
import {prisma} from '../services/prisma';
import {logger} from '../utils/logger';
import {makeLogoUrl, SponsorInputSchema, SponsorQuerySchema, SponsorUpdateSchema} from '../schemas/sponsor';

export const sponsorsRouter = Router();

// List sponsors with optional filtering and pagination
sponsorsRouter.get('/', async (req, res, next) => {
  try {
    const { type, page, limit } = SponsorQuerySchema.parse(req.query);
    const where: any = {};
    if (type) where.type = type;

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.sponsor.findMany({ where, orderBy: { id: 'asc' }, skip, take: limit }),
      prisma.sponsor.count({ where }),
    ]);

    res.json({ items, page, limit, total, pages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    logger.error('GET /sponsors failed', err as any);
    return next(err);
  }
});

// Get sponsor by id
sponsorsRouter.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
  try {
    const sponsor = await prisma.sponsor.findUnique({ where: { id } });
    if (!sponsor) return res.status(404).json({ error: 'No sponsor found with this id' });
    return res.json(sponsor);
  } catch (err) {
    logger.error('GET /sponsors/:id failed', err as any);
    return next(err);
  }
});

// Create sponsor
sponsorsRouter.post('/', async (req, res, next) => {
  try {
    const { name, type, websiteUrl, logoUrl } = SponsorInputSchema.parse(req.body);
    const created = await prisma.sponsor.create({
      data: {
        name,
        type,
        websiteUrl,
        logoUrl: logoUrl || makeLogoUrl(name),
      },
    });
    return res.status(201).json(created);
  } catch (err) {
    logger.error('POST /sponsors failed', err as any);
    return next(err);
  }
});

// Update sponsor
sponsorsRouter.put('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ongeldig id' });
  try {
    const input = SponsorUpdateSchema.parse(req.body);
    const existing = await prisma.sponsor.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Niet gevonden' });

    const nextName = input.name ?? (existing as any).name;
    const nextLogo = input.logoUrl ?? (input.name ? makeLogoUrl(input.name) : existing.logoUrl);

    const updated = await prisma.sponsor.update({
      where: { id },
      data: {
        name: nextName,
        type: (input.type as any) ?? existing.type,
        websiteUrl: input.websiteUrl ?? existing.websiteUrl,
        logoUrl: nextLogo,
      },
    });
    return res.json(updated);
  } catch (err) {
    logger.error('PUT /sponsors/:id failed', err as any);
    return next(err);
  }
});

// Delete sponsor
sponsorsRouter.delete('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ongeldig id' });
  try {
    const existing = await prisma.sponsor.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Niet gevonden' });
    await prisma.sponsor.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    logger.error('DELETE /sponsors/:id failed', err as any);
    return next(err);
  }
});

export const __test__ = { };
