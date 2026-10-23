import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import app from '../main';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {getAssetsRoot} from '../services/config';
import {createProductionScenario, ProductionScenario} from '../../test-scenarios';
import os from 'node:os';
import {TEST_ORGANIZATION_SLUG, testDb as prisma} from '../../test-helpers';
import {makeCorruptRgbaPng, makePngBomb} from '../../test-images';

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
  const logoFile = path.join(getAssetsRoot(), 'sponsors', TEST_ORGANIZATION_SLUG, logoName);
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
    expect(res.body.sponsors).toContainEqual(expect.objectContaining({id: sponsorId, logoUrl: logoName, logoSrc: `/uploads/sponsors/${TEST_ORGANIZATION_SLUG}/${logoName}`}));
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

/** The images drawn on the pages: PDFKit names them /I1, /I2, … in the (uncompressed) page resources; a transparency mask has no name. */
const drawnImages = (pdf: Buffer) => new Set(pdf.toString('latin1').match(/\/I\d+ \d+ 0 R/g) ?? []).size;

/** The text of the PDF: PDFKit compresses the page content and writes text as hex strings in TJ arrays. */
function pdfText(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  const texts: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
    } catch {
      continue; // an image stream, or not deflated
    }
    for (const tj of content.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      texts.push([...tj[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((h) => Buffer.from(h[1], 'hex').toString('latin1')).join(''));
    }
  }
  return texts.join('\n');
}

describe.runIf(runDb)('production report PDF: sponsor logos (integration)', () => {
  const stamp = Date.now();
  // The logos are in sponsors/<slug>/; the database has only the file name
  const dir = path.join(getAssetsRoot(), 'sponsors', TEST_ORGANIZATION_SLUG);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-outside-'));
  const files = {
    match: `pdf-match-${stamp}.png`,
    ball: `pdf-ball-${stamp}.png`,
    webp: `pdf-webp-${stamp}.webp`,
    fakePng: `pdf-fake-${stamp}.png`, // really webp: the name must not fool the PDF
    missing: `pdf-missing-${stamp}.png`,
    bomb: `pdf-bomb-${stamp}.png`, // claims 20000×20000 pixels
    corrupt: `pdf-corrupt-${stamp}.png`, // RGBA with broken data: PDFKit never finished the PDF
    link: `pdf-link-${stamp}.png`, // symlink to a file outside the assets dir
  };
  // Smallest valid WEBP header (PDFKit can't draw it; it only needs to be recognised)
  const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x1a, 0, 0, 0]), Buffer.from('WEBPVP8L'), Buffer.alloc(14)]);
  let show: ProductionScenario;
  const sponsorIds: number[] = [];

  const pdf = async () => {
    const res = await request(app).get(`/api/production/${show.productionId}/report/pdf`).buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(res.body.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);
    return res.body as Buffer;
  };
  const setSponsors = (matchSponsor: string | null, ballSponsor: string | null) =>
    request(app).post(`/api/production/${show.productionId}/report`).send({matchSponsor, ballSponsor}).expect(200);

  beforeAll(async () => {
    show = await createProductionScenario(prisma, {items: []});
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, files.match), PNG);
    fs.writeFileSync(path.join(dir, files.ball), PNG);
    fs.writeFileSync(path.join(dir, files.webp), WEBP);
    fs.writeFileSync(path.join(dir, files.fakePng), WEBP);
    fs.writeFileSync(path.join(dir, files.bomb), makePngBomb());
    fs.writeFileSync(path.join(dir, files.corrupt), makeCorruptRgbaPng());
    fs.writeFileSync(path.join(outside, 'secret.png'), PNG);
    fs.symlinkSync(path.join(outside, 'secret.png'), path.join(dir, files.link));
    const make = async (name: string, logoUrl: string) =>
      sponsorIds.push((await prisma.sponsor.create({data: {name, type: 'goud', logoUrl, websiteUrl: 'https://example.org'}})).id);
    await make(`PDF Wedstrijd ${stamp}`, files.match);
    await make(`PDF Bal ${stamp}`, files.ball);
    await make(`PDF Webp ${stamp}`, files.webp);
    await make(`PDF Nep ${stamp}`, files.fakePng);
    await make(`PDF Kwijt ${stamp}`, files.missing);
    await make(`PDF Bom ${stamp}`, files.bomb);
    await make(`PDF Kapot ${stamp}`, files.corrupt);
    await make(`PDF Link ${stamp}`, files.link);
  });

  afterAll(async () => {
    await show.cleanup();
    await prisma.sponsor.deleteMany({where: {id: {in: sponsorIds}}});
    for (const file of Object.values(files)) fs.rmSync(path.join(dir, file), {force: true});
    fs.rmSync(outside, {recursive: true, force: true});
  });

  it('prints the match sponsor and the ball sponsor with their PNG logos from sponsors/<slug>/', async () => {
    await setSponsors(`PDF Wedstrijd ${stamp}`, `PDF Bal ${stamp}`);
    const body = await pdf();
    expect(drawnImages(body)).toBe(2);
    const text = pdfText(body);
    expect(text).toContain('Wedstrijdsponsor');
    expect(text).toContain('Balsponsor');
    expect(text).not.toContain('logo niet');
  });

  it('prints a note instead of a webp logo, also one named .png, and the PDF stays whole', async () => {
    await setSponsors(`PDF Webp ${stamp}`, `PDF Nep ${stamp}`);
    const body = await pdf();
    expect(drawnImages(body)).toBe(0);
    const notes = pdfText(body).match(/\(logo niet afdrukbaar: webp\)/g) ?? [];
    expect(notes).toHaveLength(2);
  });

  it('prints a note for a logo file that is gone, next to a logo that prints', async () => {
    await setSponsors(`PDF Kwijt ${stamp}`, `PDF Bal ${stamp}`);
    const body = await pdf();
    expect(drawnImages(body)).toBe(1);
    expect(pdfText(body)).toContain('(logo niet gevonden)');
  });

  it('refuses a decompression bomb and a corrupt RGBA PNG: the PDF is finished, with a note', async () => {
    await setSponsors(`PDF Bom ${stamp}`, `PDF Kapot ${stamp}`);
    const body = await pdf(); // a corrupt RGBA PNG used to leave this request hanging
    expect(drawnImages(body)).toBe(0);
    const text = pdfText(body);
    expect(text).toMatch(/\(logo niet afdrukbaar: te groot \(20000×20000/);
    expect(text).toContain('(logo niet afdrukbaar: beschadigde afbeelding)');
  }, 10_000);

  it('does not read a logo through a symlink out of the assets dir', async () => {
    await setSponsors(`PDF Link ${stamp}`, null);
    const body = await pdf();
    expect(drawnImages(body)).toBe(0);
    expect(pdfText(body)).toContain('(logo niet gevonden)');
  });
});
