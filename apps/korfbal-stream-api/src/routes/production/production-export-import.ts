import {Router} from 'express';
import {prisma} from '../../services/prisma';
import {logger} from '../../utils/logger';

export const productionExportImportRouter: Router = Router();

// -------- Export/Import Production --------

// GET /api/production/:id/export
// Export a production as JSON
productionExportImportRouter.get('/:id/export', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const production = await prisma.production.findUnique({
      where: { id },
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
      }
    });

    if (!production) return res.status(404).json({ error: 'Production not found' });

    // Construct export object
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      matchSchedule: {
        externalId: production.matchSchedule.externalId,
        date: production.matchSchedule.date,
        homeTeamName: production.matchSchedule.homeTeamName,
        awayTeamName: production.matchSchedule.awayTeamName,
        accommodationName: production.matchSchedule.accommodationName,
        accommodationRoute: production.matchSchedule.accommodationRoute,
        attendanceTime: production.matchSchedule.attendanceTime,
        isPracticeMatch: production.matchSchedule.isPracticeMatch,
        isHomeMatch: production.matchSchedule.isHomeMatch,
        isCompetitiveMatch: production.matchSchedule.isCompetitiveMatch,
        fieldName: production.matchSchedule.fieldName,
        refereeName: production.matchSchedule.refereeName,
        reserveRefereeName: production.matchSchedule.reserveRefereeName,
        homeScore: production.matchSchedule.homeScore,
        awayScore: production.matchSchedule.awayScore,
        color: production.matchSchedule.color
      },
      production: {
        isActive: production.isActive,
        liveTime: production.liveTime,
        report: production.productionReport ? {
          matchSponsor: production.productionReport.matchSponsor,
          interviewRationale: production.productionReport.interviewRationale,
          remarks: production.productionReport.remarks
        } : null
      },
      persons: production.productionPersons.map(pp => ({
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
      positions: production.productionPositions.map(pp => ({
        personName: pp.person.name,
        positionName: pp.position.name,
        isStudio: pp.position.isStudio
      })),
      segments: production.segments.map(seg => ({
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
      titles: production.TitleDefinition.map(td => ({
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
      interviews: production.interviewSubjects.map(subj => ({
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
      callSheets: production.callSheets.map(cs => ({
        name: cs.name,
        color: cs.color,
        items: cs.items.map(item => ({
          id: item.id,
          productionSegmentVolgorde: item.productionSegmentId ? production.segments.find(s => s.id === item.productionSegmentId)?.volgorde : null,
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
          positions: item.positions.map(p => p.position.name)
        }))
      })),
      productionEvents: production.productionEvents.map(ev => ({
        id: ev.id,
        title: ev.title,
        status: ev.status,
        order: ev.order,
        actualStartTime: ev.actualStartTime,
        plannedStartTime: ev.plannedStartTime,
        plannedEndTime: ev.plannedEndTime,
        durationSec: ev.durationSec,
        note: ev.note,
        anchorType: ev.anchorType,
        autoAdvance: ev.autoAdvance,
        callSheetItemId: ev.callSheetItemId,
        isInLivestream: ev.isInLivestream,
        isInVenue: ev.isInVenue,
        isTimeAnchor: ev.isTimeAnchor,
        parentId: ev.parentId,
        metadata: ev.metadata,
        triggerSource: ev.triggerSource,
        vMixInputName: ev.vMixInputName,
        positions: ev.positions.map(p => p.position.name)
      }))
    };

    const dateString = `${production.matchSchedule.date.getFullYear()}-${production.matchSchedule.date.getMonth() + 1}-${production.matchSchedule.date.getDate()}`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="production-${dateString}-${production.matchSchedule.homeTeamName}-${production.matchSchedule.awayTeamName}-export.json"`);
    return res.json(exportData);
  } catch (err) {
    return next(err);
  }
});

// POST /api/production/import
// Import a production from JSON
productionExportImportRouter.post('/import', async (req, res, next) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid import data' });
    }

    // Basic validation
    if (!data.matchSchedule || !data.production) {
      return res.status(400).json({ error: 'Missing required fields in import data' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 0. If the imported production is active, deactivate all other productions.
      if (data.production.isActive) {
        await tx.production.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }

      // 1. Find or create MatchSchedule
      let match;
      if (data.matchSchedule.externalId) {
        match = await tx.matchSchedule.findUnique({
          where: { externalId: data.matchSchedule.externalId }
        });
      } else {
        match = await tx.matchSchedule.findFirst({
          where: {
            date: new Date(data.matchSchedule.date),
            homeTeamName: data.matchSchedule.homeTeamName,
            awayTeamName: data.matchSchedule.awayTeamName
          }
        });
      }

      const matchData = {
        ...data.matchSchedule,
        date: new Date(data.matchSchedule.date),
        attendanceTime: data.matchSchedule.attendanceTime ? new Date(data.matchSchedule.attendanceTime) : null
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
        // Default liveTime to 5 minutes before match if not provided in export
        const liveTime = data.production.liveTime
          ? new Date(data.production.liveTime)
          : new Date(new Date(match.date).getTime() - 5 * 60 * 1000);

        production = await tx.production.create({
          data: {
            matchScheduleId: match.id,
            isActive: data.production.isActive,
            liveTime
          }
        });
      } else {
        production = await tx.production.update({
          where: { id: production.id },
          data: {
            isActive: data.production.isActive,
            liveTime: data.production.liveTime ? new Date(data.production.liveTime) : null
          }
        });
      }

      // 3. Upsert Production Report
      if (data.production.report) {
        await tx.productionReport.upsert({
          where: { productionId: production.id },
          update: data.production.report,
          create: {
            productionId: production.id,
            ...data.production.report
          }
        });
      }

      // 4. Process Persons and Skills
      if (Array.isArray(data.persons)) {
        for (const pData of data.persons) {
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

          await tx.productionPerson.upsert({
            where: { productionId_personId: { productionId: production.id, personId: person.id } },
            update: {},
            create: { productionId: production.id, personId: person.id }
          });
        }
      }

      // 5. Process Production Positions
      if (Array.isArray(data.positions)) {
        for (const posData of data.positions) {
          const person = await tx.person.findFirst({ where: { name: posData.personName } });
          if (!person) continue;
          let position = await tx.position.findUnique({ where: { name: posData.positionName } });
          if (!position) {
            position = await tx.position.create({
              data: { name: posData.positionName, isStudio: posData.isStudio }
            });
          }
          await tx.productionPersonPosition.upsert({
            where: { productionId_personId_positionId: { productionId: production.id, personId: person.id, positionId: position.id } },
            update: {},
            create: { productionId: production.id, personId: person.id, positionId: position.id }
          });
        }
      }

      // 6. Process Segments and Assignments
      if (Array.isArray(data.segments)) {
        await tx.productionSegment.deleteMany({ where: { productionId: production.id } });
        for (const segData of data.segments) {
          const segment = await tx.productionSegment.create({
            data: {
              productionId: production.id,
              naam: segData.naam,
              volgorde: segData.volgorde,
              duurInMinuten: segData.duurInMinuten,
              isTimeAnchor: segData.isTimeAnchor
            }
          });
          if (Array.isArray(segData.assignments)) {
            for (const assignData of segData.assignments) {
              const person = await tx.person.findFirst({ where: { name: assignData.personName } });
              if (!person) continue;
              let position = await tx.position.findUnique({ where: { name: assignData.positionName } });
              if (!position) {
                position = await tx.position.create({
                  data: { name: assignData.positionName, isStudio: assignData.isStudio }
                });
              }
              await tx.segmentRoleAssignment.create({
                data: { productionSegmentId: segment.id, personId: person.id, positionId: position.id }
              });
            }
          }
        }
      }

      // 7. Process Titles
      const titleIdMap = new Map<number, number>();
      if (Array.isArray(data.titles)) {
        await tx.titleDefinition.deleteMany({ where: { productionId: production.id } });
        for (const tData of data.titles) {
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

      // 8. Process Interviews
      if (Array.isArray(data.interviews)) {
        await tx.interviewSubject.deleteMany({ where: { productionId: production.id } });
        for (const intData of data.interviews) {
          let club = await tx.club.findUnique({ where: { slug: intData.clubSlug } });
          if (!club) {
            club = await tx.club.create({
              data: { name: intData.clubName, shortName: intData.clubShortName, slug: intData.clubSlug, logoUrl: intData.clubLogoUrl }
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
            data: { productionId: production.id, side: intData.side, role: intData.role, playerId: player.id, titleDefinitionId: titleId }
          });
        }
      }

      // 9. Process CallSheets
      if (Array.isArray(data.callSheets)) {
        await tx.callSheet.deleteMany({ where: { productionId: production.id } });
        // Use a mapping to handle parentId for items
        const itemIdMap = new Map<string, string>();

        for (const csData of data.callSheets) {
          const cs = await tx.callSheet.create({
            data: {
              productionId: production.id,
              name: csData.name,
              color: csData.color
            }
          });

          // First pass: create items (without parentId to avoid FK issues if parent not yet created)
          for (const itemData of csData.items) {
            let segmentId = null;
            if (itemData.productionSegmentVolgorde != null) {
              const segment = await tx.productionSegment.findFirst({
                where: { productionId: production.id, volgorde: itemData.productionSegmentVolgorde }
              });
              segmentId = segment?.id || null;
            }

            const item = await tx.callSheetItem.create({
              data: {
                id: itemData.id,
                callSheetId: cs.id,
                productionSegmentId: segmentId,
                cue: itemData.cue,
                title: itemData.title,
                note: itemData.note,
                color: itemData.color,
                timeStart: itemData.timeStart ? new Date(itemData.timeStart) : null,
                timeEnd: itemData.timeEnd ? new Date(itemData.timeEnd) : null,
                durationSec: itemData.durationSec,
                orderIndex: itemData.orderIndex,
                isInVenue: itemData.isInVenue,
                anchorType: itemData.anchorType,
                isTimeAnchor: itemData.isTimeAnchor,
                autoAdvance: itemData.autoAdvance,
                isInLivestream: itemData.isInLivestream
              }
            });
            itemIdMap.set(itemData.id, item.id);

            // Handle positions
            if (Array.isArray(itemData.positions)) {
              for (const posName of itemData.positions) {
                let position = await tx.position.findUnique({ where: { name: posName } });
                if (!position) {
                  position = await tx.position.create({ data: { name: posName } });
                }
                await tx.callSheetItemPosition.create({
                  data: { callSheetItemId: item.id, positionId: position.id }
                });
              }
            }
          }

          // Second pass: update parentId
          for (const itemData of csData.items) {
            if (itemData.parentId && itemIdMap.has(itemData.parentId)) {
              await tx.callSheetItem.update({
                where: { id: itemIdMap.get(itemData.id) },
                data: { parentId: itemIdMap.get(itemData.parentId) }
              });
            }
          }
        }
      }

      // 10. Process ProductionEvents
      if (Array.isArray(data.productionEvents)) {
        await tx.productionEvent.deleteMany({ where: { productionId: production.id } });
        const eventIdMap = new Map<string, string>();

        // First pass: create events
        for (const evData of data.productionEvents) {
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
              anchorType: evData.anchorType,
              autoAdvance: evData.autoAdvance,
              callSheetItemId: evData.callSheetItemId, // We assume item IDs are preserved
              isInLivestream: evData.isInLivestream,
              isInVenue: evData.isInVenue,
              isTimeAnchor: evData.isTimeAnchor,
              metadata: evData.metadata || {},
              triggerSource: evData.triggerSource,
              vMixInputName: evData.vMixInputName
            }
          });
          eventIdMap.set(evData.id, event.id);

          // Handle positions
          if (Array.isArray(evData.positions)) {
            for (const posName of evData.positions) {
              let position = await tx.position.findUnique({ where: { name: posName } });
              if (!position) {
                position = await tx.position.create({ data: { name: posName } });
              }
              await tx.productionEventPosition.create({
                data: { eventId: event.id, positionId: position.id }
              });
            }
          }
        }

        // Second pass: update parentId
        for (const evData of data.productionEvents) {
          if (evData.parentId && eventIdMap.has(evData.parentId)) {
            await tx.productionEvent.update({
              where: { id: eventIdMap.get(evData.id) },
              data: { parentId: eventIdMap.get(evData.parentId) }
            });
          }
        }
      }

      return production;
    });

    return res.json({ ok: true, id: result.id });
  } catch (err) {
    logger.error('Import production failed', err);
    return next(err);
  }
});
