import {Router} from 'express';
import {prisma} from '../services/prisma';
import {logger} from '../utils/logger';
import {PersonInputSchema} from '../schemas/person';
import {SkillInputSchema} from '../schemas/skill';
import {SponsorInputSchema} from '../schemas/sponsor';

export const backupRouter: Router = Router();

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
      orderBy: { date: 'asc' }
    });

    const exportData = items.map(m => ({
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
        matchSchedule: true,
        productionReport: true,
      },
      orderBy: { id: 'asc' }
    });

    const exportData = productions.map(p => ({
      matchExternalId: p.matchSchedule.externalId,
      isActive: p.isActive,
      liveTime: p.liveTime,
      report: p.productionReport ? {
        matchSponsor: p.productionReport.matchSponsor,
        interviewRationale: p.productionReport.interviewRationale,
        remarks: p.productionReport.remarks
      } : null
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
      include: { players: true },
      orderBy: { name: 'asc' }
    });

    const exportData = items.map(c => ({
      name: c.name,
      shortName: c.shortName,
      slug: c.slug,
      logoUrl: c.logoUrl,
      players: c.players.map(p => ({
        name: p.name,
        shirtNo: p.shirtNo,
        gender: p.gender,
        photoUrl: p.photoUrl,
        externalId: p.externalId,
        personType: p.personType,
        function: p.function
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
      displayName: (s as any).displayName
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
backupRouter.get('/settings/export', async (_req, res, next) => {
  try {
    const items = await prisma.setting.findMany({
      orderBy: { key: 'asc' }
    });

    const exportData = items.map(s => ({
      key: s.key,
      value: s.value
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=settings.json');
    return res.json(exportData);
  } catch (err) {
    logger.error('GET /api/backup/settings/export failed', err as any);
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
            const skill = await prisma.skill.findUnique({ where: { code: s.code } });
            if (skill) {
              await prisma.personSkill.upsert({
                where: { personId_skillId: { personId: person.id, skillId: skill.id } },
                create: { personId: person.id, skillId: skill.id },
                update: {}
              });
            }
          }
        }
      } catch (_) {}
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
        const existing = await prisma.skill.findUnique({ where: { code: input.code } });
        if (existing) {
          await prisma.skill.update({ where: { id: existing.id }, data: input as any });
          updated++;
        } else {
          await prisma.skill.create({ data: input as any });
          created++;
        }
      } catch (_) {}
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
        const skill = item.skillCode ? await prisma.skill.findUnique({ where: { code: item.skillCode } }) : null;
        const input = {
          name: item.name,
          category: item.category,
          sortOrder: item.sortOrder,
          isStudio: !!item.isStudio,
          skillId: skill?.id || null
        };
        const existing = await prisma.position.findFirst({ where: { name: item.name } });
        if (existing) {
          await prisma.position.update({ where: { id: existing.id }, data: input as any });
          updated++;
        } else {
          await prisma.position.create({ data: input as any });
          created++;
        }
      } catch (_) {}
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
    for (const item of data) {
      try {
        if (!item.externalId) continue;
        const matchData = {
          externalId: item.externalId,
          date: new Date(item.date),
          homeTeamName: item.homeTeamName,
          awayTeamName: item.awayTeamName,
          accommodationName: item.accommodationName,
          accommodationRoute: item.accommodationRoute,
          attendanceTime: item.attendanceTime ? new Date(item.attendanceTime) : null,
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
        const existing = await prisma.matchSchedule.findUnique({ where: { externalId: item.externalId } });
        if (existing) {
          await prisma.matchSchedule.update({ where: { externalId: item.externalId }, data: matchData });
          updated++;
        } else {
          await prisma.matchSchedule.create({ data: matchData });
          created++;
        }
      } catch (_) {}
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
        const existing = await prisma.segmentTemplate.findUnique({ where: { name } }).catch(() => null);
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
      } catch (_) {}
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
    for (const item of data) {
      try {
        const match = await prisma.matchSchedule.findUnique({ where: { externalId: item.matchExternalId } });
        if (!match) continue;

        let production = await prisma.production.findUnique({ where: { matchScheduleId: match.id } });
        if (production) {
          production = await prisma.production.update({
            where: { id: production.id },
            data: { isActive: !!item.isActive, liveTime: item.liveTime }
          });
          updated++;
        } else {
          production = await prisma.production.create({
            data: { matchScheduleId: match.id, isActive: !!item.isActive, liveTime: item.liveTime }
          });
          created++;
        }

        if (item.report) {
          await prisma.productionReport.upsert({
            where: { productionId: production.id },
            create: {
              productionId: production.id,
              matchSponsor: item.report.matchSponsor,
              interviewRationale: item.report.interviewRationale,
              remarks: item.report.remarks
            },
            update: {
              matchSponsor: item.report.matchSponsor,
              interviewRationale: item.report.interviewRationale,
              remarks: item.report.remarks
            }
          });
        }
      } catch (_) {}
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
    for (const item of data) {
      try {
        const clubData = {
          name: item.name,
          shortName: item.shortName || item.name,
          slug: item.slug,
          logoUrl: item.logoUrl
        };
        let club = await prisma.club.findUnique({ where: { slug: item.slug } });
        if (club) {
          club = await prisma.club.update({ where: { id: club.id }, data: clubData });
          updated++;
        } else {
          club = await prisma.club.create({ data: clubData });
          created++;
        }

        // Restore players
        if (Array.isArray(item.players)) {
          for (const p of item.players) {
            try {
              const playerData = {
                clubId: club.id,
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
                  where: { externalId: p.externalId },
                  create: playerData,
                  update: playerData
                });
              } else {
                const existingPlayer = await prisma.player.findFirst({
                  where: { clubId: club.id, name: p.name }
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
      } catch (_) {}
    }
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
    for (const item of data) {
      try {
        const input = SponsorInputSchema.parse(item);
        const existing = await prisma.sponsor.findFirst({ where: { name: input.name } });
        if (existing) {
          await prisma.sponsor.update({ where: { id: existing.id }, data: input as any });
          updated++;
        } else {
          await prisma.sponsor.create({ data: input as any });
          created++;
        }
      } catch (_) {}
    }
    return res.json({ ok: true, created, updated });
  } catch (err) {
    logger.error('POST /api/backup/sponsors/import failed', err as any);
    return next(err);
  }
});

// POST /api/backup/settings/import
backupRouter.post('/settings/import', async (req, res, next) => {
  try {
    const data = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Array expected' });
    let created = 0, updated = 0;
    for (const item of data) {
      try {
        if (!item.key) continue;
        const existing = await prisma.setting.findUnique({ where: { key: item.key } });
        if (existing) {
          await prisma.setting.update({
            where: { key: item.key },
            data: { value: item.value ?? null }
          });
          updated++;
        } else {
          await prisma.setting.create({
            data: { key: item.key, value: item.value ?? null }
          });
          created++;
        }
      } catch (err) {
        logger.error(`Failed to import setting ${item.key}`, err as any);
      }
    }
    return res.json({ ok: true, created, updated });
  } catch (err) {
    logger.error('POST /api/backup/settings/import failed', err as any);
    return next(err);
  }
});
