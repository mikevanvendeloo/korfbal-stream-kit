import {Router} from 'express';
import {capabilitiesRouter} from './capabilities';
import {personsRouter} from './persons';
import {prisma} from '../services/prisma';
import {findClubByTeamName} from '../utils/clubs';
import {logger} from '../utils/logger';
import {z} from 'zod';
import {
  CreateTitleDefinitionSchema,
  ReorderTitleDefinitionsSchema,
  UpdateTitleDefinitionSchema
} from '../schemas/title';

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
    const maxRow = await prisma.productionSegment.aggregate({ _max: { volgorde: true }, where: { productionId: id } });
    const maxExisting = maxRow._max.volgorde || 0;
    if (!providedVolgorde) {
      // append to end
      volgorde = maxExisting + 1;
    } else {
      // clamp provided target to [1..max+1]
      volgorde = Math.max(1, Math.min(volgorde, maxExisting + 1));
    }

    const created = await prisma.$transaction(async (tx) => {
      if (isTimeAnchor) {
        await tx.productionSegment.updateMany({ where: { productionId: id, isTimeAnchor: true }, data: { isTimeAnchor: false } });
      }
      // If inserting at a specific position (not append), make room without violating unique constraints.
      // We use a two-phase shift to avoid collisions on (productionId, volgorde) in SQLite/Postgres.
      if (providedVolgorde && volgorde <= maxExisting) {
        const BUMP = 1000; // safe large offset within transaction
        // Phase 1: bump impacted rows out of the way
        await tx.productionSegment.updateMany({
          where: { productionId: id, volgorde: { gte: volgorde } },
          data: { volgorde: { increment: BUMP } as any },
        });
        // Create the new row in the freed spot
        const createdRow = await tx.productionSegment.create({ data: { productionId: id, naam, duurInMinuten, volgorde, isTimeAnchor } });
        // Phase 2: bring bumped rows back down by BUMP-1 → net effect: +1 shift
        await tx.productionSegment.updateMany({
          where: { productionId: id, volgorde: { gte: volgorde + BUMP } },
          data: { volgorde: { decrement: BUMP - 1 } as any },
        });
        return createdRow;
      }
      // Simple append or inserting at max+1
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
      // Normalize: find max to clamp target within [1..max]
      const maxRow = await tx.productionSegment.aggregate({ _max: { volgorde: true }, where: { productionId: seg.productionId } });
      const max = maxRow._max.volgorde || 0;
      const clampedTarget = Math.max(1, Math.min(target, max));

      if (clampedTarget !== current) {
        const BUMP = 1000; // large offset to avoid unique collisions during reindexing within the transaction
        if (clampedTarget < current) {
          // Move up: shift down (+1) all in [clampedTarget, current-1]
          // Phase 1: bump impacted rows out of the way
          await tx.productionSegment.updateMany({
            where: { productionId: seg.productionId, NOT: { id: seg.id }, volgorde: { gte: clampedTarget, lte: current - 1 } },
            data: { volgorde: { increment: BUMP } as any },
          });
          // Place moving row at target
          await tx.productionSegment.update({ where: { id: seg.id }, data: { naam, duurInMinuten, volgorde: clampedTarget, isTimeAnchor } });
          // Phase 2: bring bumped rows back down by BUMP-1 → net effect: +1
          await tx.productionSegment.updateMany({
            where: { productionId: seg.productionId, volgorde: { gte: clampedTarget + BUMP, lte: current - 1 + BUMP } },
            data: { volgorde: { decrement: BUMP - 1 } as any },
          });
        } else if (clampedTarget > current) {
          // Move down: shift up (-1) all in [current+1, clampedTarget]
          // Phase 1: bump impacted rows out of the way (to negative side)
          await tx.productionSegment.updateMany({
            where: { productionId: seg.productionId, NOT: { id: seg.id }, volgorde: { gte: current + 1, lte: clampedTarget } },
            data: { volgorde: { decrement: BUMP } as any },
          });
          // Place moving row at target
          await tx.productionSegment.update({ where: { id: seg.id }, data: { naam, duurInMinuten, volgorde: clampedTarget, isTimeAnchor } });
          // Phase 2: bring bumped rows back up by BUMP-1 → net effect: -1
          await tx.productionSegment.updateMany({
            where: { productionId: seg.productionId, volgorde: { gte: current + 1 - BUMP, lte: clampedTarget - BUMP } },
            data: { volgorde: { increment: BUMP - 1 } as any },
          });
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

// ---------------- Titles configuration (per production) ----------------

// List title definitions (with parts) for a production
productionRouter.get('/:id/titles', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const defs = await (prisma as any).titleDefinition.findMany({
      where: { productionId: id },
      orderBy: { order: 'asc' },
      include: { parts: { orderBy: { id: 'asc' } } },
    });
    return res.json(defs);
  } catch (err) {
    return next(err);
  }
});

// ---------------- Interview subjects (per production) ----------------

const InterviewSideEnum = z.enum(['HOME', 'AWAY', 'NONE']);
const InterviewRoleEnum = z.enum(['PLAYER', 'COACH']);

const InterviewSubjectInputSchema = z.object({
  side: InterviewSideEnum,
  role: InterviewRoleEnum,
  playerId: z.number().int().positive(),
  titleDefinitionId: z.number().int().positive().optional().nullable(),
});

// List interview subjects for a production
productionRouter.get('/:id/interviews', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const items = await (prisma as any).interviewSubject.findMany({
      where: { productionId: id },
      orderBy: { id: 'asc' },
      include: { player: true, titleDefinition: true },
    });
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});

// Bulk upsert interview subjects. Accepts array of InterviewSubjectInput; to delete, pass null playerId (not allowed by schema) or send an explicit list and 'replaceAll' flag.
// Simpler: body = { items: InterviewSubjectInput[], replaceAll?: boolean }
const BulkSaveSchema = z.object({
  items: z.array(InterviewSubjectInputSchema),
  replaceAll: z.boolean().optional().default(false),
});

productionRouter.put('/:id/interviews', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id }, include: { matchSchedule: true } as any });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const parsed = BulkSaveSchema.parse(req.body || {});

    // Helpers for validation
    const ms: any = (prod as any).matchSchedule;
    const homeClub = await findClubByTeamName(prisma as any, ms?.homeTeamName);
    const awayClub = await findClubByTeamName(prisma as any, ms?.awayTeamName);
    if (!homeClub && !awayClub) {
      return res.status(400).json({ error: 'Could not resolve clubs for production match' });
    }

    await prisma.$transaction(async (tx) => {
      if (parsed.replaceAll) {
        await (tx as any).interviewSubject.deleteMany({ where: { productionId: id } });
      }
      const results: any[] = [];
      for (const it of parsed.items) {
        // Validate player belongs to the correct side's club and role category
        const player = await (tx as any).player.findUnique({ where: { id: it.playerId } });
        if (!player) throw new Error('Player not found');
        const clubIdForSide = it.side === 'HOME' ? homeClub?.id : it.side === 'AWAY' ? awayClub?.id : null;
        if (clubIdForSide && player.clubId !== clubIdForSide) {
          throw Object.assign(new Error(`Player does not belong to ${it.side} club`), { status: 400 });
        }
        const fn = String(player.function || '').toLowerCase();
        const isPlayerFn = player.personType === 'player' || fn.includes('speler');
        const isCoachFn = (player.personType && player.personType !== 'player') || fn.includes('coach');
        if (it.role === 'PLAYER' && !isPlayerFn) {
          throw Object.assign(new Error('Selected person is not a player'), { status: 400 });
        }
        if (it.role === 'COACH' && !isCoachFn) {
          throw Object.assign(new Error('Selected person is not a coach'), { status: 400 });
        }
        // Because Prisma does not allow composite unique upsert with nullable field in where,
        // emulate upsert: find existing (including NULL titleDefinitionId), then update or create.
        const existing = await (tx as any).interviewSubject.findFirst({
          where: {
            productionId: id,
            side: it.side,
            role: it.role,
            titleDefinitionId: it.titleDefinitionId ?? null,
          },
        });
        let rec: any;
        if (existing) {
          rec = await (tx as any).interviewSubject.update({
            where: { id: existing.id },
            data: { playerId: it.playerId, titleDefinitionId: it.titleDefinitionId ?? null },
          });
        } else {
          rec = await (tx as any).interviewSubject.create({
            data: {
              productionId: id,
              side: it.side,
              role: it.role,
              playerId: it.playerId,
              titleDefinitionId: it.titleDefinitionId ?? null,
            },
          });
        }
        results.push(rec);
      }
      return results;
    });

    // Return with includes
    const full = await (prisma as any).interviewSubject.findMany({
      where: { productionId: id },
      orderBy: { id: 'asc' },
      include: { player: true, titleDefinition: true },
    });
    return res.json(full);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid payload' });
    if ((err as any)?.status === 400) return res.status(400).json({ error: (err as any).message || 'Bad Request' });
    return next(err);
  }
});

// Options endpoint: candidates for selection per side and role
productionRouter.get('/:id/interviews/options', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const side = String(req.query.side || 'HOME');
    const role = String(req.query.role || 'PLAYER');
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    if (!InterviewSideEnum.options.includes(side as any)) return res.status(400).json({ error: 'Invalid side' });
    if (!InterviewRoleEnum.options.includes(role as any)) return res.status(400).json({ error: 'Invalid role' });

    // Load production with match schedule to derive club names
    const prod = await prisma.production.findUnique({ where: { id }, include: { matchSchedule: true } as any });
    if (!prod) return res.status(404).json({ error: 'Not found' });
    const ms: any = (prod as any).matchSchedule;

    const club = side === 'HOME'
      ? await findClubByTeamName(prisma as any, ms?.homeTeamName)
      : await findClubByTeamName(prisma as any, ms?.awayTeamName);
    if (!club) {
      logger.info('🎤 interviews/options – no club resolved', {
        productionId: id,
        side,
        role,
        homeTeamName: ms?.homeTeamName,
        awayTeamName: ms?.awayTeamName,
      });
      return res.json({ items: [] });
    }

    const isPlayer = role === 'PLAYER';

    // Build role-aware filtering: many rows may not have personType set, so also use function text
    const where: any = {
      clubId: club.id,
      OR: isPlayer
        ? [
            { personType: { equals: 'player' } },
            { function: { in: ['Speler', 'Speelster'] } },
            { function: { contains: 'speler', mode: 'insensitive' } },
          ]
        : [
            { personType: { equals: 'coach' } },
            { personType: { equals: 'assistant-coach' } },
            { personType: { not: 'player' } },
            { function: { contains: 'coach', mode: 'insensitive' } },
          ],
    };

    const rows = await prisma.player.findMany({
      where,
      orderBy: [{ name: 'asc' } as any],
    });

    function sortPlayers(arr: any[]) {
      const weight = (fn: string | null | undefined) => (fn === 'Speelster' ? 0 : fn === 'Speler' ? 1 : 2);
      return [...arr].sort((a, b) => {
        const wa = weight(a.function);
        const wb = weight(b.function);
        if (wa !== wb) return wa - wb;
        return (a.name || '').localeCompare(b.name || '', 'nl', { sensitivity: 'base' });
      });
    }

    const items = isPlayer ? sortPlayers(rows) : rows;
    logger.info('🎤 interviews/options – resolved candidates', {
      productionId: id,
      side,
      role,
      club: { id: club.id, name: club.name, shortName: club.shortName },
      counts: { raw: rows.length, returned: items.length },
    });
    return res.json({ items: items.map((p: any) => ({ id: p.id, name: p.name, function: p.function ?? null })) });
  } catch (err) {
    return next(err);
  }
});

// Create a title definition with parts
productionRouter.post('/:id/titles', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const parsed = CreateTitleDefinitionSchema.parse(req.body);

    const created = await prisma.$transaction(async (tx) => {
      const maxRow = await (tx as any).titleDefinition.aggregate({ _max: { order: true }, where: { productionId: id } });
      const nextOrder = (maxRow?._max?.order || 0) + 1;
      const order = parsed.order && parsed.order > 0 ? parsed.order : nextOrder;

      // If order is within existing range, shift others down to make room
      if (order <= (maxRow?._max?.order || 0)) {
        await (tx as any).titleDefinition.updateMany({
          where: { productionId: id, order: { gte: order } },
          data: { order: { increment: 1 } as any },
        });
      }

      const def = await (tx as any).titleDefinition.create({
        data: {
          productionId: id,
          name: parsed.name,
          order,
          enabled: parsed.enabled ?? true,
        },
      });
      for (const p of parsed.parts) {
        await (tx as any).titlePart.create({
          data: {
            titleDefinitionId: def.id,
            sourceType: p.sourceType,
            teamSide: p.teamSide ?? 'NONE',
            limit: p.limit ?? null,
            filters: p.filters as any,
            customFunction: (p as any).customFunction ?? null,
            customName: (p as any).customName ?? null,
          },
        });
      }
      return def;
    });

    // Return created with parts
    const full = await (prisma as any).titleDefinition.findUnique({
      where: { id: created.id },
      include: { parts: { orderBy: { id: 'asc' } } },
    });
    return res.status(201).json(full);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid payload' });
    return next(err);
  }
});

// Update a title definition (and replace parts if provided)
productionRouter.put('/:id/titles/:titleId', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const titleId = Number(req.params.titleId);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(titleId) || titleId <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const def = await (prisma as any).titleDefinition.findUnique({ where: { id: titleId } });
    if (!def || def.productionId !== id) return res.status(404).json({ error: 'Not found' });

    const parsed = UpdateTitleDefinitionSchema.parse(req.body);

    await prisma.$transaction(async (tx) => {
      await (tx as any).titleDefinition.update({
        where: { id: titleId },
        data: {
          name: parsed.name ?? undefined,
          enabled: parsed.enabled ?? undefined,
        },
      });
      if (parsed.parts) {
        await (tx as any).titlePart.deleteMany({ where: { titleDefinitionId: titleId } });
        for (const p of parsed.parts) {
          await (tx as any).titlePart.create({
            data: {
              titleDefinitionId: titleId,
              sourceType: p.sourceType,
              teamSide: p.teamSide ?? 'NONE',
              limit: p.limit ?? null,
              filters: p.filters as any,
              customFunction: (p as any).customFunction ?? null,
              customName: (p as any).customName ?? null,
            },
          });
        }
      }
    });

    const full = await (prisma as any).titleDefinition.findUnique({ where: { id: titleId }, include: { parts: { orderBy: { id: 'asc' } } } });
    return res.json(full);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid payload' });
    return next(err);
  }
});

// Delete a title definition and renumber remaining orders
productionRouter.delete('/:id/titles/:titleId', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const titleId = Number(req.params.titleId);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(titleId) || titleId <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const def = await (prisma as any).titleDefinition.findUnique({ where: { id: titleId } });
    if (!def || def.productionId !== id) return res.status(404).json({ error: 'Not found' });

    await prisma.$transaction(async (tx) => {
      await (tx as any).titlePart.deleteMany({ where: { titleDefinitionId: titleId } });
      await (tx as any).titleDefinition.delete({ where: { id: titleId } });
      // Renumber
      const rest = await (tx as any).titleDefinition.findMany({ where: { productionId: id }, orderBy: { order: 'asc' } });
      for (let i = 0; i < rest.length; i++) {
        if (rest[i].order !== i + 1) {
          await (tx as any).titleDefinition.update({ where: { id: rest[i].id }, data: { order: i + 1 } });
        }
      }
    });

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// Reorder title definitions
productionRouter.patch('/:id/titles:reorder', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const parsed = ReorderTitleDefinitionsSchema.parse(req.body);

    await prisma.$transaction(async (tx) => {
      // Validate that all ids belong to this production
      const existing = await (tx as any).titleDefinition.findMany({ where: { productionId: id }, select: { id: true } });
      const idsSet = new Set(existing.map((e: any) => e.id));
      for (const i of parsed.ids) {
        if (!idsSet.has(i)) throw new Error('Invalid title id in ordering');
      }
      for (let index = 0; index < parsed.ids.length; index++) {
        const titleId = parsed.ids[index];
        await (tx as any).titleDefinition.update({ where: { id: titleId }, data: { order: index + 1 } });
      }
    });

    return res.status(204).send();
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid payload' });
    return next(err);
  }
});



// -------- Crew report --------
productionRouter.get('/:id/crew-report', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const [segments, positions, assignments] = await Promise.all([
      prisma.productionSegment.findMany({ where: { productionId: id }, orderBy: { volgorde: 'asc' } }),
      prisma.position.findMany({ orderBy: { name: 'asc' } }),
      prisma.segmentRoleAssignment.findMany({
        where: { productionSegment: { productionId: id } },
        include: { person: true, position: true },
      }),
    ]);

    const cells = assignments.map((a) => ({
      segmentId: a.productionSegmentId,
      positionId: a.positionId,
      personName: a.person.name,
    }));

    return res.json({ segments, positions, cells });
  } catch (err) {
    return next(err);
  }
});

// -------- Callsheets --------
// List callsheets for a production
productionRouter.get('/:id/callsheets', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const items = await prisma.callSheet.findMany({ where: { productionId: id }, orderBy: { id: 'asc' } });
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});

// Create a callsheet for a production
productionRouter.post('/:id/callsheets', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const name = String(req.body?.name || '').trim();
    const color = req.body?.color != null ? String(req.body.color) : null;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const created = await prisma.callSheet.create({ data: { productionId: id, name, color: color || undefined } });
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'P2003') return res.status(404).json({ error: 'Production not found' });
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Callsheet name must be unique within production' });
    return next(err);
  }
});

// Get a callsheet by id
productionRouter.get('/callsheets/:callSheetId', async (req, res, next) => {
  try {
    const callSheetId = Number(req.params.callSheetId);
    if (!Number.isInteger(callSheetId) || callSheetId <= 0) return res.status(400).json({ error: 'Invalid callsheet id' });

    const cs = await prisma.callSheet.findUnique({
      where: { id: callSheetId },
      include: {
        items: {
          include: {
            productionSegment: true,
            positions: { include: { position: true } },
          },
          orderBy: [{ productionSegmentId: 'asc' }, { orderIndex: 'asc' }],
        },
      },
    });
    if (!cs) return res.status(404).json({ error: 'Not found' });

    // Normalize positions to array of position ids
    const norm = {
      ...cs,
      items: cs.items.map((it) => ({
        ...it,
        positionIds: it.positions.map((p) => p.positionId),
      })),
    } as any;

    return res.json(norm);
  } catch (err) {
    return next(err);
  }
});

// Update a callsheet (name/color)
productionRouter.put('/callsheets/:callSheetId', async (req, res, next) => {
  try {
    const callSheetId = Number(req.params.callSheetId);
    if (!Number.isInteger(callSheetId) || callSheetId <= 0) return res.status(400).json({ error: 'Invalid callsheet id' });
    const name = req.body?.name != null ? String(req.body.name).trim() : undefined;
    const color = req.body?.color != null ? String(req.body.color) : undefined;

    const updated = await prisma.callSheet.update({ where: { id: callSheetId }, data: { name, color } });
    return res.json(updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Callsheet name must be unique within production' });
    return next(err);
  }
});

// Delete a callsheet
productionRouter.delete('/callsheets/:callSheetId', async (req, res, next) => {
  try {
    const callSheetId = Number(req.params.callSheetId);
    if (!Number.isInteger(callSheetId) || callSheetId <= 0) return res.status(400).json({ error: 'Invalid callsheet id' });
    await prisma.$transaction(async (tx) => {
      await tx.callSheetItemPosition.deleteMany({ where: { item: { callSheetId } } });
      await tx.callSheetItem.deleteMany({ where: { callSheetId } });
      await tx.callSheet.delete({ where: { id: callSheetId } });
    });
    return res.status(204).send();
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    return next(err);
  }
});

// Create an item within a callsheet
productionRouter.post('/callsheets/:callSheetId/items', async (req, res, next) => {
  try {
    const callSheetId = Number(req.params.callSheetId);
    if (!Number.isInteger(callSheetId) || callSheetId <= 0) return res.status(400).json({ error: 'Invalid callsheet id' });

    const id = String(req.body?.id || '').trim();
    const productionSegmentId = Number(req.body?.productionSegmentId);
    const cue = String(req.body?.cue || '').trim();
    const title = String(req.body?.title || '').trim();
    const note = req.body?.note != null ? String(req.body.note) : null;
    const color = req.body?.color != null ? String(req.body.color) : null;
    const durationSec = Number(req.body?.durationSec);
    const timeStart = req.body?.timeStart ? new Date(req.body.timeStart) : null;
    const timeEnd = req.body?.timeEnd ? new Date(req.body.timeEnd) : null;
    const orderIndex = req.body?.orderIndex != null ? Number(req.body.orderIndex) : 0;
    const positionIds: number[] = Array.isArray(req.body?.positionIds) ? req.body.positionIds.map((x: any) => Number(x)).filter((x: number) => Number.isInteger(x) && x > 0) : [];

    if (!id || !productionSegmentId || !cue || !title || !Number.isInteger(durationSec) || durationSec < 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Basic validation of segment and positions
    const seg = await prisma.productionSegment.findUnique({ where: { id: productionSegmentId } });
    if (!seg) return res.status(404).json({ error: 'Segment not found' });

    const created = await prisma.$transaction(async (tx) => {
      const it = await tx.callSheetItem.create({
        data: {
          id,
          callSheetId,
          productionSegmentId,
          cue,
          title,
          note: note || undefined,
          color: color || undefined,
          timeStart: timeStart || undefined,
          timeEnd: timeEnd || undefined,
          durationSec,
          orderIndex,
        },
      });

      if (positionIds.length > 0) {
        await tx.callSheetItemPosition.createMany({
          data: positionIds.map((pid) => ({ callSheetItemId: it.id, positionId: pid })),
          skipDuplicates: true,
        });
      }

      return it;
    });

    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Item id already exists' });
    if (err?.code === 'P2003') return res.status(404).json({ error: 'Callsheet not found' });
    return next(err);
  }
});

// Update an item
productionRouter.put('/callsheet-items/:itemId', async (req, res, next) => {
  try {
    const itemId = String(req.params.itemId);
    if (!itemId) return res.status(400).json({ error: 'Invalid item id' });

    const data: any = {};
    if (req.body?.productionSegmentId != null) data.productionSegmentId = Number(req.body.productionSegmentId);
    if (req.body?.cue != null) data.cue = String(req.body.cue).trim();
    if (req.body?.title != null) data.title = String(req.body.title).trim();
    if (req.body?.note != null) data.note = String(req.body.note);
    if (req.body?.color != null) data.color = String(req.body.color);
    if (req.body?.timeStart != null) data.timeStart = req.body.timeStart ? new Date(req.body.timeStart) : null;
    if (req.body?.timeEnd != null) data.timeEnd = req.body.timeEnd ? new Date(req.body.timeEnd) : null;
    if (req.body?.durationSec != null) data.durationSec = Number(req.body.durationSec);
    if (req.body?.orderIndex != null) data.orderIndex = Number(req.body.orderIndex);

    const positionIds: number[] | undefined = Array.isArray(req.body?.positionIds)
      ? req.body.positionIds.map((x: any) => Number(x)).filter((x: number) => Number.isInteger(x) && x > 0)
      : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      const it = await tx.callSheetItem.update({ where: { id: itemId }, data });
      if (positionIds) {
        await tx.callSheetItemPosition.deleteMany({ where: { callSheetItemId: itemId } });
        if (positionIds.length > 0) {
          await tx.callSheetItemPosition.createMany({ data: positionIds.map((pid) => ({ callSheetItemId: itemId, positionId: pid })) });
        }
      }
      return it;
    });

    return res.json(updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    return next(err);
  }
});

// Delete an item
productionRouter.delete('/callsheet-items/:itemId', async (req, res, next) => {
  try {
    const itemId = String(req.params.itemId);
    if (!itemId) return res.status(400).json({ error: 'Invalid item id' });
    await prisma.$transaction(async (tx) => {
      await tx.callSheetItemPosition.deleteMany({ where: { callSheetItemId: itemId } });
      await tx.callSheetItem.delete({ where: { id: itemId } });
    });
    return res.status(204).send();
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Not found' });
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
