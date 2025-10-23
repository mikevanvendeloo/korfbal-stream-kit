import {Router} from 'express';
import {capabilitiesRouter} from './capabilities';
import {personsRouter} from './persons';
import {prisma} from '../services/prisma';

// Easily expandable default team filters
const DEFAULT_TEAM_FILTERS = [
  'Fortuna/Ruitenheer 1',
  'Fortuna/Ruitenheer 2',
  'Fortuna/Ruitenheer U19-1',
];

export const productionRouter: Router = Router();

// Nest existing routers under production namespace
productionRouter.use('/capabilities', capabilitiesRouter);
productionRouter.use('/persons', personsRouter);

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

    const created = await prisma.production.create({ data: { matchScheduleId } });
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
    const item = await prisma.production.findUnique({ where: { id }, include: { matchSchedule: true } });
    if (!item) return res.status(404).json({ error: 'Not found' });
    return res.json(item);
  } catch (err) {
    return next(err);
  }
});

// Update a production (change selected match)
productionRouter.put('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  try {
    const matchScheduleId = Number(req.body?.matchScheduleId);
    if (!Number.isInteger(matchScheduleId) || matchScheduleId <= 0) {
      return res.status(400).json({ error: 'Invalid matchScheduleId' });
    }
    const existing = await prisma.production.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const match = await prisma.matchSchedule.findUnique({ where: { id: matchScheduleId } });
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const updated = await prisma.production.update({ where: { id }, data: { matchScheduleId } });
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

// Helper to resolve production and return its matchScheduleId
async function getMatchIdForProductionOr404(res: any, idParam: string): Promise<number | undefined> {
  const prodId = Number(idParam);
  if (!Number.isInteger(prodId) || prodId <= 0) {
    res.status(400).json({ error: 'Invalid production id' });
    return undefined;
  }
  const prod = await prisma.production.findUnique({ where: { id: prodId } });
  if (!prod) {
    res.status(404).json({ error: 'Production not found' });
    return undefined;
  }
  return prod.matchScheduleId;
}

// Production-scoped assignments (map to MatchRoleAssignment via production.matchScheduleId)
productionRouter.get('/:id/assignments', async (req, res, next) => {
  try {
    const matchId = await getMatchIdForProductionOr404(res, req.params.id);
    if (!matchId) return;
    const items = await prisma.matchRoleAssignment.findMany({
      where: { matchScheduleId: matchId },
      include: { person: true, capability: true },
      orderBy: { id: 'asc' },
    });
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});

// Create assignment for a production
productionRouter.post('/:id/assignments', async (req, res, next) => {
  try {
    const matchId = await getMatchIdForProductionOr404(res, req.params.id);
    if (!matchId) return;

    const capabilityId = Number(req.body?.capabilityId);
    const personId = Number(req.body?.personId);
    if (!Number.isInteger(capabilityId) || capabilityId <= 0 || !Number.isInteger(personId) || personId <= 0) {
      return res.status(400).json({ error: 'Invalid personId or capabilityId' });
    }

    // Validate entities and capability ownership
    const [person, capDef] = await Promise.all([
      prisma.person.findUnique({ where: { id: personId } }),
      prisma.capability.findUnique({ where: { id: capabilityId } }),
    ]);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    if (!capDef) return res.status(404).json({ error: 'Capability not found' });

    const hasCapability = await prisma.personCapability.findUnique({
      where: { personId_capabilityId: { personId, capabilityId } },
    });
    if (!hasCapability) return res.status(422).json({ error: 'Person lacks required capability for this role' });

    const created = await prisma.matchRoleAssignment.create({
      data: { matchScheduleId: matchId, personId, capabilityId },
      include: { person: true, capability: true },
    });
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'This person already has this role for this production' });
    return next(err);
  }
});

// Update an assignment
productionRouter.patch('/:id/assignments/:assignmentId', async (req, res, next) => {
  try {
    const matchId = await getMatchIdForProductionOr404(res, req.params.id);
    if (!matchId) return;
    const assignmentId = Number(req.params.assignmentId);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) return res.status(400).json({ error: 'Invalid assignment id' });

    const existing = await prisma.matchRoleAssignment.findUnique({ where: { id: assignmentId } });
    if (!existing || existing.matchScheduleId !== matchId) return res.status(404).json({ error: 'Not found' });

    const nextPersonId = req.body?.personId != null ? Number(req.body.personId) : existing.personId;
    const nextCapabilityId = req.body?.capabilityId != null ? Number(req.body.capabilityId) : existing.capabilityId;
    if (!Number.isInteger(nextPersonId) || nextPersonId <= 0 || !Number.isInteger(nextCapabilityId) || nextCapabilityId <= 0) {
      return res.status(400).json({ error: 'Invalid personId or capabilityId' });
    }

    const hasCapability = await prisma.personCapability.findUnique({
      where: { personId_capabilityId: { personId: nextPersonId, capabilityId: nextCapabilityId } },
    });
    if (!hasCapability) return res.status(422).json({ error: 'Person lacks required capability for this role' });

    const updated = await prisma.matchRoleAssignment.update({
      where: { id: assignmentId },
      data: { personId: nextPersonId, capabilityId: nextCapabilityId },
      include: { person: true, capability: true },
    });
    return res.json(updated);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'This role is already assigned for this production' });
    return next(err);
  }
});

// Delete an assignment
productionRouter.delete('/:id/assignments/:assignmentId', async (req, res, next) => {
  try {
    const matchId = await getMatchIdForProductionOr404(res, req.params.id);
    if (!matchId) return;
    const assignmentId = Number(req.params.assignmentId);
    if (!Number.isInteger(assignmentId) || assignmentId <= 0) return res.status(400).json({ error: 'Invalid assignment id' });

    const existing = await prisma.matchRoleAssignment.findUnique({ where: { id: assignmentId } });
    if (!existing || existing.matchScheduleId !== matchId) return res.status(404).json({ error: 'Not found' });

    await prisma.matchRoleAssignment.delete({ where: { id: assignmentId } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});
