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
        interviewSubjects: {
          include: {
            player: {
              include: {
                club: true
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
        clubLogoUrl: subj.player.club.logoUrl
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
      // 1. Upsert MatchSchedule
      const match = await tx.matchSchedule.upsert({
        where: { externalId: data.matchSchedule.externalId },
        update: {
          ...data.matchSchedule,
          date: new Date(data.matchSchedule.date),
          attendanceTime: data.matchSchedule.attendanceTime ? new Date(data.matchSchedule.attendanceTime) : null
        },
        create: {
          ...data.matchSchedule,
          date: new Date(data.matchSchedule.date),
          attendanceTime: data.matchSchedule.attendanceTime ? new Date(data.matchSchedule.attendanceTime) : null
        }
      });

      // 2. Create Production (always create new if not exists for this match, otherwise update?)
      // Since matchScheduleId is unique for Production, we check if one exists
      let production = await tx.production.findUnique({ where: { matchScheduleId: match.id } });
      if (!production) {
        production = await tx.production.create({
          data: {
            matchScheduleId: match.id,
            isActive: data.production.isActive,
            liveTime: data.production.liveTime ? new Date(data.production.liveTime) : null
          }
        });
      } else {
        // Update existing production
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
          // Upsert Person
          let person = await tx.person.findFirst({ where: { name: pData.name } });
          if (!person) {
            person = await tx.person.create({
              data: { name: pData.name, gender: pData.gender }
            });
          } else {
             // Update gender if needed? Let's keep existing to be safe, or update if missing.
          }

          // Upsert Skills and Link
          if (Array.isArray(pData.skills)) {
            for (const sData of pData.skills) {
              const skill = await tx.skill.upsert({
                where: { code: sData.code },
                update: {
                  name: sData.name,
                  nameMale: sData.nameMale,
                  nameFemale: sData.nameFemale,
                  type: sData.type
                },
                create: {
                  code: sData.code,
                  name: sData.name,
                  nameMale: sData.nameMale,
                  nameFemale: sData.nameFemale,
                  type: sData.type
                }
              });

              await tx.personSkill.upsert({
                where: { personId_skillId: { personId: person.id, skillId: skill.id } },
                update: {},
                create: { personId: person.id, skillId: skill.id }
              });
            }
          }

          // Add to ProductionPersons (Attendance)
          await tx.productionPerson.upsert({
            where: { productionId_personId: { productionId: production.id, personId: person.id } },
            update: {},
            create: { productionId: production.id, personId: person.id }
          });
        }
      }

      // 5. Process Production Positions (Production-wide assignments)
      if (Array.isArray(data.positions)) {
        // Clear existing? Or merge? Let's clear to match import state exactly if desired, or upsert.
        // Clearing might be safer to avoid stale data if re-importing.
        // But let's try to be additive/update.
        for (const posData of data.positions) {
          const person = await tx.person.findFirst({ where: { name: posData.personName } });
          if (!person) continue; // Should have been created in step 4

          // Upsert Position
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
        // We might want to clear existing segments to avoid duplicates if re-importing
        // But deleting is risky. Let's try to match by volgorde/naam.
        // Actually, for a clean import, maybe we should delete all segments first?
        // Let's delete all segments for this production and recreate them.
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

      // 7. Process Interviews
      if (Array.isArray(data.interviews)) {
        await tx.interviewSubject.deleteMany({ where: { productionId: production.id } });

        for (const intData of data.interviews) {
          // Ensure Club exists
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

          // Ensure Player exists
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

          await tx.interviewSubject.create({
            data: {
              productionId: production.id,
              side: intData.side,
              role: intData.role,
              playerId: player.id
            }
          });
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
