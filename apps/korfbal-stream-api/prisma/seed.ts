import {PrismaClient} from '@prisma/client';

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
    { code: 'SCHERM_REGISSEUR', functionName: 'Scherm regie', nameMale: 'Regisseur', nameFemale: 'Regisseuse' },
    { code: 'COMMENTAAR', functionName: 'Commentaar', nameMale: 'Commentator', nameFemale: 'Commentatrice' },
    { code: 'PRESENTATIE', functionName: 'Presentatie', nameMale: 'Presentator', nameFemale: 'Presentatrice' },
    { code: 'ANALIST', functionName: 'Analist', nameMale: 'Analist', nameFemale: 'Analist' },
    { code: 'GELUID', functionName: 'Geluid', nameMale: 'Geluidsman', nameFemale: 'Geluidsvrouw' },
    { code: 'SPOTLIGHT', functionName: 'Volgspot oplopen', nameMale: 'Lichtman', nameFemale: 'Lichtvrouw' },
    { code: 'CAMERA_OVERVIEW', functionName: 'Camera overzicht', nameMale: 'Cameraman', nameFemale: 'Cameravrouw' },
    { code: 'CAMERA_ZOOM', functionName: 'Camera zoom', nameMale: 'Cameraman', nameFemale: 'Cameravrouw' },
    { code: 'INTERVIEW_COORDINATOR', functionName: 'Interview coordinator', nameMale: 'Interview coordinator', nameFemale: 'Interview coordinator' },
    { code: 'SHOW_CALLER', functionName: 'Show caller', nameMale: 'Show caller', nameFemale: 'Show caller' },
    { code: 'HERHALINGEN', functionName: 'Herhalingen operator', nameMale: 'Herhalingen operator', nameFemale: 'Herhalingen operator' },

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
    Commentator: 'COMMENTAAR',
    Commentatrice: 'COMMENTAAR',
    Presentator: 'PRESENTATIE',
    Presentatrice: 'PRESENTATIE',
    Analist: 'ANALIST',
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

  // Seed Positions catalog
  const positions = [
    'overzicht camera',
    'camera links',
    'camera rechts',
    'regie',
    'ledscherm regie',
    'muziek',
    'volgspot oplopen',
    'spelers halen',
    'studio camera',
    'herhalingen',
    'show caller',
    'presentatie',
    'commentaar',
    'analist',
    'interview coordinator',
  ];
  console.log('Seeding positions catalog...');
  for (const name of positions) {
    await prisma.position.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Seed default vMix Title Templates (global templates: productionId = null)
  // Only create when none exist yet to avoid overwriting admin-configured templates.
  const existingTemplateCount = await (prisma as any).titleDefinition.count({ where: { productionId: null } }).catch(() => 0);
  if (existingTemplateCount === 0) {
    console.log('Seeding default vMix title templates...');
    // Helper to create a template with parts
    let order = 1;
    async function createTemplate(name: string, parts: Array<{ sourceType: 'COMMENTARY' | 'PRESENTATION' | 'PRESENTATION_AND_ANALIST' | 'TEAM_PLAYER' | 'TEAM_COACH'; teamSide?: 'HOME' | 'AWAY' | 'NONE'; limit?: number | null }>) {
      const def = await (prisma as any).titleDefinition.create({
        data: { productionId: null, name, order: order++, enabled: true },
      });
      for (const p of parts) {
        await (prisma as any).titlePart.create({
          data: {
            titleDefinitionId: def.id,
            sourceType: p.sourceType,
            teamSide: (p.teamSide || 'NONE'),
            limit: p.limit ?? null,
            filters: null,
          },
        });
      }
    }

    await createTemplate('Presentatie & analist', [
      { sourceType: 'PRESENTATION_AND_ANALIST', teamSide: 'NONE' },
    ]);
    await createTemplate('Presentatie', [
      { sourceType: 'PRESENTATION', teamSide: 'NONE' },
    ]);
    await createTemplate('Commentaar (allen)', [
      { sourceType: 'COMMENTARY', teamSide: 'NONE' },
    ]);
    await createTemplate('Thuis speler', [
      { sourceType: 'TEAM_PLAYER', teamSide: 'HOME' },
    ]);
    await createTemplate('Uit speler', [
      { sourceType: 'TEAM_PLAYER', teamSide: 'AWAY' },
    ]);
    await createTemplate('Thuis coach', [
      { sourceType: 'TEAM_COACH', teamSide: 'HOME' },
    ]);
    await createTemplate('Uit coach', [
      { sourceType: 'TEAM_COACH', teamSide: 'AWAY' },
    ]);
  } else {
    console.log('Skipping vMix title templates seeding: templates already exist');
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
