import {Router} from 'express';
import {z} from 'zod';
import {prisma} from '../../services/prisma';
import {findClubByTeamName} from '../../utils/clubs';
import {logger} from '../../utils/logger';

export const productionInterviewsRouter: Router = Router();

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
productionInterviewsRouter.get('/:id/interviews', async (req, res, next) => {
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

    // Sort items based on title definitions order if available
    // 1. Get all title definitions for this production (or global templates if none)
    // 2. Map interview items to their corresponding title definition order
    // 3. Sort items based on that order

    // Fetch title definitions for this production
    let titleDefs = await (prisma as any).titleDefinition.findMany({
      where: { productionId: id, enabled: true },
      orderBy: { order: 'asc' },
      select: { id: true, order: true }
    });

    // If no production-specific definitions, fetch global templates
    if (titleDefs.length === 0) {
      titleDefs = await (prisma as any).titleDefinition.findMany({
        where: { productionId: null, enabled: true },
        orderBy: { order: 'asc' },
        select: { id: true, order: true }
      });
    }

    // Create a map for quick lookup of order by titleDefinitionId
    const orderMap = new Map<number, number>();
    titleDefs.forEach((def: any, index: number) => {
      orderMap.set(def.id, index);
    });

    // Sort items
    const sortedItems = items.sort((a: any, b: any) => {
      // If both have titleDefinitionId, sort by the order of that definition
      if (a.titleDefinitionId && b.titleDefinitionId) {
        const orderA = orderMap.get(a.titleDefinitionId) ?? Number.MAX_SAFE_INTEGER;
        const orderB = orderMap.get(b.titleDefinitionId) ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
      }

      // Fallback to ID sorting if no title definition or same order (shouldn't happen for different defs)
      return a.id - b.id;
    });

    return res.json(sortedItems);
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

productionInterviewsRouter.put('/:id/interviews', async (req, res, next) => {
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
        const isCoachFn = player.personType === 'coach' || player.personType === 'assistant-coach' || fn.includes('coach');
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
productionInterviewsRouter.get('/:id/interviews/options', async (req, res, next) => {
  try {
    logger.info('🎤 interviews/options')
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
            { function: { contains: 'speler', mode: 'insensitive' } },
          ]
        : [
            { personType: { equals: 'coach' } },
            { personType: { equals: 'assistant-coach' } },
            { function: { contains: 'coach', mode: 'insensitive' } },
          ],
    };

    const rows = await prisma.player.findMany({
      where,
      orderBy: [{ name: 'asc' } as any],
    });
    logger.info('🎤 interviews/options – raw candidates', { productionId: id, side, role })
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
    return res.json({ items: items.map((p: any) => ({ id: p.id, name: p.name, function: p.function ?? null, image: p.image ?? null })) });
  } catch (err) {
    console.error('Error in GET /:id/interviews/options:', err); // Added logging
    return next(err);
  }
});
