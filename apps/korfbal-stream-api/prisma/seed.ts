/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Source data provided in the issue; mapped to our schema
const seedSponsors = [
  {
    name: 'Ruitenheer',
    logoFileName: 'ruitenheer',
    siteUrl: 'https://www.ruitenheer.nl',
    sponsorPackage: 'Premium',
    sponsorType: 'Hoofdsponsor',
  },
  {
    name: 'M-Sports',
    logoFileName: 'm-sports',
    siteUrl: 'https://www.m-sports.com',
    sponsorPackage: 'Zilver',
    sponsorType: 'Natura',
  },
] as const;

interface SourceSponsor {
  name: string;
  logoFileName?: string;
  siteUrl: string;
  sponsorPackage: string; // Premium | Goud | Zilver | Brons
  sponsorType?: string; // not persisted in current schema
}

function mapToModel(rec: SourceSponsor) {
  // Map provided fields to Prisma model fields
  const name = rec.name;
  const type = String(rec.sponsorPackage || '').toLowerCase() as 'premium' | 'goud' | 'zilver' | 'brons';
  const websiteUrl = rec.siteUrl;
  const baseLogo = rec.logoFileName || name.trim().replace(/\s+/g, '-').toLowerCase();
  const logoUrl = `${baseLogo}.png`;
  return { name, type, websiteUrl, logoUrl };
}

async function main() {
  console.log('Seeding sponsors...');
  for (const rec of seedSponsors) {
    const data = mapToModel(rec);

    if (!data.name || !data.type || !data.websiteUrl || !data.logoUrl) {
      console.warn('Skipping invalid record:', rec);
      continue;
    }

    // Idempotent upsert by name (name not unique in schema, so emulate)
    const existing = await prisma.sponsor.findFirst({ where: { name: data.name } });
    if (existing) {
      await prisma.sponsor.update({ where: { id: existing.id }, data });
      console.log(`Updated sponsor: ${data.name}`);
    } else {
      await prisma.sponsor.create({ data });
      console.log(`Created sponsor: ${data.name}`);
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
