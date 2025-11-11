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

// -------- Positions catalog (place before dynamic \/:id routes to avoid conflicts) --------
productionRouter.get('/positions', async (_req, res, next) => {
  try {
    const items = await prisma.position.findMany({ orderBy: { name: 'asc' } });
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});

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
            { productionId: p.id, naam: 'Voorbeschouwing', duurInMinuten: 10, volgorde: 1, isTimeAnchor: false },
            { productionId: p.id, naam: 'Eerste helft', duurInMinuten: 25, volgorde: 2, isTimeAnchor: true },
            { productionId: p.id, naam: 'Tweede helft', duurInMinuten: 25, volgorde: 3, isTimeAnchor: false },
            { productionId: p.id, naam: 'Nabeschouwing', duurInMinuten: 10, volgorde: 4, isTimeAnchor: false },
          ],
          skipDuplicates: true,
        });
      }
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

// ---------------- Segments CRUD ----------------
// List segments for a production
productionRouter.get('/:id/segments', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Not found' });
    const items = await prisma.productionSegment.findMany({ where: { productionId: id }, orderBy: { volgorde: 'asc' } });
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});

// Create a segment
productionRouter.post('/:id/segments', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const naam = String(req.body?.naam || '').trim();
    const duurInMinuten = Number(req.body?.duurInMinuten);
    let volgorde = req.body?.volgorde != null ? Number(req.body.volgorde) : NaN;
    const isTimeAnchor = !!req.body?.isTimeAnchor;
    if (!naam || !Number.isInteger(duurInMinuten) || duurInMinuten < 0) {
      return res.status(400).json({ error: 'Invalid naam or duurInMinuten' });
    }

    // determine volgorde if not provided
    const providedVolgorde = Number.isInteger(volgorde) && volgorde > 0;
    if (!providedVolgorde) {
      const max = await prisma.productionSegment.aggregate({ _max: { volgorde: true }, where: { productionId: id } });
      volgorde = (max._max.volgorde || 0) + 1;
    }

    const created = await prisma.$transaction(async (tx) => {
      if (isTimeAnchor) {
        await tx.productionSegment.updateMany({ where: { productionId: id, isTimeAnchor: true }, data: { isTimeAnchor: false } });
      }
      // If inserting at a specific position, make room by shifting >= volgorde down by 1
      if (providedVolgorde) {
        await tx.productionSegment.updateMany({
          where: { productionId: id, volgorde: { gte: volgorde } },
          data: { volgorde: { increment: 1 } as any },
        });
      }
      return tx.productionSegment.create({ data: { productionId: id, naam, duurInMinuten, volgorde, isTimeAnchor } });
    });

    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Volgorde must be unique per production' });
    return next(err);
  }
});

// Get a segment
productionRouter.get('/segments/:segmentId', async (req, res, next) => {
  try {
    const segmentId = Number(req.params.segmentId);
    if (!Number.isInteger(segmentId) || segmentId <= 0) return res.status(400).json({ error: 'Invalid segment id' });
    const seg = await prisma.productionSegment.findUnique({ where: { id: segmentId } });
    if (!seg) return res.status(404).json({ error: 'Not found' });
    return res.json(seg);
  } catch (err) {
    return next(err);
  }
});

// Update a segment
productionRouter.put('/segments/:segmentId', async (req, res, next) => {
  try {
    const segmentId = Number(req.params.segmentId);
    if (!Number.isInteger(segmentId) || segmentId <= 0) return res.status(400).json({ error: 'Invalid segment id' });
    const seg = await prisma.productionSegment.findUnique({ where: { id: segmentId } });
    if (!seg) return res.status(404).json({ error: 'Not found' });

    const naam = req.body?.naam != null ? String(req.body.naam).trim() : seg.naam;
    const duurInMinuten = req.body?.duurInMinuten != null ? Number(req.body.duurInMinuten) : seg.duurInMinuten;
    const desiredVolgorde = req.body?.volgorde != null ? Number(req.body.volgorde) : seg.volgorde;
    const isTimeAnchor = req.body?.isTimeAnchor != null ? !!req.body.isTimeAnchor : seg.isTimeAnchor;

    if (!naam || !Number.isInteger(duurInMinuten) || duurInMinuten < 0 || !Number.isInteger(desiredVolgorde) || desiredVolgorde <= 0) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Handle anchor uniqueness
      if (isTimeAnchor) {
        await tx.productionSegment.updateMany({ where: { productionId: seg.productionId, isTimeAnchor: true, NOT: { id: seg.id } }, data: { isTimeAnchor: false } });
      }

      const current = seg.volgorde;
      const target = desiredVolgorde;
      if (target !== current) {
        // Normalize: find max to clamp target within [1..max]
        const maxRow = await tx.productionSegment.aggregate({ _max: { volgorde: true }, where: { productionId: seg.productionId } });
        const max = maxRow._max.volgorde || 0;
        const clampedTarget = Math.max(1, Math.min(target, max));

        if (clampedTarget < current) {
          // Move up: shift down (+1) all in [clampedTarget, current-1]
          await tx.productionSegment.updateMany({
            where: { productionId: seg.productionId, NOT: { id: seg.id }, volgorde: { gte: clampedTarget, lte: current - 1 } },
            data: { volgorde: { increment: 1 } as any },
          });
          await tx.productionSegment.update({ where: { id: seg.id }, data: { naam, duurInMinuten, volgorde: clampedTarget, isTimeAnchor } });
        } else if (clampedTarget > current) {
          // Move down: shift up (-1) all in [current+1, clampedTarget]
          await tx.productionSegment.updateMany({
            where: { productionId: seg.productionId, NOT: { id: seg.id }, volgorde: { gte: current + 1, lte: clampedTarget } },
            data: { volgorde: { decrement: 1 } as any },
          });
          await tx.productionSegment.update({ where: { id: seg.id }, data: { naam, duurInMinuten, volgorde: clampedTarget, isTimeAnchor } });
        }
      } else {
        // No position change, just update fields
        await tx.productionSegment.update({ where: { id: seg.id }, data: { naam, duurInMinuten, isTimeAnchor } });
      }

      // Return the latest state
      return tx.productionSegment.findUnique({ where: { id: seg.id } });
    });

    return res.json(updated);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Volgorde must be unique per production' });
    return next(err);
  }
});

// Delete a segment and normalize order
productionRouter.delete('/segments/:segmentId', async (req, res, next) => {
  try {
    const segmentId = Number(req.params.segmentId);
    if (!Number.isInteger(segmentId) || segmentId <= 0) return res.status(400).json({ error: 'Invalid segment id' });
    const seg = await prisma.productionSegment.findUnique({ where: { id: segmentId } });
    if (!seg) return res.status(404).json({ error: 'Not found' });

    await prisma.$transaction(async (tx) => {
      await tx.segmentRoleAssignment.deleteMany({ where: { productionSegmentId: seg.id } });
      await tx.productionSegment.delete({ where: { id: seg.id } });
      // Renumber volgorde for remaining
      const rest = await tx.productionSegment.findMany({ where: { productionId: seg.productionId }, orderBy: { volgorde: 'asc' } });
      for (let i = 0; i < rest.length; i++) {
        if (rest[i].volgorde !== i + 1) {
          await tx.productionSegment.update({ where: { id: rest[i].id }, data: { volgorde: i + 1 } });
        }
      }
    });

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// -------- Timing preview for a production --------
productionRouter.get('/:id/timing', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id }, include: { matchSchedule: true } });
    if (!prod) return res.status(404).json({ error: 'Not found' });
    const segments = await prisma.productionSegment.findMany({ where: { productionId: id }, orderBy: { volgorde: 'asc' } });
    if (segments.length === 0) return res.json([]);

    const anchorIdx = segments.findIndex((s) => s.isTimeAnchor);
    if (anchorIdx === -1) return res.status(400).json({ error: 'No anchor segment defined' });

    const anchorStart = new Date(prod.matchSchedule.date).getTime();

    const result = segments.map((s) => ({ ...s, start: '', end: '' }));

    // forward from anchor
    let t = anchorStart;
    for (let i = anchorIdx; i < result.length; i++) {
      result[i].start = new Date(t).toISOString();
      t += result[i].duurInMinuten * 60 * 1000;
      result[i].end = new Date(t).toISOString();
    }

    // backward before anchor
    t = anchorStart;
    for (let i = anchorIdx - 1; i >= 0; i--) {
      t -= result[i].duurInMinuten * 60 * 1000;
      result[i].start = new Date(t).toISOString();
      result[i].end = new Date(t + result[i].duurInMinuten * 60 * 1000).toISOString();
    }

    return res.json(result);
  } catch (err) {
    return next(err);
  }
});



// -------- Segment-level assignments --------
// Crew persons for a segment's production (persons assigned at production level)
productionRouter.get('/segments/:segmentId/persons', async (req, res, next) => {
  try {
    const segmentId = Number(req.params.segmentId);
    if (!Number.isInteger(segmentId) || segmentId <= 0) return res.status(400).json({ error: 'Invalid segment id' });

    // Resolve segment -> production -> matchScheduleId
    const seg = await prisma.productionSegment.findUnique({ where: { id: segmentId } });
    if (!seg) return res.status(404).json({ error: 'Not found' });
    const prod = await prisma.production.findUnique({ where: { id: seg.productionId } });
    if (!prod) return res.status(404).json({ error: 'Production not found' });

    // Persons assigned at the production level (match-level assignments)
    const mras = await prisma.matchRoleAssignment.findMany({
      where: { matchScheduleId: prod.matchScheduleId },
      include: { person: true },
    });

    const uniqueMap = new Map<number, any>();
    for (const a of mras) {
      uniqueMap.set(a.person.id, a.person);
    }

    const items = Array.from(uniqueMap.values()).sort((a, b) => a.id - b.id);
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});
// List assignments for a segment
productionRouter.get('/segments/:segmentId/assignments', async (req, res, next) => {
  try {
    const segmentId = Number(req.params.segmentId);
    if (!Number.isInteger(segmentId) || segmentId <= 0) return res.status(400).json({ error: 'Invalid segment id' });
    const seg = await prisma.productionSegment.findUnique({ where: { id: segmentId } });
    if (!seg) return res.status(404).json({ error: 'Not found' });
    const items = await prisma.segmentRoleAssignment.findMany({ where: { productionSegmentId: segmentId }, include: { person: true, position: true }, orderBy: { id: 'asc' } });
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});

// Create assignment for a segment
productionRouter.post('/segments/:segmentId/assignments', async (req, res, next) => {
  try {
    const segmentId = Number(req.params.segmentId);
    if (!Number.isInteger(segmentId) || segmentId <= 0) return res.status(400).json({ error: 'Invalid segment id' });
    const seg = await prisma.productionSegment.findUnique({ where: { id: segmentId } });
    if (!seg) return res.status(404).json({ error: 'Not found' });

    const personId = Number(req.body?.personId);
    const positionId = Number(req.body?.positionId);
    if (!Number.isInteger(personId) || personId <= 0 || !Number.isInteger(positionId) || positionId <= 0) {
      return res.status(400).json({ error: 'Invalid personId or positionId' });
    }

    const [person, pos] = await Promise.all([
      prisma.person.findUnique({ where: { id: personId } }),
      prisma.position.findUnique({ where: { id: positionId } }),
    ]);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    if (!pos) return res.status(404).json({ error: 'Position not found' });

    const created = await prisma.segmentRoleAssignment.create({
      data: { productionSegmentId: segmentId, personId, positionId },
      include: { person: true, position: true },
    });
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Duplicate assignment for this segment' });
    return next(err);
  }
});

// Delete a segment assignment
productionRouter.delete('/segments/:segmentId/assignments/:assignmentId', async (req, res, next) => {
  try {
    const segmentId = Number(req.params.segmentId);
    const assignmentId = Number(req.params.assignmentId);
    if (!Number.isInteger(segmentId) || segmentId <= 0 || !Number.isInteger(assignmentId) || assignmentId <= 0) return res.status(400).json({ error: 'Invalid ids' });

    const existing = await prisma.segmentRoleAssignment.findUnique({ where: { id: assignmentId } });
    if (!existing || existing.productionSegmentId !== segmentId) return res.status(404).json({ error: 'Not found' });

    await prisma.segmentRoleAssignment.delete({ where: { id: assignmentId } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// Copy assignments from one segment to others
productionRouter.post('/segments/:segmentId/assignments/copy', async (req, res, next) => {
  try {
    const sourceId = Number(req.params.segmentId);
    if (!Number.isInteger(sourceId) || sourceId <= 0) return res.status(400).json({ error: 'Invalid segment id' });
    const body = req.body || {};
    const targetSegmentIds: number[] = Array.isArray(body.targetSegmentIds) ? body.targetSegmentIds.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0) : [];
    const mode = body.mode === 'overwrite' ? 'overwrite' : 'merge';
    if (targetSegmentIds.length === 0) return res.status(400).json({ error: 'targetSegmentIds required' });

    const source = await prisma.productionSegment.findUnique({ where: { id: sourceId } });
    if (!source) return res.status(404).json({ error: 'Source segment not found' });

    const targets = await prisma.productionSegment.findMany({ where: { id: { in: targetSegmentIds } } });
    if (targets.length !== targetSegmentIds.length) return res.status(404).json({ error: 'One or more target segments not found' });

    // Ensure all segments belong to the same production
    if (targets.some(t => t.productionId !== source.productionId)) return res.status(400).json({ error: 'Targets must belong to same production' });

    const copied = await prisma.$transaction(async (tx) => {
      const srcAssignments = await tx.segmentRoleAssignment.findMany({ where: { productionSegmentId: sourceId } });

      let totalDeleted = 0;
      if (mode === 'overwrite') {
        const del = await tx.segmentRoleAssignment.deleteMany({ where: { productionSegmentId: { in: targetSegmentIds } } });
        totalDeleted = del.count;
      }

      // Build bulk data for all targets to avoid per-row unique violations that abort the transaction
      const data = targetSegmentIds.flatMap((targetId) =>
        srcAssignments.map((a) => ({ productionSegmentId: targetId, personId: a.personId, positionId: a.positionId }))
      );

      // In merge mode, allow skipDuplicates to silently ignore uniques; in overwrite, targets are empty already
      const createRes = await tx.segmentRoleAssignment.createMany({ data, skipDuplicates: mode === 'merge' });

      return { created: createRes.count, deleted: totalDeleted, targets: targetSegmentIds };
    });

    return res.json({ ok: true, ...copied, mode });
  } catch (err) {
    return next(err);
  }
});
