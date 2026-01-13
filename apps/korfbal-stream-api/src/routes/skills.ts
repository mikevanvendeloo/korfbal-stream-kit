import {Router} from 'express';
import {prisma} from '../services/prisma';
import {logger} from '../utils/logger';
import {SkillInputSchema, SkillQuerySchema, SkillUpdateSchema} from '../schemas/skill';

export const skillsRouter: Router = Router();

// List skills with optional search + pagination
skillsRouter.get('/', async (req, res, next) => {
  try {
    const { q, page, limit } = SkillQuerySchema.parse(req.query);
    const where: any = {};
    if (q && q.trim()) {
      const s = q.trim();
      where.OR = [
        { code: { contains: s, mode: 'insensitive' } },
        { name: { contains: s, mode: 'insensitive' } },
        { nameMale: { contains: s, mode: 'insensitive' } },
        { nameFemale: { contains: s, mode: 'insensitive' } },
      ];
    }
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.skill.findMany({ where, orderBy: { code: 'asc' }, skip, take: limit }),
      prisma.skill.count({ where }),
    ]);
    return res.json({ items, page, limit, total, pages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    logger.error('GET /skills failed', err as any);
    return next(err);
  }
});

skillsRouter.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
  try {
    const skill = await prisma.skill.findUnique({ where: { id } });
    if (!skill) return res.status(404).json({ error: 'Not found' });
    return res.json(skill);
  } catch (err) {
    logger.error('GET /skills/:id failed', err as any);
    return next(err);
  }
});

skillsRouter.post('/', async (req, res, next) => {
  try {
    const input = SkillInputSchema.parse(req.body);
    const created = await prisma.skill.create({ data: input as any });
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'code already exists' });
    logger.error('POST /skills failed', err);
    return next(err);
  }
});

skillsRouter.put('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
  try {
    const input = SkillUpdateSchema.parse(req.body);
    const existing = await prisma.skill.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.skill.update({ where: { id }, data: input as any });
    return res.json(updated);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'code already exists' });
    logger.error('PUT /skills/:id failed', err);
    return next(err);
  }
});

skillsRouter.delete('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
  try {
    const existing = await prisma.skill.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.skill.delete({ where: { id } });
    return res.status(204).send();
  } catch (err: any) {
    if (err?.code === 'P2003') return res.status(409).json({ error: 'Skill is in use' });
    logger.error('DELETE /skills/:id failed', err);
    return next(err);
  }
});
