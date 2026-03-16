import request from 'supertest';
import app from '../../main';
import {describe, expect, it} from 'vitest';
import {prisma} from '../../services/prisma';


describe('Production Import API (integration)', () => {

  it('should deactivate an existing active production when importing a new active one', async () => {
    const suffix = Math.random().toString(36).substring(7);
    // 1. Create an initial active production
    const initialMatch = await prisma.matchSchedule.create({
      data: {
        externalId: `match-import-1-${suffix}`,
        date: new Date(),
        homeTeamName: 'Initial Home',
        awayTeamName: 'Initial Away',
      },
    });
    const initialProduction = await prisma.production.create({
      data: {
        matchScheduleId: initialMatch.id,
        isActive: true,
      },
    });

    // Verify it's active
    const check1 = await prisma.production.findUnique({ where: { id: initialProduction.id } });
    expect(check1?.isActive).toBe(true);

    // 2. Prepare import data for a new active production
    const importData = {
      matchSchedule: {
        externalId: `match-import-2-${suffix}`,
        date: new Date().toISOString(),
        homeTeamName: 'Imported Home',
        awayTeamName: 'Imported Away',
      },
      production: {
        isActive: true,
      },
      // Include other required fields for a valid import
      persons: [],
      positions: [],
      segments: [],
      interviews: [],
    };

    // 3. Perform the import
    const res = await request(app)
      .post('/api/production/import')
      .send(importData);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const importedProductionId = res.body.id;

    // 4. Verify the state of both productions
    const initialProductionAfterImport = await prisma.production.findUnique({ where: { id: initialProduction.id } });
    const importedProduction = await prisma.production.findUnique({ where: { id: importedProductionId } });

    expect(initialProductionAfterImport?.isActive).toBe(false); // Initial one should be deactivated
    expect(importedProduction?.isActive).toBe(true);      // Imported one should be active
  });
});
