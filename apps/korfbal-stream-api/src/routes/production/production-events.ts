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
    const { eventType, timestamp, metadata } = req.body;

    if (!eventType) {
      return res.status(400).json({ error: 'eventType is required' });
    }

    if (!timestamp) {
      return res.status(400).json({ error: 'timestamp is required' });
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
        eventType,
        timestamp: new Date(timestamp),
        metadata: metadata || null,
      },
    });

    return res.status(201).json(event);
  } catch (err: any) {
    // Handle invalid enum value
    if (err?.code === 'P2000' || err?.message?.includes('Invalid value')) {
      return res.status(400).json({
        error: 'Invalid eventType. Valid values are: STREAM_START, STREAM_STOP, AD_START, INTRO_VIDEO_START'
      });
    }
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
      orderBy: { timestamp: 'asc' },
    });

    return res.json({ items: events, total: events.length });
  } catch (err) {
    return next(err);
  }
});

// GET /api/production/:id/events/:eventId - Get a specific event
productionEventsRouter.get('/:id/events/:eventId', async (req, res, next) => {
  const productionId = Number(req.params.id);
  const eventId = Number(req.params.eventId);

  if (!Number.isInteger(productionId) || productionId <= 0) {
    return res.status(400).json({ error: 'Invalid production id' });
  }

  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ error: 'Invalid event id' });
  }

  try {
    const event = await prisma.productionEvent.findFirst({
      where: {
        id: eventId,
        productionId,
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
  const eventId = Number(req.params.eventId);

  if (!Number.isInteger(productionId) || productionId <= 0) {
    return res.status(400).json({ error: 'Invalid production id' });
  }

  if (!Number.isInteger(eventId) || eventId <= 0) {
    return res.status(400).json({ error: 'Invalid event id' });
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
