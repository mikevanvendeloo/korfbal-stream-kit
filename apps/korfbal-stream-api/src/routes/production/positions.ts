import {Router} from 'express';
import {z} from 'zod';
import {prisma} from '../../services/prisma';

export const positionsRouter: Router = Router();

// -------- Positions catalog (place before dynamic /:id routes to avoid conflicts) --------
const PositionSchema = z.object({
  name: z.string().min(2).max(100),
  skillId: z.number().int().positive().nullable().optional(),
});

positionsRouter.get('/positions', async (_req, res, next) => {
  try {
    const items = await prisma.position.findMany({ orderBy: { name: 'asc' }, include: { skill: true } });
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});

positionsRouter.post('/positions', async (req, res, next) => {
  try {
    const parsed = PositionSchema.parse(req.body || {});
    // Validate skillId if provided
    const skillId: number | null = parsed.skillId == null ? null : Number(parsed.skillId);
    if (skillId != null) {
      const cap = await prisma.skill.findUnique({ where: { id: skillId } });
      if (!cap) return res.status(422).json({ error: 'Skill not found' });
    }
    const created = await prisma.position.create({
      data: { name: parsed.name, skillId: skillId ?? undefined },
      include: { skill: true },
    });
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Position name already exists' });
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors?.[0]?.message || 'Invalid input' });
    return next(err);
  }
});

positionsRouter.put('/positions/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const existing = await prisma.position.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const parsed = PositionSchema.partial().required({}).parse(req.body || {});
    // skillId may be null (to unset)
    const skillId: number | null | undefined = parsed.skillId as any;
    if (skillId !== undefined && skillId !== null) {
      const cap = await prisma.skill.findUnique({ where: { id: Number(skillId) } });
      if (!cap) return res.status(422).json({ error: 'Skill not found' });
    }
    const updated = await prisma.position.update({
      where: { id },
      data: {
        name: parsed.name ?? undefined,
        skillId: skillId === undefined ? undefined : skillId,
      },
      include: { skill: true },
    });
    return res.json(updated);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Position name already exists' });
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors?.[0]?.message || 'Invalid input' });
    return next(err);
  }
});

positionsRouter.delete('/positions/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const existing = await prisma.position.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.position.delete({ where: { id } });
    return res.status(204).send();
  } catch (err: any) {
    if (err?.code === 'P2003') return res.status(409).json({ error: 'Position is in use' });
    return next(err);
  }
});
