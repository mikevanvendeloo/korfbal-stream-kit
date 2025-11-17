import {Router} from 'express';
import {prisma} from '../services/prisma';
import path from 'node:path';
import fs from 'node:fs';
import {logger} from "../utils/logger";
import {getAssetsRoot} from "../services/config";

export const clubsRouter: Router = Router();

// --- HTML parsing helpers for league site ---
function absoluteUrl(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

// Extract team page links from the league teams index page
function extractTeamLinksFromIndex(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  // Find hrefs that contain "/team/" and are likely team detail pages
  const re = /href\s*=\s*\"([^\"]*\/team\/[^\"#?]+)\"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1];
    // Filter obvious anchors to specific team pages (exclude tabs only links)
    if (/\/team\//i.test(href)) {
      const url = absoluteUrl(baseUrl, href);
      links.add(url.replace(/#.*$/, ''));
    }
  }
  return Array.from(links);
}

// Extract teamId and poolId from a team page HTML by locating the stream/team API URL
function extractIdsFromTeamPage(html: string): { teamId?: string; poolId?: string } {
  // Primary: look for data-layout_context on the page-wrapper div
  try {
    const m = html.match(/<div[^>]*class=["']page-wrapper["'][^>]*data-layout_context=["']([^"']+)["'][^>]*>/i);
    if (m && m[1]) {
      const raw = m[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      try {
        const ctx = JSON.parse(raw);
        const teamId = ctx?.team_id || ctx?.data_entity_id;
        const poolId = Array.isArray(ctx?.pool_ids) && ctx.pool_ids[0] ? String(ctx.pool_ids[0]) : undefined;
        if (teamId && poolId) return {teamId: String(teamId), poolId};
      } catch {
        // fallthrough
      }
    }
  } catch {
    // ignore
  }

  // Try to find the api stream/team URL with encoded context
  const urlMatch = html.match(/https:\/\/api-saas-site-prod-[^\s"']+\/general\/api\/stream\/team\?context=([^\"'\s]+)/i);
  if (urlMatch) {
    try {
      const ctxEnc = urlMatch[1];
      const ctxJson = decodeURIComponent(ctxEnc);
      const ctx = JSON.parse(ctxJson);
      const teamId = ctx?.team_id || ctx?.data_entity_id;
      const poolId = Array.isArray(ctx?.pool_ids) && ctx.pool_ids[0] ? String(ctx.pool_ids[0]) : undefined;
      return {teamId: teamId ? String(teamId) : undefined, poolId};
    } catch {
      // continue
    }
  }
  // Fallback: look for JSON blob with "team_id" and "pool_ids" in the HTML
  try {
    const jsonLike = html.match(/\{[^]*?\}/g) || [];
    for (const blob of jsonLike) {
      if (/team_id\"?\s*:\s*\"?\d+\"?/i.test(blob) && /pool_ids\"?\s*:\s*\[[^\]]+\]/i.test(blob)) {
        try {
          const maybe = JSON.parse(blob);
          const teamId = maybe?.team_id || maybe?.data_entity_id;
          const poolId = Array.isArray(maybe?.pool_ids) && maybe.pool_ids[0] ? String(maybe.pool_ids[0]) : undefined;
          if (teamId && poolId) return {teamId: String(teamId), poolId};
        } catch {
          // ignore parse error and continue
        }
      }
    }
  } catch {
    // ignore
  }
  return {};
}

// Korfbal League person template endpoint for richer person data (first/last name, gender m/f)
const KORFBAL_TEMPLATE_URL = 'https://api-saas-site-prod-236.dotlab.net/general/api/get-template-data';

// Helpers
function slugify(input: string): string {
  const s = (input || '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}+/gu, '')
    .toLowerCase()
    .replace(/&/g, ' en ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  return s || 'club';
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base;
  let i = 1;

  while (true) {
    const existing = await prisma.club.findUnique({where: {slug}}).catch(() => null);
    if (!existing) return slug;
    slug = `${base}-${i++}`;
  }
}

async function writeFile(subfolder: string, filename: string, data: Buffer | string): Promise<void> {
  if (!filename) throw new Error('Filename cannot be empty');
  if (!data) throw new Error('Data cannot be empty');
  const assetsDir = getAssetsRoot();
  const dir = path.join(assetsDir, subfolder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
  const fullFilePath = path.join(dir, filename);
  await fs.promises.writeFile(fullFilePath, data);
}

async function downloadFile(url: string, subfolder: 'clubs' | 'players', desiredName?: string): Promise<string | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const assetsDir = getAssetsRoot();
    const dir = path.join(assetsDir, subfolder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
    const ext = (() => {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('png')) return '.png';
      if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';
      if (ct.includes('svg')) return '.svg';
      return path.extname(new URL(url).pathname) || '.bin';
    })();
    const filename = (desiredName || Math.random().toString(36).slice(2)) + ext;
    const full = path.join(dir, filename);
    fs.writeFileSync(full, buf);
    return `${subfolder}/${filename}`;
  } catch {
    return undefined; // fail silently; caller can fall back to remote URL or skip
  }
}

// External API URL builder (Korfbal League) - legacy stream endpoint (kept as fallback)
function buildKorfbalApiUrl(teamId: string | number, poolId: string | number): string {
  const context = {
    'preferred-group': null,
    tenant: 'league',
    pool_ids: [String(poolId)],
    team_id: String(teamId),
    language: 'nl',
    data_channel: 'team',
    data_sse: true,
    data_namespace: 'public',
    data_entity_id: String(teamId),
  } as any;
  const ctx = encodeURIComponent(JSON.stringify(context));
  return `https://api-saas-site-prod-236.dotlab.net/general/api/stream/team?context=${ctx}`;
}

const toNumberOrUndefined = (val: any): number | undefined => {
  const num = Number(val);
  return Number.isFinite(num) ? num : undefined;
};
// Prefer the template endpoint sportsuite_get_person_cards to get team roster
async function fetchTeamPersonCards(teamId: string | number, poolId: string | number): Promise<{
  baseName?: string;
  shortName?: string;
  logoUrl?: string;
  players: Array<any>
} | null> {
  try {
    const body: any = {
      data_key: 'sportsuite_get_person_cards',
      context: {
        'preferred-group': null,
        tenant: 'league',
        pool_ids: [String(poolId)],
        team_id: String(teamId),
        language: 'nl',
        'banner-size': 'fullwidth',
        _person_position_id: '1',
        limit: '25',
      },
      enable_cache: true,
      is_user_specific: false,
    };
    const resp = await fetch(KORFBAL_TEMPLATE_URL, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      // Log as error as requested
      logger.error(`Template cards fetch failed: ${resp.status} for team_id=${teamId} pool_id=${poolId}`);
      return null;
    }
    const json: any = await resp.json().catch((e: any) => {
      logger.error(`Failed to parse JSON from template response: ${e?.message || e}`);
      return null;
    });
    if (!json) {
      logger.warn(`Empty/invalid JSON from template response for team_id=${teamId} pool_id=${poolId}`);
      return null;
    }
    await writeFile("team-responses", `team-${teamId}-${poolId}.json`, JSON.stringify(json, null, 2))
    // Log concise summary after parsing once (avoid consuming the body twice)
    try {
      const result = (json as any).data || json;
      const cards = result?.cards;
      const len = Array.isArray(cards) ? cards.length : Array.isArray(result?.players) ? result.players.length : 0;
      const team = result?.team || {};
      logger.info(`Template parsed: team_name=${team?.team_name || team?.name || 'n/a'} team_short=${team?.team_name_short || team?.short_name || 'n/a'} cards=${len}`);
    } catch (e: any) {
      logger.error(`Failed to extract team_name/short from template response: ${e?.message || e}`);
    }

    // Heuristic extraction: support a few possible shapes
    const result = (json as any).result || (json as any).data || json;
    const team = (result?.team) || (Array.isArray(result?.cards) && result.cards[0]?.team) || {};
    const baseName = team.team_name || team.name || team.club_name || undefined;
    const shortName = team.team_name_short || team.short_name || undefined;
    const logoUrl = team.team_image?.url || team.logo?.url || team.logo_url || result.team_image?.url || undefined;

    // Players: cards array or players array
    let players: any[] = [];
    const cards = result?.cards || result?.players || [];
    if (Array.isArray(cards)) {
      players = cards.map((c: any) => {
        const p = c?.person || c;
        const id = p.id ?? p.ref_id ?? p.external_id;
        const fullname = (p.fullname || p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ')).trim();
        const shirt_number: number | undefined =
          toNumberOrUndefined(p.back_number) ??
          toNumberOrUndefined(p.shirt_number) ??
          toNumberOrUndefined(p.shirtNo) ??
          undefined;
        const gender = p.gender;
        const imageUrl = p.image?.url || p.photo?.url || p.photo_url || undefined;

        // Try to infer person type and function/role text from various fields
        const rawRole = (c?.role || c?.position || p?.role || p?.position || {}) as any;
        const roleName: string | undefined = typeof rawRole === 'string'
          ? rawRole
          : (rawRole?.name || rawRole?.title || rawRole?.type || undefined);
        const extraFn: string | undefined =
          p?.function || p?.functie || c?.function || c?.functie || roleName || undefined;
        const isCoach = (extraFn || '').toLowerCase().includes('coach');
        const personType = isCoach ? 'coach' : 'player';
        let funcText: string | undefined = extraFn;
        if (!funcText) {
          if (personType === 'player') {
            const g = (gender || '').toString().toLowerCase();
            funcText = g === 'female' || g === 'f' ? 'Speelster' : 'Speler';
          }
        }

        return { id, fullname, shirt_number, gender, image: { url: imageUrl }, personType, function: funcText };
      });
    }

    return { baseName, shortName, logoUrl, players };
  } catch (e) {
    logger.error(`Template cards fetch exception for team_id=${teamId} pool_id=${poolId}: ${(e as any)?.message || e}`);
    return null;
  }
}

// Try to extract ids from an apiUrl built like buildKorfbalApiUrl
function extractIdsFromApiUrl(apiUrl: string): { teamId?: string; poolId?: string } {
  try {
    const u = new URL(apiUrl);
    const ctxParam = u.searchParams.get('context');
    if (!ctxParam) return {};
    const ctx = JSON.parse(decodeURIComponent(ctxParam));
    const pool = Array.isArray(ctx?.pool_ids) && ctx.pool_ids.length > 0 ? String(ctx.pool_ids[0]) : undefined;
    const team = ctx?.team_id || ctx?.data_entity_id ? String(ctx.team_id || ctx.data_entity_id) : undefined;
    return {poolId: pool, teamId: team};
  } catch {
    return {};
  }
}

// Fetch extra person details (first/last name and gender m/f) from template endpoint
async function fetchPersonTemplate(personId: string | number, poolId: string | number): Promise<{
  firstName?: string;
  lastName?: string;
  gender?: 'm' | 'f'
} | null> {
  try {
    const body = {
      data_key: 'sportsuite_get_person_config',
      context: {
        'preferred-group': null,
        tenant: 'league',
        pool_ids: [String(poolId)],
        person_id: String(personId),
        language: 'nl',
      },
      enable_cache: true,
      is_user_specific: false,
    } as any;
    const resp = await fetch(KORFBAL_TEMPLATE_URL, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(body),
    });
    if (!resp.ok) return null;
    const json: any = await resp.json().catch(() => null);
    if (!json) return null;
    // Best-effort extraction; structure may vary
    const first = json?.result?.person?.first_name || json?.first_name || json?.person?.first_name || undefined;
    const last = json?.result?.person?.last_name || json?.last_name || json?.person?.last_name || undefined;
    const graw = (json?.result?.person?.gender || json?.person?.gender || json?.gender || '').toString().toLowerCase();
    const g: 'm' | 'f' | undefined = graw === 'm' ? 'm' : graw === 'f' ? 'f' : undefined;
    return {firstName: first, lastName: last, gender: g};
  } catch {
    return null;
  }
}

// Internal: process a list of sources using the existing logic
async function processImportSources(sources: Array<{ teamId: string | number; poolId: string | number } | {
  apiUrl: string
} | {
  name: string;
  shortName?: string;
  logoUrl?: string;
  slug?: string;
  players?: Array<{
    name: string;
    shirtNo?: number;
    gender?: 'male' | 'female';
    photoUrl?: string;
    externalId?: string;
    personType?: string;
    function?: string;
  }>
}>) {
  const problems: string[] = [];
  let clubsCreated = 0;
  let clubsUpdated = 0;
  let playersCreated = 0;
  let playersUpdated = 0;

  for (const src of sources) {
    let baseName = '';
    let shortName = '';
    let logoUrlRemote: string | undefined;
    let players: Array<any> = [];

    let currentPoolId: string | undefined;
    if ('name' in src) {
      // Direct payload
      baseName = src.name;
      shortName = src.shortName || src.name;
      logoUrlRemote = src.logoUrl;
      players = src.players || [];
      currentPoolId = undefined;
    } else {
      // Prefer the template person cards endpoint using teamId/poolId; fall back to legacy stream/team if needed
      let teamId: string | undefined;
      let poolId: string | undefined;
      if ('apiUrl' in src && src.apiUrl) {
        const ids = extractIdsFromApiUrl(src.apiUrl);
        teamId = ids.teamId;
        poolId = ids.poolId;
      } else {
        teamId = String((src as any).teamId);
        poolId = String((src as any).poolId);
      }

      let usedCards = false;
      if (teamId && poolId) {
        const cards = await fetchTeamPersonCards(teamId, poolId).catch(() => null);
        if (cards && (Array.isArray(cards.players) && cards.players.length > 0)) {
          usedCards = true;
          baseName = cards.baseName || '';
          shortName = cards.shortName || baseName || '';
          logoUrlRemote = cards.logoUrl;
          players = cards.players;
          currentPoolId = poolId;
        }
      } else { logger.warn(`Invalid teamId/poolId for source: ${JSON.stringify(src)}`);}

      // Fallback: when template returns no players, use legacy stream/team API
      if (!usedCards && teamId && poolId) {
        try {
          const apiUrl = buildKorfbalApiUrl(teamId, poolId);
          const resp = await fetch(apiUrl);
          if (resp.ok) {
            const json: any = await resp.json();
            const team = json?.result?.team || {};
            const playersPayload = Array.isArray(team?.players) ? team.players : [];
            if (playersPayload.length > 0) {
              baseName = team.team_name || baseName || '';
              shortName = team.team_name_short || shortName || baseName || '';
              logoUrlRemote = team.team_image?.url || logoUrlRemote;
              players = playersPayload;
              currentPoolId = poolId;
            }
          }
        } catch (e) {
          // ignore fallback error
        }
      }

      // Log how many players are present for this team payload
      try {
        const teamIdLog = teamId ?? (src as any).teamId ?? undefined;
        const poolIdLog = currentPoolId ?? poolId ?? (src as any).poolId ?? undefined;
        logger.info(`Import team payload: ${shortName || baseName} — players=${players.length}`, {
          teamId: teamIdLog,
          poolId: poolIdLog
        });
      } catch(e: any) { logger.error(`Failed to log team payload: ${e?.message || e}`);
      }
    }

    // Prepare club upsert
    const baseSlug = slugify(shortName || baseName);
    let slug = baseSlug;
    const existingBySlug = await prisma.club.findUnique({where: {slug}}).catch(() => null);
    if (existingBySlug) {
      // Keep slug; will update club
    } else {
      slug = await ensureUniqueSlug(baseSlug);
    }

    // Download logo if possible
    let logoLocal: string | undefined;
    if (logoUrlRemote) {
      logoLocal = await downloadFile(logoUrlRemote, 'clubs', slug);
    }

    const clubData = {
      name: baseName,
      shortName: shortName || baseName,
      slug,
      logoUrl: logoLocal || logoUrlRemote || null,
    } as any;

    let club = await prisma.club.findUnique({where: {slug}}).catch(() => null);
    if (club) {
      club = await prisma.club.update({where: {id: club.id}, data: clubData});
      clubsUpdated++;
    } else {
      club = await prisma.club.create({data: clubData});
      clubsCreated++;
    }

    logger.info(`Club ${slug} (${JSON.stringify(clubData)})`);
    logger.info(`Players: ${players.length}`);
    // Upsert players
    for (const p of players) {
      const rawFullName = (p.fullname || p.full_name || p.name || `${p.first_name || ''} ${p.last_name || ''}` || '').trim();
      if (!rawFullName) continue;
      const shirtNo: number | undefined = p.back_number ?? p.shirtNo ?? p.shirt_number ?? undefined;
      const gender: 'male' | 'female' | undefined = p.gender === 'F' || p.gender === 'female' ? 'female' : p.gender === 'M' || p.gender === 'male' ? 'male' : undefined;
      const extId: string | undefined = String(p.id ?? p.external_id ?? '').trim() || undefined;
      const photoRemote: string | undefined = p.image?.url || p.photo_url || undefined;
      // Person type and function
      const personType: string | undefined = (p.personType || '').toString() || undefined;
      let personFunction: string | undefined = (p.function || '').toString() || undefined;
      if (!personType || !personFunction) {
        // Try to infer from source
        const srcRole = (p.role || p.position || {}) as any;
        const roleName: string | undefined = typeof srcRole === 'string' ? srcRole : (srcRole?.name || srcRole?.title || undefined);
        const maybeCoach = (roleName || '').toLowerCase().includes('coach');
        const inferredType = personType || (maybeCoach ? 'coach' : 'player');
        let inferredFn = personFunction || roleName;
        if (!inferredFn && inferredType === 'player') {
          inferredFn = gender === 'female' ? 'Speelster' : 'Speler';
        }
        if (!personFunction && inferredFn) personFunction = inferredFn;
        if (!personType && inferredType) (p as any).personType = inferredType;
      }

      // // Optional enrichment via person template when we have both extId (person_id) and poolId
      // let fullName = rawFullName;
      // if (currentPoolId && extId) {
      //   const tpl = await fetchPersonTemplate(extId, currentPoolId).catch(() => null);
      //   if (tpl) {
      //     const tplName = `${(tpl.firstName || '').trim()} ${(tpl.lastName || '').trim()}`.trim();
      //     if (tplName) fullName = tplName;
      //     if (tpl.gender === 'f') gender = 'female';
      //     if (tpl.gender === 'm') gender = 'male';
      //   }
      // }

      // Determine unique where: prefer externalId, else (clubId, name, shirtNo)
      let existingPlayer: any = null;
      if (extId) {
        existingPlayer = await prisma.player.findUnique({where: {externalId: extId}}).catch(() => null);
      }
      if (!existingPlayer) {
        existingPlayer = await prisma.player.findFirst({
          where: {
            clubId: club.id,
            name: rawFullName
          }
        }).catch(() => null);
      }

      let photoLocal: string | undefined;
      if (photoRemote) {
        const desired = slugify(rawFullName);
        photoLocal = await downloadFile(photoRemote, 'players', `${slug}-${desired}`);
      }

      const playerData: any = {
        name: rawFullName,
        shirtNo: shirtNo ?? null,
        gender: gender ?? null,
        photoUrl: photoLocal || photoRemote || null,
        personType: (p.personType || (personType ?? null)) ?? null,
        function: (personFunction ?? null)
      };
      logger.info(`Player ${rawFullName} (${JSON.stringify(playerData)})`);
      if (extId) playerData.externalId = extId;

      if (existingPlayer) {
        await prisma.player.update({
          where: { id: existingPlayer.id },
          data: {
            ...playerData,
            // In tests we use a lightweight mock that doesn't understand nested connect.
            // Setting clubId directly keeps both real Prisma and tests happy.
            clubId: club.id,
          },
        });
        playersUpdated++;
      } else {
        await prisma.player.create({
          data: {
            ...playerData,
            // Set relation using direct foreign key for compatibility with test mocks
            clubId: club.id,
          },
        });
        playersCreated++;
      }
    }
  }

  return {ok: true, clubsCreated, clubsUpdated, playersCreated, playersUpdated, problems};
}

// Types for import request
// Accept either { sources: [{ teamId, poolId }] } or single { teamId, poolId }

// Import all league teams by scraping the public teams index
// POST /api/clubs/import/league-teams { limit?: number }
clubsRouter.post('/import/league-teams', async (req, res, next) => {
  try {
    const limit = Number(req.body?.limit) > 0 ? Number(req.body.limit) : undefined;
    const indexUrl = 'https://league.korfbal.nl/teams/';
    logger.info(`HTTP GET ${indexUrl} — fetching teams index`);
    const idxResp = await fetch(indexUrl);
    logger.info(`HTTP ${idxResp.status} GET ${indexUrl} — teams index`);
    if (!idxResp.ok) return res.status(502).json({error: `Failed to fetch teams index (${idxResp.status})`});
    const html = await idxResp.text();
    const links = extractTeamLinksFromIndex(html, indexUrl);
    logger.info(`Extracted ${links.length} links from league teams index`);
    logger.info(`$links[1] = ${links[1]}`);
    const picked = typeof limit === 'number' ? links.slice(0, limit) : links;

    const sources: Array<{ teamId: string; poolId: string }> = [];
    const problems: string[] = [];

    for (const url of picked) {
      try {
        logger.info(`HTTP GET ${url} — fetching team page`);
        const resp = await fetch(url);
        logger.info(`HTTP ${resp.status} GET ${url} — team page`);
        if (!resp.ok) {
          problems.push(`Team page fetch failed (${resp.status}): ${url}`);
          continue;
        }
        const page = await resp.text();
        logger.info(`Scraped team page ${url}`);
        const ids = extractIdsFromTeamPage(page);
        logger.info(`Extracted ids from team page ${url}: ${JSON.stringify(ids)}`);
        if (ids.teamId && ids.poolId) {
          sources.push({teamId: ids.teamId, poolId: ids.poolId});
        } else {
          problems.push(`Could not extract teamId/poolId: ${url}`);
        }
      } catch (e: any) {
        problems.push(`Error fetching team page ${url}: ${e?.message || 'unknown'}`);
      }
    }

    if (sources.length === 0) {
      return res.status(400).json({error: 'No team pages with extractable ids found', problems});
    }

    const result = await processImportSources(sources);
    // Merge problems from scraping phase
    result.problems = [...(result.problems || []), ...problems];
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

clubsRouter.post('/import', async (req, res, next) => {
  try {
    const body = req.body || {};
    const sources: Array<{ teamId: string | number; poolId: string | number } | { apiUrl: string } | {
      name: string;
      shortName?: string;
      logoUrl?: string;
      slug?: string;
      players?: Array<{
        name: string;
        shirtNo?: number;
        gender?: 'male' | 'female';
        photoUrl?: string;
        externalId?: string
      }>
    }> = Array.isArray(body.sources)
      ? body.sources
      : (body.teamId && body.poolId) || body.apiUrl || body.name
        ? [body]
        : [];

    if (sources.length === 0) {
      return res.status(400).json({error: 'Provide sources array or an object with teamId+poolId or apiUrl or name'});
    }

    const result = await processImportSources(sources);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// List clubs
clubsRouter.get('/', async (_req, res, next) => {
  try {
    const items = await prisma.club.findMany({orderBy: {name: 'asc'}});
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});

// Delete club by slug (also removes its players)
clubsRouter.delete('/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug);
    const club = await prisma.club.findUnique({ where: { slug } });
    if (!club) return res.status(404).json({ error: 'Club not found' });
    // Remove players first to satisfy FK constraints (if cascade not configured)
    try {
      await prisma.player.deleteMany({ where: { clubId: club.id } });
    } catch (e) {
      // ignore; continue to delete club
    }
    await prisma.club.delete({ where: { id: club.id } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// List players for a club by slug (for dropdown)
clubsRouter.get('/:slug/players', async (req, res, next) => {
  try {
    const slug = String(req.params.slug);
    const club = await prisma.club.findUnique({where: {slug}});
    if (!club) return res.status(404).json({error: 'Club not found'});
    const items = await prisma.player.findMany({
      where: {clubId: club.id},
      orderBy: [{shirtNo: 'asc' as const}, {name: 'asc' as const}]
    });
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});
