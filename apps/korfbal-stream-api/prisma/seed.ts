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

  // Seed Capabilities catalog and migrate from ProductionFunction if present
  type Gender = 'male' | 'female';

  const desiredCapabilities: Array<{ code: string; functionName: string; nameMale: string; nameFemale: string }> = [
    { code: 'REGISSEUR', functionName: 'Regie', nameMale: 'Regisseur', nameFemale: 'Regisseuse' },
    { code: 'COMMENTATOR', functionName: 'Commentaar', nameMale: 'Commentator', nameFemale: 'Commentatrice' },
    { code: 'PRESENTATOR', functionName: 'Presentatie', nameMale: 'Presentator', nameFemale: 'Presentatrice' },
    { code: 'ANALIST', functionName: 'Analist', nameMale: 'Analist', nameFemale: 'Analist' },
    { code: 'SPELER', functionName: 'Speler', nameMale: 'Speler', nameFemale: 'Speelster' },
    { code: 'COACH', functionName: 'Coach', nameMale: 'Coach', nameFemale: 'Coach' },
  ];

  console.log('Seeding capabilities catalog...');
  for (const c of desiredCapabilities) {
    await prisma.capability.upsert({
      where: { code: c.code },
      update: { functionName: c.functionName, nameMale: c.nameMale, nameFemale: c.nameFemale, vMixTitle: false },
      create: { code: c.code, functionName: c.functionName, nameMale: c.nameMale, nameFemale: c.nameFemale, vMixTitle: false },
    });
    console.log(`Ensured capability: ${c.code}`);
  }

  // Attempt migration/backfill from ProductionFunction -> Capability
  // Map base names to capability codes
  const nameToCode: Record<string, string> = {
    Regisseur: 'REGISSEUR',
    Regiseuze: 'REGISSEUR',
    Regisseuse: 'REGISSEUR',
    Commentator: 'COMMENTATOR',
    Commentatrice: 'COMMENTATOR',
    Presentator: 'PRESENTATOR',
    Presentatrice: 'PRESENTATOR',
    Analist: 'ANALIST',
    Speler: 'SPELER',
    Speelster: 'SPELER',
    Coach: 'COACH',
  };

  // If ProductionFunction table exists in the DB (older schema), migrate its data
  try {
    // Find any production functions
    const pfs = await (prisma as any).productionFunction?.findMany?.();
    if (pfs && Array.isArray(pfs) && pfs.length > 0) {
      console.log(`Migrating ${pfs.length} ProductionFunction rows to Capability relations...`);

      // Build code -> capabilityId map
      const caps = await prisma.capability.findMany();
      const codeToId = Object.fromEntries(caps.map((x) => [x.code, x.id] as const));

      // For each person capability, map to capability by PF name -> code
      const personCaps = await prisma.personCapability.findMany();
      for (const pc of personCaps) {
        const pf = pfs.find((x: any) => x.id === (pc as any).productionFunctionId);
        if (!pf) continue;
        const code = nameToCode[pf.name];
        const capabilityId = code ? codeToId[code] : undefined;
        if (!capabilityId) continue;
        // Upsert new relation and delete old row
        try {
          await prisma.personCapability.create({ data: { personId: (pc as any).personId, capabilityId } as any });
        } catch {}
        await prisma.personCapability.delete({ where: { personId_capabilityId: { personId: (pc as any).personId, capabilityId } } }).catch(() => {});
      }

      // For each match role assignment, map function -> capability
      const mras = await prisma.matchRoleAssignment.findMany();
      for (const mr of mras) {
        const pf = pfs.find((x: any) => x.id === (mr as any).productionFunctionId);
        if (!pf) continue;
        const code = nameToCode[pf.name];
        const capabilityId = code ? codeToId[code] : undefined;
        if (!capabilityId) continue;
        try {
          await prisma.matchRoleAssignment.update({ where: { id: mr.id }, data: { capabilityId } as any });
        } catch {}
      }
      console.log('Migration from ProductionFunction completed (best-effort).');
    }
  } catch {
    // ignore if PF does not exist in current client
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
