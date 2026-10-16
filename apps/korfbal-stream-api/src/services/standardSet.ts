import {Position, Prisma} from '@prisma/client';
import {prisma} from './prisma';
import {runWithOrganization} from './organizationContext';
import {findPositionByName} from '../domain/positionSkill';
import {logger} from '../utils/logger';
import {standardPositionLinks, standardPositions, standardSkills, standardTitles} from '../standardSet/data';
import {standardCallSheetTemplates} from '../standardSet/callSheetTemplates';
import {standardSegmentTemplates} from '../standardSet/segmentTemplates';

export type StandardSetResult = {
  skills: number;
  positions: number;
  positionLinks: number;
  titles: number;
  callSheetTemplates: number;
  segmentTemplates: number;
};

/** SHOW_CALLER and SHOWCALLER are the same skill */
const skillKey = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Adds the standard set (skills, positions with links, title templates, callsheet and segment
 * templates) to an organization, in one transaction. Idempotent: only what is missing is added;
 * existing rows (matched by skill code, position name like findPositionByName, template name) are
 * left as the organization made them, except that an old skill code is renamed to the standard one and
 * a position without a skill gets the standard skill.
 */
export async function applyStandardSet(organizationId: number): Promise<StandardSetResult> {
  return runWithOrganization(organizationId, () =>
    prisma.$transaction((tx) => addStandardSet(tx), {timeout: 60_000}));
}

async function addStandardSet(tx: Prisma.TransactionClient): Promise<StandardSetResult> {
  const result: StandardSetResult = {skills: 0, positions: 0, positionLinks: 0, titles: 0, callSheetTemplates: 0, segmentTemplates: 0};

  const skills = await tx.skill.findMany();
  for (const s of standardSkills) {
    const existing = skills.find((e) => e.code === s.code) ?? skills.find((e) => skillKey(e.code) === skillKey(s.code));
    if (existing) {
      if (existing.code !== s.code) Object.assign(existing, await tx.skill.update({where: {id: existing.id}, data: {code: s.code}}));
      continue;
    }
    skills.push(await tx.skill.create({data: {code: s.code, name: s.name, nameMale: s.nameMale, nameFemale: s.nameFemale, type: s.type}}));
    result.skills++;
  }
  const skillIdFor = (code?: string) => (code ? skills.find((s) => skillKey(s.code) === skillKey(code))?.id ?? null : null);

  const positions: Position[] = await tx.position.findMany();
  for (const p of standardPositions) {
    const existing = findPositionByName(positions, p.name);
    if (existing) {
      // Only fill in what is missing: the organization may have changed the rest
      const skillId = skillIdFor(p.skillCode);
      if (!existing.skillId && skillId) Object.assign(existing, await tx.position.update({where: {id: existing.id}, data: {skillId}}));
      continue;
    }
    positions.push(await tx.position.create({
      data: {name: p.name, isStudio: p.isStudio, category: p.category, sortOrder: p.sortOrder, skillId: skillIdFor(p.skillCode)},
    }));
    result.positions++;
  }

  for (const link of standardPositionLinks) {
    const source = findPositionByName(positions, link.source);
    if (!source) continue;
    for (const targetName of link.targets) {
      const target = findPositionByName(positions, targetName);
      if (!target) continue;
      const exists = await tx.positionLink.findFirst({where: {sourcePositionId: source.id, targetPositionId: target.id}});
      if (exists) continue;
      await tx.positionLink.create({data: {sourcePositionId: source.id, targetPositionId: target.id}});
      result.positionLinks++;
    }
  }

  const titleCount = await tx.titleDefinition.count({where: {productionId: null}});
  for (const t of standardTitles) {
    if (await tx.titleDefinition.findFirst({where: {productionId: null, name: t.name}})) continue;
    await tx.titleDefinition.create({
      data: {
        name: t.name,
        order: titleCount + result.titles + 1,
        enabled: true,
        parts: {create: t.parts.map((part) => ({sourceType: part.sourceType, teamSide: part.teamSide, limit: part.limit ?? null}))},
      },
    });
    result.titles++;
  }

  for (const template of standardCallSheetTemplates) {
    if (await tx.callSheetTemplate.findFirst({where: {name: template.name}})) continue;
    const created = await tx.callSheetTemplate.create({data: {name: template.name}});
    const idByKey = new Map<string, string>();
    for (const item of template.items) {
      const positionIds = [...new Set(item.positions.map((name) => findPositionByName(positions, name)?.id).filter((id): id is number => !!id))];
      const row = await tx.callSheetTemplateItem.create({
        data: {
          templateId: created.id,
          title: item.title,
          note: item.note ?? null,
          durationSec: item.durationSec,
          orderIndex: item.orderIndex,
          isInVenue: item.isInVenue,
          isInLivestream: item.isInLivestream,
          isTimeAnchor: item.isTimeAnchor ?? false,
          anchorType: item.anchorType ?? null,
          autoAdvance: item.autoAdvance ?? false,
          positions: {create: positionIds.map((positionId) => ({positionId}))},
        },
      });
      if (item.key) idByKey.set(item.key, row.id);
    }
    for (const item of template.items) {
      const id = item.key && idByKey.get(item.key);
      const parentId = item.parentKey && idByKey.get(item.parentKey);
      if (id && parentId) await tx.callSheetTemplateItem.update({where: {id}, data: {parentId}});
    }
    result.callSheetTemplates++;
  }

  const hasDefault = !!(await tx.segmentTemplate.findFirst({where: {isDefault: true}}));
  for (const template of standardSegmentTemplates) {
    if (await tx.segmentTemplate.findFirst({where: {name: template.name}})) continue;
    await tx.segmentTemplate.create({
      data: {name: template.name, isDefault: template.isDefault && !hasDefault, items: {create: template.items}},
    });
    result.segmentTemplates++;
  }

  return result;
}

/**
 * Startup check: organizations without any position get the standard set (e.g. KNKV right after the
 * migration, in environments that skip the seed).
 */
export async function applyStandardSetWhereMissing(organizationIds?: number[]): Promise<void> {
  const organizations = await prisma.organization.findMany({
    where: organizationIds ? {id: {in: organizationIds}} : {},
    select: {id: true, slug: true},
  });
  for (const organization of organizations) {
    const positions = await runWithOrganization(organization.id, () => prisma.position.count());
    if (positions > 0) continue;
    const result = await applyStandardSet(organization.id);
    logger.info(`Standard set added to organization ${organization.slug}`, result);
  }
}
