import request from 'supertest';
import app from '../main';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {currentSeasonId, testDb as prisma} from '../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';
const PREFIX = 'CrewReport Int';

describe.runIf(runDb)('crew reports (integration)', () => {
  let seasonId: number;
  let productionId: number;
  let matchId: number;
  let createdSkillId: number | null = null;
  const segmentIds: number[] = [];
  const personIds: number[] = [];
  const positions: Record<'regie' | 'camera' | 'commentaar', number> = {regie: 0, camera: 0, commentaar: 0};

  beforeAll(async () => {
    seasonId = await currentSeasonId(prisma);
    // Use the existing commentary skill; only create (and later remove) it when the test db has none
    let skill = await prisma.skill.findFirst({where: {code: 'COMMENTAAR'}});
    if (!skill) {
      skill = await prisma.skill.create({data: {code: 'COMMENTAAR', name: 'Commentaar', nameMale: 'Commentator', nameFemale: 'Commentatrice'}});
      createdSkillId = skill.id;
    }
    positions.regie = (await prisma.position.create({data: {name: `${PREFIX} Regie`, category: 'TECHNICAL', sortOrder: 1}})).id;
    positions.camera = (await prisma.position.create({data: {name: `${PREFIX} Camera`, category: 'TECHNICAL', sortOrder: 2}})).id;
    positions.commentaar = (await prisma.position.create({data: {name: `${PREFIX} Commentaar`, category: 'ENTERTAINMENT', skillId: skill.id}})).id;

    for (const name of [`${PREFIX} Anna`, `${PREFIX} Bas`, `${PREFIX} Cor`]) {
      personIds.push((await prisma.person.create({data: {name, gender: 'female'}})).id);
    }

    const match = await prisma.matchSchedule.create({
      data: {seasonId, externalId: `crew-report-int-${Date.now()}`, date: new Date(), homeTeamName: 'Thuis', awayTeamName: 'Uit', isHomeMatch: true},
    });
    matchId = match.id;
    productionId = (await prisma.production.create({data: {matchScheduleId: match.id}})).id;
    for (const [i, name] of ['Voorbeschouwing', 'Eerste helft'].entries()) {
      segmentIds.push((await prisma.productionChapter.create({data: {productionId, name, orderIndex: i + 1}})).id);
    }

    // Anna directs the whole production, Bas only films the first half, Cor comments
    await prisma.productionPersonPosition.createMany({data: [
      {productionId, personId: personIds[0], positionId: positions.regie},
      {productionId, personId: personIds[2], positionId: positions.commentaar},
    ]});
    await prisma.chapterRoleAssignment.create({data: {productionSegmentId: segmentIds[1], personId: personIds[1], positionId: positions.camera}});

    const callSheet = await prisma.callSheet.create({data: {productionId, name: 'Main'}});
    await prisma.callSheetItem.create({data: {
      id: `crew-report-int-${Date.now()}`, callSheetId: callSheet.id, chapterId: segmentIds[0], cue: 'A1', title: 'Opening', durationSec: 60,
      positions: {create: [{positionId: positions.camera}]},
    }});
  });

  afterAll(async () => {
    await prisma.production.deleteMany({where: {id: productionId}});
    await prisma.matchSchedule.deleteMany({where: {id: matchId}});
    await prisma.person.deleteMany({where: {id: {in: personIds}}});
    await prisma.position.deleteMany({where: {id: {in: Object.values(positions)}}});
    if (createdSkillId) await prisma.skill.delete({where: {id: createdSkillId}});
  });

  it('shows the effective crew per segment, with only the positions that are filled', async () => {
    const res = await request(app).get(`/api/production/${productionId}/crew-report`);
    expect(res.status).toBe(200);

    expect(res.body.groupedPositions).toEqual([
      {category: 'TECHNICAL', positions: [
        expect.objectContaining({id: positions.regie}),
        expect.objectContaining({id: positions.camera}),
      ]},
      {category: 'ENTERTAINMENT', positions: [expect.objectContaining({id: positions.commentaar})]},
    ]);

    const crewOf = (segmentId: number) => res.body.cells
      .filter((c: { chapterId: number }) => c.chapterId === segmentId)
      .map((c: { personName: string }) => c.personName.replace(`${PREFIX} `, ''))
      .sort();
    expect(crewOf(segmentIds[0])).toEqual(['Anna', 'Cor']);
    expect(crewOf(segmentIds[1])).toEqual(['Anna', 'Bas', 'Cor']);

    expect(res.body.chapters.map((c: { name: string }) => c.name)).toEqual(['Voorbeschouwing', 'Eerste helft']);
    expect(res.body.callsheets[0].items[0]).toMatchObject({title: 'Opening', chapterId: segmentIds[0], positionIds: [positions.camera]});
  });

  type RolesReport = { positions: Array<{ id: number; name: string }>; productions: Array<{ id: number; assignments: Record<string, string[]> }> };
  const rolesOf = (body: RolesReport) => body.productions.find((p) => p.id === productionId)?.assignments;

  it('lists the on-screen roles in the entertainment roles report', async () => {
    const res = await request(app).get(`/api/reports/entertainment-roles?seasonId=${seasonId}`);
    expect(res.status).toBe(200);
    const ids = res.body.positions.map((p: { id: number }) => p.id);
    expect(ids).toContain(positions.commentaar);
    expect(ids).not.toContain(positions.regie);
    expect(rolesOf(res.body)).toEqual({[positions.commentaar]: [`${PREFIX} Cor`]});
  });

  it('lists the technical and general roles in the crew roles report, also when assigned for one segment', async () => {
    const res = await request(app).get(`/api/reports/crew-roles?seasonId=${seasonId}`);
    expect(res.status).toBe(200);
    const ids = res.body.positions.map((p: { id: number }) => p.id);
    // In sortOrder: regie (1) before camera (2); no entertainment positions
    expect(ids.indexOf(positions.regie)).toBeLessThan(ids.indexOf(positions.camera));
    expect(ids).not.toContain(positions.commentaar);
    expect(rolesOf(res.body)).toEqual({
      [positions.regie]: [`${PREFIX} Anna`],
      [positions.camera]: [`${PREFIX} Bas`],
    });
  });
});
