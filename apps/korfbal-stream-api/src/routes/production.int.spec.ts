import request from 'supertest';
import { execSync } from 'node:child_process';
import app from '../main';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

function run(cmd: string) {
  execSync(cmd, { stdio: 'inherit' });
}

const runDb = !!process.env.DATABASE_URL && process.env.RUN_DB_TESTS === 'true';
const prisma = new PrismaClient();

async function resetDb() {
  await prisma.$transaction([
    prisma.productionPerson.deleteMany({}),
    prisma.segmentRoleAssignment.deleteMany({}), // Added to clean up assignments
    prisma.productionSegment.deleteMany({}), // Added to clean up segments
    prisma.production.deleteMany({}),
    prisma.matchRoleAssignment.deleteMany({}),
    prisma.personSkill.deleteMany({}),
    prisma.person.deleteMany({}),
    prisma.matchSchedule.deleteMany({}),
    prisma.position.deleteMany({}), // Added to clean up positions
  ]);
}

(runDb ? describe : describe.skip)('Production API (integration)', () => {
  beforeAll(async () => {
    run('npx prisma migrate deploy --schema=apps/korfbal-stream-api/prisma/schema.prisma');
    run('npx prisma db seed --schema=apps/korfbal-stream-api/prisma/schema.prisma');
  });

  beforeEach(async () => {
    await resetDb();
  });

  it('creates, lists, updates and deletes a production', async () => {
    const match = await prisma.matchSchedule.create({
      data: {
        externalId: 'm-1',
        date: new Date(),
        homeTeamName: 'Fortuna/Ruitenheer 1',
        awayTeamName: 'Opponent',
        isHomeMatch: true,
      },
    });

    const createRes = await request(app).post('/api/production').send({ matchScheduleId: match.id });
    expect(createRes.status).toBe(201);

    const list = await request(app).get('/api/production');
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBe(1);

    // Update to another match
    const match2 = await prisma.matchSchedule.create({
      data: {
        externalId: 'm-2',
        date: new Date(),
        homeTeamName: 'Fortuna/Ruitenheer 2',
        awayTeamName: 'Opponent 2',
        isHomeMatch: true,
      },
    });

    const upd = await request(app).put(`/api/production/${createRes.body.id}`).send({ matchScheduleId: match2.id });
    expect(upd.status).toBe(200);
    expect(upd.body.matchScheduleId).toBe(match2.id);

    const del = await request(app).delete(`/api/production/${createRes.body.id}`);
    expect(del.status).toBe(204);
  });

  it('manages production persons (attendance tracking)', async () => {
    // Setup production
    const match = await prisma.matchSchedule.create({
      data: { externalId: 'm-persons', date: new Date(), homeTeamName: 'Fortuna/Ruitenheer 1', awayTeamName: 'Opp', isHomeMatch: true },
    });
    const prod = await prisma.production.create({ data: { matchScheduleId: match.id } });

    // Create persons
    const alice = await prisma.person.create({ data: { name: 'Alice', gender: 'female' } });
    const bob = await prisma.person.create({ data: { name: 'Bob', gender: 'male' } });

    // Initially no persons present
    const list1 = await request(app).get(`/api/production/${prod.id}/persons`);
    expect(list1.status).toBe(200);
    expect(list1.body.length).toBe(0);

    // Mark Alice as present
    const add1 = await request(app)
      .post(`/api/production/${prod.id}/persons`)
      .send({ personId: alice.id });
    expect(add1.status).toBe(201);

    // Mark Bob as present
    const add2 = await request(app)
      .post(`/api/production/${prod.id}/persons`)
      .send({ personId: bob.id });
    expect(add2.status).toBe(201);

    // List should show 2
    const list2 = await request(app).get(`/api/production/${prod.id}/persons`);
    expect(list2.status).toBe(200);
    expect(list2.body.length).toBe(2);

    // Adding Alice again should conflict
    const addDupe = await request(app)
      .post(`/api/production/${prod.id}/persons`)
      .send({ personId: alice.id });
    expect(addDupe.status).toBe(409);

    // Remove Alice
    const del = await request(app).delete(`/api/production/${prod.id}/persons/${add1.body.id}`);
    expect(del.status).toBe(204);

    // List should show 1
    const list3 = await request(app).get(`/api/production/${prod.id}/persons`);
    expect(list3.status).toBe(200);
    expect(list3.body.length).toBe(1);
    expect(list3.body[0].person.name).toBe('Bob');
  });

  it('should create a production with the new default segments', async () => {
    const match = await prisma.matchSchedule.create({
      data: {
        externalId: 'm-segments',
        date: new Date(),
        homeTeamName: 'Test Home',
        awayTeamName: 'Test Away',
        isHomeMatch: true,
      },
    });

    const createRes = await request(app).post('/api/production').send({ matchScheduleId: match.id });
    expect(createRes.status).toBe(201);
    const productionId = createRes.body.id;

    const segmentsRes = await request(app).get(`/api/production/${productionId}/segments`);
    expect(segmentsRes.status).toBe(200);
    expect(segmentsRes.body).toBeInstanceOf(Array);
    expect(segmentsRes.body.length).toBe(6);

    const segments = segmentsRes.body;

    expect(segments[0]).toMatchObject({ naam: 'Voorbeschouwing', duurInMinuten: 20, volgorde: 1, isTimeAnchor: false });
    expect(segments[1]).toMatchObject({ naam: 'Oplopen', duurInMinuten: 10, volgorde: 2, isTimeAnchor: false });
    expect(segments[2]).toMatchObject({ naam: 'Eerste helft', duurInMinuten: 35, volgorde: 3, isTimeAnchor: true });
    expect(segments[3]).toMatchObject({ naam: 'Rust', duurInMinuten: 10, volgorde: 4, isTimeAnchor: false });
    expect(segments[4]).toMatchObject({ naam: 'Tweede helft', duurInMinuten: 35, volgorde: 5, isTimeAnchor: false });
    expect(segments[5]).toMatchObject({ naam: 'Nabeschouwing', duurInMinuten: 20, volgorde: 6, isTimeAnchor: false });
  });

  it('should return production report with correct attendees and assignment status', async () => {
    // Setup production
    const match = await prisma.matchSchedule.create({
      data: { externalId: 'm-report', date: new Date(), homeTeamName: 'Home Team', awayTeamName: 'Away Team', isHomeMatch: true },
    });
    const prod = await prisma.production.create({ data: { matchScheduleId: match.id } });

    // Create persons
    const assignedPerson = await prisma.person.create({ data: { name: 'Assigned Person', gender: 'male' } });
    const unassignedPerson = await prisma.person.create({ data: { name: 'Unassigned Person', gender: 'female' } });

    // Mark both as present for the production
    await prisma.productionPerson.create({ data: { productionId: prod.id, personId: assignedPerson.id } });
    await prisma.productionPerson.create({ data: { productionId: prod.id, personId: unassignedPerson.id } });

    // Create a segment and a position
    const segment = await prisma.productionSegment.create({
      data: { productionId: prod.id, naam: 'Segment 1', duurInMinuten: 10, volgorde: 1 },
    });
    const position = await prisma.position.create({ data: { name: 'Camera Operator' } });

    // Assign 'Assigned Person' to a position in a segment
    await prisma.segmentRoleAssignment.create({
      data: { productionSegmentId: segment.id, personId: assignedPerson.id, positionId: position.id },
    });

    // Fetch the production report
    const res = await request(app).get(`/api/production/${prod.id}/report`);
    expect(res.status).toBe(200);
    expect(res.body.enriched).toBeDefined();
    expect(res.body.enriched.attendees).toBeInstanceOf(Array);
    expect(res.body.enriched.attendees.length).toBe(2);

    // Check the assigned person
    const foundAssigned = res.body.enriched.attendees.find((p: any) => p.name === 'Assigned Person');
    expect(foundAssigned).toBeDefined();
    expect(foundAssigned.isAssigned).toBe(true);

    // Check the unassigned person
    const foundUnassigned = res.body.enriched.attendees.find((p: any) => p.name === 'Unassigned Person');
    expect(foundUnassigned).toBeDefined();
    expect(foundUnassigned.isAssigned).toBe(false);

    // Test PDF generation (basic check for status, content-type and disposition)
    const pdfRes = await request(app).get(`/api/production/${prod.id}/report/pdf`);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.header['content-type']).toBe('application/pdf');
    expect(pdfRes.header['content-disposition']).toMatch(/^attachment; filename="Productie_Positie_Overzicht_/);

    // Test WhatsApp generation (basic check for status, content-type and disposition)
    const whatsappRes = await request(app).get(`/api/production/${prod.id}/report/whatsapp`);
    expect(whatsappRes.status).toBe(200);
    expect(whatsappRes.header['content-type']).toBe('text/plain; charset=utf-8');
    expect(whatsappRes.header['content-disposition']).toMatch(/^attachment; filename="Productie_Positie_Overzicht_/);
    expect(whatsappRes.text).toContain('Assigned Person');
    expect(whatsappRes.text).toContain('_(Unassigned Person)_'); // Check for italic formatting
  });
});
