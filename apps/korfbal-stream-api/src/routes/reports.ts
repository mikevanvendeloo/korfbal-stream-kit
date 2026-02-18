import {Router} from 'express';
import {prisma} from '../services/prisma';
import {z} from 'zod';

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
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

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

    // Collect all unique persons involved in these productions
    const personMap = new Map<number, { id: number; name: string; assignments: Record<number, string[]> }>();

    for (const prod of productions) {
      for (const pp of prod.productionPositions) {
        if (!personMap.has(pp.personId)) {
          personMap.set(pp.personId, { id: pp.personId, name: pp.person.name, assignments: {} });
        }
        const entry = personMap.get(pp.personId)!;
        if (!entry.assignments[prod.id]) {
          entry.assignments[prod.id] = [];
        }
        entry.assignments[prod.id].push(pp.position.name);
      }
    }

    const persons = Array.from(personMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return res.json({
      date,
      productions: productions.map(p => ({
        id: p.id,
        time: p.matchSchedule.date,
        homeTeam: p.matchSchedule.homeTeamName,
        awayTeam: p.matchSchedule.awayTeamName,
      })),
      persons,
    });
  } catch (err) {
    return next(err);
  }
});

// 2. Overzicht van de interviews over alle wedstrijden heen
// GET /api/reports/interviews
reportsRouter.get('/interviews', async (req, res, next) => {
  try {
    const productions = await prisma.production.findMany({
      include: {
        matchSchedule: true,
        interviewSubjects: {
          include: {
            player: true,
          },
        },
      },
      orderBy: {
        matchSchedule: {
          date: 'desc', // Most recent first
        },
      },
    });

    const report = productions.map(p => {
      const homeInterviews = p.interviewSubjects
        .filter(s => s.side === 'HOME')
        .map(s => ({ name: s.player.name, role: s.role }));
      const awayInterviews = p.interviewSubjects
        .filter(s => s.side === 'AWAY')
        .map(s => ({ name: s.player.name, role: s.role }));

      return {
        id: p.id,
        date: p.matchSchedule.date,
        homeTeam: p.matchSchedule.homeTeamName,
        awayTeam: p.matchSchedule.awayTeamName,
        homeInterviews,
        awayInterviews,
      };
    });

    return res.json(report);
  } catch (err) {
    return next(err);
  }
});

// 3. Overzicht van alle wedstrijden met specifieke rollen (Speaker, Regisseur, Presentator, Analist)
// GET /api/reports/crew-roles
reportsRouter.get('/crew-roles', async (req, res, next) => {
  try {
    // Define the skill codes we are interested in
    const targetSkillCodes = ['SPEAKER', 'REGISSEUR', 'PRESENTATIE', 'ANALIST'];

    const productions = await prisma.production.findMany({
      include: {
        matchSchedule: true,
        productionPositions: {
          where: {
            position: {
              skill: {
                code: { in: targetSkillCodes }
              }
            }
          },
          include: {
            person: true,
            position: {
              include: {
                skill: true
              }
            }
          }
        }
      },
      orderBy: {
        matchSchedule: {
          date: 'desc',
        },
      },
    });

    const report = productions.map(p => {
      const roles: Record<string, string[]> = {
        SPEAKER: [],
        REGISSEUR: [],
        PRESENTATIE: [],
        ANALIST: []
      };

      for (const pp of p.productionPositions) {
        const code = pp.position.skill?.code;
        if (code && roles[code]) {
          roles[code].push(pp.person.name);
        }
      }

      return {
        id: p.id,
        date: p.matchSchedule.date,
        homeTeam: p.matchSchedule.homeTeamName,
        awayTeam: p.matchSchedule.awayTeamName,
        speaker: roles['SPEAKER'],
        regisseur: roles['REGISSEUR'],
        presentator: roles['PRESENTATIE'],
        analist: roles['ANALIST'],
      };
    });

    return res.json(report);
  } catch (err) {
    return next(err);
  }
});
