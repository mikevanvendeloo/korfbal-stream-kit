import fs from 'node:fs';
import path from 'node:path';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {prisma} from '../services/prisma';
import {currentSeasonId} from '../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';
const MIGRATION = path.join(__dirname, '../../prisma/migrations/20261014170000_merge_duplicate_positions/migration.sql');

/** Runs the migration again on the test database; one connection, because it uses temp tables. */
async function runMigration() {
  const statements = fs.readFileSync(MIGRATION, 'utf8')
    .split('\n').filter((line) => !line.trim().startsWith('--')).join('\n')
    .split(';').map((s) => s.trim()).filter(Boolean);
  await prisma.$transaction(async (tx) => {
    for (const sql of statements) await tx.$executeRawUnsafe(sql);
  });
}

describe.runIf(runDb)('merge duplicate positions migration (integration)', () => {
  const P = 'Mergetest';
  let matchId: number;
  let productionId: number;
  let segmentId: number;
  let personIds: number[] = [];
  let keepId: number;
  let dupIds: number[] = [];
  let otherId: number;

  beforeAll(async () => {
    const match = await prisma.matchSchedule.create({
      data: {seasonId: await currentSeasonId(prisma), externalId: `merge-int-${Date.now()}`, date: new Date(), homeTeamName: 'A', awayTeamName: 'B', isHomeMatch: true},
    });
    matchId = match.id;
    productionId = (await prisma.production.create({data: {matchScheduleId: match.id}})).id;
    segmentId = (await prisma.productionSegment.create({data: {productionId, naam: 'Wedstrijd', volgorde: 1, duurInMinuten: 60}})).id;
    personIds = [
      (await prisma.person.create({data: {name: `${P} Anna`, gender: 'female'}})).id,
      (await prisma.person.create({data: {name: `${P} Bas`, gender: 'male'}})).id,
    ];

    // The kept one is the most used spelling; the duplicates differ in case/spacing
    keepId = (await prisma.position.create({data: {name: `${P} Camera links`}})).id;
    dupIds = [
      (await prisma.position.create({data: {name: `${P.toLowerCase()} camera links`}})).id,
      (await prisma.position.create({data: {name: `${P} Camera-Links`}})).id,
    ];
    otherId = (await prisma.position.create({data: {name: `${P} Regie`}})).id;

    await prisma.productionPersonPosition.createMany({data: [
      {productionId, personId: personIds[0], positionId: keepId},
      {productionId, personId: personIds[1], positionId: keepId},
      // Anna is on both spellings: must end up once
      {productionId, personId: personIds[0], positionId: dupIds[0]},
    ]});
    await prisma.segmentRoleAssignment.create({data: {productionSegmentId: segmentId, personId: personIds[1], positionId: dupIds[1]}});
    const callSheet = await prisma.callSheet.create({data: {productionId, name: 'Main'}});
    await prisma.callSheetItem.create({data: {
      id: `merge-int-${Date.now()}`, callSheetId: callSheet.id, cue: 'A1', title: 'Opening', durationSec: 60,
      positions: {create: [{positionId: dupIds[0]}, {positionId: dupIds[1]}]},
    }});
    await prisma.positionLink.createMany({data: [
      {sourcePositionId: otherId, targetPositionId: dupIds[0]},
      // Would become a link from the position to itself
      {sourcePositionId: keepId, targetPositionId: dupIds[1]},
    ]});

    await runMigration();
  });

  afterAll(async () => {
    await prisma.production.deleteMany({where: {id: productionId}});
    await prisma.matchSchedule.deleteMany({where: {id: matchId}});
    await prisma.person.deleteMany({where: {id: {in: personIds}}});
    await prisma.position.deleteMany({where: {name: {startsWith: P, mode: 'insensitive'}}});
  });

  it('keeps one position per name, with all references moved to it', async () => {
    const left = await prisma.position.findMany({where: {name: {startsWith: P, mode: 'insensitive'}}, orderBy: {id: 'asc'}});
    expect(left.map((p) => p.id)).toEqual([keepId, otherId]);

    const crew = await prisma.productionPersonPosition.findMany({where: {productionId}});
    expect(crew.map((c) => [c.personId, c.positionId]).sort()).toEqual([[personIds[0], keepId], [personIds[1], keepId]].sort());

    expect(await prisma.segmentRoleAssignment.findMany({where: {productionSegmentId: segmentId}, select: {personId: true, positionId: true}}))
      .toEqual([{personId: personIds[1], positionId: keepId}]);

    const item = await prisma.callSheetItem.findFirst({where: {callSheet: {productionId}}, include: {positions: true}});
    expect(item?.positions.map((p) => p.positionId)).toEqual([keepId]);

    const links = await prisma.positionLink.findMany({where: {OR: [{sourcePositionId: {in: [keepId, otherId]}}, {targetPositionId: {in: [keepId, otherId]}}]}});
    expect(links.map((l) => [l.sourcePositionId, l.targetPositionId])).toEqual([[otherId, keepId]]);
  });

  it('changes nothing when it runs again', async () => {
    const before = await prisma.position.count();
    await runMigration();
    expect(await prisma.position.count()).toBe(before);
  });
});
