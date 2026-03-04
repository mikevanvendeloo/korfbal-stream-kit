import {Router} from 'express';
import {prisma} from '../services/prisma';
import {z} from 'zod';

export const manualMatchesRouter: Router = Router();

const ManualMatchSchema = z.object({
  date: z.string().datetime(),
  homeTeamName: z.string().min(1),
  awayTeamName: z.string().min(1),
  description: z.string().optional().nullable(),
  refereeName: z.string().optional().nullable(),
});

// GET /api/manual-matches
manualMatchesRouter.get('/', async (req, res, next) => {
  try {
    const matches = await prisma.matchSchedule.findMany({
      where: { isManual: true },
      orderBy: { date: 'desc' },
    });
    return res.json(matches);
  } catch (err) {
    return next(err);
  }
});

// POST /api/manual-matches
manualMatchesRouter.post('/', async (req, res, next) => {
  try {
    const data = ManualMatchSchema.parse(req.body);
    const newMatch = await prisma.matchSchedule.create({
      data: { ...data, isManual: true },
    });
    return res.status(201).json(newMatch);
  } catch (err) {
    return next(err);
  }
});

// PUT /api/manual-matches/:id
manualMatchesRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = ManualMatchSchema.parse(req.body);
    const updatedMatch = await prisma.matchSchedule.update({
      where: { id },
      data,
    });
    return res.json(updatedMatch);
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/manual-matches/:id
manualMatchesRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.matchSchedule.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});
