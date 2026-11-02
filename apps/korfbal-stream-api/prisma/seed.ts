import {prisma} from '../src/services/prisma';
import {addMissingStandardSkills} from '../src/services/standardSet';

/**
 * The seed after every `prisma migrate deploy` (docker/migrate-and-seed.cjs). It only ADDS shared basics and never
 * changes what an organization has: no persons, no roles of persons, no sponsors, no positions, titles or
 * draaiboek templates (those come with the standard set when an organization is created, or at startup for an
 * organization without any position: applyStandardSetWhereMissing). Organization data moves with export/import.
 *
 * 1. The current season (global): matches and players always belong to one.
 * 2. Per organization: the roles (skills) of the standard set it doesn't have yet.
 */
async function main() {
  // Same rule as services/season.ts: 1 July starts a season (Europe/Amsterdam)
  const [year, month] = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit'})
    .format(new Date()).split('-').map(Number);
  const startYear = month >= 7 ? year : year - 1;
  const season = await prisma.season.upsert({
    where: {startYear},
    update: {},
    create: {startYear, name: `${startYear}/${startYear + 1}`},
  });
  console.log(`Ensured season ${season.name}`);

  for (const organization of await prisma.organization.findMany({select: {id: true, slug: true}})) {
    const added = await addMissingStandardSkills(organization.id);
    console.log(`Roles added for ${organization.slug}: ${added}`);
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
