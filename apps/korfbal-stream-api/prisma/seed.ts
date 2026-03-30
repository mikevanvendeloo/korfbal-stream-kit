import {PrismaClient} from '@prisma/client';
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
