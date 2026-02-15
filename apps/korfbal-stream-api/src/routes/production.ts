import {Router} from 'express';
import {skillsRouter} from './skills';
import {prisma} from '../services/prisma';

// Import all production sub-routers
import {productionPersonsRouter} from './production/production-persons';
import {productionPersonPositionsRouter} from './production/production-person-positions';
import {positionsRouter} from './production/positions';
import {segmentDefaultPositionsRouter} from './production/segment-default-positions';
import {segmentsRouter} from './production/segments';
import {productionTimingRouter} from './production/production-timing';
import {productionTitlesRouter} from './production/production-titles';
import {productionInterviewsRouter} from './production/production-interviews';
import {productionCrewReportRouter} from './production/production-crew-report';
import {productionCallsheetsRouter} from './production/production-callsheets';
import {segmentAssignmentsRouter} from './production/segment-assignments';
import {productionReportsRouter} from './production/production-reports';
import {productionCrewRouter} from './production/production-crew';

// Easily expandable default team filters
const DEFAULT_TEAM_FILTERS = [
  'Fortuna/Ruitenheer 1',
  'Fortuna/Ruitenheer 2',
  'Fortuna/Ruitenheer U19-1',
];

export const productionRouter: Router = Router();

// IMPORTANT: Production-specific routes with :id param must come BEFORE nested routers
// to avoid conflicts with /persons and /skills routes

// Mount all the sub-routers
productionRouter.use(productionPersonsRouter);
productionRouter.use(productionPersonPositionsRouter);
productionRouter.use(positionsRouter);
productionRouter.use(segmentDefaultPositionsRouter);
productionRouter.use(segmentsRouter);
productionRouter.use(productionTimingRouter);
productionRouter.use(productionTitlesRouter);
productionRouter.use(productionInterviewsRouter);
productionRouter.use(productionCrewReportRouter);
productionRouter.use(productionCallsheetsRouter);
productionRouter.use(segmentAssignmentsRouter);
productionRouter.use(productionReportsRouter);
productionRouter.use(productionCrewRouter);

// Nest skills router under production namespace for backward compatibility
// Note: /persons router is NOT nested here - persons are available at /api/persons
productionRouter.use('/skills', skillsRouter);

// Activate a production (ensure only one active at a time)
productionRouter.post('/:id/activate', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  try {
    const target = await prisma.production.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ error: 'Not found' });

    await prisma.$transaction([
      prisma.production.updateMany({ where: { isActive: true }, data: { isActive: false } }),
      prisma.production.update({ where: { id }, data: { isActive: true } }),
    ]);

    const updated = await prisma.production.findUnique({ where: { id } });
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

// GET /api/production/matches -> list candidate matches for production with filters
productionRouter.get('/matches', async (req, res, next) => {
  try {
    // allow override via query team[]=A&team[]=B
    const teams = ([] as string[]).concat(
      ...(Array.isArray(req.query.team) ? (req.query.team as string[]) : req.query.team ? [String(req.query.team)] : [])
    );
    const filters = teams.length > 0 ? teams : DEFAULT_TEAM_FILTERS;

    // Only home matches and homeTeamName matches any of the filters (contains)
    const items = await prisma.matchSchedule.findMany({
      where: {
        isHomeMatch: true,
        OR: filters.map((f) => ({ homeTeamName: { contains: f, mode: 'insensitive' as const } })),
      },
      orderBy: [{ date: 'asc' }],
    });
    return res.json({ items, filters });
  } catch (err) {
    return next(err);
  }
});

// POST /api/production -> create a production by selecting a match
productionRouter.post('/', async (req, res, next) => {
  try {
    const matchScheduleId = Number(req.body?.matchScheduleId);
    if (!Number.isInteger(matchScheduleId) || matchScheduleId <= 0) {
      return res.status(400).json({ error: 'Invalid matchScheduleId' });
    }

    const match = await prisma.matchSchedule.findUnique({ where: { id: matchScheduleId } });
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const created = await prisma.$transaction(async (tx) => {
      const p = await tx.production.create({ data: { matchScheduleId } });
      // Auto-create default segments in correct order if none exist yet
      const count = await tx.productionSegment.count({ where: { productionId: p.id } });
      if (count === 0) {
        await tx.productionSegment.createMany({
          data: [
            { productionId: p.id, naam: 'Voorbeschouwing', duurInMinuten: 20, volgorde: 1, isTimeAnchor: false },
            { productionId: p.id, naam: 'Oplopen', duurInMinuten: 10, volgorde: 2, isTimeAnchor: false },
            { productionId: p.id, naam: 'Eerste helft', duurInMinuten: 35, volgorde: 3, isTimeAnchor: true },
            { productionId: p.id, naam: 'Rust', duurInMinuten: 10, volgorde: 4, isTimeAnchor: false },
            { productionId: p.id, naam: 'Tweede helft', duurInMinuten: 35, volgorde: 5, isTimeAnchor: false },
            { productionId: p.id, naam: 'Nabeschouwing', duurInMinuten: 20, volgorde: 6, isTimeAnchor: false },
          ],
          skipDuplicates: true,
        });
      }

      // Ensure there is always at least one callsheet for a production
      await tx.callSheet.upsert({
        where: { productionId_name: { productionId: p.id, name: 'Callsheet' } },
        update: {},
        create: { productionId: p.id, name: 'Callsheet' },
      });

      return p;
    });
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Production already exists for this match' });
    return next(err);
  }
});

// GET /api/production -> list productions with match details
productionRouter.get('/', async (_req, res, next) => {
  try {
    const items = await prisma.production.findMany({
      orderBy: { id: 'asc' },
      include: { matchSchedule: true },
    });
    return res.json({ items, total: items.length });
  } catch (err) {
    return next(err);
  }
});


// Get a single production with match details
productionRouter.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  try {
    const item = await prisma.production.findUnique({
      where: { id },
      include: {
        matchSchedule: true,
        productionPositions: { // Include production-wide assignments
          include: {
            person: true,
            position: true,
          },
        },
      },
    });
    if (!item) return res.status(404).json({ error: 'Not found' });
    return res.json(item);
  } catch (err) {
    return next(err);
  }
});

// Update a production (change selected match or liveTime)
productionRouter.put('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  try {
    const existing = await prisma.production.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const data: any = {};

    if (req.body.matchScheduleId !== undefined) {
      const matchScheduleId = Number(req.body.matchScheduleId);
      if (!Number.isInteger(matchScheduleId) || matchScheduleId <= 0) {
        return res.status(400).json({ error: 'Invalid matchScheduleId' });
      }
      const match = await prisma.matchSchedule.findUnique({ where: { id: matchScheduleId } });
      if (!match) return res.status(404).json({ error: 'Match not found' });
      data.matchScheduleId = matchScheduleId;
    }

    if (req.body.liveTime !== undefined) {
      data.liveTime = req.body.liveTime ? new Date(req.body.liveTime) : null;
    }

    const updated = await prisma.production.update({ where: { id }, data });
    return res.json(updated);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Production already exists for this match' });
    return next(err);
  }
});

// Delete a production
productionRouter.delete('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  try {
    const existing = await prisma.production.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.production.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});
