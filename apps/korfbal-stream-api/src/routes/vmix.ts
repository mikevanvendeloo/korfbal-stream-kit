import {Router} from 'express';
import axios from 'axios';
import {prisma} from '../services/prisma';
import {findClubByTeamName} from '../utils/clubs';
import {logger} from '../utils/logger';
// ================= Admin vMix templates API =================
import {z} from 'zod';
import {
  CreateTitleDefinitionSchema,
  ReorderTitleDefinitionsSchema,
  UpdateTitleDefinitionSchema
} from '../schemas/title';
import {buildVmixApiUrl, getSponsorNamesTypes, getSponsorRowsTypes, getVmixUrl} from '../services/appSettings';
import {shuffle} from "../utils/array-utils";
import os from 'os';

export const vmixRouter: Router = Router();
export const adminVmixRouter: Router = Router();

// ---------------- vMix control endpoints ----------------
// POST /api/vmix/set-timer  { seconds: number }
vmixRouter.post('/set-timer', async (req, res, next) => {
  try {
    const secondsRaw = Number(req.body?.seconds);
    if (!Number.isFinite(secondsRaw) || secondsRaw <= 0) {
      return res.status(400).json({ error: 'seconds must be a positive number' });
    }
    const secs = Math.round(secondsRaw);
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');
    const value = `${mm}:${ss}`;

    const base = await getVmixUrl();
    if (!base) {
      return res.status(400).json({ error: 'vMix Web URL is not configured' });
    }
    // vMix Web Controller API: SetCountdown expects Value=mm:ss
    const url = buildVmixApiUrl(base, `Function=SetCountdown&Value=${encodeURIComponent(value)}`);
    const response = await axios.get(url, { timeout: 2000 });

    return res.json({ ok: true, seconds: secs, vmixResponse: typeof response.data === 'string' ? response.data : undefined });
  } catch (err) {
    if (axios.isAxiosError(err)) { return res.status(err.response?.status ?? 500).json({ message: err.message, url: err.config?.url});}
    return next(err);
  }
});

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
    let where: any = {};
    if (sponsorIds && sponsorIds.length > 0) {
      where = { id: { in: sponsorIds } };
    } else {
      const types = await getSponsorRowsTypes();
      where = { type: { in: types } };
    }

    const sponsors = await prisma.sponsor.findMany({
      where,
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
        const image1 = partTop[i % partTop.length];
        let image2 = partMid[i % partMid.length];
        let image3 = partBot[i % partBot.length];
        // Ensure uniqueness within row
        if (new Set([image1, image2, image3]).size !== 3) {
          image2 = partMid[(i + 1) % partMid.length];
        }
        // Try to minimize overlap with previous row by shifting mid/bot if needed
        if (prevSet && (prevSet.has(image1) || prevSet.has(image2) || prevSet.has(image3))) {
          // Try a couple of shifts to reduce overlap
          for (let step = 1; step < 3; step++) { // Changed loop limit to 3
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
    const types = await getSponsorNamesTypes();
    const sponsors = await prisma.sponsor.findMany({
      where: {
        type: {
          in: types as any
        }
      },
      orderBy: [
        {type: 'asc'},
        {name: 'asc'}
      ]

    });
    const premium = shuffle(sponsors.filter((s) => s.type === 'premium'));
    const other =  shuffle(sponsors.filter((s) => s.type !== 'premium'));

    const names = [...premium, ...other].map((s) => {
      const dn = ((s as any).displayName || '').trim();
      return dn || (s.name || '').trim();
    }).filter(Boolean);
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

vmixRouter.get('/sponsor-carrousel', async (_req, res, next) => {
  try {
    const types = await getSponsorNamesTypes(); // Reusing names types for carousel for now, or should have its own? Assuming same as ticker/names.
    const sponsors = await prisma.sponsor.findMany({
      where: {
        type: {
          in: types as any
        }
      },
      orderBy: [
        {type: 'asc'},
        {name: 'asc'}
      ]
    });
    sponsors.push({
      id: 9999,
      name: 'Fortuna sponsor',
      logoUrl: 'sponsoring.png',
      type: 'premium',
      websiteUrl: 'https://www.fortuna-korfbal.nl/sponsoring/businessclub/',
      categories: null,
      createdAt: new Date()
    } as any)
    return res.status(200).json(shuffle(sponsors).map((s) => {
      const dn = ((s as any).displayName || '').trim();
      return {
        name: dn || s.name,
        commercial: s.logoUrl.toLowerCase(),
        type: s.type,
        website: s.websiteUrl
      };
    }));
  } catch (err) {
    logger.error('GET /vmix/sponsor-carrousel failed', err as any);
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
            gt: new Date() // 'gt' = greater than (groter dan nu)
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
        skill: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        skill: {
          name: 'asc' // Sorteer op functienaam (optioneel)
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
      const functionName = assignment.skill.name;

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

// GET /api/vmix/endpoints
// Returns a list of available vMix GET endpoints with host IP
vmixRouter.get('/endpoints', async (req, res, next) => {
  try {
    // Determine host IP
    const nets = os.networkInterfaces();
    let hostIp = 'localhost';

    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        // Skip internal (i.e. 127.0.0.1) and non-IPv4 addresses
        if (net.family === 'IPv4' && !net.internal) {
          hostIp = net.address;
          break;
        }
      }
      if (hostIp !== 'localhost') break;
    }

    const port = process.env.PORT || 3000; // Assuming default port if not set
    const baseUrl = `http://${hostIp}:${port}/api/vmix`;

    const endpoints = [
      {
        name: 'Sponsor Names (Ticker)',
        url: `${baseUrl}/sponsor-names`,
        description: 'Returns concatenated sponsor names for ticker.'
      },
      {
        name: 'Sponsor Carrousel',
        url: `${baseUrl}/sponsor-carrousel`,
        description: 'Returns list of sponsors for carousel.'
      },
      {
        name: 'Active Production Staff',
        url: `${baseUrl}/active-production/staff`,
        description: 'Returns staff list for the active production.'
      },
      {
        name: 'Active Production Titles',
        url: `${baseUrl}/production/active/titles`,
        description: 'Returns titles for the active production.'
      }
    ];

    return res.json({ hostIp, endpoints });
  } catch (err) {
    return next(err);
  }
});

export default vmixRouter;

// ---------------- vMix configurable titles ----------------

type VmixTitleItem = { functionName: string; name: string | null };

/**
 * Resolve vMix titles for a production according to TitleDefinitions, or a default layout when none exist.
 * Friendly names are used (e.g., "Presentatie & analist", "Commentaar").
 */
// IMPORTANT: Define the specific "active" route BEFORE the dynamic :id route to avoid
// Express treating "active" as an :id parameter.
vmixRouter.get('/production/active/titles', async (_req, res, next) => {
  try {
    const active = await prisma.production.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
    if (!active) return res.status(404).json({ error: 'No active production' });
    // Redirect to the concrete id-based endpoint to reuse the same resolver
    return res.redirect(307, `/api/vmix/production/${active.id}/titles`);
  } catch (err) {
    return next(err);
  }
});

vmixRouter.get('/production/:id/titles', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const production = await prisma.production.findUnique({
      where: { id },
      include: { matchSchedule: true },
    });
    if (!production) return res.status(404).json({ error: 'Not found' });

    // Load definitions for the production
    const definitions = await (prisma as any).titleDefinition.findMany({
      where: { productionId: id, enabled: true },
      orderBy: { order: 'asc' },
      include: { parts: { orderBy: { id: 'asc' } } },
    }).catch(() => []);

    // Helper: load crew by capability codes (uses new production crew endpoint logic)
    async function loadCrew() {
      // Fetch production-wide person-position assignments with on-stream skills
      const productionPositions = await prisma.productionPersonPosition.findMany({
        where: {
          productionId: id,
          position: {
            skill: {
              type: 'on_stream',
            },
          },
        },
        include: {
          person: true,
          position: {
            include: {
              skill: true,
            },
          },
        },
      });

      // Build crew by skill code
      const commentary: string[] = [];
      const presenter: string[] = [];
      const analyst: string[] = [];

      for (const pp of productionPositions) {
        const code = pp.position.skill?.code;
        if (code === 'COMMENTAAR') {
          commentary.push(pp.person.name);
        } else if (code === 'PRESENTATIE') {
          presenter.push(pp.person.name);
        } else if (code === 'ANALIST') {
          analyst.push(pp.person.name);
        }
      }

      return { commentary, presenter, analyst };
    }

    // Helper: players/coaches for a club
    async function loadClubPeople(clubId: number | null) {
      if (!clubId) return { players: [] as any[], coaches: [] as any[] };
      const all = await prisma.player.findMany({ where: { clubId }, orderBy: [{ function: 'asc' as any }, { name: 'asc' }] });
      const players = all.filter((p) => p.function === 'Speler' || p.function === 'Speelster');
      const coaches = all.filter((p) => (p.function || '').toLowerCase().includes('coach'));
      return { players, coaches };
    }

    const crew = await loadCrew();
    const ms = production.matchSchedule;
    const homeClub = await findClubByTeamName(prisma as any, ms?.homeTeamName, logger);
    const awayClub = await findClubByTeamName(prisma as any, ms?.awayTeamName, logger);
    logger.info('🎬 vMix resolver – clubs resolved', {
      productionId: production.id,
      match: { homeTeamName: ms?.homeTeamName, awayTeamName: ms?.awayTeamName },
      homeClub: homeClub ? { id: homeClub.id, name: homeClub.name, shortName: homeClub.shortName } : null,
      awayClub: awayClub ? { id: awayClub.id, name: awayClub.name, shortName: awayClub.shortName } : null,
    });
    const homePeople = await loadClubPeople(homeClub?.id || null);
    const awayPeople = await loadClubPeople(awayClub?.id || null);

    function buildDefaultDefinitions() {
      return [
        { key: 'presentation_analyst', parts: ['PRESENTATION_AND_ANALIST'] },
        { key: 'commentary', parts: ['COMMENTARY'] },
        { key: 'away_coaches', parts: [{ type: 'TEAM_COACH', side: 'AWAY', limit: null }] },
        { key: 'away_players', parts: [{ type: 'TEAM_PLAYER', side: 'AWAY', limit: null }] },
        { key: 'home_players', parts: [{ type: 'TEAM_PLAYER', side: 'HOME', limit: null }] },
        { key: 'home_coaches', parts: [{ type: 'TEAM_COACH', side: 'HOME', limit: null }] },

      ];
    }

    const result: VmixTitleItem[] = [];

    // Load interview subject overrides for this production (if any)
    const interviewSubjects: Array<{ id: number; side: 'HOME'|'AWAY'|'NONE'; role: 'PLAYER'|'COACH'; playerId: number; titleDefinitionId: number | null }> = await (prisma as any).interviewSubject.findMany({
      where: { productionId: production.id },
      select: { id: true, side: true, role: true, playerId: true, titleDefinitionId: true },
    }).catch(() => []);
    if (interviewSubjects && interviewSubjects.length > 0) {
      const summary = interviewSubjects.reduce((acc: any, s) => {
        const key = `${s.side}-${s.role}-${s.titleDefinitionId ?? 'generic'}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      logger.info('🎬 vMix resolver – interview overrides loaded', { productionId: production.id, selections: summary });
    }

    function findInterviewSelection(side: 'HOME'|'AWAY'|'NONE', role: 'PLAYER'|'COACH', defId?: number | null) {
      if (!interviewSubjects || interviewSubjects.length === 0) return null;
      // Prefer title-specific override if available
      if (defId) {
        const t = interviewSubjects.find((s) => s.side === side && s.role === role && s.titleDefinitionId === defId);
        if (t) return t;
      }
      // Fallback to generic (no title association)
      return interviewSubjects.find((s) => s.side === side && s.role === role && (s.titleDefinitionId === null || typeof s.titleDefinitionId === 'undefined')) || null;
    }

    async function emitFromPart(part: any, defId?: number | null) {
      const type = part.sourceType;
      const side = part.teamSide || 'NONE';

      if (type === 'COMMENTARY') {
        if (crew.commentary.length > 0) {
          result.push({ functionName: 'Commentaar', name: crew.commentary.join(' & ') });
        } else {
          result.push({ functionName: 'Commentaar', name: null }); // Ensure placeholder
        }
      } else if (type === 'PRESENTATION_AND_ANALIST') {
        const names = [...crew.presenter, ...crew.analyst].filter(Boolean);
        if (names.length > 0) {
          result.push({ functionName: 'Presentatie & analist', name: names.join(' & ') });
        } else {
          result.push({ functionName: 'Presentatie & analist', name: null }); // Ensure placeholder
        }
      }  else if (type === 'PRESENTATION') {
        const names = [...crew.presenter].filter(Boolean);
        if (names.length > 0) {
          result.push({ functionName: 'Presentatie', name: names.join(' & ') });
        } else {
          result.push({ functionName: 'Presentatie', name: null }); // Ensure placeholder
        }
      } else if (type === 'TEAM_PLAYER' || type === 'TEAM_COACH') {
        const role = type === 'TEAM_PLAYER' ? 'PLAYER' : 'COACH';
        const sel = findInterviewSelection(side as any, role as any, defId);
        if (sel) {
          const isPlayers = type === 'TEAM_PLAYER';
          const people = side === 'HOME' ? (isPlayers ? homePeople.players : homePeople.coaches) : side === 'AWAY' ? (isPlayers ? awayPeople.players : awayPeople.coaches) : [];
          let p = people.find((x: any) => x.id === sel.playerId);
          if (!p) {
            p = await prisma.player.findUnique({ where: { id: sel.playerId } }).catch(() => null) as any;
            if (!p) {
              // If player not found, still push a placeholder
              const clubName = side === 'HOME' ? ((homeClub?.shortName || homeClub?.name) ?? '') : side === 'AWAY' ? ((awayClub?.shortName || awayClub?.name) ?? '') : '';
              const fn = isPlayers ? `Speler${clubName ? ` ${clubName}` : ''}` : `Coach${clubName ? ` ${clubName}` : ''}`;
              result.push({ functionName: fn, name: null });
              return;
            }
          }
          const clubName = side === 'HOME'
            ? ((homeClub?.name || homeClub?.shortName) ?? '')
            : side === 'AWAY'
            ? ((awayClub?.name || awayClub?.shortName) ?? '')
            : '';
          logger.info('Club player selected for interview: ', { playerId: sel.playerId, clubName, isPlayers, side, name: p.name });
          const fn = (p.function || '').trim().replace('Hoofd coach','Coach');
          const suffix = clubName ? ` ${clubName}` : '';
          const functionName = fn ? `${fn}${suffix}`.trim() : (isPlayers ? `Speler${suffix}`.trim() : `Coach${suffix}`.trim());
          result.push({ functionName, name: p.name });
        } else {
          const isPlayers = type === 'TEAM_PLAYER';
          const clubName = side === 'HOME'
            ? ((homeClub?.shortName || homeClub?.name) ?? '')
            : side === 'AWAY'
            ? ((awayClub?.shortName || awayClub?.name) ?? '')
            : '';
          const fn = isPlayers ? `Speler${clubName ? ` ${clubName}` : ''}` : `Coach${clubName ? ` ${clubName}` : ''}`;
          result.push({ functionName: fn, name: null });
        }
      } else if (type === 'FREE_TEXT') {
        const fn = (part.customFunction || '').trim();
        const nm = (part.customName || '').trim();
        if (fn && nm) {
          result.push({ functionName: fn, name: nm });
        } else {
          result.push({ functionName: fn || 'Vrije tekst', name: nm || null }); // Ensure placeholder
        }
      }
    }

    // If the production has no definitions, try global templates (productionId=null)
    let effectiveDefinitions: any[] = Array.isArray(definitions) ? definitions : [];
    if (!effectiveDefinitions || effectiveDefinitions.length === 0) {
      const templates = await (prisma as any).titleDefinition.findMany({
        where: { productionId: null, enabled: true },
        orderBy: { order: 'asc' },
        include: { parts: { orderBy: { id: 'asc' } } },
      }).catch(() => []);
      effectiveDefinitions = templates;
    }

    logger.info('🎬 vMix resolver – Effective Definitions:', effectiveDefinitions.map((def: any) => ({ id: def.id, name: def.name, order: def.order, parts: def.parts.map((p: any) => ({ sourceType: p.sourceType, teamSide: p.teamSide, customFunction: p.customFunction, customName: p.customName })) })));

    if (Array.isArray(effectiveDefinitions) && effectiveDefinitions.length > 0) {
      for (const def of effectiveDefinitions) {
        for (const part of (def.parts || [])) {
          await emitFromPart(part, def.id);
        }
      }
    } else {
      // Fallback to default configuration
      const defs = buildDefaultDefinitions();
      for (const def of defs) {
        for (const part of def.parts as any[]) await emitFromPart(part);
      }
    }

    logger.info('🎬 vMix resolver – Final Result:', result);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// List templates (productionId=null)
adminVmixRouter.get('/title-templates', async (_req, res, next) => {
  try {
    const defs = await (prisma as any).titleDefinition.findMany({
      where: { productionId: null },
      orderBy: { order: 'asc' },
      include: { parts: { orderBy: { id: 'asc' } } },
    });
    return res.json(defs);
  } catch (err) {
    return next(err);
  }
});

// Create template
adminVmixRouter.post('/title-templates', async (req, res, next) => {
  try {
    const parsed = CreateTitleDefinitionSchema.parse(req.body);
    const created = await prisma.$transaction(async (tx) => {
      const maxRow = await (tx as any).titleDefinition.aggregate({ _max: { order: true }, where: { productionId: null } });
      const nextOrder = (maxRow?._max?.order || 0) + 1;
      const order = parsed.order && parsed.order > 0 ? parsed.order : nextOrder;
      if (order <= (maxRow?._max?.order || 0)) {
        await (tx as any).titleDefinition.updateMany({ where: { productionId: null, order: { gte: order } }, data: { order: { increment: 1 } as any } });
      }
      const def = await (tx as any).titleDefinition.create({ data: { productionId: null, name: parsed.name, order, enabled: parsed.enabled ?? true } });
      for (const p of parsed.parts) {
        await (tx as any).titlePart.create({
          data: {
            titleDefinitionId: def.id,
            sourceType: p.sourceType,
            teamSide: (p as any).teamSide ?? 'NONE',
            limit: (p as any).limit ?? null,
            filters: (p as any).filters as any,
            customFunction: (p as any).customFunction ?? null,
            customName: (p as any).customName ?? null,
          },
        });
      }
      return def;
    });
    const full = await (prisma as any).titleDefinition.findUnique({ where: { id: created.id }, include: { parts: { orderBy: { id: 'asc' } } } });
    return res.status(201).json(full);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid payload' });
    return next(err);
  }
});

// Update template
adminVmixRouter.put('/title-templates/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const def = await (prisma as any).titleDefinition.findUnique({ where: { id } });
    if (!def || def.productionId !== null) return res.status(404).json({ error: 'Not found' });

    const parsed = UpdateTitleDefinitionSchema.parse(req.body);
    await prisma.$transaction(async (tx) => {
      await (tx as any).titleDefinition.update({ where: { id }, data: { name: parsed.name ?? undefined, enabled: parsed.enabled ?? undefined } });
      if (parsed.parts) {
        await (tx as any).titlePart.deleteMany({ where: { titleDefinitionId: id } });
        for (const p of parsed.parts) {
          await (tx as any).titlePart.create({
            data: {
              titleDefinitionId: id,
              sourceType: p.sourceType,
              teamSide: (p as any).teamSide ?? 'NONE',
              limit: (p as any).limit ?? null,
              filters: (p as any).filters as any,
              customFunction: (p as any).customFunction ?? null,
              customName: (p as any).customName ?? null,
            },
          });
        }
      }
    });
    const full = await (prisma as any).titleDefinition.findUnique({ where: { id }, include: { parts: { orderBy: { id: 'asc' } } } });
    return res.json(full);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid payload' });
    return next(err);
  }
});

// Delete template and renumber
adminVmixRouter.delete('/title-templates/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const def = await (prisma as any).titleDefinition.findUnique({ where: { id } });
    if (!def || def.productionId !== null) return res.status(404).json({ error: 'Not found' });

    await prisma.$transaction(async (tx) => {
      await (tx as any).titlePart.deleteMany({ where: { titleDefinitionId: id } });
      await (tx as any).titleDefinition.delete({ where: { id } });
      const rest = await (tx as any).titleDefinition.findMany({ where: { productionId: null }, orderBy: { order: 'asc' } });
      for (let i = 0; i < rest.length; i++) {
        if (rest[i].order !== i + 1) await (tx as any).titleDefinition.update({ where: { id: rest[i].id }, data: { order: i + 1 } });
      }
    });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// Reorder templates
adminVmixRouter.patch('/title-templates:reorder', async (req, res, next) => {
  try {
    const parsed = ReorderTitleDefinitionsSchema.parse(req.body);
    await prisma.$transaction(async (tx) => {
      const existing = await (tx as any).titleDefinition.findMany({ where: { productionId: null }, select: { id: true } });
      const idsSet = new Set(existing.map((e: any) => e.id));
      for (const i of parsed.ids) if (!idsSet.has(i)) throw new Error('Invalid template id in ordering');
      for (let index = 0; index < parsed.ids.length; index++) {
        const templateId = parsed.ids[index];
        await (tx as any).titleDefinition.update({ where: { id: templateId }, data: { order: index + 1 } });
      }
    });
    return res.status(204).send();
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid payload' });
    return next(err);
  }
});

// Copy templates to a production (clears existing production titles first)
adminVmixRouter.post('/production/:id/titles/use-default', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Production not found' });

    await prisma.$transaction(async (tx) => {
      // Remove existing definitions for this production
      const existing = await (tx as any).titleDefinition.findMany({ where: { productionId: id }, select: { id: true } });
      const existingIds = existing.map((e: any) => e.id);
      if (existingIds.length > 0) {
        await (tx as any).titlePart.deleteMany({ where: { titleDefinitionId: { in: existingIds } } });
        await (tx as any).titleDefinition.deleteMany({ where: { id: { in: existingIds } } });
      }

      // Load templates in order
      const templates = await (tx as any).titleDefinition.findMany({
        where: { productionId: null, enabled: true },
        orderBy: { order: 'asc' },
        include: { parts: true },
      });
      let order = 1;
      for (const t of templates) {
        const def = await (tx as any).titleDefinition.create({ data: { productionId: id, name: t.name, order: order++, enabled: t.enabled } });
        for (const p of t.parts || []) {
          await (tx as any).titlePart.create({
            data: {
              titleDefinitionId: def.id,
              sourceType: p.sourceType,
              teamSide: p.teamSide,
              limit: p.limit,
              filters: (p as any).filters as any,
              customFunction: (p as any).customFunction ?? null,
              customName: (p as any).customName ?? null,
            },
          });
        }
      }
    });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});
