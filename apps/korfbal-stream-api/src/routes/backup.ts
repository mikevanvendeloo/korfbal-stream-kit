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
        isManual: p.matchSchedule.isManual
      },
      production: {
        isActive: p.isActive,
        liveTime: p.liveTime,
        report: p.productionReport ? {
          matchSponsor: p.productionReport.matchSponsor,
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

        let existing;
        if (item.externalId) {
          existing = await prisma.matchSchedule.findUnique({ where: { externalId: item.externalId } });
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
        if (!item.matchSchedule || !item.production) continue;

        await prisma.$transaction(async (tx) => {
          // 1. Find or create MatchSchedule
          let match;
          if (item.matchSchedule.externalId) {
            match = await tx.matchSchedule.findUnique({
              where: { externalId: item.matchSchedule.externalId }
            });
          } else {
            match = await tx.matchSchedule.findFirst({
              where: {
                date: new Date(item.matchSchedule.date),
                homeTeamName: item.matchSchedule.homeTeamName,
                awayTeamName: item.matchSchedule.awayTeamName
              }
            });
          }

          const matchData = {
            ...item.matchSchedule,
            date: new Date(item.matchSchedule.date),
            attendanceTime: item.matchSchedule.attendanceTime ? new Date(item.matchSchedule.attendanceTime) : null
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
                liveTime: item.production.liveTime ? new Date(item.production.liveTime) : null
              }
            });
            created++;
          } else {
            production = await tx.production.update({
              where: { id: production.id },
              data: {
                isActive: !!item.production.isActive,
                liveTime: item.production.liveTime ? new Date(item.production.liveTime) : null
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
                    where: { code: sData.code },
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
              let position = await tx.position.findFirst({ where: { name: cData.positionName } });
              if (!position) {
                position = await tx.position.create({
                  data: { name: cData.positionName, isStudio: !!cData.isStudio }
                });
              }
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
            await tx.productionSegment.deleteMany({ where: { productionId: production.id } });

            for (const sData of item.segments) {
              const segment = await tx.productionSegment.create({
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
                  let position = await tx.position.findFirst({ where: { name: bData.positionName } });
                  if (!position) {
                    position = await tx.position.create({
                      data: { name: bData.positionName, isStudio: !!bData.isStudio }
                    });
                  }
                  if (person) {
                    await tx.segmentRoleAssignment.create({
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
                    create: tData.parts
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
                    slug: intData.clubSlug,
                    logoUrl: intData.clubLogoUrl
                  }
                });
              }
              let player = await tx.player.findFirst({ where: { clubId: club.id, name: intData.playerName } });
              if (!player) {
                player = await tx.player.create({
                  data: {
                    clubId: club.id,
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

          // 10. CallSheets
          if (Array.isArray(item.callSheets)) {
            await tx.callSheet.deleteMany({ where: { productionId: production.id } });
            for (const csData of item.callSheets) {
              const callSheet = await tx.callSheet.create({
                data: { productionId: production.id, name: csData.name, color: csData.color }
              });

              if (Array.isArray(csData.items)) {
                for (const iData of csData.items) {
                  const seg = iData.productionSegmentVolgorde ? await tx.productionSegment.findFirst({
                    where: { productionId: production.id, volgorde: iData.productionSegmentVolgorde }
                  }) : null;

                  const callSheetItem = await tx.callSheetItem.create({
                    data: {
                      id: iData.id,
                      callSheetId: callSheet.id,
                      cue: iData.cue,
                      title: iData.title,
                      note: iData.note,
                      color: iData.color,
                      timeStart: iData.timeStart ? new Date(iData.timeStart) : null,
                      timeEnd: iData.timeEnd ? new Date(iData.timeEnd) : null,
                      durationSec: Number(iData.durationSec || 0),
                      orderIndex: Number(iData.orderIndex || 0),
                      isInVenue: !!iData.isInVenue,
                      anchorType: iData.anchorType,
                      isTimeAnchor: !!iData.isTimeAnchor,
                      autoAdvance: !!iData.autoAdvance,
                      isInLivestream: iData.isInLivestream !== false,
                      parentId: iData.parentId,
                      productionSegmentId: seg?.id || null
                    }
                  });

                  if (Array.isArray(iData.positions)) {
                    for (const posName of iData.positions) {
                      let position = await tx.position.findUnique({ where: { name: posName } });
                      if (!position) {
                        position = await tx.position.create({
                          data: { name: posName }
                        });
                      }
                      await tx.callSheetItemPosition.create({
                        data: {
                          callSheetItemId: callSheetItem.id,
                          positionId: position.id
                        }
                      });
                    }
                  }
                }
              }
            }
          }

          // 11. Production Events
          if (Array.isArray(item.productionEvents)) {
            await tx.productionEvent.deleteMany({ where: { productionId: production.id } });

            for (const evData of item.productionEvents) {
              const event = await tx.productionEvent.create({
                data: {
                  productionId: production.id,
                  title: evData.title,
                  status: evData.status,
                  order: evData.order,
                  actualStartTime: evData.actualStartTime ? new Date(evData.actualStartTime) : null,
                  plannedStartTime: evData.plannedStartTime ? new Date(evData.plannedStartTime) : null,
                  plannedEndTime: evData.plannedEndTime ? new Date(evData.plannedEndTime) : null,
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

              if (Array.isArray(evData.positions)) {
                for (const posName of evData.positions) {
                  let position = await tx.position.findUnique({ where: { name: posName } });
                  if (!position) {
                    position = await tx.position.create({
                      data: { name: posName }
                    });
                  }
                  await tx.productionEventPosition.create({
                    data: {
                      eventId: event.id,
                      positionId: position.id
                    }
                  });
                }
              }
            }
          }
        });
      } catch (err) {
        logger.error(`Import of production failed for item`, { item, error: err });
      }
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
