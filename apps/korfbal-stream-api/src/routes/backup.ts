import {requireOrganizationId} from '../services/organizationContext';
import {randomUUID} from 'node:crypto';
import {Router} from 'express';
import {findExistingPosition, findOrCreatePosition} from '../services/positions';
import {prisma} from '../services/prisma';
import {logger} from '../utils/logger';
import {parseInstant} from '../utils/time';
import {PersonInputSchema} from '../schemas/person';
import {SkillInputSchema} from '../schemas/skill';
import {SponsorInputSchema} from '../schemas/sponsor';
import {currentOrganizationRef, resolveClientLogoUrl} from '../services/sponsorLogos';
import {migrateLogoStorage} from '../services/logoStorage';
import {titlePartsForCreate} from '../services/backupFields';
import {organizationImagePaths, streamImagesZip} from '../services/backupImages';
import {contentDisposition} from '../utils/attachment';
import {clubAbbreviation, clubColor} from '../utils/clubs';
import {amsterdamDay} from '../utils/time';
import {z} from 'zod';
import {Prisma} from '@prisma/client';
import {
  ACTIVE_SEASON_ID_KEY,
  createSeasonIdResolver,
  getActiveSeason,
} from '../services/season';
import {migrateLegacySeasonAssets} from '../services/seasonAssetMigration';
import {getSetting, GLOBAL_SETTING_KEYS, setSetting} from '../services/appSettings';
import {getOwnClubId, setOwnClubId} from '../services/ownClub';
import {clearOrganizationLookupCache} from '../middleware/organizationContext';

export const backupRouter: Router = Router();

/** Settings-backup key for the active season, stored by name because season ids differ per database. */
export const ACTIVE_SEASON_NAME_EXPORT_KEY = 'activeSeasonName';
/** The own club of backups made before it moved to Organization.clubId. */
const LEGACY_OWN_CLUB_ID_KEY = 'ownClubId';
// Club ids are serial per database (the clubs restore matches on slug): the own club also goes out by slug
const OWN_CLUB_SLUG_EXPORT_KEY = 'ownClubSlug';
/** Settings-backup key for the chosen organization's details: {name, slug, logoUrl, clubSlug, isActive}. */
export const ORGANIZATION_DETAILS_EXPORT_KEY = 'organizationDetails';
/** Settings-backup key for the seasons' indoor start dates, by season name (seasons are global): [{seasonName, indoorStartDate}]. */
export const SEASON_INDOOR_START_EXPORT_KEY = 'seasonIndoorStartDates';

/** A sponsor in a backup: the normal input plus the fields only a backup carries. */
const SponsorBackupSchema = SponsorInputSchema.extend({ categories: z.string().nullable().optional() });

// Version for segment template JSON
const SEGMENT_TEMPLATE_JSON_VERSION = 1 as const;

// --- Export Endpoints ---

// GET /api/backup/segment-templates/export
backupRouter.get('/segment-templates/export', async (_req, res, next) => {
  try {
    const templates = await prisma.segmentTemplate.findMany({ include: { items: { orderBy: { volgorde: 'asc' } } }, orderBy: { name: 'asc' } });
    const exportData = templates.map(t => ({
      version: SEGMENT_TEMPLATE_JSON_VERSION,
      name: t.name,
      items: t.items.map(i => ({ naam: i.naam, volgorde: i.volgorde, duurInMinuten: i.duurInMinuten, isTimeAnchor: i.isTimeAnchor }))
    }));
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=segment-templates.json');
    return res.json(exportData);
  } catch (err) {
    logger.error('GET /api/backup/segment-templates/export failed', err as any);
    return next(err);
  }
});

// GET /api/backup/persons/export
backupRouter.get('/persons/export', async (_req, res, next) => {
  try {
    const items = await prisma.person.findMany({
      orderBy: { id: 'asc' },
      include: {
        skills: {
          include: {
            skill: true
          }
        }
      }
    });

    const exportData = items.map((p) => ({
      name: p.name,
      gender: p.gender,
      skills: p.skills.map(ps => ({
        code: ps.skill.code,
        name: ps.skill.name,
        nameMale: ps.skill.nameMale,
        nameFemale: ps.skill.nameFemale,
        type: ps.skill.type
      }))
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=persons.json');
    return res.json(exportData);
  } catch (err) {
    logger.error('GET /api/backup/persons/export failed', err as any);
    return next(err);
  }
});

// GET /api/backup/skills/export
backupRouter.get('/skills/export', async (_req, res, next) => {
  try {
    const items = await prisma.skill.findMany({ orderBy: { code: 'asc' } });
    const exportData = items.map((s) => ({
      code: s.code,
      name: s.name,
      nameMale: s.nameMale,
      nameFemale: s.nameFemale,
      type: s.type,
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=skills.json');
    return res.json(exportData);
  } catch (err) {
    logger.error('GET /api/backup/skills/export failed', err as any);
    return next(err);
  }
});

// GET /api/backup/positions/export
backupRouter.get('/positions/export', async (_req, res, next) => {
  try {
    const items = await prisma.position.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { skill: true }
    });

    const exportData = items.map(p => ({
      name: p.name,
      category: p.category,
      sortOrder: p.sortOrder,
      isStudio: p.isStudio,
      skillCode: p.skill?.code || null
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=positions.json');
    return res.json(exportData);
  } catch (err) {
    logger.error('GET /api/backup/positions/export failed', err as any);
    return next(err);
  }
});

// GET /api/backup/matches/export
backupRouter.get('/matches/export', async (_req, res, next) => {
  try {
    const items = await prisma.matchSchedule.findMany({
      orderBy: { date: 'asc' },
      include: { season: true }
    });

    const exportData = items.map(m => ({
      seasonName: m.season?.name,
      externalId: m.externalId,
      date: m.date,
      homeTeamName: m.homeTeamName,
      awayTeamName: m.awayTeamName,
      accommodationName: m.accommodationName,
      accommodationRoute: m.accommodationRoute,
      attendanceTime: m.attendanceTime,
      isPracticeMatch: m.isPracticeMatch,
      isHomeMatch: m.isHomeMatch,
      isCompetitiveMatch: m.isCompetitiveMatch,
      isManual: m.isManual,
      fieldName: m.fieldName,
      refereeName: m.refereeName,
      reserveRefereeName: m.reserveRefereeName,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      color: m.color
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=matches.json');
    return res.json(exportData);
  } catch (err) {
    logger.error('GET /api/backup/matches/export failed', err as any);
    return next(err);
  }
});

// GET /api/backup/producties/export
backupRouter.get('/producties/export', async (_req, res, next) => {
  try {
    const productions = await prisma.production.findMany({
      include: {
        matchSchedule: { include: { season: true } },
        productionReport: true,
        productionPersons: {
          include: {
            person: {
              include: {
                skills: {
                  include: {
                    skill: true
                  }
                }
              }
            }
          }
        },
        productionPositions: {
          include: {
            position: true,
            person: true
          }
        },
        segments: {
          include: {
            bezetting: {
              include: {
                person: true,
                position: true
              }
            }
          },
          orderBy: { volgorde: 'asc' }
        },
        TitleDefinition: {
          include: {
            parts: true
          }
        },
        interviewSubjects: {
          include: {
            player: {
              include: {
                club: true
              }
            },
            titleDefinition: true
          }
        },
        callSheets: {
          include: {
            items: {
              include: {
                positions: {
                  include: {
                    position: true
                  }
                }
              }
            }
          }
        },
        productionEvents: {
          include: {
            positions: {
              include: {
                position: true
              }
            }
          }
        }
      },
      orderBy: { id: 'asc' }
    });

    const exportData = productions.map(p => ({
      version: 1,
      exportedAt: new Date().toISOString(),
      matchSchedule: {
        externalId: p.matchSchedule.externalId,
        date: p.matchSchedule.date,
        homeTeamName: p.matchSchedule.homeTeamName,
        awayTeamName: p.matchSchedule.awayTeamName,
        accommodationName: p.matchSchedule.accommodationName,
        accommodationRoute: p.matchSchedule.accommodationRoute,
        attendanceTime: p.matchSchedule.attendanceTime,
        isPracticeMatch: p.matchSchedule.isPracticeMatch,
        isHomeMatch: p.matchSchedule.isHomeMatch,
        isCompetitiveMatch: p.matchSchedule.isCompetitiveMatch,
        fieldName: p.matchSchedule.fieldName,
        refereeName: p.matchSchedule.refereeName,
        reserveRefereeName: p.matchSchedule.reserveRefereeName,
        homeScore: p.matchSchedule.homeScore,
        awayScore: p.matchSchedule.awayScore,
        color: p.matchSchedule.color,
        isManual: p.matchSchedule.isManual,
        seasonName: p.matchSchedule.season?.name
      },
      production: {
        isActive: p.isActive,
        liveTime: p.liveTime,
        setupTime: p.setupTime,
        crewCallTime: p.crewCallTime,
        report: p.productionReport ? {
          matchSponsor: p.productionReport.matchSponsor,
          ballSponsor: p.productionReport.ballSponsor,
          interviewRationale: p.productionReport.interviewRationale,
          remarks: p.productionReport.remarks
        } : null
      },
      persons: p.productionPersons.map(pp => ({
        name: pp.person.name,
        gender: pp.person.gender,
        skills: pp.person.skills.map(ps => ({
          code: ps.skill.code,
          name: ps.skill.name,
          nameMale: ps.skill.nameMale,
          nameFemale: ps.skill.nameFemale,
          type: ps.skill.type
        }))
      })),
      positions: p.productionPositions.map(pp => ({
        personName: pp.person.name,
        positionName: pp.position.name,
        isStudio: pp.position.isStudio
      })),
      segments: p.segments.map(seg => ({
        naam: seg.naam,
        volgorde: seg.volgorde,
        duurInMinuten: seg.duurInMinuten,
        isTimeAnchor: seg.isTimeAnchor,
        assignments: seg.bezetting.map(bez => ({
          personName: bez.person.name,
          positionName: bez.position.name,
          isStudio: bez.position.isStudio
        }))
      })),
      titles: p.TitleDefinition.map(td => ({
        id: td.id,
        name: td.name,
        order: td.order,
        enabled: td.enabled,
        parts: td.parts.map(tp => ({
          sourceType: tp.sourceType,
          teamSide: tp.teamSide,
          limit: tp.limit,
          filters: tp.filters,
          customFunction: tp.customFunction,
          customName: tp.customName
        }))
      })),
      interviews: p.interviewSubjects.map(subj => ({
        side: subj.side,
        role: subj.role,
        playerName: subj.player.name,
        playerShirtNo: subj.player.shirtNo,
        playerGender: subj.player.gender,
        playerPersonType: subj.player.personType,
        playerFunction: subj.player.function,
        playerPhotoUrl: subj.player.photoUrl,
        clubName: subj.player.club.name,
        clubShortName: subj.player.club.shortName,
        clubSlug: subj.player.club.slug,
        clubLogoUrl: subj.player.club.logoUrl,
        titleName: subj.titleDefinition?.name || null
      })),
      callSheets: p.callSheets.map(cs => ({
        name: cs.name,
        color: cs.color,
        items: cs.items.map(item => ({
          id: item.id,
          productionSegmentVolgorde: item.productionSegmentId ? p.segments.find(s => s.id === item.productionSegmentId)?.volgorde : null,
          cue: item.cue,
          title: item.title,
          note: item.note,
          color: item.color,
          timeStart: item.timeStart,
          timeEnd: item.timeEnd,
          durationSec: item.durationSec,
          orderIndex: item.orderIndex,
          isInVenue: item.isInVenue,
          anchorType: item.anchorType,
          isTimeAnchor: item.isTimeAnchor,
          autoAdvance: item.autoAdvance,
          isInLivestream: item.isInLivestream,
          parentId: item.parentId,
          positions: item.positions.map(pos => pos.position.name)
        }))
      })),
      productionEvents: p.productionEvents.map(ev => ({
        id: ev.id,
        callSheetItemId: ev.callSheetItemId,
        parentId: ev.parentId,
        metadata: ev.metadata,
        title: ev.title,
        status: ev.status,
        order: ev.order,
        actualStartTime: ev.actualStartTime,
        plannedStartTime: ev.plannedStartTime,
        plannedEndTime: ev.plannedEndTime,
        durationSec: ev.durationSec,
        note: ev.note,
        triggerSource: ev.triggerSource,
        vMixInputName: ev.vMixInputName,
        isInVenue: ev.isInVenue,
        isInLivestream: ev.isInLivestream,
        isTimeAnchor: ev.isTimeAnchor,
        anchorType: ev.anchorType,
        autoAdvance: ev.autoAdvance,
        positions: ev.positions.map(pos => pos.position.name)
      }))
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=productions.json');
    return res.json(exportData);
  } catch (err) {
    logger.error('GET /api/backup/producties/export failed', err as any);
    return next(err);
  }
});

// GET /api/backup/clubs/export
backupRouter.get('/clubs/export', async (_req, res, next) => {
  try {
    const items = await prisma.club.findMany({
      include: { players: { include: { season: true } } },
      orderBy: { name: 'asc' }
    });

    const exportData = items.map(c => ({
      name: c.name,
      shortName: c.shortName,
      abbreviation: c.abbreviation,
      primaryColor: c.primaryColor,
      secondaryColor: c.secondaryColor,
      slug: c.slug,
      logoUrl: c.logoUrl,
      players: c.players.map(p => ({
        name: p.name,
        shirtNo: p.shirtNo,
        gender: p.gender,
        photoUrl: p.photoUrl,
        externalId: p.externalId,
        personType: p.personType,
        function: p.function,
        seasonName: p.season?.name
      }))
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=clubs.json');
    return res.json(exportData);
  } catch (err) {
    logger.error('GET /api/backup/clubs/export failed', err as any);
    return next(err);
  }
});

// GET /api/backup/sponsors/export
backupRouter.get('/sponsors/export', async (_req, res, next) => {
  try {
    const items = await prisma.sponsor.findMany({
      orderBy: { name: 'asc' }
    });

    const exportData = items.map(s => ({
      name: s.name,
      type: s.type,
      websiteUrl: s.websiteUrl,
      logoUrl: s.logoUrl,
      categories: s.categories,
      displayName: (s as any).displayName,
      enabled: s.enabled
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=sponsors.json');
    return res.json(exportData);
  } catch (err) {
    logger.error('GET /api/backup/sponsors/export failed', err as any);
    return next(err);
  }
});

// GET /api/backup/settings/export
// The chosen organization's settings and own club, plus the installation's active season (by name, for
// reference: a restore into one organization doesn't change it).
backupRouter.get('/settings/export', async (_req, res, next) => {
  try {
    const items = await prisma.organizationSetting.findMany({ orderBy: { key: 'asc' } });
    const exportData: { key: string; value: unknown }[] = items.map((s) => ({ key: s.key, value: s.value }));
    // The own club lives on the organization; exported under its old key so older and newer backups restore alike
    const ownClubId = await getOwnClubId();
    if (ownClubId !== null) {
      exportData.push({ key: LEGACY_OWN_CLUB_ID_KEY, value: ownClubId });
      const club = await prisma.club.findUnique({ where: { id: ownClubId }, select: { slug: true } });
      if (club) exportData.push({ key: OWN_CLUB_SLUG_EXPORT_KEY, value: club.slug });
    }

    // Season ids are serial per database: export the active season by name so it resolves on import.
    const activeSeasonId = await getSetting<number>(ACTIVE_SEASON_ID_KEY);
    const season = typeof activeSeasonId === 'number' ? await prisma.season.findUnique({ where: { id: activeSeasonId } }) : null;
    if (season) exportData.push({ key: ACTIVE_SEASON_NAME_EXPORT_KEY, value: season.name });

    // The organization itself (its slug only for reference: a restore never changes the target's slug)
    const organization = await prisma.organization.findUnique({ where: { id: requireOrganizationId() }, include: { club: { select: { slug: true } } } });
    if (organization) {
      exportData.push({
        key: ORGANIZATION_DETAILS_EXPORT_KEY,
        value: { name: organization.name, slug: organization.slug, logoUrl: organization.logoUrl, clubSlug: organization.club?.slug ?? null, isActive: organization.isActive },
      });
    }
    // Seasons are global, so they aren't restored; their indoor start date is, by name, when it is missing
    const seasons = (await prisma.season.findMany({ orderBy: { startYear: 'asc' } })).filter((s) => s.indoorStartDate instanceof Date);
    if (seasons.length) {
      exportData.push({
        key: SEASON_INDOOR_START_EXPORT_KEY,
        value: seasons.map((s) => ({ seasonName: s.name, indoorStartDate: s.indoorStartDate!.toISOString().slice(0, 10) })),
      });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=settings.json');
    return res.json(exportData);
  } catch (err) {
    logger.error('GET /api/backup/settings/export failed', err as any);
    return next(err);
  }
});

// GET /api/backup/images
// A zip of the chosen organization's image files under their paths relative to ASSETS_DIR
// (sponsors/<slug>/…, organizations/<slug>.<ext>, and the shared clubs/… logos and player photos its
// data uses: services/backupImages.ts), so it unpacks straight into storage/. Streamed.
backupRouter.get('/images', async (_req, res, next) => {
  try {
    const organization = await currentOrganizationRef();
    const paths = await organizationImagePaths();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', contentDisposition(`afbeeldingen-${organization.slug}-${amsterdamDay(new Date())}.zip`));
    const files = await streamImagesZip(paths, res);
    logger.info(`Image backup of ${organization.slug}: ${files} files`);
  } catch (err) {
    logger.error('GET /api/backup/images failed', err as any);
    if (res.headersSent) return res.destroy(err as Error);
    return next(err);
  }
});

// --- Import Endpoints ---

// POST /api/backup/persons/import
backupRouter.post('/persons/import', async (req, res, next) => {
  try {
    const data = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Array expected' });
    let created = 0, updated = 0;
    for (const item of data) {
      try {
        const input = PersonInputSchema.parse({ name: item.name, gender: item.gender });
        let person = await prisma.person.findFirst({ where: { name: input.name } });
        if (person) {
          person = await prisma.person.update({ where: { id: person.id }, data: input as any });
          updated++;
        } else {
          person = await prisma.person.create({ data: input as any });
          created++;
        }
        // Skills management
        if (Array.isArray(item.skills)) {
          for (const s of item.skills) {
            const skill = await prisma.skill.findFirst({ where: { code: s.code } });
            if (skill) {
              await prisma.personSkill.upsert({
                where: { personId_skillId: { personId: person.id, skillId: skill.id } },
                create: { personId: person.id, skillId: skill.id },
                update: {}
              });
            }
          }
        }
      } catch (_) { /* an invalid row is skipped */ }
    }
    return res.json({ ok: true, created, updated });
  } catch (err) {
    logger.error('POST /api/backup/persons/import failed', err as any);
    return next(err);
  }
});

// POST /api/backup/skills/import
backupRouter.post('/skills/import', async (req, res, next) => {
  try {
    const data = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Array expected' });
    let created = 0, updated = 0;
    for (const item of data) {
      try {
        const input = SkillInputSchema.parse(item);
        const existing = await prisma.skill.findFirst({ where: { code: input.code } });
        if (existing) {
          await prisma.skill.update({ where: { id: existing.id }, data: input as any });
          updated++;
        } else {
          await prisma.skill.create({ data: input as any });
          created++;
        }
      } catch (_) { /* an invalid row is skipped */ }
    }
    return res.json({ ok: true, created, updated });
  } catch (err) {
    logger.error('POST /api/backup/skills/import failed', err as any);
    return next(err);
  }
});

// POST /api/backup/positions/import
backupRouter.post('/positions/import', async (req, res, next) => {
  try {
    const data = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Array expected' });
    let created = 0, updated = 0;
    for (const item of data) {
      try {
        const skill = item.skillCode ? await prisma.skill.findFirst({ where: { code: item.skillCode } }) : null;
        const input = {
          name: item.name,
          category: item.category,
          sortOrder: item.sortOrder,
          isStudio: !!item.isStudio,
          skillId: skill?.id || null
        };
        const existing = await findExistingPosition(prisma, item.name);
        if (existing) {
          await prisma.position.update({ where: { id: existing.id }, data: input as any });
          updated++;
        } else {
          await prisma.position.create({ data: input as any });
          created++;
        }
      } catch (_) { /* an invalid row is skipped */ }
    }
    return res.json({ ok: true, created, updated });
  } catch (err) {
    logger.error('POST /api/backup/positions/import failed', err as any);
    return next(err);
  }
});

// POST /api/backup/matches/import
backupRouter.post('/matches/import', async (req, res, next) => {
  try {
    const data = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Array expected' });
    let created = 0, updated = 0;
    // A match's season is always derived from its date; an exported seasonName is informational only.
    const seasons = createSeasonIdResolver();
    for (const item of data) {
      try {
        const date = parseInstant(item.date);
        if (!date) continue; // an invalid row is skipped
        const matchData = {
          externalId: item.externalId,
          date,
          seasonId: await seasons.forDate(date),
          homeTeamName: item.homeTeamName,
          awayTeamName: item.awayTeamName,
          accommodationName: item.accommodationName,
          accommodationRoute: item.accommodationRoute,
          attendanceTime: parseInstant(item.attendanceTime),
          isPracticeMatch: !!item.isPracticeMatch,
          isHomeMatch: !!item.isHomeMatch,
          isCompetitiveMatch: !!item.isCompetitiveMatch,
          isManual: !!item.isManual,
          fieldName: item.fieldName,
          refereeName: item.refereeName,
          reserveRefereeName: item.reserveRefereeName,
          homeScore: item.homeScore,
          awayScore: item.awayScore,
          color: item.color
        };

        let existing;
        if (item.externalId) {
          existing = await prisma.matchSchedule.findFirst({ where: { externalId: item.externalId } });
        } else {
          existing = await prisma.matchSchedule.findFirst({
            where: {
              date: matchData.date,
              homeTeamName: matchData.homeTeamName,
              awayTeamName: matchData.awayTeamName
            }
          });
        }

        if (existing) {
          await prisma.matchSchedule.update({ where: { id: existing.id }, data: matchData });
          updated++;
        } else {
          await prisma.matchSchedule.create({ data: matchData });
          created++;
        }
      } catch (_) { /* an invalid row is skipped */ }
    }
    return res.json({ ok: true, created, updated });
  } catch (err) {
    logger.error('POST /api/backup/matches/import failed', err as any);
    return next(err);
  }
});

// POST /api/backup/segment-templates/import
backupRouter.post('/segment-templates/import', async (req, res, next) => {
  try {
    const data = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Array expected' });
    let created = 0, updated = 0;
    for (const item of data) {
      try {
        const version = Number(item.version ?? 1);
        if (!Number.isInteger(version) || version > SEGMENT_TEMPLATE_JSON_VERSION) continue;
        const name = String(item.name || '').trim();
        if (!name) continue;
        const items = Array.isArray(item.items) ? item.items : [];
        const existing = await prisma.segmentTemplate.findFirst({ where: { name } }).catch(() => null);
        let tplId: number;
        if (existing) {
          tplId = existing.id;
          await prisma.segmentTemplateItem.deleteMany({ where: { templateId: tplId } });
          updated++;
        } else {
          const tpl = await prisma.segmentTemplate.create({ data: { name } });
          tplId = tpl.id;
          created++;
        }
        for (const raw of items) {
          const naam = String(raw.naam || '').trim();
          const volgorde = Number(raw.volgorde);
          const duurInMinuten = Number(raw.duurInMinuten);
          const isTimeAnchor = !!raw.isTimeAnchor;
          if (!naam || !Number.isInteger(volgorde) || volgorde <= 0 || !Number.isInteger(duurInMinuten) || duurInMinuten < 0) continue;
          await prisma.segmentTemplateItem.create({ data: { templateId: tplId, naam, volgorde, duurInMinuten, isTimeAnchor } });
        }
      } catch (_) { /* an invalid row is skipped */ }
    }
    return res.json({ ok: true, created, updated });
  } catch (err) {
    logger.error('POST /api/backup/segment-templates/import failed', err as any);
    return next(err);
  }
});

// POST /api/backup/producties/import
backupRouter.post('/producties/import', async (req, res, next) => {
  try {
    const data = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Array expected' });
    let created = 0, updated = 0;
    const seasons = createSeasonIdResolver();
    for (const item of data) {
      try {
        if (!item.matchSchedule || !item.production) continue;
        // seasonName is informational only: the season is always derived from the match date.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { seasonName: _seasonName, ...matchSchedule } = item.matchSchedule;
        const matchDate = parseInstant(matchSchedule.date);
        if (!matchDate) continue; // an invalid row is skipped
        const seasonId = await seasons.forDate(matchDate);

        await prisma.$transaction(async (tx) => {
          // 1. Find or create MatchSchedule
          let match;
          if (item.matchSchedule.externalId) {
            match = await tx.matchSchedule.findFirst({
              where: { externalId: item.matchSchedule.externalId }
            });
          } else {
            match = await tx.matchSchedule.findFirst({
              where: {
                date: matchDate,
                homeTeamName: item.matchSchedule.homeTeamName,
                awayTeamName: item.matchSchedule.awayTeamName
              }
            });
          }

          const matchData = {
            ...matchSchedule,
            date: matchDate,
            seasonId,
            attendanceTime: parseInstant(matchSchedule.attendanceTime)
          };

          if (match) {
            match = await tx.matchSchedule.update({
              where: { id: match.id },
              data: matchData
            });
          } else {
            match = await tx.matchSchedule.create({
              data: matchData
            });
          }

          // 2. Create Production
          let production = await tx.production.findUnique({ where: { matchScheduleId: match.id } });
          if (!production) {
            production = await tx.production.create({
              data: {
                matchScheduleId: match.id,
                isActive: !!item.production.isActive,
                liveTime: parseInstant(item.production.liveTime),
                setupTime: parseInstant(item.production.setupTime),
                crewCallTime: parseInstant(item.production.crewCallTime)
              }
            });
            created++;
          } else {
            production = await tx.production.update({
              where: { id: production.id },
              data: {
                isActive: !!item.production.isActive,
                liveTime: parseInstant(item.production.liveTime),
                setupTime: parseInstant(item.production.setupTime),
                crewCallTime: parseInstant(item.production.crewCallTime)
              }
            });
            updated++;
          }

          // 3. Upsert Production Report
          if (item.production.report) {
            await tx.productionReport.upsert({
              where: { productionId: production.id },
              update: item.production.report,
              create: {
                productionId: production.id,
                ...item.production.report
              }
            });
          }

          // 4. Process Persons and Skills
          if (Array.isArray(item.persons)) {
            for (const pData of item.persons) {
              let person = await tx.person.findFirst({ where: { name: pData.name } });
              if (!person) {
                person = await tx.person.create({
                  data: { name: pData.name, gender: pData.gender }
                });
              }

              if (Array.isArray(pData.skills)) {
                for (const sData of pData.skills) {
                  const skill = await tx.skill.upsert({
                    where: { organizationId_code: { organizationId: requireOrganizationId(), code: sData.code } },
                    update: { name: sData.name, nameMale: sData.nameMale, nameFemale: sData.nameFemale, type: sData.type },
                    create: { code: sData.code, name: sData.name, nameMale: sData.nameMale, nameFemale: sData.nameFemale, type: sData.type }
                  });
                  await tx.personSkill.upsert({
                    where: { personId_skillId: { personId: person.id, skillId: skill.id } },
                    update: {},
                    create: { personId: person.id, skillId: skill.id }
                  });
                }
              }
            }
          }

          // 5. Link Persons to Production (ProductionPerson)
          if (Array.isArray(item.persons)) {
            for (const pData of item.persons) {
              const person = await tx.person.findFirst({ where: { name: pData.name } });
              if (person) {
                await tx.productionPerson.upsert({
                  where: { productionId_personId: { productionId: production.id, personId: person.id } },
                  update: {},
                  create: { productionId: production.id, personId: person.id }
                });
              }
            }
          }

          // 6. Crew / Position Assignments
          if (Array.isArray(item.positions)) {
            for (const cData of item.positions) {
              const person = await tx.person.findFirst({ where: { name: cData.personName } });
              const position = await findOrCreatePosition(tx, cData.positionName, { isStudio: !!cData.isStudio });
              if (person) {
                await tx.productionPersonPosition.upsert({
                  where: {
                    productionId_personId_positionId: {
                      productionId: production.id,
                      personId: person.id,
                      positionId: position.id
                    }
                  },
                  update: {},
                  create: {
                    productionId: production.id,
                    personId: person.id,
                    positionId: position.id
                  }
                });
              }
            }
          }

          // 7. Segments and Bezetting
          if (Array.isArray(item.segments)) {
            await tx.productionChapter.deleteMany({ where: { productionId: production.id } });

            for (const sData of item.segments) {
              const segment = await tx.productionChapter.create({
                data: {
                  productionId: production.id,
                  naam: sData.naam,
                  volgorde: sData.volgorde,
                  duurInMinuten: sData.duurInMinuten,
                  isTimeAnchor: !!sData.isTimeAnchor
                }
              });

              if (Array.isArray(sData.assignments)) {
                for (const bData of sData.assignments) {
                  const person = await tx.person.findFirst({ where: { name: bData.personName } });
                  const position = await findOrCreatePosition(tx, bData.positionName, { isStudio: !!bData.isStudio });
                  if (person) {
                    await tx.chapterRoleAssignment.create({
                      data: {
                        productionSegmentId: segment.id,
                        personId: person.id,
                        positionId: position.id
                      }
                    });
                  }
                }
              }
            }
          }

          // 8. Titles
          const titleIdMap = new Map<number, number>();
          if (Array.isArray(item.titles)) {
            await tx.titleDefinition.deleteMany({ where: { productionId: production.id } });
            for (const tData of item.titles) {
              const title = await tx.titleDefinition.create({
                data: {
                  productionId: production.id,
                  name: tData.name,
                  order: tData.order,
                  enabled: tData.enabled,
                  parts: {
                    create: titlePartsForCreate(tData.parts)
                  }
                }
              });
              titleIdMap.set(tData.id, title.id);
            }
          }

          // 9. Interviews
          if (Array.isArray(item.interviews)) {
            await tx.interviewSubject.deleteMany({ where: { productionId: production.id } });
            for (const intData of item.interviews) {
              let club = await tx.club.findUnique({ where: { slug: intData.clubSlug } });
              if (!club) {
                club = await tx.club.create({
                  data: {
                    name: intData.clubName,
                    shortName: intData.clubShortName,
                    abbreviation: clubAbbreviation(intData.clubShortName || intData.clubName),
                    slug: intData.clubSlug,
                    logoUrl: intData.clubLogoUrl
                  }
                });
              }
              let player = await tx.player.findFirst({ where: { seasonId: match.seasonId, clubId: club.id, name: intData.playerName } });
              if (!player) {
                player = await tx.player.create({
                  data: {
                    clubId: club.id,
                    seasonId: match.seasonId,
                    name: intData.playerName,
                    shirtNo: intData.playerShirtNo,
                    gender: intData.playerGender,
                    personType: intData.playerPersonType,
                    function: intData.playerFunction,
                    photoUrl: intData.playerPhotoUrl
                  }
                });
              }

              let titleId = null;
              if (intData.titleName) {
                const title = await tx.titleDefinition.findFirst({
                  where: { productionId: production.id, name: intData.titleName }
                });
                titleId = title?.id || null;
              }

              await tx.interviewSubject.create({
                data: {
                  productionId: production.id,
                  playerId: player.id,
                  titleDefinitionId: titleId,
                  side: intData.side,
                  role: intData.role
                }
              });
            }
          }

          // 10. CallSheets (old item id -> new item id over all callsheets, for the events below)
          const callSheetItemIds = new Map<string, string>();
          if (Array.isArray(item.callSheets)) {
            await tx.callSheet.deleteMany({ where: { productionId: production.id } });
            for (const csData of item.callSheets) {
              const callSheet = await tx.callSheet.create({
                data: { productionId: production.id, name: csData.name, color: csData.color }
              });

              if (Array.isArray(csData.items)) {
                // New ids: item ids are global, and the backup may come from another organization
                const itemIdMap = new Map<string, string>();
                for (const iData of csData.items) {
                  const seg = iData.productionSegmentVolgorde ? await tx.productionChapter.findFirst({
                    where: { productionId: production.id, volgorde: iData.productionSegmentVolgorde }
                  }) : null;

                  const callSheetItem = await tx.callSheetItem.create({
                    data: {
                      id: randomUUID(),
                      callSheetId: callSheet.id,
                      cue: iData.cue,
                      title: iData.title,
                      note: iData.note,
                      color: iData.color,
                      timeStart: parseInstant(iData.timeStart),
                      timeEnd: parseInstant(iData.timeEnd),
                      durationSec: Number(iData.durationSec || 0),
                      orderIndex: Number(iData.orderIndex || 0),
                      isInVenue: !!iData.isInVenue,
                      anchorType: iData.anchorType,
                      isTimeAnchor: !!iData.isTimeAnchor,
                      autoAdvance: !!iData.autoAdvance,
                      isInLivestream: iData.isInLivestream !== false,
                      productionSegmentId: seg?.id || null
                    }
                  });
                  if (iData.id) {
                    itemIdMap.set(String(iData.id), callSheetItem.id);
                    callSheetItemIds.set(String(iData.id), callSheetItem.id);
                  }

                  if (Array.isArray(iData.positions)) {
                    for (const posName of iData.positions) {
                      const position = await findOrCreatePosition(tx, posName);
                      await tx.callSheetItemPosition.create({
                        data: {
                          callSheetItemId: callSheetItem.id,
                          positionId: position.id
                        }
                      });
                    }
                  }
                }
                for (const iData of csData.items) {
                  const id = iData.id && itemIdMap.get(String(iData.id));
                  const parentId = iData.parentId && itemIdMap.get(String(iData.parentId));
                  if (id && parentId) await tx.callSheetItem.update({ where: { id }, data: { parentId } });
                }
              }
            }
          }

          // 11. Production Events
          if (Array.isArray(item.productionEvents)) {
            await tx.productionEvent.deleteMany({ where: { productionId: production.id } });

            const eventIds = new Map<string, string>();
            for (const evData of item.productionEvents) {
              const callSheetItemId = evData.callSheetItemId ? callSheetItemIds.get(String(evData.callSheetItemId)) ?? null : null;
              const event = await tx.productionEvent.create({
                data: {
                  productionId: production.id,
                  callSheetItemId,
                  metadata: evData.metadata == null ? Prisma.DbNull : evData.metadata,
                  title: evData.title,
                  status: evData.status,
                  order: evData.order,
                  actualStartTime: parseInstant(evData.actualStartTime),
                  plannedStartTime: parseInstant(evData.plannedStartTime),
                  plannedEndTime: parseInstant(evData.plannedEndTime),
                  durationSec: evData.durationSec,
                  note: evData.note,
                  triggerSource: evData.triggerSource,
                  vMixInputName: evData.vMixInputName,
                  isInVenue: evData.isInVenue,
                  isInLivestream: evData.isInLivestream,
                  isTimeAnchor: evData.isTimeAnchor,
                  anchorType: evData.anchorType,
                  autoAdvance: evData.autoAdvance
                }
              });
              if (evData.id) eventIds.set(String(evData.id), event.id);

              if (Array.isArray(evData.positions)) {
                for (const posName of evData.positions) {
                  const position = await findOrCreatePosition(tx, posName);
                  await tx.productionEventPosition.create({
                    data: {
                      eventId: event.id,
                      positionId: position.id
                    }
                  });
                }
              }
            }
            for (const evData of item.productionEvents) {
              const id = evData.id && eventIds.get(String(evData.id));
              const parentId = evData.parentId && eventIds.get(String(evData.parentId));
              if (id && parentId) await tx.productionEvent.update({ where: { id }, data: { parentId } });
            }
          }
        });
      } catch (err) {
        logger.error(`Import of production failed for item`, { item, error: err });
      }
    }
    // Interview players created by the import may carry pre-season `players/...` photoUrls.
    if (created + updated > 0) {
      await migrateLegacySeasonAssets().catch((err) => logger.error('Season asset migration after productions import failed', err as Error));
    }
    return res.json({ ok: true, created, updated });
  } catch (err) {
    logger.error('POST /api/backup/producties/import failed', err as any);
    return next(err);
  }
});

// POST /api/backup/clubs/import
backupRouter.post('/clubs/import', async (req, res, next) => {
  try {
    const data = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Array expected' });
    let created = 0, updated = 0;
    const activeSeasonId = (await getActiveSeason()).id;
    const seasons = createSeasonIdResolver();
    // Players keep the season they were exported with; old backups without one land in the active season.
    const seasonIdForPlayer = async (seasonName: unknown): Promise<number> =>
      (await seasons.forSeasonName(seasonName)) ?? activeSeasonId;
    for (const item of data) {
      try {
        const clubData = {
          name: item.name,
          shortName: item.shortName || item.name,
          // Older backups have no abbreviation: then an existing club keeps its own, a new one gets the default
          ...(typeof item.abbreviation === 'string' || item.abbreviation === null
            ? { abbreviation: item.abbreviation }
            : {}),
          // Older backups have no colours: an existing club keeps its own
          ...(item.primaryColor === undefined ? {} : { primaryColor: clubColor(item.primaryColor) }),
          ...(item.secondaryColor === undefined ? {} : { secondaryColor: clubColor(item.secondaryColor) }),
          slug: item.slug,
          logoUrl: item.logoUrl
        };
        let club = await prisma.club.findUnique({ where: { slug: item.slug } });
        if (club) {
          club = await prisma.club.update({ where: { id: club.id }, data: clubData });
          updated++;
        } else {
          club = await prisma.club.create({ data: { abbreviation: clubAbbreviation(clubData.shortName), ...clubData } });
          created++;
        }

        // Restore players
        if (Array.isArray(item.players)) {
          for (const p of item.players) {
            try {
              const seasonId = await seasonIdForPlayer(p.seasonName);
              const playerData = {
                clubId: club.id,
                seasonId,
                name: p.name,
                shirtNo: p.shirtNo,
                gender: p.gender,
                photoUrl: p.photoUrl,
                externalId: p.externalId,
                personType: p.personType,
                function: p.function
              };

              if (p.externalId) {
                await prisma.player.upsert({
                  where: { seasonId_externalId: { seasonId, externalId: p.externalId } },
                  create: playerData,
                  update: playerData
                });
              } else {
                const existingPlayer = await prisma.player.findFirst({
                  where: { seasonId, clubId: club.id, name: p.name }
                });
                if (existingPlayer) {
                  await prisma.player.update({
                    where: { id: existingPlayer.id },
                    data: playerData
                  });
                } else {
                  await prisma.player.create({ data: playerData });
                }
              }
            } catch (perr) {
              logger.warn(`Failed to restore player ${p.name} for club ${club.name}`, perr as any);
            }
          }
        }
      } catch (_) { /* an invalid row is skipped */ }
    }
    // Restored players may carry pre-season `players/...` photoUrls; move those files into their season dir.
    await migrateLegacySeasonAssets().catch((err) => logger.error('Season asset migration after clubs import failed', err as any));
    return res.json({ ok: true, created, updated });
  } catch (err) {
    logger.error('POST /api/backup/clubs/import failed', err as any);
    return next(err);
  }
});

// POST /api/backup/sponsors/import
backupRouter.post('/sponsors/import', async (req, res, next) => {
  try {
    const data = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Array expected' });
    let created = 0, updated = 0;
    const organization = await currentOrganizationRef();
    for (const item of data) {
      try {
        // The export writes null for an empty displayName; the schema wants it left out
        const input = SponsorBackupSchema.parse(Object.fromEntries(Object.entries(item ?? {}).filter(([, v]) => v !== null)));
        const existing = await prisma.sponsor.findFirst({ where: { name: input.name } });
        // Only the file name is restored: it resolves in the chosen organization's own directory
        // (sponsors/<slug>/), whatever organization the backup came from. The files come with the
        // image download (GET /api/backup/images).
        const logoUrl = resolveClientLogoUrl(input.logoUrl, organization, existing?.logoUrl ?? null, { lenient: true, fromBackup: true });
        if (existing) {
          await prisma.sponsor.update({ where: { id: existing.id }, data: { ...input, logoUrl } as any });
          updated++;
        } else {
          await prisma.sponsor.create({ data: { ...input, logoUrl } as any });
          created++;
        }
      } catch (_) { /* an invalid row is skipped */ }
    }
    // A backup from before organizations names files in the shared directory: take them into sponsors/<slug>/
    await migrateLogoStorage({ organizationIds: [requireOrganizationId()] }).catch((err) => logger.error('Moving logos after the sponsors restore failed', err as any));
    return res.json({ ok: true, created, updated });
  } catch (err) {
    logger.error('POST /api/backup/sponsors/import failed', err as any);
    return next(err);
  }
});

// POST /api/backup/settings/import
// Into the chosen organization, also from backups made before there were organizations. Installation-wide
// keys (the active season) are skipped: a restore of one organization must not change them for all.
backupRouter.post('/settings/import', async (req, res, next) => {
  try {
    const data = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Array expected' });
    let created = 0, updated = 0;
    // The own club by slug when the backup has it (newer backups); the id only for older backups
    const ownClubSlug = data.find((item) => item?.key === OWN_CLUB_SLUG_EXPORT_KEY)?.value;
    const hasOwnClubSlug = typeof ownClubSlug === 'string' && ownClubSlug.length > 0;
    for (const item of data) {
      try {
        if (typeof item?.key !== 'string' || !item.key) continue;
        const key: string = item.key;
        const value = item.value ?? null;
        if (GLOBAL_SETTING_KEYS.has(key) || key === ACTIVE_SEASON_NAME_EXPORT_KEY) {
          logger.info(`Skipping setting ${key} from backup: it holds for the whole installation, not one organization`);
          continue;
        }
        if (key === ORGANIZATION_DETAILS_EXPORT_KEY) {
          if (await restoreOrganizationDetails(value)) updated++;
          continue;
        }
        if (key === SEASON_INDOOR_START_EXPORT_KEY) {
          updated += await restoreIndoorStartDates(value);
          continue;
        }
        if (key === OWN_CLUB_SLUG_EXPORT_KEY) {
          const club = hasOwnClubSlug ? await prisma.club.findUnique({ where: { slug: ownClubSlug }, select: { id: true } }) : null;
          if (club && (await setOwnClubId(club.id))) updated++;
          else logger.warn(`Skipping setting ${key} from backup: no such club`, { value });
          continue;
        }
        if (key === LEGACY_OWN_CLUB_ID_KEY) {
          if (hasOwnClubSlug) continue;
          // Old backups: the own club is the organization's club now (Organization.clubId)
          if (Number.isInteger(value) && value > 0 && (await setOwnClubId(value))) updated++;
          else logger.warn(`Skipping setting ${key} from backup: no such club`, { value });
          continue;
        }
        const existed = (await getSetting(key)) !== null;
        await setSetting(key, value);
        if (existed) updated++;
        else created++;
      } catch (err) {
        logger.error(`Failed to import setting ${item?.key}`, err as any);
      }
    }
    return res.json({ ok: true, created, updated });
  } catch (err) {
    logger.error('POST /api/backup/settings/import failed', err as any);
    return next(err);
  }
});

const OrganizationDetailsSchema = z.object({
  name: z.string().trim().min(1).max(200),
  logoUrl: z.string().nullable().optional(),
  clubSlug: z.string().nullable().optional(),
});

/**
 * Takes over name, own club (by club slug) and logo file name into the chosen organization. Never its
 * slug or whether it is active: those belong to the target. The logo name is stored as `<slug>.<ext>`
 * of the target, so it resolves to organizations/<target slug>.<ext> (put the file there from the
 * image download).
 */
async function restoreOrganizationDetails(value: unknown): Promise<boolean> {
  const parsed = OrganizationDetailsSchema.safeParse(value);
  if (!parsed.success) {
    logger.warn('Skipping organization details from backup: invalid');
    return false;
  }
  const organizationId = requireOrganizationId();
  const target = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!target) return false;
  const ext = parsed.data.logoUrl ? /\.(png|jpe?g|gif|webp)$/i.exec(parsed.data.logoUrl)?.[0].toLowerCase() : undefined;
  const data: { name: string; logoUrl?: string | null } = { name: parsed.data.name };
  if (parsed.data.logoUrl === null) data.logoUrl = null;
  else if (ext) data.logoUrl = `${target.slug}${ext}`;
  await prisma.organization.update({ where: { id: organizationId }, data });
  clearOrganizationLookupCache();
  if (parsed.data.clubSlug) {
    const club = await prisma.club.findUnique({ where: { slug: parsed.data.clubSlug }, select: { id: true } });
    if (!club || !(await setOwnClubId(club.id))) logger.warn('Own club from backup not found: club left as it is', { clubSlug: parsed.data.clubSlug });
  }
  return true;
}

const IndoorStartDatesSchema = z.array(z.object({
  seasonName: z.string().min(1),
  indoorStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}));

/**
 * Sets a season's indoor start date from the backup, by season name, only when that season exists
 * and has none yet. Never creates a season and never overwrites another date (logged instead).
 */
async function restoreIndoorStartDates(value: unknown): Promise<number> {
  const parsed = IndoorStartDatesSchema.safeParse(value);
  if (!parsed.success) {
    logger.warn('Skipping season indoor start dates from backup: invalid');
    return 0;
  }
  let changed = 0;
  for (const { seasonName, indoorStartDate } of parsed.data) {
    const date = new Date(`${indoorStartDate}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) continue;
    const season = await prisma.season.findUnique({ where: { name: seasonName } });
    if (!season) {
      logger.info(`Indoor start date from backup skipped: season ${seasonName} does not exist here`);
    } else if (!season.indoorStartDate) {
      await prisma.season.update({ where: { id: season.id }, data: { indoorStartDate: date } });
      changed++;
    } else if (season.indoorStartDate.toISOString().slice(0, 10) !== indoorStartDate) {
      logger.warn(`Indoor start date from backup skipped: season ${seasonName} already has ${season.indoorStartDate.toISOString().slice(0, 10)} (backup: ${indoorStartDate})`);
    }
  }
  return changed;
}
