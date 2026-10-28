import request from 'supertest';
import ExcelJS from 'exceljs';
import app from '../main';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {testDb as prisma} from '../../test-helpers';

const runDb = process.env.REQUIRE_DB === 'true';

async function workbook(rows: Array<Record<string, unknown>>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sponsors');
  ws.columns = Object.keys(rows[0]).map((h) => ({header: h, key: h}));
  rows.forEach((r) => ws.addRow(r));
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

function uploadExcel(buf: Buffer) {
  return request(app).post('/api/sponsors/upload-excel')
    .attach('file', buf, {filename: 'sponsors.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

describe.runIf(runDb)('vMix sponsor data sources: enabled and type (integration)', () => {
  const marker = `vmixsp${Date.now()}`;
  const name = (n: string) => `${marker} ${n}`;
  const logo = (n: string) => `${marker}-${n}.png`;
  let previousConfig: unknown;
  const ids: Record<string, number> = {};

  beforeAll(async () => {
    previousConfig = (await request(app).get('/api/settings/sponsor-config')).body;
    for (const [key, type] of [['a', 'premium'], ['b', 'goud'], ['c', 'zilver'], ['d', 'goud'], ['ev', 'event']] as const) {
      ids[key] = (await prisma.sponsor.create({data: {name: name(key), type, logoUrl: logo(key), websiteUrl: 'https://example.org'}})).id;
    }
    // Rows and slides give one row of 3 logos per player image (global table): enough rows to show every logo
    await prisma.playerImage.createMany({data: Array.from({length: 10}, (_, i) => ({subject: `${marker}-${i}`, filename: `${marker}-${i}.png`}))});
  });

  afterAll(async () => {
    await request(app).put('/api/settings/sponsor-config').send(previousConfig);
    await prisma.sponsor.deleteMany({where: {name: {startsWith: marker}}});
    await prisma.playerImage.deleteMany({where: {subject: {startsWith: marker}}});
  });

  const setTypes = (types: string[]) =>
    request(app).put('/api/settings/sponsor-config').send({namesTypes: types, rowsTypes: types, slidesTypes: types});
  const setEnabled = (key: string, enabled: boolean) => request(app).put(`/api/sponsors/${ids[key]}`).send({enabled});

  /** The own sponsors' logos each feed gives, by feed. */
  async function feeds() {
    const own = (logos: string[]) => [...new Set(logos.filter((l) => l.startsWith(marker)))].sort();
    const names = await request(app).get('/api/vmix/sponsor-names');
    const carousel = await request(app).get('/api/vmix/sponsor-carrousel');
    const rows = await request(app).post('/api/vmix/sponsor-rows').send({seed: 1});
    const slides = await request(app).get('/api/vmix/sponsor-slides?seed=1');
    for (const res of [names, carousel, rows, slides]) expect(res.status).toBe(200);
    const rowLogos = (body: Array<{image1: string; image2: string; image3: string}>) => body.flatMap((r) => [r.image1, r.image2, r.image3]);
    const ticker: string = names.body[0]['sponsor-names'];
    return {
      names: Object.keys(ids).filter((k) => ticker.includes(name(k))).map(logo).sort(),
      carousel: own(carousel.body.map((s: {commercial: string}) => s.commercial)),
      rows: own(rowLogos(rows.body)),
      slides: own(rowLogos(slides.body)),
    };
  }

  it('leaves a switched-off sponsor out of every feed, and puts it back when switched on', async () => {
    expect((await setTypes(['premium', 'goud', 'zilver'])).status).toBe(200);
    expect((await setEnabled('b', false)).status).toBe(200);

    const off = [logo('a'), logo('c'), logo('d')].sort();
    expect(await feeds()).toEqual({names: off, carousel: off, rows: off, slides: off});

    expect((await setEnabled('b', true)).status).toBe(200);
    const on = [logo('a'), logo('b'), logo('c'), logo('d')].sort();
    expect(await feeds()).toEqual({names: on, carousel: on, rows: on, slides: on});
  });

  it('gives event sponsors only when the event type is chosen, and only when switched on', async () => {
    const withEvent = [logo('a'), logo('b'), logo('c'), logo('d'), logo('ev')].sort();
    expect((await setTypes(['premium', 'goud', 'zilver', 'event'])).status).toBe(200);
    expect(await feeds()).toEqual({names: withEvent, carousel: withEvent, rows: withEvent, slides: withEvent});

    await setEnabled('ev', false);
    const without = [logo('a'), logo('b'), logo('c'), logo('d')].sort();
    expect(await feeds()).toEqual({names: without, carousel: without, rows: without, slides: without});

    await setEnabled('ev', true);
    await setTypes(['event', 'premium', 'zilver']);
    const eventOnly = [logo('a'), logo('c'), logo('ev')].sort();
    expect(await feeds()).toEqual({names: eventOnly, carousel: eventOnly, rows: eventOnly, slides: eventOnly});
  });

  it('refuses an unknown sponsor type in the settings, so the feeds keep working', async () => {
    const res = await request(app).put('/api/settings/sponsor-config').send({namesTypes: ['onbekend'], rowsTypes: [], slidesTypes: []});
    expect(res.status).toBe(400);
    expect((await request(app).get('/api/vmix/sponsor-names')).status).toBe(200);
  });

  it('imports event sponsors from Excel', async () => {
    const res = await uploadExcel(await workbook([{Name: name('import-event'), Labels: 'event', Website: 'https://example.org'}]));
    expect(res.status).toBe(200);
    expect(res.body.problems).toEqual([]);
    expect(await prisma.sponsor.findFirst({where: {name: name('import-event')}})).toMatchObject({type: 'event', enabled: true});
  });

  it('keeps a switched-off sponsor off on an import without the Enabled column, and follows the column when filled', async () => {
    await setEnabled('d', false);
    await uploadExcel(await workbook([{Name: name('d'), Labels: 'goud', Website: 'https://example.org'}]));
    expect((await prisma.sponsor.findUnique({where: {id: ids.d}}))?.enabled).toBe(false);

    await uploadExcel(await workbook([{Name: name('d'), Labels: 'goud', Website: 'https://example.org', Enabled: 'Ja'}]));
    expect((await prisma.sponsor.findUnique({where: {id: ids.d}}))?.enabled).toBe(true);

    await uploadExcel(await workbook([{Name: name('d'), Labels: 'goud', Website: 'https://example.org', Enabled: false}]));
    expect((await prisma.sponsor.findUnique({where: {id: ids.d}}))?.enabled).toBe(false);
  });
});
