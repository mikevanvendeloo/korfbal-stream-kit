import {Router} from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import {skillsRouter} from './skills';
import {prisma} from '../services/prisma';
import {findClubByTeamName} from '../utils/clubs';
import {logger} from '../utils/logger';
import {z} from 'zod';
import {DEFAULT_SEGMENT_POSITIONS, getRequiredSkillCodeForPosition} from '../domain/positionSkill';
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

// Multer memory storage for Excel upload (used by callsheet import)
const uploadMem = multer({ storage: multer.memoryStorage() });

// IMPORTANT: Production-specific routes with :id param must come BEFORE nested routers
// to avoid conflicts with /persons and /skills routes

// -------- Production Persons (attendance tracking) --------
// These routes must be defined BEFORE productionRouter.use('/persons', personsRouter)
// List persons marked as present for a production
productionRouter.get('/:id/persons', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const items = await prisma.productionPerson.findMany({
      where: { productionId: id },
      include: { person: true },
      orderBy: { person: { name: 'asc' } },
    });
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});

// Add person to production (mark as present)
productionRouter.post('/:id/persons', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const personId = Number(req.body?.personId);
    if (!Number.isInteger(personId) || personId <= 0) {
      return res.status(400).json({ error: 'Invalid personId' });
    }

    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const created = await prisma.productionPerson.create({
      data: { productionId: id, personId },
      include: { person: true },
    });
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Person already marked as present' });
    return next(err);
  }
});

// Remove person from production (mark as absent)
productionRouter.delete('/:id/persons/:productionPersonId', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const productionPersonId = Number(req.params.productionPersonId);
    if (!Number.isInteger(productionPersonId) || productionPersonId <= 0) {
      return res.status(400).json({ error: 'Invalid productionPersonId' });
    }

    const existing = await prisma.productionPerson.findUnique({ where: { id: productionPersonId } });
    if (!existing || existing.productionId !== id) return res.status(404).json({ error: 'Not found' });

    await prisma.productionPerson.delete({ where: { id: productionPersonId } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// Nest skills router under production namespace for backward compatibility
// Note: /persons router is NOT nested here - persons are available at /api/persons
productionRouter.use('/skills', skillsRouter);

// -------- Positions catalog (place before dynamic \/:id routes to avoid conflicts) --------
const PositionSchema = z.object({
  name: z.string().min(2).max(100),
  skillId: z.number().int().positive().nullable().optional(),
});

productionRouter.get('/positions', async (_req, res, next) => {
  try {
    const items = await prisma.position.findMany({ orderBy: { name: 'asc' }, include: { skill: true } });
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});

productionRouter.post('/positions', async (req, res, next) => {
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

productionRouter.put('/positions/:id', async (req, res, next) => {
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

productionRouter.delete('/positions/:id', async (req, res, next) => {
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

// -------- Segment default positions configuration --------
// Reserved internal name for the global default set. UI will display this as "Algemeen".
const GLOBAL_SEGMENT_NAME = '__GLOBAL__';
const SegmentDefaultsSchema = z.object({
  segmentName: z.string().min(2).max(100),
  positions: z.array(z.object({ positionId: z.number().int().positive(), order: z.number().int().nonnegative() })),
});

// List defaults for a segment name
productionRouter.get('/segment-default-positions', async (req, res, next) => {
  try {
    const name = String(req.query.segmentName || '').trim();
    if (!name) return res.status(400).json({ error: 'segmentName is required' });
    const items = await prisma.segmentDefaultPosition.findMany({
      where: { segmentName: name },
      orderBy: { order: 'asc' },
      include: { position: { include: { skill: true } } },
    });
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});

// List configured segment default names (distinct). Includes global when present.
productionRouter.get('/segment-default-positions/names', async (_req, res, next) => {
  try {
    const rows = await prisma.segmentDefaultPosition.findMany({
      select: { segmentName: true },
      distinct: ['segmentName'],
      orderBy: { segmentName: 'asc' },
    });
    const names = Array.from(new Set(rows.map((r) => r.segmentName)));
    return res.json({ items: names, hasGlobal: names.includes(GLOBAL_SEGMENT_NAME) });
  } catch (err) {
    return next(err);
  }
});

// Upsert defaults for a segment name (replace all with provided list)
productionRouter.put('/segment-default-positions', async (req, res, next) => {
  try {
    const parsed = SegmentDefaultsSchema.parse(req.body || {});
    // Allow the special global name
    const segmentName = parsed.segmentName === 'Algemeen' ? GLOBAL_SEGMENT_NAME : parsed.segmentName;
    // Validate positions exist
    const posIds = parsed.positions.map((p) => p.positionId);
    const uniquePosIds = Array.from(new Set(posIds));
    const positions = await prisma.position.findMany({ where: { id: { in: uniquePosIds } } });
    if (positions.length !== uniquePosIds.length) return res.status(422).json({ error: 'One or more positions not found' });

    await prisma.$transaction(async (tx) => {
      await tx.segmentDefaultPosition.deleteMany({ where: { segmentName } });
      if (parsed.positions.length > 0) {
        await tx.segmentDefaultPosition.createMany({
          data: parsed.positions.map((p) => ({ segmentName, positionId: p.positionId, order: p.order })),
          skipDuplicates: true,
        });
      }
    });
    const refreshed = await prisma.segmentDefaultPosition.findMany({
      where: { segmentName },
      orderBy: { order: 'asc' },
      include: { position: { include: { skill: true } } },
    });
    return res.json(refreshed);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors?.[0]?.message || 'Invalid input' });
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

// Import a callsheet from an Excel template
// POST /api/production/:id/callsheets/import-excel
// Accepts multipart/form-data with field name "file" containing an .xlsx file.
// If no file uploaded, attempts to read a default template.xlsx from the API app root.
productionRouter.post('/:id/callsheets/import-excel', uploadMem.single('file'), async (req, res, next) => {
  try {
    const productionId = Number(req.params.id);
    if (!Number.isInteger(productionId) || productionId <= 0) return res.status(400).json({ error: 'Invalid id' });

    const prod = await prisma.production.findUnique({ where: { id: productionId } });
    if (!prod) return res.status(404).json({ error: 'Production not found' });

    let buffer: Buffer | null = null;
    if (req.file?.buffer) {
      buffer = req.file.buffer;
    } else {
      const fallbackPath = path.join(process.cwd(), 'apps', 'korfbal-stream-api', 'template.xlsx');
      if (fs.existsSync(fallbackPath)) buffer = fs.readFileSync(fallbackPath);
    }
    if (!buffer) return res.status(400).json({ error: 'No file provided and default template.xlsx not found' });

    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    if (!ws) return res.status(400).json({ error: 'Workbook has no sheets' });

    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No data rows found in sheet' });
    }

    // Fetch segments and positions upfront for fast lookup
    const [segments, allPositions] = await Promise.all([
      prisma.productionSegment.findMany({ where: { productionId }, orderBy: { volgorde: 'asc' } }),
      prisma.position.findMany({}),
    ]);
    const segByName = new Map<string, { id: number; naam: string; volgorde: number }>();
    for (const s of segments as any[]) segByName.set((s.naam || '').toString().trim().toLowerCase(), s);
    const posByName = new Map<string, { id: number; name: string }>();
    for (const p of allPositions as any[]) posByName.set((p.name || '').toString().trim().toLowerCase(), p);

    const normKey = (k: string) => k.toString().trim().toLowerCase().replace(/\s+|[_-]+/g, '');

    type Parsed = {
      productionSegmentId: number;
      id: string;
      cue: string;
      title: string;
      note?: string | null;
      color?: string | null;
      timeStart?: Date | null;
      timeEnd?: Date | null;
      durationSec: number;
      orderIndex: number;
      positionNames: string[];
    };

    const problems: string[] = [];
    const parsed: Parsed[] = [];

    const parseDuration = (v: any): number | null => {
      if (v == null) return null;
      if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
      const s = String(v).trim();
      if (!s) return null;
      // Allow mm:ss
      const m = s.match(/^(\d+):(\d{1,2})$/);
      if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
      const n = Number(s.replace(/[,]/g, '.'));
      if (Number.isFinite(n)) return Math.round(n);
      return null;
    };

    const toDateMaybe = (v: any): Date | null => {
      if (v == null || v === '') return null;
      if (v instanceof Date) return v;
      // XLSX may provide Excel date numbers
      if (typeof v === 'number') {
        const d = XLSX.SSF ? XLSX.SSF.parse_date_code?.(v as any) : null;
        if (d && typeof d === 'object' && 'y' in d) {
          const dd = new Date(Date.UTC((d as any).y, (d as any).m - 1, (d as any).d, (d as any).H || 0, (d as any).M || 0, (d as any).S || 0));
          return dd;
        }
      }
      const s = String(v);
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    };

    const genId = () => Math.random().toString(16).slice(2, 10);

    rows.forEach((row, idx) => {
      const headers = Object.keys(row);
      const map: Record<string, any> = {};
      for (const hk of headers) map[normKey(hk)] = row[hk];

      const segName = (map[normKey('segment')] ?? map[normKey('segmentnaam')] ?? map[normKey('segmentname')] ?? '').toString().trim();
      const cue = (map[normKey('cue')] ?? '').toString().trim();
      const title = (map[normKey('title')] ?? map[normKey('titel')] ?? '').toString().trim();
      const note = map[normKey('note')] ?? map[normKey('opmerking')] ?? '';
      const color = map[normKey('color')] ?? map[normKey('kleur')] ?? '';
      const timeStart = toDateMaybe(map[normKey('timestart')] ?? map[normKey('start')] ?? map[normKey('starttijd')]);
      const timeEnd = toDateMaybe(map[normKey('timeend')] ?? map[normKey('end')] ?? map[normKey('eindtijd')]);
      const durationSec = parseDuration(map[normKey('duration')] ?? map[normKey('duur')] ?? map[normKey('durationsec')] ?? map[normKey('duursec')]);
      const orderIndex = Number(map[normKey('order')] ?? map[normKey('volgorde')] ?? map[normKey('index')] ?? 0) || 0;
      const idCell = (map[normKey('id')] ?? '').toString().trim();
      const positionsRaw = (map[normKey('positions')] ?? map[normKey('posities')] ?? map[normKey('position')] ?? map[normKey('positie')] ?? '').toString();
      const positionNames = positionsRaw
        .split(/[,;]+/)
        .map((s: string) => s.trim())
        .filter((s: string) => !!s);

      const rowNo = idx + 2; // +2 for header baseline in Excel
      if (!segName || !cue || !title || durationSec == null) {
        problems.push(`Row ${rowNo}: missing required fields (segment/cue/title/duration)`);
        return;
      }

      const seg = segByName.get(segName.toLowerCase());
      if (!seg) {
        problems.push(`Row ${rowNo}: unknown segment '${segName}'`);
        return;
      }

      parsed.push({
        productionSegmentId: (seg as any).id,
        id: idCell || genId(),
        cue,
        title,
        note: note ? String(note) : null,
        color: color ? String(color) : null,
        timeStart,
        timeEnd,
        durationSec: durationSec!,
        orderIndex,
        positionNames,
      });
    });

    if (parsed.length === 0) {
      return res.status(400).json({ error: 'No valid rows to import', problems });
    }

    const callSheetName = (req.body?.name ? String(req.body.name) : 'Callsheet import').trim() || 'Callsheet import';
    const callSheetColor = req.body?.color != null ? String(req.body.color) : undefined;

    const result = await prisma.$transaction(async (tx) => {
      const cs = await tx.callSheet.create({ data: { productionId, name: callSheetName, color: callSheetColor } });

      for (const it of parsed) {
        const created = await tx.callSheetItem.create({
          data: {
            id: it.id,
            callSheetId: cs.id,
            productionSegmentId: it.productionSegmentId,
            cue: it.cue,
            title: it.title,
            note: it.note || undefined,
            color: it.color || undefined,
            timeStart: it.timeStart || undefined,
            timeEnd: it.timeEnd || undefined,
            durationSec: it.durationSec,
            orderIndex: it.orderIndex,
          },
        });

        if (it.positionNames.length > 0) {
          // Ensure positions exist
          const ids: number[] = [];
          for (const name of it.positionNames) {
            const key = name.trim().toLowerCase();
            let p = posByName.get(key);
            if (!p) {
              p = await tx.position.create({ data: { name } });
              posByName.set(key, p as any);
            }
            ids.push((p as any).id);
          }
          if (ids.length > 0) {
            await tx.callSheetItemPosition.createMany({
              data: ids.map((pid) => ({ callSheetItemId: created.id, positionId: pid })),
              skipDuplicates: true,
            });
          }
        }
      }

      return cs;
    });

    return res.status(201).json({ ok: true, callSheet: result, items: parsed.length, problems });
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
      include: {
        person: {
          include: {
            skills: true,
          },
        },
      },
    });

    const uniqueMap = new Map<number, any>();
    for (const a of mras) {
      // Flatten to expose skillIds for client-side filtering
      const capIds = (a.person as any).skills?.map((c: any) => c.skillId) || [];
      uniqueMap.set(a.person.id, {
        id: a.person.id,
        name: a.person.name,
        gender: a.person.gender,
        skillIds: capIds,
      });
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
    const prod = await prisma.production.findUnique({ where: { id: seg.productionId } });
    if (!prod) return res.status(404).json({ error: 'Production not found' });

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

    // Validate that person is in production crew (any match role assignment for this production)
    const crewAssignment = await prisma.matchRoleAssignment.findFirst({
      where: { matchScheduleId: prod.matchScheduleId, personId },
      select: { id: true },
    });
    if (!crewAssignment) {
      return res.status(422).json({ error: 'Persoon is niet gekoppeld als crew van deze productie' });
    }

    // Skill requirement per position: prefer configured skill on the position; fallback to centralized mapping
    let requiredCode: string | null = null;
    const posWithCap = await prisma.position.findUnique({ where: { id: pos.id }, include: { skill: true } });
    if (posWithCap?.skill) requiredCode = posWithCap.skill.code;
    else requiredCode = getRequiredSkillCodeForPosition(pos.name);
    if (requiredCode) {
      // Resolve skillId by code
      const cap = await prisma.skill.findUnique({ where: { code: requiredCode } });
      if (!cap) return res.status(422).json({ error: `Vereiste skill ${requiredCode} bestaat niet` });
      const hasCap = await prisma.personSkill.findUnique({ where: { personId_skillId: { personId, skillId: cap.id } } });
      if (!hasCap) {
        return res.status(422).json({ error: 'Persoon mist de vereiste skill voor deze positie' });
      }
    }

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

// Default positions for a segment (computed template)
productionRouter.get('/segments/:segmentId/positions', async (req, res, next) => {
  try {
    const segmentId = Number(req.params.segmentId);
    if (!Number.isInteger(segmentId) || segmentId <= 0) return res.status(400).json({ error: 'Invalid segment id' });
    const seg = await prisma.productionSegment.findUnique({ where: { id: segmentId } });
    if (!seg) return res.status(404).json({ error: 'Not found' });

    // Try configured defaults for this segment name; fall back to hardcoded list
    const configured = await prisma.segmentDefaultPosition.findMany({
      where: { segmentName: seg.naam },
      orderBy: { order: 'asc' },
      include: { position: { include: { skill: true } } },
    });

    if (configured.length > 0) {
      const mapped = configured.map((it, idx) => ({
        id: it.position.id,
        name: it.position.name,
        order: it.order ?? idx,
        requiredSkillCode: it.position.skill ? it.position.skill.code : null,
      }));
      return res.json(mapped);
    }

    // Fallback to global defaults if present
    const global = await prisma.segmentDefaultPosition.findMany({
      where: { segmentName: GLOBAL_SEGMENT_NAME },
      orderBy: { order: 'asc' },
      include: { position: { include: { skill: true } } },
    });
    if (global.length > 0) {
      const mapped = global.map((it, idx) => ({
        id: it.position.id,
        name: it.position.name,
        order: it.order ?? idx,
        requiredSkillCode: it.position.skill ? it.position.skill.code : null,
      }));
      return res.json(mapped);
    }

    // Fallback to creating defaults from constant list (compatible with previous behavior)
    const positions = await Promise.all(
      DEFAULT_SEGMENT_POSITIONS.map(async (name, order) => {
        let p = await prisma.position.findUnique({ where: { name } });
        if (!p) p = await prisma.position.create({ data: { name, skillId: null } });
        const requiredSkillCode = p.skillId
          ? (await prisma.skill.findUnique({ where: { id: p.skillId } }))?.code || null
          : getRequiredSkillCodeForPosition(name);
        return { id: p.id, name: p.name, order, requiredSkillCode };
      })
    );

    return res.json(positions);
  } catch (err) {
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

// -------- Production Report (Livestream Productie Rapport) --------

// Schema's voor validatie
const CreateUpdateProductionReportSchema = z.object({
  matchSponsor: z.string().max(200).optional().nullable(),
  interviewRationale: z.string().max(5000).optional().nullable(),
});

// Helper functie om segment naam te mappen naar rapport sectie
function mapSegmentToSection(segmentName: string): string {
  const lower = segmentName.toLowerCase();
  if (lower.includes('oplopen') || lower.includes('oploop')) return 'OPLOPEN';
  if (lower.includes('wedstrijd')) return 'WEDSTRIJD';
  if (lower.includes('studio')) return 'STUDIO';
  if (lower.includes('commentaar')) return 'COMMENTAAR';
  if (lower.includes('speaker')) return 'SPEAKER';
  return 'OVERIG';
}

// GET /api/production/:id/report - Haal het productie rapport op (enriched met productie data)
productionRouter.get('/:id/report', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid production id' });

    const production = await prisma.production.findUnique({
      where: { id },
      include: {
        matchSchedule: true,
        productionReport: true,
        segments: {
          include: {
            bezetting: {
              include: {
                person: true,
                position: true,
              },
            },
          },
          orderBy: { volgorde: 'asc' },
        },
        interviewSubjects: {
          include: {
            player: {
              include: {
                club: true,
              },
            },
          },
        },
      },
    });

    if (!production) return res.status(404).json({ error: 'Production not found' });

    // Verzamel unieke personen (aanwezigen)
    const uniquePeople = new Set<string>();
    production.segments.forEach((seg) => {
      seg.bezetting.forEach((b) => uniquePeople.add(b.person.name));
    });
    const attendees = Array.from(uniquePeople).sort();

    // Groepeer rollen per sectie (met isStudio info)
    const rolesBySection: Record<string, Array<{ positionName: string; personNames: string[]; isStudio: boolean }>> = {};

    production.segments.forEach((segment) => {
      const section = mapSegmentToSection(segment.naam);
      if (!rolesBySection[section]) rolesBySection[section] = [];

      const positionMap = new Map<string, { names: Set<string>; isStudio: boolean }>();
      segment.bezetting.forEach((b) => {
        if (!positionMap.has(b.position.name)) {
          positionMap.set(b.position.name, { names: new Set(), isStudio: b.position.isStudio });
        }
        positionMap.get(b.position.name)!.names.add(b.person.name);
      });

      positionMap.forEach((data, posName) => {
        const existing = rolesBySection[section].find((r) => r.positionName === posName);
        if (existing) {
          data.names.forEach((n) => {
            if (!existing.personNames.includes(n)) existing.personNames.push(n);
          });
        } else {
          rolesBySection[section].push({
            positionName: posName,
            personNames: Array.from(data.names),
            isStudio: data.isStudio,
          });
        }
      });
    });

    // Sorteer en maak leesbaar
    Object.keys(rolesBySection).forEach((section) => {
      rolesBySection[section].sort((a, b) => a.positionName.localeCompare(b.positionName));
    });

    // Interview subjects (met foto's en rugnummer)
    const interviews = {
      home: {
        players: production.interviewSubjects
          .filter((s) => s.side === 'HOME' && s.role === 'PLAYER')
          .map((s) => ({
            id: s.player.id,
            name: s.player.name,
            shirtNo: s.player.shirtNo,
            function: s.player.function,
            photoUrl: s.player.photoUrl,
          })),
        coaches: production.interviewSubjects
          .filter((s) => s.side === 'HOME' && s.role === 'COACH')
          .map((s) => ({
            id: s.player.id,
            name: s.player.name,
            shirtNo: s.player.shirtNo,
            function: s.player.function,
            photoUrl: s.player.photoUrl,
          })),
      },
      away: {
        players: production.interviewSubjects
          .filter((s) => s.side === 'AWAY' && s.role === 'PLAYER')
          .map((s) => ({
            id: s.player.id,
            name: s.player.name,
            shirtNo: s.player.shirtNo,
            function: s.player.function,
            photoUrl: s.player.photoUrl,
          })),
        coaches: production.interviewSubjects
          .filter((s) => s.side === 'AWAY' && s.role === 'COACH')
          .map((s) => ({
            id: s.player.id,
            name: s.player.name,
            shirtNo: s.player.shirtNo,
            function: s.player.function,
            photoUrl: s.player.photoUrl,
          })),
      },
    };

    // Haal alle sponsors op voor de dropdown
    const sponsors = await prisma.sponsor.findMany({ orderBy: { name: 'asc' } });

    return res.json({
      production: {
        id: production.id,
        matchScheduleId: production.matchScheduleId,
        homeTeam: production.matchSchedule.homeTeamName,
        awayTeam: production.matchSchedule.awayTeamName,
        date: production.matchSchedule.date,
      },
      report: production.productionReport || null,
      enriched: {
        attendees,
        rolesBySection,
        interviews,
      },
      sponsors,
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/production/:id/report - Maak of update het productie rapport
productionRouter.post('/:id/report', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid production id' });

    const parsed = CreateUpdateProductionReportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid payload' });
    }

    const { matchSponsor, interviewRationale } = parsed.data;

    // Check if production exists
    const production = await prisma.production.findUnique({ where: { id } });
    if (!production) return res.status(404).json({ error: 'Production not found' });

    // Upsert het rapport
    const report = await prisma.productionReport.upsert({
      where: { productionId: id },
      create: {
        productionId: id,
        matchSponsor,
        interviewRationale,
      },
      update: {
        matchSponsor,
        interviewRationale,
      },
    });

    return res.json(report);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid payload' });
    return next(err);
  }
});

// DELETE /api/production/:id/report - Verwijder het productie rapport
productionRouter.delete('/:id/report', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid production id' });

    const existing = await prisma.productionReport.findUnique({ where: { productionId: id } });
    if (!existing) return res.status(404).json({ error: 'Report not found' });

    await prisma.productionReport.delete({ where: { id: existing.id } });

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// GET /api/production/:id/report/pdf - Download het productie rapport als PDF
productionRouter.get('/:id/report/pdf', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid production id' });

    const production = await prisma.production.findUnique({
      where: { id },
      include: {
        matchSchedule: true,
        productionReport: true,
        segments: {
          include: {
            bezetting: {
              include: {
                person: true,
                position: true,
              },
            },
          },
          orderBy: { volgorde: 'asc' },
        },
        interviewSubjects: {
          include: {
            player: {
              include: {
                club: true,
              },
            },
          },
        },
      },
    });

    if (!production) return res.status(404).json({ error: 'Production not found' });

    const report = production.productionReport;
    const match = production.matchSchedule;

    // Debug: log segment names
    logger.info('Production segments:', production.segments.map(s => ({ name: s.naam, bezettingCount: s.bezetting.length })));

    // Verzamel enriched data
    const uniquePeople = new Set<string>();
    production.segments.forEach((seg) => {
      seg.bezetting.forEach((b) => uniquePeople.add(b.person.name));
    });
    const attendees = Array.from(uniquePeople).sort();

    // Groepeer rollen per sectie (met isStudio info)
    const rolesBySection: Record<string, Array<{ positionName: string; personNames: string[]; isStudio: boolean }>> = {};
    production.segments.forEach((segment) => {
      const section = mapSegmentToSection(segment.naam);
      logger.info(`Mapping segment "${segment.naam}" to section "${section}"`);
      if (!rolesBySection[section]) rolesBySection[section] = [];

      const positionMap = new Map<string, { names: Set<string>; isStudio: boolean }>();
      segment.bezetting.forEach((b) => {
        if (!positionMap.has(b.position.name)) {
          positionMap.set(b.position.name, { names: new Set(), isStudio: b.position.isStudio });
        }
        positionMap.get(b.position.name)!.names.add(b.person.name);
      });

      positionMap.forEach((data, posName) => {
        const existing = rolesBySection[section].find((r) => r.positionName === posName);
        if (existing) {
          data.names.forEach((n) => {
            if (!existing.personNames.includes(n)) existing.personNames.push(n);
          });
        } else {
          rolesBySection[section].push({
            positionName: posName,
            personNames: Array.from(data.names),
            isStudio: data.isStudio,
          });
        }
      });
    });

    // Sorteer
    Object.keys(rolesBySection).forEach((section) => {
      rolesBySection[section].sort((a, b) => a.positionName.localeCompare(b.positionName));
    });

    // Debug: log final rolesBySection
    logger.info('Final rolesBySection after processing:', JSON.stringify(rolesBySection, null, 2));

    // Interview subjects
    const interviews = {
      home: {
        players: production.interviewSubjects.filter((s) => s.side === 'HOME' && s.role === 'PLAYER').map((s) => s.player),
        coaches: production.interviewSubjects.filter((s) => s.side === 'HOME' && s.role === 'COACH').map((s) => s.player),
      },
      away: {
        players: production.interviewSubjects.filter((s) => s.side === 'AWAY' && s.role === 'PLAYER').map((s) => s.player),
        coaches: production.interviewSubjects.filter((s) => s.side === 'AWAY' && s.role === 'COACH').map((s) => s.player),
      },
    };

    // Format datum en tijd
    const matchDate = new Date(match.date);
    const timeStr = matchDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    const matchTitle = `${match.homeTeamName} - ${match.awayTeamName}: ${timeStr} uur`;

    // Maak PDF document
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Set response headers
    const filename = `Productie_Positie_Overzicht_${match.homeTeamName.replace(/[^a-z0-9]/gi, '_')}_${matchDate.toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe PDF naar response
    doc.pipe(res);

    // Titel
    doc.fontSize(18).font('Helvetica-Bold').text('Livestream bezetting', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica').text(matchTitle, { align: 'center' });
    doc.moveDown(1);

    // Aanwezigen
    doc.fontSize(12).font('Helvetica-Bold').text('Aanwezig:', { continued: false });
    doc.font('Helvetica').text(attendees.join(', ') || 'Geen aanwezigen');
    doc.moveDown(0.5);

    // Wedstrijdsponsor
    if (report?.matchSponsor) {
      doc.fontSize(12).font('Helvetica-Bold').text('Wedstrijdsponsor:', { continued: false });
      doc.font('Helvetica').text(report.matchSponsor);
      doc.moveDown(1);
    } else {
      doc.moveDown(0.5);
    }

    // Positie bezetting header
    doc.fontSize(14).font('Helvetica-Bold').text('Positie bezetting', { underline: true });
    doc.moveDown(0.5);

    // Debug: log rolesBySection
    logger.info('rolesBySection keys:', Object.keys(rolesBySection));
    Object.keys(rolesBySection).forEach(key => {
      logger.info(`Section ${key}:`, rolesBySection[key]);
    });

    // Verzamel alle posities uit alle secties
    const allRoles: Array<{ positionName: string; personNames: string[]; isStudio: boolean }> = [];
    Object.values(rolesBySection).forEach((roles) => {
      roles.forEach((role) => {
        const existing = allRoles.find((r) => r.positionName === role.positionName);
        if (existing) {
          role.personNames.forEach((name) => {
            if (!existing.personNames.includes(name)) {
              existing.personNames.push(name);
            }
          });
        } else {
          allRoles.push({ positionName: role.positionName, personNames: [...role.personNames], isStudio: role.isStudio });
        }
      });
    });

    // Splits in Studio en Productie posities op basis van isStudio veld
    const studioRoles = allRoles.filter((r) => r.isStudio);
    const productieRoles = allRoles.filter((r) => !r.isStudio);

    // Render twee kolommen met tabellen
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columnWidth = pageWidth / 2 - 10;
    const leftColumnX = doc.page.margins.left;
    const rightColumnX = doc.page.margins.left + columnWidth + 20;
    let currentY = doc.y;
    const positionColumnY = doc.y;

    // Linker kolom: Studio posities
    doc.fontSize(12).font('Helvetica-Bold').text('Studio posities', leftColumnX, currentY);
    currentY += 20;

    // Tabel headers
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Positie', leftColumnX, currentY, { width: columnWidth * 0.4, continued: false });
    doc.text('Naam', leftColumnX + columnWidth * 0.4, currentY, { width: columnWidth * 0.6, continued: false });
    currentY += 15;

    // Tabel rijen
    doc.fontSize(9).font('Helvetica');
    if (studioRoles.length === 0) {
      doc.fillColor('gray').text('Geen posities toegewezen', leftColumnX, currentY, { width: columnWidth, continued: false });
      doc.fillColor('black');
      currentY += 12;
    } else {
      studioRoles.forEach((role) => {
        const rowHeight = Math.max(12, Math.ceil(role.personNames.join(', ').length / 30) * 12);
        doc.text(role.positionName, leftColumnX, currentY, { width: columnWidth * 0.4, continued: false });
        doc.text(role.personNames.join(', '), leftColumnX + columnWidth * 0.4, currentY, { width: columnWidth * 0.6, continued: false });
        currentY += rowHeight;
      });
    }

    // Rechter kolom: Productie posities (start vanaf boven)
    const startY = positionColumnY;

    doc.fontSize(12).font('Helvetica-Bold').text('Productie posities', rightColumnX, startY);
    let rightCurrentY = startY + 20;

    // Tabel headers
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Positie', rightColumnX, rightCurrentY, { width: columnWidth * 0.4, continued: false });
    doc.text('Naam', rightColumnX + columnWidth * 0.4, rightCurrentY, { width: columnWidth * 0.6, continued: false });
    rightCurrentY += 15;

    // Tabel rijen
    doc.fontSize(9).font('Helvetica');
    if (productieRoles.length === 0) {
      doc.fillColor('gray').text('Geen posities toegewezen', rightColumnX, rightCurrentY, { width: columnWidth, continued: false });
      doc.fillColor('black');
      rightCurrentY += 12;
    } else {
      productieRoles.forEach((role) => {
        const rowHeight = Math.max(12, Math.ceil(role.personNames.join(', ').length / 30) * 12);
        doc.text(role.positionName, rightColumnX, rightCurrentY, { width: columnWidth * 0.4, continued: false });
        doc.text(role.personNames.join(', '), rightColumnX + columnWidth * 0.4, rightCurrentY, { width: columnWidth * 0.6, continued: false });
        rightCurrentY += rowHeight;
      });
    }

    // Zet cursor naar de laagste punt van beide kolommen
    doc.y = Math.max(currentY, rightCurrentY);
    doc.moveDown(1);

    // Interview sectie met foto's in 2 kolommen (coach links, speler rechts)
    const allInterviewees = [...interviews.home.players, ...interviews.home.coaches, ...interviews.away.players, ...interviews.away.coaches];
    if (allInterviewees.length > 0) {
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const columnWidth = pageWidth / 2 - 10;
      const leftColumnX = doc.page.margins.left;
      const rightColumnX = doc.page.margins.left + columnWidth + 20;
      doc.x = leftColumnX;
      doc.fontSize(13).font('Helvetica-Bold').text('Spelers voor interviews:', { underline: true });
      doc.moveDown(0.5);
      // Helper functie om persoon te renderen
      const renderPerson = (person: any, xPos: number, yPos: number) => {
        const imageWidth = 120;
        const imageHeight = 120;
        let currentY = yPos;

        // Naam en rugnummer eerst
        const shirtNo = (person.shirtNo != null && person.shirtNo > 0) ? ` (#${person.shirtNo})` : '';
        doc.fontSize(11).font('Helvetica-Bold').text(`${person.name}${shirtNo}`, xPos, currentY);
        currentY = doc.y;
        if (person.function) {
          doc.fontSize(10).font('Helvetica').text(person.function, xPos, currentY);
          currentY = doc.y;
        }
        currentY += 1;

        // Foto eronder
        if (person.photoUrl) {
          const imagePath = path.join(process.cwd(), 'uploads', person.photoUrl);

          if (fs.existsSync(imagePath)) {
            try {
              // 1. Sla de huidige staat van het document op
              doc.save();

              // 1. Teken het kader waar de foto in MOET komen
              doc.rect(xPos, currentY, imageWidth, imageHeight).clip();

              // 2. Plaats de afbeelding
              // We gebruiken 'cover' met exact dezelfde dimensies als de clip-rect.
              // 'valign: top' zorgt dat we het hoofd zien.
              doc.image(imagePath, xPos, currentY, {
                width: imageWidth
              });

              doc.restore(); // Herstel clip-staat zodat tekst weer zichtbaar is

              // 3. Update currentY voor de rest van de content
              // We voegen extra ruimte toe (bijv. 15px) na de afbeelding
              currentY += imageHeight + 1;

            } catch (e) {
              logger.warn(`Could not add image for ${person.name}: ${e}`);
            }
          }
        }

        return currentY;
      };



      // Away team - 2 kolommen layout
      if (interviews.away.players.length > 0 || interviews.away.coaches.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text(`${match.awayTeamName}:`);
        doc.moveDown(0.3);

        const rowStartY = doc.y;
        let leftY = rowStartY;
        let rightY = rowStartY;

        // Coach links
        if (interviews.away.coaches.length > 0) {
          const coach = interviews.away.coaches[0];
          leftY = renderPerson(coach, leftColumnX, leftY);
        }

        // Spelers rechts
        if (interviews.away.players.length > 0) {
          for (const player of interviews.away.players) {
            rightY = renderPerson(player, rightColumnX, rightY);
            rightY += 5; // Spacing tussen spelers
          }
        }

        // Zet cursor onder de hoogste kolom
        doc.y = Math.max(leftY, rightY) + 2;
        doc.x = leftColumnX;
      }

      // Home team - 2 kolommen layout
      if (interviews.home.players.length > 0 || interviews.home.coaches.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text(`${match.homeTeamName}:`);
        doc.moveDown(0.3);

        const rowStartY = doc.y;
        let leftY = rowStartY;
        let rightY = rowStartY;

        // Coach links
        if (interviews.home.coaches.length > 0) {
          const coach = interviews.home.coaches[0];
          leftY = renderPerson(coach, leftColumnX, leftY);
        }

        // Spelers rechts
        if (interviews.home.players.length > 0) {
          for (const player of interviews.home.players) {
            rightY = renderPerson(player, rightColumnX, rightY);
            rightY += 20; // Spacing tussen spelers
          }
        }

        // Zet cursor onder de hoogste kolom
        doc.y = Math.max(leftY, rightY) + 2;
        doc.x = leftColumnX;
      }
      doc.moveDown(0.5);
    }

    // Interview rationale
    if (report?.interviewRationale) {
      doc.fontSize(13).font('Helvetica-Bold').text('Argumentatie voor spelerkeuze:', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica').text(report.interviewRationale);
      doc.moveDown(0.5);
    }

    // Finalize PDF
    doc.end();
  } catch (err) {
    return next(err);
  }
});

// GET /api/production/:id/report/markdown - Download het productie rapport als Markdown
productionRouter.get('/:id/report/markdown', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid production id' });

    const production = await prisma.production.findUnique({
      where: { id },
      include: {
        matchSchedule: true,
        productionReport: true,
        segments: {
          include: {
            bezetting: {
              include: {
                person: true,
                position: true,
              },
            },
          },
          orderBy: { volgorde: 'asc' },
        },
        interviewSubjects: {
          include: {
            player: {
              include: {
                club: true,
              },
            },
          },
        },
      },
    });

    if (!production) return res.status(404).json({ error: 'Production not found' });

    const report = production.productionReport;
    const match = production.matchSchedule;

    // Verzamel enriched data
    const uniquePeople = new Set<string>();
    production.segments.forEach((seg) => {
      seg.bezetting.forEach((b) => uniquePeople.add(b.person.name));
    });
    const attendees = Array.from(uniquePeople).sort();

    // Groepeer rollen per sectie (met isStudio info)
    const rolesBySection: Record<string, Array<{ positionName: string; personNames: string[]; isStudio: boolean }>> = {};
    production.segments.forEach((segment) => {
      const section = mapSegmentToSection(segment.naam);
      if (!rolesBySection[section]) rolesBySection[section] = [];

      const positionMap = new Map<string, { names: Set<string>; isStudio: boolean }>();
      segment.bezetting.forEach((b) => {
        if (!positionMap.has(b.position.name)) {
          positionMap.set(b.position.name, { names: new Set(), isStudio: b.position.isStudio });
        }
        positionMap.get(b.position.name)!.names.add(b.person.name);
      });

      positionMap.forEach((data, posName) => {
        const existing = rolesBySection[section].find((r) => r.positionName === posName);
        if (existing) {
          data.names.forEach((n) => {
            if (!existing.personNames.includes(n)) existing.personNames.push(n);
          });
        } else {
          rolesBySection[section].push({
            positionName: posName,
            personNames: Array.from(data.names),
            isStudio: data.isStudio,
          });
        }
      });
    });

    // Sorteer
    Object.keys(rolesBySection).forEach((section) => {
      rolesBySection[section].sort((a, b) => a.positionName.localeCompare(b.positionName));
    });

    // Interview subjects
    const interviews = {
      home: {
        players: production.interviewSubjects.filter((s) => s.side === 'HOME' && s.role === 'PLAYER').map((s) => s.player),
        coaches: production.interviewSubjects.filter((s) => s.side === 'HOME' && s.role === 'COACH').map((s) => s.player),
      },
      away: {
        players: production.interviewSubjects.filter((s) => s.side === 'AWAY' && s.role === 'PLAYER').map((s) => s.player),
        coaches: production.interviewSubjects.filter((s) => s.side === 'AWAY' && s.role === 'COACH').map((s) => s.player),
      },
    };

    // Format datum en tijd
    const matchDate = new Date(match.date);
    const timeStr = matchDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    const matchTitle = `${match.homeTeamName} - ${match.awayTeamName}: ${timeStr} uur`;

    // Bouw Markdown content
    let markdown = `# Livestream bezetting\n\n`;
    markdown += `${matchTitle}\n\n`;

    // Aanwezigen
    markdown += `## Aanwezig\n\n`;
    markdown += `${attendees.join(', ') || 'Geen aanwezigen'}\n\n`;

    // Wedstrijdsponsor
    if (report?.matchSponsor) {
      markdown += `## Wedstrijdsponsor\n\n`;
      markdown += `${report.matchSponsor}\n\n`;
    }

    // Positie bezetting
    markdown += `## Positie bezetting\n\n`;

    // Verzamel alle posities uit alle secties
    const allRoles: Array<{ positionName: string; personNames: string[]; isStudio: boolean }> = [];
    Object.values(rolesBySection).forEach((roles) => {
      roles.forEach((role) => {
        const existing = allRoles.find((r) => r.positionName === role.positionName);
        if (existing) {
          role.personNames.forEach((name) => {
            if (!existing.personNames.includes(name)) {
              existing.personNames.push(name);
            }
          });
        } else {
          allRoles.push({ positionName: role.positionName, personNames: [...role.personNames], isStudio: role.isStudio });
        }
      });
    });

    // Splits in Studio en Productie posities op basis van isStudio veld
    const studioRoles = allRoles.filter((r) => r.isStudio);
    const productieRoles = allRoles.filter((r) => !r.isStudio);

    // Studio posities
    markdown += `### Studio posities\n\n`;
    if (studioRoles.length === 0) {
      markdown += `*Geen posities toegewezen*\n\n`;
    } else {
      markdown += `| Positie | Naam |\n`;
      markdown += `|---------|------|\n`;
      studioRoles.forEach((role) => {
        markdown += `| ${role.positionName} | ${role.personNames.join(', ')} |\n`;
      });
      markdown += `\n`;
    }

    // Productie posities
    markdown += `### Productie posities\n\n`;
    if (productieRoles.length === 0) {
      markdown += `*Geen posities toegewezen*\n\n`;
    } else {
      markdown += `| Positie | Naam |\n`;
      markdown += `|---------|------|\n`;
      productieRoles.forEach((role) => {
        markdown += `| ${role.positionName} | ${role.personNames.join(', ')} |\n`;
      });
      markdown += `\n`;
    }

    // Interview sectie
    const allInterviewees = [...interviews.home.players, ...interviews.home.coaches, ...interviews.away.players, ...interviews.away.coaches];
    if (allInterviewees.length > 0) {
      markdown += `## Spelers voor interviews\n\n`;

      // Home team
      if (interviews.home.players.length > 0 || interviews.home.coaches.length > 0) {
        markdown += `### ${match.homeTeamName}\n\n`;

        if (interviews.home.coaches.length > 0) {
          const coach = interviews.home.coaches[0];
          markdown += `**${coach.name}**`;
          if (coach.function) markdown += ` - ${coach.function}`;
          markdown += `\n\n`;
        }

        interviews.home.players.forEach((player) => {
          markdown += `**${player.name}**`;
          if (player.shirtNo != null && player.shirtNo > 0) markdown += ` (#${player.shirtNo})`;
          if (player.function) markdown += ` - ${player.function}`;
          markdown += `\n\n`;
        });
      }

      // Away team
      if (interviews.away.players.length > 0 || interviews.away.coaches.length > 0) {
        markdown += `### ${match.awayTeamName}\n\n`;

        if (interviews.away.coaches.length > 0) {
          const coach = interviews.away.coaches[0];
          markdown += `**${coach.name}**`;
          if (coach.function) markdown += ` - ${coach.function}`;
          markdown += `\n\n`;
        }

        interviews.away.players.forEach((player) => {
          markdown += `**${player.name}**`;
          if (player.shirtNo != null && player.shirtNo > 0) markdown += ` (#${player.shirtNo})`;
          if (player.function) markdown += ` - ${player.function}`;
          markdown += `\n\n`;
        });
      }
    }

    // Interview rationale
    if (report?.interviewRationale) {
      markdown += `## Argumentatie voor spelerkeuze\n\n`;
      markdown += `${report.interviewRationale}\n\n`;
    }

    // Set response headers
    const filename = `Productie_Positie_Overzicht_${match.homeTeamName.replace(/[^a-z0-9]/gi, '_')}_${matchDate.toISOString().split('T')[0]}.md`;
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.send(markdown);
  } catch (err) {
    return next(err);
  }
});

// GET /api/production/:id/report/whatsapp - Download het productie rapport als WhatsApp tekst
productionRouter.get('/:id/report/whatsapp', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid production id' });

    const production = await prisma.production.findUnique({
      where: { id },
      include: {
        matchSchedule: true,
        productionReport: true,
        segments: {
          include: {
            bezetting: {
              include: {
                person: true,
                position: true,
              },
            },
          },
          orderBy: { volgorde: 'asc' },
        },
        interviewSubjects: {
          include: {
            player: {
              include: {
                club: true,
              },
            },
          },
        },
      },
    });

    if (!production) return res.status(404).json({ error: 'Production not found' });

    const report = production.productionReport;
    const match = production.matchSchedule;

    // Verzamel enriched data
    const uniquePeople = new Set<string>();
    production.segments.forEach((seg) => {
      seg.bezetting.forEach((b) => uniquePeople.add(b.person.name));
    });
    const attendees = Array.from(uniquePeople).sort();

    // Groepeer rollen per sectie (met isStudio info)
    const rolesBySection: Record<string, Array<{ positionName: string; personNames: string[]; isStudio: boolean }>> = {};
    production.segments.forEach((segment) => {
      const section = mapSegmentToSection(segment.naam);
      if (!rolesBySection[section]) rolesBySection[section] = [];

      const positionMap = new Map<string, { names: Set<string>; isStudio: boolean }>();
      segment.bezetting.forEach((b) => {
        if (!positionMap.has(b.position.name)) {
          positionMap.set(b.position.name, { names: new Set(), isStudio: b.position.isStudio });
        }
        positionMap.get(b.position.name)!.names.add(b.person.name);
      });

      positionMap.forEach((data, posName) => {
        const existing = rolesBySection[section].find((r) => r.positionName === posName);
        if (existing) {
          data.names.forEach((n) => {
            if (!existing.personNames.includes(n)) existing.personNames.push(n);
          });
        } else {
          rolesBySection[section].push({
            positionName: posName,
            personNames: Array.from(data.names),
            isStudio: data.isStudio,
          });
        }
      });
    });

    // Sorteer
    Object.keys(rolesBySection).forEach((section) => {
      rolesBySection[section].sort((a, b) => a.positionName.localeCompare(b.positionName));
    });

    // Interview subjects
    const interviews = {
      home: {
        players: production.interviewSubjects.filter((s) => s.side === 'HOME' && s.role === 'PLAYER').map((s) => s.player),
        coaches: production.interviewSubjects.filter((s) => s.side === 'HOME' && s.role === 'COACH').map((s) => s.player),
      },
      away: {
        players: production.interviewSubjects.filter((s) => s.side === 'AWAY' && s.role === 'PLAYER').map((s) => s.player),
        coaches: production.interviewSubjects.filter((s) => s.side === 'AWAY' && s.role === 'COACH').map((s) => s.player),
      },
    };

    // Format datum en tijd
    const matchDate = new Date(match.date);
    const timeStr = matchDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    const matchTitle = `${match.homeTeamName} - ${match.awayTeamName}: ${timeStr} uur`;

    // Bouw WhatsApp tekst (met emoji's voor opmaak)
    let text = `*🎬 Livestream bezetting*\n\n`;
    text += `${matchTitle}\n\n`;

    // Aanwezigen
    text += `*👥 Aanwezig*\n`;
    text += `${attendees.join(', ') || 'Geen aanwezigen'}\n\n`;

    // Wedstrijdsponsor
    if (report?.matchSponsor) {
      text += `*🤝 Wedstrijdsponsor*\n`;
      text += `${report.matchSponsor}\n\n`;
    }

    // Positie bezetting
    text += `*📍 Positie bezetting*\n\n`;

    // Verzamel alle posities uit alle secties
    const allRoles: Array<{ positionName: string; personNames: string[]; isStudio: boolean }> = [];
    Object.values(rolesBySection).forEach((roles) => {
      roles.forEach((role) => {
        const existing = allRoles.find((r) => r.positionName === role.positionName);
        if (existing) {
          role.personNames.forEach((name) => {
            if (!existing.personNames.includes(name)) {
              existing.personNames.push(name);
            }
          });
        } else {
          allRoles.push({ positionName: role.positionName, personNames: [...role.personNames], isStudio: role.isStudio });
        }
      });
    });

    // Splits in Studio en Productie posities op basis van isStudio veld
    const studioRoles = allRoles.filter((r) => r.isStudio);
    const productieRoles = allRoles.filter((r) => !r.isStudio);

    // Studio posities
    text += `_Studio posities_\n`;
    if (studioRoles.length === 0) {
      text += `Geen posities toegewezen\n`;
    } else {
      studioRoles.forEach((role) => {
        text += `• ${role.positionName}: ${role.personNames.join(', ')}\n`;
      });
    }
    text += `\n`;

    // Productie posities
    text += `_Productie posities_\n`;
    if (productieRoles.length === 0) {
      text += `Geen posities toegewezen\n`;
    } else {
      productieRoles.forEach((role) => {
        text += `• ${role.positionName}: ${role.personNames.join(', ')}\n`;
      });
    }
    text += `\n`;

    // Interview sectie
    const allInterviewees = [...interviews.home.players, ...interviews.home.coaches, ...interviews.away.players, ...interviews.away.coaches];
    if (allInterviewees.length > 0) {
      text += `*🎤 Spelers voor interviews*\n\n`;

      // Away team
      if (interviews.away.players.length > 0 || interviews.away.coaches.length > 0) {
        text += `_${match.awayTeamName}_\n`;

        if (interviews.away.coaches.length > 0) {
          const coach = interviews.away.coaches[0];
          text += `• ${coach.name}`;
          if (coach.function) text += ` - ${coach.function}`;
          text += `\n`;
        }

        interviews.away.players.forEach((player) => {
          text += `• ${player.name}`;
          if (player.shirtNo != null && player.shirtNo > 0) text += ` (#${player.shirtNo})`;
          if (player.function) text += ` - ${player.function}`;
          text += `\n`;
        });
        text += `\n`;
      }

      // Home team
      if (interviews.home.players.length > 0 || interviews.home.coaches.length > 0) {
        text += `_${match.homeTeamName}_\n`;

        if (interviews.home.coaches.length > 0) {
          const coach = interviews.home.coaches[0];
          text += `• ${coach.name}`;
          if (coach.function) text += ` - ${coach.function}`;
          text += `\n`;
        }

        interviews.home.players.forEach((player) => {
          text += `• ${player.name}`;
          if (player.shirtNo != null && player.shirtNo > 0) text += ` (#${player.shirtNo})`;
          if (player.function) text += ` - ${player.function}`;
          text += `\n`;
        });
        text += `\n`;
      }
    }

    // Interview rationale
    if (report?.interviewRationale) {
      text += `*💭 Argumentatie voor spelerkeuze*\n`;
      text += `${report.interviewRationale}\n`;
    }

    // Set response headers
    const filename = `Productie_Positie_Overzicht_${match.homeTeamName.replace(/[^a-z0-9]/gi, '_')}_${matchDate.toISOString().split('T')[0]}.txt`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.send(text);
  } catch (err) {
    return next(err);
  }
});
