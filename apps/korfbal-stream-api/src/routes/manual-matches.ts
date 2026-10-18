import {Router} from 'express';
import {prisma} from '../services/prisma';
import {z} from 'zod';
import {ensureSeasonForDate, resolveSeasonId} from '../services/season';
import {parseInstant} from '../utils/time';
import {shiftProductionTimesForMatchDateChange} from '../services/matchChange';

export const manualMatchesRouter: Router = Router();

const ManualMatchSchema = z.object({
  // UTC ("…Z") or with an offset, as the kit sends it; a time without zone means Amsterdam time
  date: z.string().transform((value, ctx) => {
    const date = parseInstant(value);
    if (!date) {
      ctx.addIssue({code: z.ZodIssueCode.custom, message: 'Invalid date'});
      return z.NEVER;
    }
    return date;
  }),
  homeTeamName: z.string().min(1),
  awayTeamName: z.string().min(1),
  description: z.string().optional().nullable(),
  refereeName: z.string().optional().nullable(),
});

// GET /api/manual-matches
manualMatchesRouter.get('/', async (req, res, next) => {
  try {
    const seasonId = await resolveSeasonId(req.query.seasonId);
    const matches = await prisma.matchSchedule.findMany({
      where: { isManual: true, seasonId },
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
    const season = await ensureSeasonForDate(data.date);
    const newMatch = await prisma.matchSchedule.create({
      data: { ...data, isManual: true, seasonId: season.id },
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
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Ongeldig id' });
    const data = ManualMatchSchema.parse(req.body);
    const season = await ensureSeasonForDate(data.date);
    // The production's own times move with the match date, in the same transaction
    const updatedMatch = await prisma.$transaction(async (tx) => {
      // Only manual matches: an imported match is updated by the next import
      const previous = await tx.matchSchedule.findFirst({ where: { id, isManual: true }, select: { date: true } });
      if (!previous) return null;
      const updated = await tx.matchSchedule.update({
        where: { id },
        data: { ...data, seasonId: season.id },
      });
      await shiftProductionTimesForMatchDateChange(tx, id, previous.date, updated.date);
      return updated;
    });
    if (!updatedMatch) return res.status(404).json({ error: 'Not found' });
    return res.json(updatedMatch);
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/manual-matches/:id
manualMatchesRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Ongeldig id' });
    const { count } = await prisma.matchSchedule.deleteMany({ where: { id, isManual: true } });
    if (count === 0) return res.status(404).json({ error: 'Not found' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});
