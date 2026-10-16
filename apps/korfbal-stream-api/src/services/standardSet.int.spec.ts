import {afterAll, describe, expect, it} from 'vitest';
import {ensureOrganization, testDb as prisma} from '../../test-helpers';
import {runWithOrganization} from './organizationContext';
import {applyStandardSet, applyStandardSetWhereMissing} from './standardSet';
import {standardPositions} from '../standardSet/data';

const runDb = process.env.REQUIRE_DB === 'true';

describe.runIf(runDb)('standard set (integration)', () => {
  const slugs = ['std-set-a', 'std-set-b'];
  afterAll(async () => {
    await prisma.organization.deleteMany({where: {slug: {in: slugs}}});
  });

  const counts = (organizationId: number) => runWithOrganization(organizationId, async () => ({
    skills: await prisma.skill.count(),
    positions: await prisma.position.count(),
    links: await prisma.positionLink.count(),
    titles: await prisma.titleDefinition.count(),
    titleParts: await prisma.titlePart.count(),
    callSheetTemplates: await prisma.callSheetTemplate.count(),
    templateItems: await prisma.callSheetTemplateItem.count(),
    templatePositions: await prisma.callSheetTemplatePosition.count(),
    segmentTemplates: await prisma.segmentTemplate.count(),
    segmentItems: await prisma.segmentTemplateItem.count(),
  }));

  it('is idempotent: a second run adds nothing', async () => {
    const id = await ensureOrganization(prisma, slugs[0]);
    await applyStandardSet(id);
    const first = await counts(id);
    expect(first.positions).toBe(standardPositions.length);
    const again = await applyStandardSet(id);
    expect(again).toEqual({skills: 0, positions: 0, positionLinks: 0, titles: 0, callSheetTemplates: 0, segmentTemplates: 0});
    expect(await counts(id)).toEqual(first);
  });

  it('leaves changes of the organization alone and only adds what is missing', async () => {
    const id = await ensureOrganization(prisma, slugs[0]);
    await runWithOrganization(id, async () => {
      await prisma.position.update({where: {organizationId_name: {organizationId: id, name: 'Runner'}}, data: {sortOrder: 1}});
      await prisma.callSheetTemplate.delete({where: {organizationId_name: {organizationId: id, name: 'Alleen wedstrijd'}}});
    });
    const result = await applyStandardSet(id);
    expect(result.callSheetTemplates).toBe(1);
    await runWithOrganization(id, async () => {
      expect((await prisma.position.findFirst({where: {name: 'Runner'}}))?.sortOrder).toBe(1);
    });
  });

  it('gives organizations without positions the standard set on startup', async () => {
    const id = await ensureOrganization(prisma, slugs[1]);
    await applyStandardSetWhereMissing([id]);
    expect((await counts(id)).positions).toBe(standardPositions.length);
  });
});
