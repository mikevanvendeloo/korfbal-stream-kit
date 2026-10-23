import {Router} from 'express';
import {z} from 'zod';
import {prisma} from '../../services/prisma';
import {findClubByTeamName} from '../../utils/clubs';
import {logger} from '../../utils/logger';
import {loadInterviewNames} from '../../services/interviewPlaceholders';
import {emitToOrganization} from '../../services/socket';

/** Socket event after the interview choice of a production changed; payload {productionId}. */
export const INTERVIEWS_UPDATED_EVENT = 'interviews_updated';

export const productionInterviewsRouter: Router = Router();

// ---------------- Interview subjects (per production) ----------------

const InterviewSideEnum = z.enum(['HOME', 'AWAY', 'NONE']);
const InterviewRoleEnum = z.enum(['PLAYER', 'COACH']);

const InterviewSubjectInputSchema = z.object({
  side: InterviewSideEnum,
  role: InterviewRoleEnum,
  playerId: z.number().int().positive(),
  titleDefinitionId: z.number().int().positive().optional().nullable(),
  titleOrder: z.number().int().positive().optional().nullable(),
});

// Selected interview names per side/role plus the own club's side, for the {coach-uit} placeholders in callsheets
productionInterviewsRouter.get('/:id/interview-names', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const names = await loadInterviewNames(id);
    if (!names) return res.status(404).json({ error: 'Not found' });
    return res.json(names);
  } catch (err) {
    return next(err);
  }
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
    return res.json(await sortByTitleOrder(id, items));
  } catch (err) {
    return next(err);
  }
});

// The chosen interviews as cards for the LIVE Interviews screen: only what the cards show
productionInterviewsRouter.get('/:id/interview-cards', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({
      where: { id },
      select: { matchSchedule: { select: { homeTeamName: true, awayTeamName: true } } },
    });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const subjects = await prisma.interviewSubject.findMany({
      where: { productionId: id },
      orderBy: { id: 'asc' },
      select: {
        id: true, side: true, role: true, titleDefinitionId: true,
        titleDefinition: { select: { name: true } },
        player: { select: { name: true, shirtNo: true, photoUrl: true, club: { select: { name: true, shortName: true } } } },
      },
    });
    const sorted = await sortByTitleOrder(id, subjects);
    const teamName = (s: (typeof subjects)[number]) =>
      s.side === 'HOME' ? prod.matchSchedule.homeTeamName
        : s.side === 'AWAY' ? prod.matchSchedule.awayTeamName
          : s.player.club?.shortName || s.player.club?.name || null;
    return res.json({
      items: sorted.map((s) => ({
        id: s.id,
        side: s.side,
        role: s.role,
        title: s.titleDefinition?.name ?? null,
        name: s.player.name,
        shirtNo: s.player.shirtNo ?? null,
        photoUrl: s.player.photoUrl ?? null,
        teamName: teamName(s),
      })),
    });
  } catch (err) {
    return next(err);
  }
});

/** Interview subjects in the order of their title definitions (the production's, else the templates), then by id. */
async function sortByTitleOrder<T extends { id: number; titleDefinitionId: number | null }>(productionId: number, items: T[]): Promise<T[]> {
  let titleDefs: Array<{ id: number }> = await prisma.titleDefinition.findMany({
    where: { productionId, enabled: true },
    orderBy: { order: 'asc' },
    select: { id: true },
  });
  // If no production-specific definitions, use the templates
  if (titleDefs.length === 0) {
    titleDefs = await prisma.titleDefinition.findMany({
      where: { productionId: null, enabled: true },
      orderBy: { order: 'asc' },
      select: { id: true },
    });
  }
  const orderMap = new Map<number, number>();
  titleDefs.forEach((def, index) => orderMap.set(def.id, index));

  return [...items].sort((a, b) => {
    // If both have titleDefinitionId, sort by the order of that definition
    if (a.titleDefinitionId && b.titleDefinitionId) {
      const orderA = orderMap.get(a.titleDefinitionId) ?? Number.MAX_SAFE_INTEGER;
      const orderB = orderMap.get(b.titleDefinitionId) ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
    }
    return a.id - b.id;
  });
}

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
    const prod = await prisma.production.findUnique({ where: { id }, include: { matchSchedule: true } });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const parsed = BulkSaveSchema.parse(req.body || {});

    // Helpers for validation
    const ms = prod.matchSchedule;
    const homeClub = await findClubByTeamName(prisma as any, ms.homeTeamName);
    const awayClub = await findClubByTeamName(prisma as any, ms.awayTeamName);
    if (!homeClub && !awayClub) {
      return res.status(400).json({ error: 'Could not resolve clubs for production match' });
    }

    await prisma.$transaction(async (tx) => {
      // Players already linked to this production stay valid even when they belong to another season:
      // productions from before the season split may sit in a newer season than their linked players.
      const linkedPlayerIds = new Set(
        (await tx.interviewSubject.findMany({ where: { productionId: id }, select: { playerId: true } }))
          .map((s) => s.playerId),
      );
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
        if (player.seasonId !== ms.seasonId && !linkedPlayerIds.has(player.id)) {
          throw Object.assign(new Error('Player does not belong to the season of this match'), { status: 400 });
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
    // LIVE screens (Interviews, callsheet photos) refetch at once instead of on their next poll
    emitToOrganization(INTERVIEWS_UPDATED_EVENT, { productionId: id });
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
    const prod = await prisma.production.findUnique({ where: { id }, include: { matchSchedule: true } });
    if (!prod) return res.status(404).json({ error: 'Not found' });
    const ms = prod.matchSchedule;

    const club = side === 'HOME'
      ? await findClubByTeamName(prisma as any, ms.homeTeamName)
      : await findClubByTeamName(prisma as any, ms.awayTeamName);
    if (!club) {
      logger.info('🎤 interviews/options – no club resolved', {
        productionId: id,
        side,
        role,
        homeTeamName: ms.homeTeamName,
        awayTeamName: ms.awayTeamName,
      });
      return res.json({ items: [] });
    }

    const isPlayer = role === 'PLAYER';

    // Build role-aware filtering: many rows may not have personType set, so also use function text
    // Players are per season: use the season of the production's match, not the active season
    const where: any = {
      clubId: club.id,
      seasonId: ms.seasonId,
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
    return res.json({ items: items.map((p: any) => ({ id: p.id, name: p.name, function: p.function ?? null, image: p.photoUrl ?? null })) });
  } catch (err) {
    console.error('Error in GET /:id/interviews/options:', err); // Added logging
    return next(err);
  }
});
