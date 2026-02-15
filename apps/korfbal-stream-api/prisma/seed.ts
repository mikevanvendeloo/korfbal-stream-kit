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
  return {name, type, websiteUrl, logoUrl};
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
    const existing = await prisma.sponsor.findFirst({where: {name: data.name}});
    if (existing) {
      await prisma.sponsor.update({where: {id: existing.id}, data});
      console.log(`Updated sponsor: ${data.name}`);
    } else {
      await prisma.sponsor.create({data});
      console.log(`Created sponsor: ${data.name}`);
    }
  }

  // Seed Skills catalog (formerly Capabilities)
  type Gender = 'male' | 'female';

  const desiredSkills: Array<{ code: string; name: string; nameMale: string; nameFemale: string }> = [
    {code: 'REGISSEUR', name: 'Regie livestream', nameMale: 'Regisseur', nameFemale: 'Regisseuse'},
    {code: 'SCHERM_REGISSEUR', name: 'Regie LEDscherm', nameMale: 'Regisseur', nameFemale: 'Regisseuse'},
    {code: 'COMMENTAAR', name: 'Commentaar', nameMale: 'Commentator', nameFemale: 'Commentatrice'},
    {code: 'PRESENTATIE', name: 'Presentatie', nameMale: 'Presentator', nameFemale: 'Presentatrice'},
    {code: 'ANALIST', name: 'Analist', nameMale: 'Analist', nameFemale: 'Analist'},
    {code: 'GELUID', name: 'Geluid', nameMale: 'Geluidsman', nameFemale: 'Geluidsvrouw'},
    {code: 'SPOTLIGHT', name: 'Volgspot oplopen', nameMale: 'Lichtman', nameFemale: 'Lichtvrouw'},
    {code: 'CAMERA_OVERVIEW', name: 'Camera overzicht', nameMale: 'Cameraman', nameFemale: 'Cameravrouw'},
    {code: 'CAMERA_ZOOM', name: 'Camera zoom', nameMale: 'Cameraman', nameFemale: 'Cameravrouw'},
    {
      code: 'INTERVIEW_COORDINATOR',
      name: 'Interview coordinator',
      nameMale: 'Interview coordinator',
      nameFemale: 'Interview coordinator'
    },
    {code: 'SHOW_CALLER', name: 'Show caller', nameMale: 'Show caller', nameFemale: 'Show caller'},
    {
      code: 'HERHALINGEN',
      name: 'Herhalingen operator',
      nameMale: 'Herhalingen operator',
      nameFemale: 'Herhalingen operator'
    },
    {code: 'RUNNER', name: 'Runner', nameMale: 'Runner', nameFemale: 'Runner'},
    {code: 'SPEAKER', name: 'Speaker', nameMale: 'Speaker', nameFemale: 'Speaker'},
    {code: 'CAMERA_PTZ', name: 'PTZ operator', nameMale: 'PTZ operator', nameFemale: 'PTZ operator'},
    {code: 'IN_EAR_SUPPORT', name:'In-ear ondersteuning', nameFemale: 'In-ear ondersteuning', nameMale: 'In-ear ondersteuning'},
  ];

  console.log('Seeding skills catalog...');
  for (const s of desiredSkills) {
    await prisma.skill.upsert({
      where: {code: s.code},
      update: {name: s.name, nameMale: s.nameMale, nameFemale: s.nameFemale},
      create: {code: s.code, name: s.name, nameMale: s.nameMale, nameFemale: s.nameFemale},
    });
    console.log(`Ensured skill: ${s.code}`);
  }

  // Attempt migration/backfill from ProductionFunction -> Skill
  // Map base names to skill codes
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
      console.log(`Migrating ${pfs.length} ProductionFunction rows to Skill relations...`);

      // Build code -> skillId map
      const skills = await prisma.skill.findMany();
      const codeToId = Object.fromEntries(skills.map((x) => [x.code, x.id] as const));

      // For each person skill, map to skill by PF name -> code
      const personSkills = await prisma.personSkill.findMany();
      for (const ps of personSkills) {
        const pf = pfs.find((x: any) => x.id === (ps as any).productionFunctionId);
        if (!pf) continue;
        const code = nameToCode[pf.name];
        const skillId = code ? codeToId[code] : undefined;
        if (!skillId) continue;
        // Upsert new relation and delete old row
        try {
          await prisma.personSkill.create({data: {personId: (ps as any).personId, skillId} as any});
        } catch { /* empty */
        }
        await prisma.personSkill.delete({
          where: {
            personId_skillId: {
              personId: (ps as any).personId,
              skillId
            }
          }
        }).catch((e) => {
          console.error(`Failed to remove duplicate person skill: ${e}`);
        });
      }

      // For each match role assignment, map function -> skill
      const mras = await prisma.matchRoleAssignment.findMany();
      for (const mr of mras) {
        const pf = pfs.find((x: any) => x.id === (mr as any).productionFunctionId);
        if (!pf) continue;
        const code = nameToCode[pf.name];
        const skillId = code ? codeToId[code] : undefined;
        if (!skillId) continue;
        try {
          await prisma.matchRoleAssignment.update({where: {id: mr.id}, data: {skillId} as any});
        } catch { /* empty */
        }
      }
      console.log('Migration from ProductionFunction completed (best-effort).');
    }
  } catch {
    // ignore if PF does not exist in current client
  }

  // Seed Positions catalog with isStudio flag
  const positions: Array<{ name: string; isStudio: boolean }> = [
    {name: 'Camera overzicht', isStudio: false},
    {name: 'Camera links', isStudio: false},
    {name: 'Camera rechts', isStudio: false},
    {name: 'Camera studio', isStudio: true},
    {name: 'Regie livestream', isStudio: false},
    {name: 'Regie LEDscherm', isStudio: false},
    {name: 'Muziek', isStudio: false},
    {name: 'Oplopen geluid', isStudio: false},
    {name: 'Oplopen volgspot', isStudio: false},
    {name: 'Interview coordinator', isStudio: true},
    {name: 'Camera studio', isStudio: true},
    {name: 'Herhalingen', isStudio: false},
    {name: 'Show caller', isStudio: false},
    {name: 'Presentatie', isStudio: true},
    {name: 'Commentaar', isStudio: true},
    {name: 'Analist', isStudio: true},
    {name: 'PTZ operator', isStudio: true},
    {name: 'Runner', isStudio: false},
    {name: 'Speaker', isStudio: true}
  ];
  console.log('Seeding positions catalog...');
  for (const pos of positions) {
    await prisma.position.upsert({
      where: {name: pos.name},
      update: {isStudio: pos.isStudio},
      create: {name: pos.name, isStudio: pos.isStudio},
    });
  }

  // Link common positions to capabilities by convention
  const skills = await prisma.skill.findMany();
  const skillsByCode = Object.fromEntries(skills.map((c) => [c.code, c.id] as const));
  const mapNameToCode: Record<string, string> = {
    'Camera rechts': 'CAMERA_ZOOM',
    'Camera links': 'CAMERA_ZOOM',
    'Camera studio': 'CAMERA_ZOOM',
    'Camera overzicht': 'CAMERA_OVERVIEW',
    'Regie livestream': 'REGISSEUR',
    'Show caller': 'SHOW_CALLER',
    'Herhalingen': 'HERHALINGEN',
    'Regie LEDscherm': 'SCHERM_REGISSEUR',
    'Muziek': 'GELUID',
    'Commentaar': 'COMMENTAAR',
    'Presentatie': 'PRESENTATIE',
    'Analist': 'ANALIST',
    'Oplopen volgspot': 'SPOTLIGHT',
    'Oplopen geluid': 'GELUID',
    'Interview coordinator': 'INTERVIEW_COORDINATOR',
    'PTZ operator': 'CAMERA_PTZ',
    'Runner': 'RUNNER',
    'Speaker': 'SPEAKER',
  };
  for (const [name, code] of Object.entries(mapNameToCode)) {
    const skillId = skillsByCode[code];
    if (!skillId) continue;
    try {
      await prisma.position.update({where: {name}, data: {skillId: skillId}});
    } catch { /* empty */
    }
  }

  // Seed a default template for Voorbeschouwing if not configured
  const existingDefaults = await prisma.segmentDefaultPosition.findMany({where: {segmentName: 'Voorbeschouwing'}});
  if (existingDefaults.length === 0) {
    const defaultNames = ['camera overzicht', 'camera links', 'camera rechts', 'regie', 'scherm regie', 'commentaar', 'analist', 'presentatie'];
    const allPos = await prisma.position.findMany({where: {name: {in: defaultNames}}});
    const byName = new Map(allPos.map((p) => [p.name, p] as const));
    let order = 0;
    for (const nm of defaultNames) {
      const p = byName.get(nm);
      if (!p) continue;
      await prisma.segmentDefaultPosition.create({
        data: {
          segmentName: 'Voorbeschouwing',
          positionId: p.id,
          order: order++
        }
      });
    }
  }

  // Seed default vMix Title Templates (global templates: productionId = null)
  // Only create when none exist yet to avoid overwriting admin-configured templates.
  const existingTemplateCount = await (prisma as any).titleDefinition.count({where: {productionId: null}}).catch(() => 0);
  if (existingTemplateCount === 0) {
    console.log('Seeding default vMix title templates...');
    // Helper to create a template with parts
    let order = 1;

    async function createTemplate(name: string, parts: Array<{
      sourceType: 'COMMENTARY' | 'PRESENTATION_AND_ANALIST' | 'TEAM_COACH' | 'TEAM_PLAYER';
      teamSide?: 'AWAY' | 'HOME' | 'NONE';
      order?: number;
      limit?: number | null
    }>) {
      const def = await (prisma as any).titleDefinition.create({
        data: {productionId: null, name, order: order, enabled: true},
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
      {sourceType: 'PRESENTATION_AND_ANALIST', teamSide: 'NONE', order: 1},
    ]);

    await createTemplate('Commentaar (allen)', [
      {sourceType: 'COMMENTARY', teamSide: 'NONE', order: 2},
    ]);

    await createTemplate('Uit coach', [
      {sourceType: 'TEAM_COACH', teamSide: 'AWAY', order: 3},
    ]);

    await createTemplate('Uit speler', [
      {sourceType: 'TEAM_PLAYER', teamSide: 'AWAY', order: 4},
    ]);

    await createTemplate('Thuis coach', [
      {sourceType: 'TEAM_COACH', teamSide: 'HOME', order: 5},
    ]);

    await createTemplate('Thuis speler', [
      {sourceType: 'TEAM_PLAYER', teamSide: 'HOME', order: 6},
    ]);

  } else {
    console.log('Skipping vMix title templates seeding: templates already exist');
  }

  // Seed persons with their capabilities
  const seedPersons: Array<{ name: string; gender: Gender; skillCodes: string[] }> = [
    {name: 'Danny', gender: 'male', skillCodes: ['REGISSEUR', 'CAMERA_ZOOM', 'CAMERA_OVERVIEW', 'SCHERM_REGISSEUR','IN_EAR_SUPPORT']},
    {
      name: 'Pascal',
      gender: 'male',
      skillCodes: ['REGISSEUR', 'GELUID', 'SPOTLIGHT', 'SCHERM_REGISSEUR', 'CAMERA_ZOOM', 'CAMERA_OVERVIEW', 'HERHALINGEN','IN_EAR_SUPPORT','PTZ_OPERATOR','RUNNER']
    },
    {
      name: 'Michel',
      gender: 'male',
      skillCodes: ['REGISSEUR', 'CAMERA_ZOOM', 'CAMERA_OVERVIEW', 'SCHERM_REGISSEUR', 'SPOTLIGHT', 'HERHALINGEN','IN_EAR_SUPPORT']
    },
    {
      name: 'Richard',
      gender: 'male',
      skillCodes: ['CAMERA_ZOOM', 'SPOTLIGHT', 'GELUID', 'CAMERA_OVERVIEW', 'REGISSEUR', 'HERHALINGEN']
    },
    {name: 'Henk', gender: 'male', skillCodes: ['CAMERA_OVERVIEW']},
    {
      name: 'Mike',
      gender: 'male',
      skillCodes: ['CAMERA_OVERVIEW', 'CAMERA_ZOOM', 'SCHERM_REGISSEUR', 'INTERVIEW_COORDINATOR', 'HERHALINGEN']
    },
    {name: 'Bart', gender: 'male', skillCodes: ['CAMERA_ZOOM', 'REGISSEUR', 'HERHALINGEN']},
    {name: 'Christie', gender: 'female', skillCodes: ['CAMERA_OVERVIEW', 'CAMERA_ZOOM', 'INTERVIEW_COORDINATOR']},
    {name: 'Peter Jan', gender: 'male', skillCodes: ['CAMERA_OVERVIEW', 'CAMERA_ZOOM', 'SCHERM_REGISSEUR']},
    {name: 'Bastiaan', gender: 'male', skillCodes: ['CAMERA_OVERVIEW', 'CAMERA_ZOOM', 'SCHERM_REGISSEUR']},
    {name: 'Ron', gender: 'male', skillCodes: ['CAMERA_OVERVIEW', 'CAMERA_ZOOM', 'SCHERM_REGISSEUR']},
    {name: 'Justin', gender: 'male', skillCodes: ['SCHERM_REGISSEUR']},
    {name: 'Thomas', gender: 'male', skillCodes: ['CAMERA_OVERVIEW', 'CAMERA_ZOOM', 'SPOTLIGHT', 'GELUID']},
    {name: 'Ferdinand Wittenberg', gender: 'male', skillCodes: ['PRESENTATIE', 'COMMENTAAR']},
    {name: 'Daan de Groot', gender: 'male', skillCodes: ['COMMENTAAR']},
    {name: 'Peter Boes', gender: 'male', skillCodes: ['ANALIST']},
    {name: 'Ryanne Segaar', gender: 'female', skillCodes: ['PRESENTATIE']},
    {name: 'Claire van Oosten', gender: 'female', skillCodes: ['PRESENTATIE', 'ANALIST']},
    {name: 'Jennifer Tromp', gender: 'female', skillCodes: ['COMMENTAAR', 'ANALIST']},
    {name: 'Ed van der Steen', gender: 'male', skillCodes: ['ANALIST']},
    {name: 'Laurens Verbaan', gender: 'male', skillCodes: ['ANALIST', 'COMMENTAAR']},
    {name: 'Bruun van der Steuijt', gender: 'male', skillCodes: ['SPEAKER']},
    {name: 'Maarten Boot', gender: 'male', skillCodes: ['SPEAKER']},
    {name: 'Cindy van Eijk', gender: 'female', skillCodes: ['COMMENTAAR', 'ANALIST']},
  ];

  console.log('Seeding persons with capabilities...');
  for (const p of seedPersons) {
    // Upsert person by name
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

    // Delete existing capabilities for this person
    await prisma.personSkill.deleteMany({where: {personId: person.id}});

    // Add capabilities
    for (const code of p.skillCodes) {
      const skillId = skillsByCode[code];
      if (!skillId) {
        console.warn(`  Skipping unknown capability code: ${code}`);
        continue;
      }
      await prisma.personSkill.create({
        data: {personId: person.id, skillId: skillId},
      });
    }
    console.log(`  Added ${p.skillCodes.length} capabilities for ${p.name}`);
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
