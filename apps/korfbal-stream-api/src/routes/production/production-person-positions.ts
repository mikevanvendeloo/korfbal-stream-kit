import {Router} from 'express';
import {prisma} from '../../services/prisma';

export const productionPersonPositionsRouter: Router = Router();

// -------- Production-wide Person-Position Assignments --------
// List production-wide person-position assignments
productionPersonPositionsRouter.get('/:id/person-positions', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid production id' });
    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Production not found' });

    const items = await prisma.productionPersonPosition.findMany({
      where: { productionId: id },
      include: { person: true, position: true },
      orderBy: [{ person: { name: 'asc' } }, { position: { name: 'asc' } }],
    });
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});

// Create a production-wide person-position assignment
productionPersonPositionsRouter.post('/:id/person-positions', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid production id' });
    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Production not found' });

    const personId = Number(req.body?.personId);
    const positionId = Number(req.body?.positionId);
    if (!Number.isInteger(personId) || personId <= 0 || !Number.isInteger(positionId) || positionId <= 0) {
      return res.status(400).json({ error: 'Invalid personId or positionId' });
    }

    const [person, position] = await Promise.all([
      prisma.person.findUnique({ where: { id: personId } }),
      prisma.position.findUnique({ where: { id: positionId } }),
    ]);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    if (!position) return res.status(404).json({ error: 'Position not found' });

    const created = await prisma.productionPersonPosition.create({
      data: { productionId: id, personId, positionId },
      include: { person: true, position: true },
    });
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Duplicate production-wide assignment' });
    return next(err);
  }
});

// Delete a production-wide person-position assignment
productionPersonPositionsRouter.delete('/:id/person-positions/:personPositionId', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid production id' });
    const personPositionId = Number(req.params.personPositionId);
    if (!Number.isInteger(personPositionId) || personPositionId <= 0) {
      return res.status(400).json({ error: 'Invalid personPositionId' });
    }

    const existing = await prisma.productionPersonPosition.findUnique({ where: { id: personPositionId } });
    if (!existing || existing.productionId !== id) return res.status(404).json({ error: 'Not found' });

    await prisma.productionPersonPosition.delete({ where: { id: personPositionId } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});
