import {Router} from 'express';
import {prisma} from '../../services/prisma';
import {DEFAULT_SEGMENT_POSITIONS, getRequiredSkillCodeForPosition} from '../../domain/positionSkill';

export const segmentAssignmentsRouter: Router = Router();

// Reserved internal name for the global default set. UI will display this as "Algemeen".
const GLOBAL_SEGMENT_NAME = '__GLOBAL__';

// -------- Segment-level assignments --------
// Crew persons for a segment's production (persons assigned at production level)
segmentAssignmentsRouter.get('/segments/:segmentId/persons', async (req, res, next) => {
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
segmentAssignmentsRouter.get('/segments/:segmentId/assignments', async (req, res, next) => {
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
segmentAssignmentsRouter.post('/segments/:segmentId/assignments', async (req, res, next) => {
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
    // const crewAssignment = await prisma.matchRoleAssignment.findFirst({
    //   where: { matchScheduleId: prod.matchScheduleId, personId },
    //   select: { id: true },
    // });
    // if (!crewAssignment) {
    //   return res.status(422).json({ error: 'Persoon is niet gekoppeld als crew van deze productie' });
    // }

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
segmentAssignmentsRouter.get('/segments/:segmentId/positions', async (req, res, next) => {
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
segmentAssignmentsRouter.delete('/segments/:segmentId/assignments/:assignmentId', async (req, res, next) => {
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
segmentAssignmentsRouter.post('/segments/:segmentId/assignments/copy', async (req, res, next) => {
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
