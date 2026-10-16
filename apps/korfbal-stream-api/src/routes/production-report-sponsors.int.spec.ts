import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import app from '../main';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {getAssetsRoot} from '../services/config';
import {createProductionScenario, ProductionScenario} from '../../test-scenarios';
import {testDb as prisma} from '../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';

// Smallest valid PNG (1x1), so PDFKit can draw it
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** PDFKit compresses the content, but an embedded image is still its own XObject (plus one for a transparency mask). */
const imageCount = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Subtype \/Image/g) ?? []).length;

function binary(res: request.Response, done: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => done(null, Buffer.concat(chunks)));
}

describe.runIf(runDb)('production report sponsors (integration)', () => {
  const logoName = `report-ball-sponsor-${Date.now()}.png`;
  const logoFile = path.join(getAssetsRoot(), 'sponsors', logoName);
  let productionId: number;
  let show: ProductionScenario;
  let sponsorId: number;

  beforeAll(async () => {
    fs.mkdirSync(path.dirname(logoFile), {recursive: true});
    fs.writeFileSync(logoFile, PNG);
    sponsorId = (await prisma.sponsor.create({data: {name: 'Report Int Balsponsor', type: 'goud', logoUrl: logoName, websiteUrl: 'https://example.org'}})).id;
    show = await createProductionScenario(prisma, {items: []});
    productionId = show.productionId;
  });

  afterAll(async () => {
    await show.cleanup();
    await prisma.sponsor.deleteMany({where: {id: sponsorId}});
    fs.rmSync(logoFile, {force: true});
  });

  it('stores a ball sponsor next to the match sponsor', async () => {
    const saved = await request(app).post(`/api/production/${productionId}/report`)
      .send({matchSponsor: 'Vrije tekst sponsor', ballSponsor: 'report int balsponsor'});
    expect(saved.status).toBe(200);

    const res = await request(app).get(`/api/production/${productionId}/report`);
    expect(res.body.report).toMatchObject({matchSponsor: 'Vrije tekst sponsor', ballSponsor: 'report int balsponsor'});
    expect(res.body.sponsors).toContainEqual(expect.objectContaining({id: sponsorId, logoUrl: logoName}));
  });

  it('puts both sponsors in the texts and the matching logo in the PDF', async () => {
    await request(app).post(`/api/production/${productionId}/report`)
      .send({matchSponsor: 'Vrije tekst sponsor', ballSponsor: 'Report Int Balsponsor'});

    const whatsapp = await request(app).get(`/api/production/${productionId}/report/whatsapp`);
    expect(whatsapp.text).toContain('*🏐 Balsponsor*\nReport Int Balsponsor');
    const markdown = await request(app).get(`/api/production/${productionId}/report/markdown`);
    expect(markdown.text).toContain('## Balsponsor\n\nReport Int Balsponsor');

    const withLogo = await request(app).get(`/api/production/${productionId}/report/pdf`).buffer(true).parse(binary);
    expect(withLogo.status).toBe(200);
    expect(imageCount(withLogo.body)).toBeGreaterThan(0);

    // A typed name without a matching sponsor has no logo
    await request(app).post(`/api/production/${productionId}/report`).send({matchSponsor: 'Vrije tekst sponsor', ballSponsor: null});
    const withoutLogo = await request(app).get(`/api/production/${productionId}/report/pdf`).buffer(true).parse(binary);
    expect(imageCount(withoutLogo.body)).toBe(0);
  });
});
