import {Router} from 'express';
import {prisma} from '../services/prisma';
import {z} from 'zod';
import type {PositionCategory} from '@prisma/client';
import {resolveSeasonId} from '../services/season';
import {amsterdamDay, amsterdamDayRange} from '../utils/time';
import {getDayPlanningSettings, planDay} from '../services/dayPlanning';
import {liveEnds} from '../services/productionTiming';

export const reportsRouter: Router = Router();

// Schema for date query parameter
const DateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
});

// 1. Overzicht van de bezetting per persoon op 1 dag
// GET /api/reports/daily-occupancy?date=YYYY-MM-DD
reportsRouter.get('/daily-occupancy', async (req, res, next) => {
  try {
    const { date } = DateQuerySchema.parse(req.query);
    // The Amsterdam day, whatever the server's zone
    const {start: startOfDay, end: nextDay} = amsterdamDayRange(date);
    const endOfDay = new Date(nextDay.getTime() - 1);

    // Find all productions on this day
    const productions = await prisma.production.findMany({
      where: {
        matchSchedule: {
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      },
      include: {
        matchSchedule: true,
        productionPersons: true, // NIEUW: Aanwezigheidsregistratie ophalen
        segments: {
          select: {
            duurInMinuten: true
          }
        },
        productionPositions: {
          orderBy: {
            position: {
              sortOrder: 'asc',
            },
          },
          include: {
            person: true,
            position: {
              include: {
                skill: true
              }
            },
          },
        },
      },
      orderBy: {
        matchSchedule: {
          date: 'asc',
        },
      },
    });

    // Collect all unique persons involved in these productions OR marked as present
    const personMap = new Map<number, { id: number; name: string; hasEntertainmentRole: boolean; assignments: Record<number, string[]>; presence: Record<number, boolean> }>();

    for (const prod of productions) {
      // Mark presence
      for (const pp of prod.productionPersons) {
        if (!personMap.has(pp.personId)) {
          const p = await prisma.person.findUnique({ where: { id: pp.personId } });
          if (p) {
             personMap.set(pp.personId, { id: pp.personId, name: p.name, hasEntertainmentRole: false, assignments: {}, presence: {} });
          }
        }
        const entry = personMap.get(pp.personId);
        if (entry) {
          entry.presence[prod.id] = true;
        }
      }

      // Mark assignments
      for (const pp of prod.productionPositions) {
        if (!personMap.has(pp.personId)) {
          personMap.set(pp.personId, { id: pp.personId, name: pp.person.name, hasEntertainmentRole: false, assignments: {}, presence: {} });
        }
        const entry = personMap.get(pp.personId)!;
        if (!entry.assignments[prod.id]) {
          entry.assignments[prod.id] = [];
        }
        entry.assignments[prod.id].push(pp.position.name);

        // Check if this position is an entertainment role
        if (pp.position.skill?.type === 'entertainment') {
          entry.hasEntertainmentRole = true;
        }
      }
    }

    // Sort persons: first by entertainment role (false first, true last), then by name
    const persons = Array.from(personMap.values()).sort((a, b) => {
      if (a.hasEntertainmentRole !== b.hasEntertainmentRole) {
        return a.hasEntertainmentRole ? 1 : -1; // entertainment roles at the bottom
      }
      return a.name.localeCompare(b.name);
    });

    const ends = await liveEnds(productions);
    // The day planning: opbouw before the first stream, then per stream verzamelen, live and einde
    const planned = planDay(productions, await getDayPlanningSettings());

    return res.json({
      date,
      productions: productions.map(p => {
        const totalDuration = p.segments.reduce((sum, s) => sum + s.duurInMinuten, 0);
        const endLiveTime = ends.get(p.id) ?? null;
        const plan = planned.get(p.id);
        return {
          id: p.id,
          time: p.matchSchedule.date,
          liveTime: p.liveTime, // Include liveTime
          endLiveTime: endLiveTime,
          homeTeam: p.matchSchedule.homeTeamName,
          awayTeam: p.matchSchedule.awayTeamName,
          planning: plan && {
            setupTime: plan.setupTime,
            setupIsDefault: plan.setupIsDefault,
            crewCallTime: plan.crewCallTime,
            crewCallIsDefault: plan.crewCallIsDefault,
            liveStart: plan.liveStart,
            liveEnd: ends.get(p.id) ?? new Date(plan.liveStart.getTime() + totalDuration * 60000),
          },
        };
      }),
      persons,
    });
  } catch (err) {
    return next(err);
  }
});

// 2. Overzicht van de bezetting per positie op 1 dag
// GET /api/reports/daily-occupancy-by-position?date=YYYY-MM-DD
reportsRouter.get('/daily-occupancy-by-position', async (req, res, next) => {
  try {
    const { date } = DateQuerySchema.parse(req.query);
    // The Amsterdam day, whatever the server's zone
    const {start: startOfDay, end: nextDay} = amsterdamDayRange(date);
    const endOfDay = new Date(nextDay.getTime() - 1);

    // Find all productions on this day
    const productions = await prisma.production.findMany({
      where: {
        matchSchedule: {
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      },
      include: {
        matchSchedule: true,
        segments: {
          select: {
            duurInMinuten: true
          }
        },
        productionPositions: {
          include: {
            person: true,
            position: true,
          },
        },
      },
      orderBy: {
        matchSchedule: {
          date: 'asc',
        },
      },
    });

    // Find all unique positions used in these productions (or all positions if we want a complete table)
    // The requirement says "posities netjes gesorteerd moeten zijn op category en hun sorteer volgorde"
    // Let's get all positions to ensure they are all present in the report
    const allPositions = await prisma.position.findMany({
      orderBy: [
        { category: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    });

    // Map positions to their occupants for each production
    const positionMap = new Map<number, { id: number; name: string; category: string; sortOrder: number; assignments: Record<number, string[]> }>();

    for (const pos of allPositions) {
      positionMap.set(pos.id, {
        id: pos.id,
        name: pos.name,
        category: pos.category,
        sortOrder: pos.sortOrder,
        assignments: {}
      });
    }

    for (const prod of productions) {
      for (const pp of prod.productionPositions) {
        const entry = positionMap.get(pp.positionId);
        if (entry) {
          if (!entry.assignments[prod.id]) {
            entry.assignments[prod.id] = [];
          }
          entry.assignments[prod.id].push(pp.person.name);
        }
      }
    }

    // Filter out positions that have no assignments across all productions for this day
    // Or keep them? Usually, for a report per position, showing all positions is clearer.
    // The user said "per positie maken", implying a full list of positions might be expected.
    // Let's keep all positions that have at least one assignment on this day to keep it relevant.
    const categoryOrder = {
      'GENERAL': 3,
      'TECHNICAL': 1,
      'ENTERTAINMENT': 2
    };

    const positions = Array.from(positionMap.values())
      .filter(pos => Object.values(pos.assignments).some(names => names.length > 0))
      .sort((a, b) => {
        const catA = categoryOrder[a.category as keyof typeof categoryOrder] || 99;
        const catB = categoryOrder[b.category as keyof typeof categoryOrder] || 99;
        if (catA !== catB) return catA - catB;
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      });

    const ends = await liveEnds(productions);
    return res.json({
      date,
      productions: productions.map(p => {
        const endLiveTime = ends.get(p.id) ?? null;
        return {
          id: p.id,
          time: p.matchSchedule.date,
          liveTime: p.liveTime,
          endLiveTime: endLiveTime,
          homeTeam: p.matchSchedule.homeTeamName,
          awayTeam: p.matchSchedule.awayTeamName,
        };
      }),
      positions,
    });
  } catch (err) {
    return next(err);
  }
});

// 3. Overzicht van de interviews over alle wedstrijden heen
// GET /api/reports/interviews
reportsRouter.get('/interviews', async (req, res, next) => {
  try {
    const seasonId = await resolveSeasonId(req.query.seasonId);
    const productions = await prisma.production.findMany({
      where: { matchSchedule: { seasonId } },
      include: {
        matchSchedule: true,
        segments: {
          select: {
            duurInMinuten: true
          }
        },
        interviewSubjects: {
          include: {
            player: true,
          },
        },
        productionReport: true,
      },
      orderBy: {
        matchSchedule: {
          date: 'desc', // Most recent first
        },
      },
    });

    const ends = await liveEnds(productions);
    const report = productions.map(p => {
      const homeInterviews = p.interviewSubjects
        .filter(s => s.side === 'HOME')
        .map(s => ({ name: s.player.name, role: s.role, photoUrl: s.player.photoUrl }));
      const awayInterviews = p.interviewSubjects
        .filter(s => s.side === 'AWAY')
        .map(s => ({ name: s.player.name, role: s.role, photoUrl: s.player.photoUrl }));

      const endLiveTime = ends.get(p.id) ?? null;

      return {
        id: p.id,
        date: p.matchSchedule.date,
        liveTime: p.liveTime, // Include liveTime
        endLiveTime: endLiveTime,
        homeTeam: p.matchSchedule.homeTeamName,
        awayTeam: p.matchSchedule.awayTeamName,
        homeInterviews,
        awayInterviews,
        remarks: p.productionReport?.remarks,
        matchSponsor: p.productionReport?.matchSponsor,
        ballSponsor: p.productionReport?.ballSponsor,
      };
    });

    return res.json(report);
  } catch (err) {
    return next(err);
  }
});

// 3. Wie welke rol had, per productie van het seizoen: één kolom per positie van de organisatie.
// GET /api/reports/entertainment-roles (posities met categorie ENTERTAINMENT)
// GET /api/reports/crew-roles (posities met categorie TECHNICAL of GENERAL: regie, camera's, oplopen, ...)
async function rolesReport(categories: PositionCategory[], seasonIdParam: unknown) {
  const seasonId = await resolveSeasonId(seasonIdParam);
  const [positions, productions] = await Promise.all([
    prisma.position.findMany({where: {category: {in: categories}}, orderBy: [{sortOrder: 'asc'}, {name: 'asc'}], select: {id: true, name: true}}),
    prisma.production.findMany({
      where: {matchSchedule: {seasonId}},
      include: {
        matchSchedule: true,
        // As on the Bezetting tab: the production-wide positions plus the ones for a segment only
        segments: {
          select: {
            duurInMinuten: true,
            bezetting: {where: {position: {category: {in: categories}}}, select: {positionId: true, person: {select: {name: true}}}},
          },
        },
        productionPositions: {
          where: {position: {category: {in: categories}}},
          select: {positionId: true, person: {select: {name: true}}},
        },
      },
      orderBy: {matchSchedule: {date: 'desc'}},
    }),
  ]);

  const ends = await liveEnds(productions.map((p) => ({id: p.id, liveTime: p.liveTime, segments: p.segments})));
  return {
    positions,
    productions: productions.map((p) => {
      const byPosition = new Map<number, Set<string>>();
      for (const {positionId, person} of [...p.productionPositions, ...p.segments.flatMap((s) => s.bezetting)]) {
        byPosition.set(positionId, (byPosition.get(positionId) ?? new Set<string>()).add(person.name));
      }
      const assignments: Record<number, string[]> = {};
      for (const [positionId, names] of byPosition) assignments[positionId] = [...names].sort((a, b) => a.localeCompare(b));
      return {
        id: p.id,
        date: p.matchSchedule.date,
        liveTime: p.liveTime,
        endLiveTime: ends.get(p.id) ?? null,
        homeTeam: p.matchSchedule.homeTeamName,
        awayTeam: p.matchSchedule.awayTeamName,
        assignments,
      };
    }),
  };
}

reportsRouter.get('/entertainment-roles', async (req, res, next) => {
  try {
    return res.json(await rolesReport(['ENTERTAINMENT'], req.query.seasonId));
  } catch (err) {
    return next(err);
  }
});

reportsRouter.get('/crew-roles', async (req, res, next) => {
  try {
    return res.json(await rolesReport(['TECHNICAL', 'GENERAL'], req.query.seasonId));
  } catch (err) {
    return next(err);
  }
});

// 5. Ophalen van alle datums waarop er producties zijn
// GET /api/reports/production-dates
reportsRouter.get('/production-dates', async (req, res, next) => {
  try {
    const seasonId = await resolveSeasonId(req.query.seasonId);
    const productions = await prisma.production.findMany({
      where: { matchSchedule: { seasonId } },
      select: {
        matchSchedule: {
          select: {
            date: true,
          },
        },
      },
      orderBy: {
        matchSchedule: {
          date: 'asc',
        },
      },
    });

    const dates = productions.map(p => amsterdamDay(p.matchSchedule.date));
    const uniqueDates = Array.from(new Set(dates));

    return res.json(uniqueDates);
  } catch (err) {
    return next(err);
  }
});

// 6. Ophalen van de datum van de eerstvolgende productie (vanaf vandaag)
// GET /api/reports/next-production-date
reportsRouter.get('/next-production-date', async (req, res, next) => {
  try {
    const today = amsterdamDayRange(amsterdamDay(new Date())).start;

    const nextProduction = await prisma.production.findFirst({
      where: {
        matchSchedule: {
          date: {
            gte: today,
          },
        },
      },
      select: {
        matchSchedule: {
          select: {
            date: true,
          },
        },
      },
      orderBy: {
        matchSchedule: {
          date: 'asc',
        },
      },
    });

    if (!nextProduction) {
      return res.json(null);
    }

    return res.json(amsterdamDay(nextProduction.matchSchedule.date));
  } catch (err) {
    return next(err);
  }
});
