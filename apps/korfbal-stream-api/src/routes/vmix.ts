import {Router} from 'express';
import {prisma} from '../services/prisma';
import {logger} from '../utils/logger';

export const vmixRouter: Router = Router();

// POST /api/vmix/sponsor-rows
// Body: { sponsorIds?: number[]; seed?: string | number }
// Response: Array<{ subject: string; image1: string; image2: string; image3: string }>
vmixRouter.post('/sponsor-rows', async (req, res, next) => {
  try {
    const sponsorIds = Array.isArray((req.body?.sponsorIds as any)) ? (req.body.sponsorIds as any).map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n)) : undefined;
    const seedRaw = (req.body?.seed ?? undefined);

    // Seedable RNG + helpers (mirrors scripts/generate-sponsor-csv.ts)
    function hashSeed(input: string): number {
      let h = 1779033703 ^ input.length;
      for (let i = 0; i < input.length; i++) {
        h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      return (h >>> 0) || 0x9e3779b9; // ensure non-zero
    }
    function mulberry32(seed: number) {
      let t = seed >>> 0;
      return function () {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      };
    }
    function shuffle<T>(arr: T[], rnd: () => number) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
    function rotate<T>(arr: T[], offset: number) {
      if (arr.length === 0) return arr;
      const n = ((offset % arr.length) + arr.length) % arr.length;
      if (n === 0) return arr;
      return arr.slice(n).concat(arr.slice(0, n));
    }
    const seedStr = String(seedRaw ?? Date.now());
    const rnd = mulberry32(hashSeed(seedStr));

    // Load sponsors to use
    const sponsors = await prisma.sponsor.findMany({
      where: sponsorIds && sponsorIds.length > 0 ? { id: { in: sponsorIds } } : {
        type: { in: ['premium', 'goud', 'zilver'] as any },
      },
      orderBy: { id: 'asc' },
    });

    // Shuffle sponsors for more variation
    const sponsorLogos = shuffle(sponsors.map((s) => (s.logoUrl || '').trim()).filter(Boolean), rnd);
    if (sponsorLogos.length < 3) {
      return res.status(400).json({ error: 'Need at least 3 sponsors' });
    }
    // Ensure uniqueness of filenames (defensive)
    const uniqueSponsorLogos = Array.from(new Set(sponsorLogos));

    // Load player images (subjects)
    const playersRaw = await (prisma as any).playerImage.findMany({ orderBy: { id: 'asc' } });
    if (!playersRaw || playersRaw.length === 0) {
      return res.status(400).json({ error: 'No player images found. Upload player images first.' });
    }
    // Shuffle players
    const players = shuffle([...playersRaw], rnd);

    // Strategy selection:
    // - If we have at least 6 unique sponsors, we can guarantee that consecutive rows
    //   have disjoint sets of sponsors by grouping in steps of 3 over the shuffled list.
    // - If fewer than 6 are available, it is mathematically impossible to avoid overlap
    //   between two consecutive rows that both need 3 unique sponsors. In that case we
    //   fall back to the previous partitioned approach and try to minimize overlap.

    // Partitioned fallback (used only when unique sponsors < 6)
    function buildPartitionedAssign() {
      const sponsorsTop: string[] = [];
      const sponsorsMid: string[] = [];
      const sponsorsBot: string[] = [];
      for (let i = 0; i < sponsorLogos.length; i++) {
        const s = sponsorLogos[i];
        if (i % 3 === 0) sponsorsTop.push(s);
        else if (i % 3 === 1) sponsorsMid.push(s);
        else sponsorsBot.push(s);
      }
      const partitions = [sponsorsTop, sponsorsMid, sponsorsBot];
      if (partitions.some((p) => p.length === 0)) {
        const arr = [...sponsorLogos];
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
      const topRot = Math.floor(rnd() * (sponsorsTop.length || 1));
      const midRot = Math.floor(rnd() * (sponsorsMid.length || 1));
      const botRot = Math.floor(rnd() * (sponsorsBot.length || 1));
      const partTop = rotate(sponsorsTop, topRot);
      const partMid = rotate(sponsorsMid, midRot);
      const partBot = rotate(sponsorsBot, botRot);

      return function assignRowPartitioned(i: number, prevSet?: Set<string>) {
        let image1 = partTop[i % partTop.length];
        let image2 = partMid[i % partMid.length];
        let image3 = partBot[i % partBot.length];
        // Ensure uniqueness within row
        if (new Set([image1, image2, image3]).size !== 3) {
          image2 = partMid[(i + 1) % partMid.length];
        }
        // Try to minimize overlap with previous row by shifting mid/bot if needed
        if (prevSet && (prevSet.has(image1) || prevSet.has(image2) || prevSet.has(image3))) {
          // Try a couple of shifts to reduce overlap
          for (let step = 1; step <= 3; step++) {
            const cand2 = partMid[(i + step) % partMid.length];
            const cand3 = partBot[(i + step) % partBot.length];
            const set = new Set([image1, cand2, cand3]);
            if (set.size === 3) {
              const inter = [image1, cand2, cand3].filter((x) => prevSet.has(x)).length;
              const interOrig = [image1, image2, image3].filter((x) => prevSet.has(x)).length;
              if (inter < interOrig) {
                image2 = cand2;
                image3 = cand3;
                if (inter === 0) break;
              }
            }
          }
        }
        return { image1, image2, image3 };
      };
    }

    const canGuaranteeNoAdjOverlap = uniqueSponsorLogos.length >= 6;
    const assignRow = canGuaranteeNoAdjOverlap
      ? function assignRowByGrouping(i: number) {
          const n = uniqueSponsorLogos.length;
          const a = uniqueSponsorLogos[(3 * i) % n];
          const b = uniqueSponsorLogos[(3 * i + 1) % n];
          const c = uniqueSponsorLogos[(3 * i + 2) % n];
          return { image1: a, image2: b, image3: c };
        }
      : buildPartitionedAssign();

    // Log seed and sizes for reproducibility/debugging
    try {
      const mode = canGuaranteeNoAdjOverlap ? 'group-of-3' : 'partition-fallback';
      logger.info(`vmix/sponsor-rows seed=${seedStr} mode=${mode} sponsorsUnique=${uniqueSponsorLogos.length} players=${players.length}`);
      if (!canGuaranteeNoAdjOverlap) {
        logger.warn('Only < 6 unique sponsors available; cannot fully avoid overlap between consecutive rows. Minimizing overlap.');
      }
    } catch {}

    let prevSet: Set<string> | undefined = undefined;
    const rows = players.map((p: any, i: number) => {
      const { image1, image2, image3 } = (assignRow as any)(i, prevSet);
      prevSet = new Set([image1, image2, image3]);
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
