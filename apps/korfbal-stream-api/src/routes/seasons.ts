import {Router} from 'express';
import {prisma} from '../services/prisma';
import {
  clearSeasonCache,
  findSeasonOrThrow,
  getActiveSeason,
  SEASON_COUNTS_INCLUDE,
  SeasonDto,
  seasonNameForStartYear,
  seasonStartYearForDate,
  setActiveSeason,
  toSeasonDto,
} from '../services/season';
import {emitSeasonChanged} from '../services/socket';
import {CreateSeasonSchema, SeasonIdParamSchema, SetActiveSeasonSchema} from '../schemas/season';

export const seasonsRouter: Router = Router();

const SEASON_EXISTS = 'Seizoen bestaat al';
const SEASON_NOT_EMPTY = 'Seizoen bevat nog wedstrijden of spelers';

function prismaCode(err: unknown): string | undefined {
  return (err as { code?: string })?.code;
}

async function seasonDtoById(id: number, activeSeasonId: number): Promise<SeasonDto> {
  return toSeasonDto(await findSeasonOrThrow(id, SEASON_COUNTS_INCLUDE), activeSeasonId);
}

// GET /api/seasons
seasonsRouter.get('/', async (_req, res, next) => {
  try {
    const active = await getActiveSeason();
    const seasons = await prisma.season.findMany({orderBy: {startYear: 'desc'}, include: SEASON_COUNTS_INCLUDE});
    return res.json(seasons.map((s) => toSeasonDto(s, active.id)));
  } catch (err) {
    return next(err);
  }
});

// GET /api/seasons/active
seasonsRouter.get('/active', async (_req, res, next) => {
  try {
    const active = await getActiveSeason();
    return res.json(await seasonDtoById(active.id, active.id));
  } catch (err) {
    return next(err);
  }
});

// GET /api/seasons/suggest-next
seasonsRouter.get('/suggest-next', async (_req, res, next) => {
  try {
    const latest = await prisma.season.findFirst({orderBy: {startYear: 'desc'}, select: {startYear: true}});
    const startYear = (latest?.startYear ?? seasonStartYearForDate(new Date())) + 1;
    return res.json({startYear, name: seasonNameForStartYear(startYear)});
  } catch (err) {
    return next(err);
  }
});

// POST /api/seasons
seasonsRouter.post('/', async (req, res, next) => {
  try {
    const {name: startYear, activate} = CreateSeasonSchema.parse(req.body ?? {});
    const existing = await prisma.season.findUnique({where: {startYear}});
    if (existing) return res.status(409).json({error: SEASON_EXISTS});

    const created = await prisma.season.create({data: {startYear, name: seasonNameForStartYear(startYear)}});
    const activeId = activate ? (await setActiveSeason(created.id)).id : (await getActiveSeason()).id;
    const dto = await seasonDtoById(created.id, activeId);
    if (activate) emitSeasonChanged(dto);
    return res.status(201).json(dto);
  } catch (err) {
    if (prismaCode(err) === 'P2002') return res.status(409).json({error: SEASON_EXISTS});
    return next(err);
  }
});

// PUT /api/seasons/active
seasonsRouter.put('/active', async (req, res, next) => {
  try {
    const {seasonId} = SetActiveSeasonSchema.parse(req.body ?? {});
    const season = await setActiveSeason(seasonId);
    const dto = await seasonDtoById(season.id, season.id);
    emitSeasonChanged(dto);
    return res.json(dto);
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/seasons/:id
seasonsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = SeasonIdParamSchema.parse(req.params.id);
    const season = await findSeasonOrThrow(id, SEASON_COUNTS_INCLUDE);

    const active = await getActiveSeason();
    if (active.id === season.id) {
      return res.status(409).json({error: 'Het actieve seizoen kan niet worden verwijderd'});
    }
    if (season._count.matches > 0 || season._count.players > 0) {
      return res.status(409).json({error: SEASON_NOT_EMPTY});
    }

    await prisma.season.delete({where: {id}});
    clearSeasonCache();
    return res.status(204).send();
  } catch (err) {
    // A match or player created between the count check and the delete (onDelete: Restrict).
    if (prismaCode(err) === 'P2003') return res.status(409).json({error: SEASON_NOT_EMPTY});
    return next(err);
  }
});
