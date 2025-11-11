import {Router} from 'express';
import {prisma} from '../services/prisma';
import {logger} from '../utils/logger';

export const vmixRouter: Router = Router();

// POST /api/vmix/sponsor-rows
// Body: { sponsorIds?: number[] }
// Response: Array<{ subject: string; image1: string; image2: string; image3: string }>
vmixRouter.post('/sponsor-rows', async (req, res, next) => {
  try {
    const sponsorIds = Array.isArray((req.body?.sponsorIds as any)) ? (req.body.sponsorIds as any).map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n)) : undefined;

    // Load sponsors to use
    const sponsors = await prisma.sponsor.findMany({
      where: sponsorIds && sponsorIds.length > 0 ? { id: { in: sponsorIds } } : {
        type: { in: ['premium', 'goud', 'zilver'] as any },
      },
      orderBy: { id: 'asc' },
    });

    const sponsorLogos = sponsors.map((s) => (s.logoUrl || '').trim()).filter(Boolean);
    if (sponsorLogos.length < 3) {
      return res.status(400).json({ error: 'Need at least 3 sponsors' });
    }

    // Load player images (subjects)
    const players = await (prisma as any).playerImage.findMany({ orderBy: { id: 'asc' } });
    if (!players || players.length === 0) {
      return res.status(400).json({ error: 'No player images found. Upload player images first.' });
    }

    // Partition sponsors into three disjoint cycles
    const sponsorsTop: string[] = [];
    const sponsorsMid: string[] = [];
    const sponsorsBot: string[] = [];
    for (let i = 0; i < sponsorLogos.length; i++) {
      const s = sponsorLogos[i].replace(/\.(png|jpg|jpeg|webp|svg)$/i, '');
      if (i % 3 === 0) sponsorsTop.push(s);
      else if (i % 3 === 1) sponsorsMid.push(s);
      else sponsorsBot.push(s);
    }
    // ensure non-empty partitions
    const partitions = [sponsorsTop, sponsorsMid, sponsorsBot];
    if (partitions.some((p) => p.length === 0)) {
      const arr = sponsorLogos.map((x) => x.replace(/\.(png|jpg|jpeg|webp|svg)$/i, ''));
      while (sponsorsTop.length === 0 && arr.length) sponsorsTop.push(arr.shift()!);
      while (sponsorsMid.length === 0 && arr.length) sponsorsMid.push(arr.shift()!);
      while (sponsorsBot.length === 0 && arr.length) sponsorsBot.push(arr.shift()!);
      let idx = 0;
      for (const s of arr) {
        if (idx % 3 === 0) sponsorsTop.push(s);
        else if (idx % 3 === 1) sponsorsMid.push(s);
        else sponsorsBot.push(s);
        idx++;
      }
    }

    function assignRow(i: number) {
      const image1 = sponsorsTop[i % sponsorsTop.length];
      const image2 = sponsorsMid[i % sponsorsMid.length];
      const image3 = sponsorsBot[i % sponsorsBot.length];
      if (new Set([image1, image2, image3]).size !== 3) {
        const alt2 = sponsorsMid[(i + 1) % sponsorsMid.length];
        return { image1, image2: alt2, image3 };
      }
      return { image1, image2, image3 };
    }

    const rows = players.map((p: any, i: number) => {
      const { image1, image2, image3 } = assignRow(i);
      return {
        subject: String(p.subject),
        image1,
        image2,
        image3,
      };
    });

    return res.json(rows);
  } catch (err) {
    logger.error('POST /vmix/sponsor-rows failed', err as any);
    return next(err);
  }
});

// GET /api/vmix/sponsor-names
// Returns a JSON object with the concatenated sponsor names string under the
// property "sponsor-names". The value uses three spaces, a vertical bar, and
// three spaces as separator ("   |   ") and includes a trailing separator.
vmixRouter.get('/sponsor-names', async (_req, res, next) => {
  try {
    const sponsors = await prisma.sponsor.findMany({
      where: {
        type: {
          in: ['premium', 'goud', 'zilver']
        }
      },
      orderBy: [
        {type: 'asc'},
        {name: 'asc'}
      ]

    });
    const names = sponsors.map((s) => (s.name || '').trim()).filter(Boolean);
    const sep = '   |   ';
    const ticker = names.length > 0 ? names.join(sep) + sep : '';
    return res.status(200).json([{ 'sponsor-names': ticker }]);
  } catch (err) {
    logger.error('GET /vmix/sponsor-names failed', err as any);
    return next(err);
  }
});

// List all sponsors for the carousel used in the vmix livestream
// {
//     "commercial": "active-health-center.png"
//   },

vmixRouter.get('/sponsor-carousel', async (_req, res, next) => {
  try {
    const sponsors = await prisma.sponsor.findMany({
      where: {
        type: {
          in: ['premium', 'goud', 'zilver']
        }
      },
      orderBy: [
        {type: 'asc'},
        {name: 'asc'}
      ]
    });
    return res.status(200).json(sponsors.map((s) => ({
      name: s.name,
      commercial: s.logoUrl.toLowerCase(),
      type: s.type,
      website: s.websiteUrl
    })));
  } catch (err) {
    logger.error('GET /vmix/sponsor-carousel failed', err as any);
    return next(err);
  }
});

vmixRouter.get('/active-production/staff', async (req, res, next) => {
  try {
    // === Stap 1: Vind de "actieve" productie ===
    // We zoeken de productie waarvan de gekoppelde wedstrijd
    // in de toekomst ligt, en we nemen de eerstvolgende.
    const activeProduction = await prisma.production.findFirst({
      where: {
        matchSchedule: {
          date: {
            lt: new Date() // 'gt' = greater than (groter dan nu)
          }
        }
      },
      orderBy: {
        matchSchedule: {
          date: 'asc' // De eerstvolgende in de tijd
        }
      },
      select: {
        matchScheduleId: true // We hebben alleen de ID van de wedstrijd nodig
      }
    });

    if (!activeProduction) {
      // Geen actieve (toekomstige) productie gevonden
      return res.status(404).json({ message: 'Geen actieve productie gevonden.' });
    }

    // === Stap 2: Haal de namen en functies op voor die wedstrijd ===
    // Nu gebruiken we de gevonden matchScheduleId om de crew te vinden.
    const staffAssignments = await prisma.matchRoleAssignment.findMany({
      where: {
        matchScheduleId: activeProduction.matchScheduleId
      },
      // We selecteren alleen de velden die we nodig hebben
      select: {
        person: {
          select: {
            name: true
          }
        },
        capability: {
          select: {
            functionName: true
          }
        }
      },
      orderBy: {
        capability: {
          functionName: 'asc' // Sorteer op functienaam (optioneel)
        }
      }
    });

    // === Stap 3: Formatteer het resultaat ===
    // 1. Definieer de speciale groep
    const specialGroupKey = 'PRESENTATIE & ANALIST';
    const specialFunctions = ['PRESENTATIE', 'ANALIST'];

// 2. Gebruik een Map om de personen per functie te groeperen
    const staffMap = new Map();

    for (const assignment of staffAssignments) {
      const name = assignment.person.name;
      const functionName = assignment.capability.functionName;

      let groupKey;
      let finalFunctionName;

      // Bepaal of dit de speciale groep is
      if (specialFunctions.includes(functionName)) {
        groupKey = specialGroupKey;
        finalFunctionName = specialGroupKey;
      } else {
        // Zo niet, gebruik de originele functienaam
        groupKey = functionName;
        finalFunctionName = functionName;
      }

      // Voeg de groep toe aan de Map als deze nog niet bestaat
      if (!staffMap.has(groupKey)) {
        staffMap.set(groupKey, {
          functionName: finalFunctionName,
          names: [] // Een array om alle namen te verzamelen
        });
      }

      // Voeg de huidige persoon toe aan de namen-array van de juiste groep
      staffMap.get(groupKey).names.push(name);
    }

// 3. Converteer de Map naar de gewenste output-array
// We nemen de 'values' (de objecten) uit de Map en joinen de namen
    const staffList = Array.from(staffMap.values()).map(group => ({
      functionName: group.functionName,
      name: group.names.join(' & ') // Alle namen samenvoegen met ' & '
    }));

// Nu bevat staffList het gecombineerde resultaat
// bv:
// [
//   { functionName: 'PRESENTATIE & ANALIST', name: 'Mike & Jan' },
//   { functionName: 'REGIE', name: 'Sarah' }
// ]
    return res.json(staffList);

  } catch (error) {
    // Stuur fouten door naar de error handler
    return next(error);
  }
});

export default vmixRouter;
