import {Router} from 'express';
import {prisma} from '../../services/prisma';
import {crewGroupOf, positionCategoriesBySkill} from '../../domain/crewGroup';
import {computeMinimumStaffing} from '../../domain/minimumStaffing';

export const productionPersonsRouter: Router = Router();

// -------- Production Persons (attendance tracking) --------
// These routes must be defined BEFORE productionRouter.use('/persons', personsRouter)
// List persons marked as present for a production
productionPersonsRouter.get('/:id/persons', async (req, res, next) => {
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

// GET /api/production/:id/attendance -> everything the Beschikbaarheid tab shows: every person of the
// organization (no paging) with their group (crew/entertainment, from the positions of their skills),
// skill codes and presence, and the minimum staffing of the people present (domain/minimumStaffing.ts)
productionPersonsRouter.get('/:id/attendance', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id }, select: { id: true } });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const [persons, presences, positions, skills] = await Promise.all([
      prisma.person.findMany({
        select: { id: true, name: true, gender: true, skills: { select: { skill: { select: { id: true, code: true, name: true } } } } },
        orderBy: { name: 'asc' },
      }),
      prisma.productionPerson.findMany({ where: { productionId: id }, select: { id: true, personId: true } }),
      prisma.position.findMany({ select: { skillId: true, category: true } }),
      prisma.skill.findMany({ select: { code: true } }),
    ]);
    const presenceByPerson = new Map(presences.map((p) => [p.personId, p.id]));
    const categoriesBySkill = positionCategoriesBySkill(positions);

    const items = persons.map((p) => ({
      id: p.id,
      name: p.name,
      gender: p.gender,
      group: crewGroupOf(p.skills.map((s) => s.skill.id), categoriesBySkill),
      skills: p.skills.map((s) => ({ code: s.skill.code, name: s.skill.name })),
      productionPersonId: presenceByPerson.get(p.id) ?? null,
    }));
    const staffing = computeMinimumStaffing(
      items.filter((p) => p.productionPersonId !== null).map((p) => ({ id: p.id, skillCodes: p.skills.map((s) => s.code) })),
      skills.map((s) => s.code),
    );
    return res.json({ persons: items, staffing });
  } catch (err) {
    return next(err);
  }
});

// Add person to production (mark as present)
productionPersonsRouter.post('/:id/persons', async (req, res, next) => {
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
productionPersonsRouter.delete('/:id/persons/:productionPersonId', async (req, res, next) => {
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
