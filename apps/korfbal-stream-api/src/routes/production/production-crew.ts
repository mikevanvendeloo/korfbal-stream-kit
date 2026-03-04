import { Router } from 'express';
import { prisma } from '../../services/prisma';
import { PositionCategory } from '@prisma/client';

export const productionCrewRouter: Router = Router();

productionCrewRouter.get('/:id/crew', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const assignments = await prisma.productionPersonPosition.findMany({
      where: { productionId: id },
      include: {
        person: true,
        position: {
          include: {
            skill: true,
          },
        },
      },
      orderBy: [
        { position: { category: 'asc' } },
        { position: { sortOrder: 'asc' } },
        { person: { name: 'asc' } },
      ],
    });

    // Group by person
    const groupedByPerson = assignments.reduce((acc, curr) => {
      const personId = curr.personId;
      if (!acc[personId]) {
        acc[personId] = {
          person: curr.person,
          positions: [],
        };
      }
      acc[personId].positions.push(curr.position);
      return acc;
    }, {} as Record<number, { person: any; positions: any[] }>);

    const allCrew = Object.values(groupedByPerson).sort((a, b) => a.person.name.localeCompare(b.person.name));

    // Split into categories
    const crewByCategory: Record<string, typeof allCrew> = {
      [PositionCategory.ENTERTAINMENT]: [],
      [PositionCategory.TECHNICAL]: [],
      [PositionCategory.GENERAL]: [],
    };

    allCrew.forEach(item => {
      // Assign person to the category of their FIRST position for simplicity
      const category = item.positions[0]?.category || PositionCategory.GENERAL;
      crewByCategory[category].push(item);
    });

    return res.json(crewByCategory);
  } catch (err) {
    return next(err);
  }
});
