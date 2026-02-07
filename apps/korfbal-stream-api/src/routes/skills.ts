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

// GET /api/skills/export-json
// Export all skills as JSON
// IMPORTANT: Must be BEFORE /:id route
skillsRouter.get('/export-json', async (_req, res, next) => {
  try {
    const skills = await prisma.skill.findMany({ orderBy: { code: 'asc' } });

    // Map to export format (without id and createdAt)
    const exportData = skills.map((s) => ({
      code: s.code,
      name: s.name,
      nameMale: s.nameMale,
      nameFemale: s.nameFemale,
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=skills.json');
    return res.json(exportData);
  } catch (err) {
    logger.error('GET /skills/export-json failed', err as any);
    return next(err);
  }
});

// POST /api/skills/import-json
// Import skills from JSON (upsert based on code)
skillsRouter.post('/import-json', async (req, res, next) => {
  try {
    const data = req.body;
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: 'Expected an array of skills' });
    }

    let created = 0;
    let updated = 0;
    const problems: { code: string; reason: string }[] = [];

    for (const item of data) {
      try {
        const input = SkillInputSchema.parse(item);
        const existing = await prisma.skill.findUnique({ where: { code: input.code } });

        if (existing) {
          await prisma.skill.update({ where: { id: existing.id }, data: input as any });
          updated++;
        } else {
          await prisma.skill.create({ data: input as any });
          created++;
        }
      } catch (err: any) {
        problems.push({ code: item.code || 'unknown', reason: err.message || 'validation failed' });
      }
    }

    return res.json({ ok: true, total: data.length, created, updated, problems });
  } catch (err) {
    logger.error('POST /skills/import-json failed', err as any);
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
