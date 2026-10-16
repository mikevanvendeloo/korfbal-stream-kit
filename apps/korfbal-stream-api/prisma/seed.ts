import {prisma} from '../src/services/prisma';
import {runWithOrganization} from '../src/services/organizationContext';
import {applyStandardSet} from '../src/services/standardSet';
import {seedPersons} from './seed-data';

/** The organizations the migration creates; the seed makes sure they exist (and have the standard set). */
const organizations = [
  {slug: 'fortuna', name: 'Fortuna'},
  {slug: 'knkv', name: 'KNKV'},
];

// Fortuna's own data, not part of the standard set
const fortunaSponsors = [
  {name: 'Ruitenheer', logoUrl: 'ruitenheer.png', websiteUrl: 'https://www.ruitenheer.nl', type: 'premium' as const},
];

async function seedFortuna() {
  console.log('Seeding Fortuna sponsors...');
  for (const data of fortunaSponsors) {
    const existing = await prisma.sponsor.findFirst({where: {name: data.name}});
    if (existing) await prisma.sponsor.update({where: {id: existing.id}, data});
    else await prisma.sponsor.create({data});
    console.log(`Ensured sponsor: ${data.name}`);
  }

  console.log('Seeding Fortuna persons...');
  const skills = await prisma.skill.findMany();
  for (const p of seedPersons) {
    const existing = await prisma.person.findFirst({where: {name: p.name}});
    const person = existing
      ? await prisma.person.update({where: {id: existing.id}, data: {gender: p.gender}})
      : await prisma.person.create({data: {name: p.name, gender: p.gender}});

    // Only touch the skills of persons named in the seed, and only when they differ
    const current = await prisma.personSkill.findMany({where: {personId: person.id}});
    const currentCodes = new Set(current.map((ps) => skills.find((s) => s.id === ps.skillId)?.code).filter(Boolean));
    const target = new Set(p.skillCodes);
    if (currentCodes.size === target.size && [...target].every((code) => currentCodes.has(code))) continue;

    await prisma.personSkill.deleteMany({where: {personId: person.id}});
    for (const code of p.skillCodes) {
      const skill = skills.find((s) => s.code === code);
      if (skill) await prisma.personSkill.create({data: {personId: person.id, skillId: skill.id}});
    }
    console.log(`Synced skills for person: ${p.name}`);
  }
}

async function main() {
  for (const org of organizations) {
    const {id} = await prisma.organization.upsert({where: {slug: org.slug}, update: {}, create: org});
    const result = await applyStandardSet(id);
    console.log(`Standard set for ${org.name}:`, result);
    if (org.slug === 'fortuna') await runWithOrganization(id, seedFortuna);
  }

  // Seasons: matches and players always belong to one. Seed the season containing today so
  // matches/players created afterwards (import, manual entry) have an active season to land in.
  // Same rule as services/season.ts: 1 July starts a season (Europe/Amsterdam).
  const [year, month] = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit'})
    .format(new Date()).split('-').map(Number);
  const startYear = month >= 7 ? year : year - 1;
  const currentSeason = await prisma.season.upsert({
    where: {startYear},
    update: {},
    create: {startYear, name: `${startYear}/${startYear + 1}`},
  });
  console.log(`Ensured season ${currentSeason.name}`);

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
