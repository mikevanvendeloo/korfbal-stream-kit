import {PrismaClient} from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {seedPersons, seedPositions, seedSkills, seedTitles} from './seed-data';

const prisma = new PrismaClient();

// Source data for sponsors
const seedSponsors = [
  {
    name: 'Ruitenheer',
    logoFileName: 'ruitenheer',
    siteUrl: 'https://www.ruitenheer.nl',
    sponsorPackage: 'Premium',
    sponsorType: 'Hoofdsponsor',
  },
] as const;

interface SourceSponsor {
  name: string;
  logoFileName?: string;
  siteUrl: string;
  sponsorPackage: string; // Premium | Goud | Zilver | Brons
  sponsorType?: string; // not persisted in current schema
}

function mapSponsorToModel(rec: SourceSponsor) {
  const name = rec.name;
  const type = String(rec.sponsorPackage || '').toLowerCase() as 'premium' | 'goud' | 'zilver' | 'brons' | 'event';
  const websiteUrl = rec.siteUrl;
  const baseLogo = rec.logoFileName || name.trim().replace(/\s+/g, '-').toLowerCase();
  const logoUrl = `${baseLogo}.png`;
  return {name, type, websiteUrl, logoUrl};
}

async function main() {
  console.log('Seeding sponsors...');
  for (const rec of seedSponsors) {
    const data = mapSponsorToModel(rec);
    if (!data.name || !data.type || !data.websiteUrl || !data.logoUrl) continue;

    const existing = await prisma.sponsor.findFirst({where: {name: data.name}});
    if (existing) {
      await prisma.sponsor.update({where: {id: existing.id}, data});
      console.log(`Updated sponsor: ${data.name}`);
    } else {
      await prisma.sponsor.create({data});
      console.log(`Created sponsor: ${data.name}`);
    }
  }

  console.log('Seeding skills catalog...');
  for (const s of seedSkills) {
    await prisma.skill.upsert({
      where: {code: s.code},
      update: {name: s.name, nameMale: s.nameMale, nameFemale: s.nameFemale, type: s.type},
      create: {code: s.code, name: s.name, nameMale: s.nameMale, nameFemale: s.nameFemale, type: s.type},
    });
    console.log(`Ensured skill: ${s.code}`);
  }

  console.log('Seeding positions catalog...');
  const skills = await prisma.skill.findMany();
  const skillsByCode = Object.fromEntries(skills.map((s) => [s.code, s.id] as const));

  for (const pos of seedPositions) {
    const skillId = pos.skillCode ? skillsByCode[pos.skillCode] : null;
    await prisma.position.upsert({
      where: {name: pos.name},
      update: {isStudio: pos.isStudio, category: pos.category, sortOrder: pos.sortOrder, skillId},
      create: {name: pos.name, isStudio: pos.isStudio, category: pos.category, sortOrder: pos.sortOrder, skillId},
    });
    console.log(`Ensured position: ${pos.name}`);
  }

  console.log('Seeding position links...');
  const posRegie = await prisma.position.findFirst({where: {name: 'Regie livestream'}});
  if (posRegie) {
    const targets = ['Regie LEDscherm', 'Muziek', 'Oplopen geluid', 'Speaker'];
    const targetPositions = await prisma.position.findMany({where: {name: {in: targets}}});
    for (const targetPos of targetPositions) {
      await (prisma as any).positionLink.upsert({
        where: {
          sourcePositionId_targetPositionId: {
            sourcePositionId: posRegie.id,
            targetPositionId: targetPos.id
          }
        },
        update: {},
        create: {
          sourcePositionId: posRegie.id,
          targetPositionId: targetPos.id
        }
      });
    }
  }

  console.log('Seeding default vMix title templates...');
  for (const t of seedTitles) {
    const existingDef = await (prisma as any).titleDefinition.findFirst({
      where: { productionId: null, name: t.name }
    }).catch(() => null);

    let def;
    if (existingDef) {
      def = existingDef;
      console.log(`Title template already exists: ${t.name}`);
    } else {
      const orderCount = await (prisma as any).titleDefinition.count({ where: { productionId: null } }).catch(() => 0);
      def = await (prisma as any).titleDefinition.create({
        data: { productionId: null, name: t.name, order: orderCount + 1, enabled: true },
      });
      console.log(`Created title template: ${t.name}`);
    }

    // Always ensure parts are present (if we want to update them, we'd need a more complex sync)
    // For now, only create parts if they don't exist yet for this definition
    const existingPartsCount = await (prisma as any).titlePart.count({
      where: { titleDefinitionId: def.id }
    }).catch(() => 0);

    if (existingPartsCount === 0) {
      for (const p of t.parts) {
        await (prisma as any).titlePart.create({
          data: {
            titleDefinitionId: def.id,
            sourceType: p.sourceType,
            teamSide: p.teamSide,
            limit: p.limit ?? null,
            filters: null,
          },
        });
      }
      console.log(`Added parts to title template: ${t.name}`);
    }
  }

  console.log('Seeding persons...');
  for (const p of seedPersons) {
    const existingPerson = await prisma.person.findFirst({where: {name: p.name}});
    let person;
    if (existingPerson) {
      person = await prisma.person.update({
        where: {id: existingPerson.id},
        data: {gender: p.gender},
      });
      console.log(`Updated person: ${p.name}`);
    } else {
      person = await prisma.person.create({
        data: {name: p.name, gender: p.gender},
      });
      console.log(`Created person: ${p.name}`);
    }

    // Only sync skills if the person was just created or updated via seed
    // This way we only touch skills of persons explicitly mentioned in the seed
    const currentSkills = await prisma.personSkill.findMany({ where: { personId: person.id } });
    const currentSkillCodes = new Set(
      currentSkills.map(ps => {
        const skill = skills.find(s => s.id === ps.skillId);
        return skill?.code;
      }).filter(Boolean)
    );

    const targetSkillCodes = new Set(p.skillCodes);

    // Check if skills are already correct to avoid unnecessary deletes/creates
    const skillsMatch = currentSkillCodes.size === targetSkillCodes.size &&
                       [...targetSkillCodes].every(code => currentSkillCodes.has(code));

    if (!skillsMatch) {
      await prisma.personSkill.deleteMany({where: {personId: person.id}});
      for (const code of p.skillCodes) {
        const skillId = skillsByCode[code];
        if (skillId) {
          await prisma.personSkill.create({
            data: {personId: person.id, skillId: skillId},
          });
        }
      }
      console.log(`Synced skills for person: ${p.name}`);
    }
  }

  console.log('Seeding CallSheetTemplates from JSON...');
  const callsheetDir = path.join(__dirname, 'seed-data/callsheets');
  console.log(`Checking directory: ${callsheetDir}`);
  if (fs.existsSync(callsheetDir)) {
    const files = fs.readdirSync(callsheetDir).filter(f => f.endsWith('.json'));
    console.log(`Found ${files.length} JSON files: ${files.join(', ')}`);
    const positions = await prisma.position.findMany();
    const positionsByName = Object.fromEntries(positions.map(p => [p.name, p.id] as const));

    for (const file of files) {
      const filePath = path.join(callsheetDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (data.version && data.version > 1) {
        console.warn(`Skipping ${file}: Unsupported template version ${data.version}`);
        continue;
      }

      const template = await prisma.callSheetTemplate.upsert({
        where: { name: data.name },
        update: {},
        create: { name: data.name }
      });

      console.log(`Ensured CallSheetTemplate: ${data.name}`);

      // Sync items
      // For simplicity, we remove existing items and recreate them to ensure order and positions are correct
      // In a production environment with existing productions linked to these templates, you might want to be more careful.
      await prisma.callSheetTemplateItem.deleteMany({ where: { templateId: template.id } });

      const idMapping: Record<string, string> = {};

      for (const item of data.items) {
        const createdItem = await prisma.callSheetTemplateItem.create({
          data: {
            templateId: template.id,
            title: item.title,
            durationSec: item.durationSec,
            orderIndex: item.orderIndex,
            isInVenue: item.isInVenue ?? false,
            isInLivestream: item.isInLivestream ?? true,
            note: item.note ?? null,
            isTimeAnchor: item.isTimeAnchor ?? false,
            anchorType: item.anchorType ?? null,
            autoAdvance: item.autoAdvance ?? false,
          }
        });

        if (item.id) {
          idMapping[item.id] = createdItem.id;
        }

        if (item.positions && Array.isArray(item.positions)) {
          for (const posName of item.positions) {
            const positionId = positionsByName[posName];
            if (positionId) {
              await prisma.callSheetTemplatePosition.create({
                data: {
                  templateItemId: createdItem.id,
                  positionId: positionId
                }
              });
            } else {
              console.warn(`Position not found: ${posName} for template ${data.name}`);
            }
          }
        }
      }

      // Second pass for parentIds
      for (const item of data.items) {
        if (item.parentId && idMapping[item.parentId]) {
          const currentItemId = idMapping[item.id];
          if (currentItemId) {
            await prisma.callSheetTemplateItem.update({
              where: { id: currentItemId },
              data: { parentId: idMapping[item.parentId] }
            });
          }
        }
      }
      console.log(`Synced ${data.items.length} items for template: ${data.name}`);
    }
  }

  console.log('Seeding SegmentTemplates from JSON...');
  const segDir = path.join(__dirname, 'seed-data/segments');
  if (fs.existsSync(segDir)) {
    const files = fs.readdirSync(segDir).filter(f => f.endsWith('.json'));
    console.log(`Found ${files.length} segment template JSON files: ${files.join(', ')}`);
    for (const file of files) {
      const filePath = path.join(segDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const version = Number(data.version ?? 1);
      if (!Number.isInteger(version) || version > 1) {
        console.warn(`Skipping ${file}: Unsupported template version ${data.version}`);
        continue;
      }
      const name = String(data.name || '').trim();
      if (!name) {
        console.warn(`Skipping ${file}: Missing name`);
        continue;
      }
      const isDefault = !!data.isDefault;
      const template = await prisma.segmentTemplate.upsert({
        where: { name },
        update: { isDefault },
        create: { name, isDefault },
      });
      await prisma.segmentTemplateItem.deleteMany({ where: { templateId: template.id } });
      const items = Array.isArray(data.items) ? data.items : [];
      for (const raw of items) {
        const naam = String(raw.naam || '').trim();
        const volgorde = Number(raw.volgorde);
        const duurInMinuten = Number(raw.duurInMinuten);
        const isTimeAnchor = !!raw.isTimeAnchor;
        if (!naam || !Number.isInteger(volgorde) || volgorde <= 0 || !Number.isInteger(duurInMinuten) || duurInMinuten < 0) continue;
        await prisma.segmentTemplateItem.create({
          data: { templateId: template.id, naam, volgorde, duurInMinuten, isTimeAnchor },
        });
      }
      console.log(`Synced SegmentTemplate from ${file}: ${name}`);
    }
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
