import {Router} from 'express';
import {prisma} from '../../services/prisma';

export const productionEventsRouter: Router = Router();

// POST /api/production/:id/events - Log a new event for a production
productionEventsRouter.post('/:id/events', async (req, res, next) => {
  const productionId = Number(req.params.id);
  if (!Number.isInteger(productionId) || productionId <= 0) {
    return res.status(400).json({ error: 'Invalid production id' });
  }

  try {
    const { title, vMixInputName, metadata, order, triggerSource, note, durationSec, positionIds } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    if (order === undefined) {
      return res.status(400).json({ error: 'order is required' });
    }

    // Verify production exists
    const production = await prisma.production.findUnique({
      where: { id: productionId },
    });

    if (!production) {
      return res.status(404).json({ error: 'Production not found' });
    }

    // Create the event
    const event = await prisma.productionEvent.create({
      data: {
        productionId,
        title,
        vMixInputName,
        metadata: metadata || null,
        order,
        triggerSource,
        note,
        durationSec,
        positions: {
          create: positionIds.map((positionId: number) => ({
            position: {
              connect: { id: positionId },
            },
          })),
        },
      },
      include: {
        positions: {
          include: {
            position: true,
          },
        },
      },
    });

    return res.status(201).json(event);
  } catch (err: any) {
    return next(err);
  }
});

// GET /api/production/:id/events - Get all events for a production, ordered by timestamp
productionEventsRouter.get('/:id/events', async (req, res, next) => {
  const productionId = Number(req.params.id);
  if (!Number.isInteger(productionId) || productionId <= 0) {
    return res.status(400).json({ error: 'Invalid production id' });
  }

  try {
    // Verify production exists
    const production = await prisma.production.findUnique({
      where: { id: productionId },
    });

    if (!production) {
      return res.status(404).json({ error: 'Production not found' });
    }

    const events = await prisma.productionEvent.findMany({
      where: { productionId },
      orderBy: { order: 'asc' },
      include: {
        positions: {
          include: {
            position: true,
          },
        },
        parent: true,
        linkedItems: true,
      },
    });

    return res.json({ items: events, total: events.length });
  } catch (err) {
    return next(err);
  }
});

// GET /api/production/:id/events/positions - Get all unique positions used in events for a production
productionEventsRouter.get('/:id/events/positions', async (req, res, next) => {
  const productionId = Number(req.params.id);
  if (!Number.isInteger(productionId) || productionId <= 0) {
    return res.status(400).json({ error: 'Invalid production id' });
  }

  try {
    // Haal alle ProductionEventPosition records op voor deze productie
    const eventPositions = await prisma.productionEventPosition.findMany({
      where: {
        event: {
          productionId: productionId,
        },
      },
      include: {
        position: true, // Includeer de details van de positie
      },
      distinct: ['positionId'], // Zorg ervoor dat elke positie maar één keer voorkomt
    });

    // Extraheer de unieke posities
    const uniquePositions = eventPositions.map((ep) => ep.position);

    return res.json(uniquePositions);
  } catch (err) {
    return next(err);
  }
});


// GET /api/production/:id/events/:eventId - Get a specific event
productionEventsRouter.get('/:id/events/:eventId', async (req, res, next) => {
  const productionId = Number(req.params.id);
  const eventId = req.params.eventId;

  if (!Number.isInteger(productionId) || productionId <= 0) {
    return res.status(400).json({ error: 'Invalid production id' });
  }

  try {
    const event = await prisma.productionEvent.findFirst({
      where: {
        id: eventId,
        productionId,
      },
      include: {
        positions: {
          include: {
            position: true,
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    return res.json(event);
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/production/:id/events/:eventId - Delete a specific event
productionEventsRouter.delete('/:id/events/:eventId', async (req, res, next) => {
  const productionId = Number(req.params.id);
  const eventId = req.params.eventId;

  if (!Number.isInteger(productionId) || productionId <= 0) {
    return res.status(400).json({ error: 'Invalid production id' });
  }

  try {
    // Verify event exists and belongs to this production
    const event = await prisma.productionEvent.findFirst({
      where: {
        id: eventId,
        productionId,
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await prisma.productionEvent.delete({
      where: { id: eventId },
    });

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});
