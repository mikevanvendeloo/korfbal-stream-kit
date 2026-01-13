import {Router} from 'express';
import {prisma} from '../services/prisma';
import {logger} from '../utils/logger';
import {
  AssignmentCreateSchema,
  AssignmentUpdateSchema,
  SkillInputSchema,
  PaginationQuerySchema,
  PersonInputSchema,
  PersonUpdateSchema,
} from '../schemas/person';

export const personsRouter: Router = Router();

// Deprecated endpoint: proxy to new skills list for backward compatibility
personsRouter.get('/functions', async (_req, res, next) => {
  try {
    const items = await prisma.skill.findMany({ orderBy: [{ code: 'asc' }] });
    // Shape similar to old response but with derived name+gender when needed
    return res.json(items);
  } catch (err) {
    logger.error('GET /persons/functions failed', err as any);
    return next(err);
  }
});

// List persons
personsRouter.get('/', async (req, res, next) => {
  try {
    const { page, limit, gender, q } = PaginationQuerySchema.parse(req.query);
    const where: any = {};
    if (gender) where.gender = gender as any;
    if (q && q.trim()) where.name = { contains: q.trim(), mode: 'insensitive' };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.person.findMany({ where, orderBy: { id: 'asc' }, skip, take: limit }),
      prisma.person.count({ where }),
    ]);
    return res.json({ items, page, limit, total, pages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    logger.error('GET /persons failed', err as any);
    return next(err);
  }
});

// Get person by id with skills
personsRouter.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
  try {
    const person = await prisma.person.findUnique({
      where: { id },
      include: {
        skills: { include: { skill: true } },
      },
    });
    if (!person) return res.status(404).json({ error: 'Not found' });
    return res.json(person);
  } catch (err) {
    logger.error('GET /persons/:id failed', err as any);
    return next(err);
  }
});

// Create person
personsRouter.post('/', async (req, res, next) => {
  try {
    const input = PersonInputSchema.parse(req.body);
    const created = await prisma.person.create({ data: input as any });
    return res.status(201).json(created);
  } catch (err) {
    logger.error('POST /persons failed', err as any);
    return next(err);
  }
});

// Update person
personsRouter.put('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
  try {
    const input = PersonUpdateSchema.parse(req.body);
    const existing = await prisma.person.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.person.update({ where: { id }, data: input as any });
    return res.json(updated);
  } catch (err) {
    logger.error('PUT /persons/:id failed', err as any);
    return next(err);
  }
});

// Delete person (cascade removes skills and assignments by FK)
personsRouter.delete('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
  try {
    const existing = await prisma.person.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await prisma.person.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    logger.error('DELETE /persons/:id failed', err as any);
    return next(err);
  }
});

// List a person's skills
personsRouter.get('/:id/skills', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
  try {
    const person = await prisma.person.findUnique({
      where: { id },
      include: { skills: { include: { skill: true } } },
    });
    if (!person) return res.status(404).json({ error: 'Not found' });
    return res.json(person.skills);
  } catch (err) {
    logger.error('GET /persons/:id/skills failed', err as any);
    return next(err);
  }
});

// Add a skill to a person
personsRouter.post('/:id/skills', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
  try {
    const { skillId } = SkillInputSchema.parse(req.body);
    // Ensure both entities exist
    const [person, capDef] = await Promise.all([
      prisma.person.findUnique({ where: { id } }),
      prisma.skill.findUnique({ where: { id: skillId } }),
    ]);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    if (!capDef) return res.status(404).json({ error: 'Skill not found' });

    const cap = await prisma.personSkill.upsert({
      where: { personId_skillId: { personId: id, skillId } },
      update: {},
      create: { personId: id, skillId },
      include: { skill: true },
    });
    return res.status(201).json(cap);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Skill already exists' });
    logger.error('POST /persons/:id/skills failed', err);
    return next(err);
  }
});

// Remove a skill from a person
personsRouter.delete('/:id/skills/:skillId', async (req, res, next) => {
  const id = Number(req.params.id);
  const skillId = Number(req.params.skillId);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(skillId) || skillId <= 0) {
    return res.status(400).json({ error: 'invalid id' });
  }
  try {
    await prisma.personSkill.delete({
      where: { personId_skillId: { personId: id, skillId } },
    });
    return res.status(204).send();
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Skill not found' });
    logger.error('DELETE /persons/:id/skills/:skillId failed', err);
    return next(err);
  }
});

// List assignments for a match
personsRouter.get('/matches/:matchId/assignments', async (req, res, next) => {
  const matchId = Number(req.params.matchId);
  if (!Number.isInteger(matchId) || matchId <= 0) return res.status(400).json({ error: 'invalid match id' });
  try {
    const items = await prisma.matchRoleAssignment.findMany({
      where: { matchScheduleId: matchId },
      include: { person: true, skill: true },
      orderBy: { id: 'asc' },
    });
    return res.json(items);
  } catch (err) {
    logger.error('GET /matches/:matchId/assignments failed', err as any);
    return next(err);
  }
});

// Create assignment for a match
personsRouter.post('/matches/:matchId/assignments', async (req, res, next) => {
  const matchId = Number(req.params.matchId);
  if (!Number.isInteger(matchId) || matchId <= 0) return res.status(400).json({ error: 'invalid match id' });
  try {
    const { skillId, personId } = AssignmentCreateSchema.parse(req.body);

    // Validate entities exist
    const [match, person, capDef] = await Promise.all([
      prisma.matchSchedule.findUnique({ where: { id: matchId } }),
      prisma.person.findUnique({ where: { id: personId } }),
      prisma.skill.findUnique({ where: { id: skillId } }),
    ]);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (!person) return res.status(404).json({ error: 'Person not found' });
    if (!capDef) return res.status(404).json({ error: 'Skill not found' });

    // Validate skill
    const hasSkill = await prisma.personSkill.findUnique({
      where: { personId_skillId: { personId, skillId } },
    });
    if (!hasSkill) return res.status(422).json({ error: 'Person lacks required skill for this role' });

    const created = await prisma.matchRoleAssignment.create({
      data: { matchScheduleId: matchId, personId, skillId },
      include: { person: true, skill: true },
    });
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'This person already has this role for this match' });
    logger.error('POST /matches/:matchId/assignments failed', err);
    return next(err);
  }
});

// Update an assignment
personsRouter.patch('/matches/:matchId/assignments/:assignmentId', async (req, res, next) => {
  const matchId = Number(req.params.matchId);
  const assignmentId = Number(req.params.assignmentId);
  if (!Number.isInteger(matchId) || matchId <= 0 || !Number.isInteger(assignmentId) || assignmentId <= 0) {
    return res.status(400).json({ error: 'invalid id' });
  }
  try {
    const input = AssignmentUpdateSchema.parse(req.body);

    const existing = await prisma.matchRoleAssignment.findUnique({ where: { id: assignmentId } });
    if (!existing || existing.matchScheduleId !== matchId) return res.status(404).json({ error: 'Not found' });

    const nextPersonId = input.personId ?? existing.personId;
    const nextSkillId = input.skillId ?? existing.skillId;

    // Validate skill
    const hasSkill = await prisma.personSkill.findUnique({
      where: { personId_skillId: { personId: nextPersonId, skillId: nextSkillId } },
    });
    if (!hasSkill) return res.status(422).json({ error: 'Person lacks required skill for this role' });

    const updated = await prisma.matchRoleAssignment.update({
      where: { id: assignmentId },
      data: { personId: nextPersonId, skillId: nextSkillId },
      include: { person: true, skill: true },
    });
    return res.json(updated);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'This person already has this role for this match' });
    logger.error('PATCH /matches/:matchId/assignments/:assignmentId failed', err);
    return next(err);
  }
});

// Delete an assignment
personsRouter.delete('/matches/:matchId/assignments/:assignmentId', async (req, res, next) => {
  const matchId = Number(req.params.matchId);
  const assignmentId = Number(req.params.assignmentId);
  if (!Number.isInteger(matchId) || matchId <= 0 || !Number.isInteger(assignmentId) || assignmentId <= 0) {
    return res.status(400).json({ error: 'invalid id' });
  }
  try {
    const existing = await prisma.matchRoleAssignment.findUnique({ where: { id: assignmentId } });
    if (!existing || existing.matchScheduleId !== matchId) return res.status(404).json({ error: 'Not found' });
    await prisma.matchRoleAssignment.delete({ where: { id: assignmentId } });
    return res.status(204).send();
  } catch (err) {
    logger.error('DELETE /matches/:matchId/assignments/:assignmentId failed', err as any);
    return next(err);
  }
});
