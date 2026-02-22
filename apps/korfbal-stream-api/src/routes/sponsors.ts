import {Router} from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import {prisma} from '../services/prisma';
import {logger} from '../utils/logger';
import {
  makeLogoUrl,
  normalizeLogoFilename,
  SponsorInputSchema,
  SponsorQuerySchema,
  SponsorUpdateSchema
} from '../schemas/sponsor';

export const sponsorsRouter: Router = Router();

const storagePath = path.join(process.cwd(), 'storage', 'sponsors');
if (!fs.existsSync(storagePath)) {
  fs.mkdirSync(storagePath, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, storagePath);
  },
  filename: function (req, file, cb) {
    const sponsorName = (req as any).sponsor?.name || 'unknown-sponsor';
    const safeName = normalizeLogoFilename(sponsorName);
    const extension = path.extname(file.originalname) || '.png';
    cb(null, `${safeName}${extension}`);
  }
});

const uploadDisk = multer({ storage: diskStorage });
const uploadMem = multer({ storage: multer.memoryStorage() });

// Helper to sort sponsors by type priority
const typePriority: Record<string, number> = {
  premium: 1,
  goud: 2,
  zilver: 3,
  brons: 4,
};

// List sponsors with optional filtering and pagination
sponsorsRouter.get('/', async (req, res, next) => {
  try {
    const { type, page, limit } = SponsorQuerySchema.parse(req.query);
    const where: any = {};

    if (type) {
      if (Array.isArray(type)) {
        where.type = { in: type };
      } else {
        where.type = type;
      }
    }

    const skip = (page - 1) * limit;

    const allMatches = await prisma.sponsor.findMany({ where });

    allMatches.sort((a, b) => {
      const pa = typePriority[a.type] || 99;
      const pb = typePriority[b.type] || 99;
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name);
    });

    const total = allMatches.length;
    const items = allMatches.slice(skip, skip + limit);

    return res.json({ items, page, limit, total, pages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    logger.error('GET /sponsors failed', err);
    return next(err);
  }
});

sponsorsRouter.get('/export-excel', async (_req, res, next) => {
  try {
    const sponsors = await prisma.sponsor.findMany({});

    sponsors.sort((a, b) => {
      const pa = typePriority[a.type] || 99;
      const pb = typePriority[b.type] || 99;
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name);
    });

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Sponsors');

    ws.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Labels', key: 'type', width: 15 },
      { header: 'Website URL', key: 'websiteUrl', width: 30 },
      { header: 'Logo file name', key: 'logoUrl', width: 20 },
      { header: 'Sponsorcategorieën', key: 'categories', width: 25 },
      { header: 'DisplayName', key: 'displayName', width: 25 },
    ];

    sponsors.forEach((s) => {
      ws.addRow({
        name: s.name,
        type: s.type,
        websiteUrl: s.websiteUrl,
        logoUrl: s.logoUrl,
        categories: s.categories || '',
        displayName: (s as any).displayName || '',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Sponsors.xlsx');
    return res.send(buffer);
  } catch (err) {
    logger.error('GET /sponsors/export-excel failed', err as any);
    return next(err);
  }
});

sponsorsRouter.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
  try {
    const sponsor = await prisma.sponsor.findUnique({ where: { id } });
    if (!sponsor) return res.status(404).json({ error: 'No sponsor found with this id' });
    return res.json(sponsor);
  } catch (err) {
    logger.error('GET /sponsors/:id failed', err as any);
    return next(err);
  }
});

sponsorsRouter.post('/', async (req, res, next) => {
  try {
    const { name, type, websiteUrl, logoUrl, displayName } = SponsorInputSchema.parse(req.body);
    const created = await prisma.sponsor.create({
      data: {
        name,
        type,
        websiteUrl,
        logoUrl: logoUrl ? normalizeLogoFilename(logoUrl) : makeLogoUrl(name),
        displayName: displayName || null,
      },
    });
    return res.status(201).json(created);
  } catch (err) {
    logger.error('POST /sponsors failed', err as any);
    return next(err);
  }
});

sponsorsRouter.post('/:id/logo',
  async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' });
    const sponsor = await prisma.sponsor.findUnique({ where: { id } });
    if (!sponsor) return res.status(404).json({ error: 'Sponsor not found' });
    (req as any).sponsor = sponsor;
    next();
  },
  uploadDisk.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const id = Number(req.params.id);
      const logoUrl = req.file.filename;

      const updatedSponsor = await prisma.sponsor.update({
        where: { id },
        data: { logoUrl },
      });

      res.json(updatedSponsor);
    } catch (err) {
      logger.error(`POST /sponsors/${req.params.id}/logo failed`, err as any);
      return next(err);
    }
  }
);

sponsorsRouter.put('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ongeldig id' });
  try {
    const input = SponsorUpdateSchema.parse(req.body);
    const existing = await prisma.sponsor.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Niet gevonden' });

    const nextName = input.name ?? (existing as any).name;
    const nextLogo = input.logoUrl ? normalizeLogoFilename(input.logoUrl) : (input.name ? makeLogoUrl(input.name) : existing.logoUrl);

    const updated = await prisma.sponsor.update({
      where: { id },
      data: {
        name: nextName,
        type: (input.type as any) ?? existing.type,
        websiteUrl: input.websiteUrl ?? existing.websiteUrl,
        logoUrl: nextLogo,
        displayName: input.displayName === undefined ? (existing as any).displayName : (input.displayName || null),
      },
    });
    return res.json(updated);
  } catch (err) {
    logger.error('PUT /sponsors/:id failed', err as any);
    return next(err);
  }
});

sponsorsRouter.delete('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ongeldig id' });
  try {
    const existing = await prisma.sponsor.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Niet gevonden' });
    await prisma.sponsor.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    logger.error('DELETE /sponsors/:id failed', err as any);
    return next(err);
  }
});

sponsorsRouter.post('/upload-excel', uploadMem.single('file'), async (req, res, next) => {
  try {
    let buffer: Buffer | null = null;
    if (req.file && req.file.buffer) {
      buffer = req.file.buffer as Buffer;
    } else {
      const fallbackPath = path.join(process.cwd(), 'apps', 'korfbal-stream-api', 'Sponsors.xlsx');
      if (fs.existsSync(fallbackPath)) {
        buffer = fs.readFileSync(fallbackPath);
      }
    }

    if (!buffer) return res.status(400).json({ error: 'No file provided and default Sponsors.xlsx not found' });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const ws = workbook.worksheets[0];
    if (!ws) return res.status(400).json({ error: 'Workbook has no sheets' });

    const rows: any[] = [];
    let headers: string[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        headers = (row.values as any[]).slice(1).map(v => String(v));
      } else {
        const rowData: any = {};
        headers.forEach((header, index) => {
          const cellValue = row.getCell(index + 1).value;
          if (cellValue && typeof cellValue === 'object' && 'text' in cellValue) {
             rowData[header] = (cellValue as any).text;
          } else if (cellValue && typeof cellValue === 'object' && 'hyperlink' in cellValue) {
             rowData[header] = (cellValue as any).text || (cellValue as any).hyperlink;
          } else {
             rowData[header] = cellValue;
          }
        });
        rows.push(rowData);
      }
    });

    let created = 0;
    let updated = 0;
    const problems: { row: number; reason: string }[] = [];

    const receivedNames: string[] = [];

    function normalizeHeaderKey(k: string): string {
      const base = String(k || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '');
      return base;
    }

    logger.info('Sponsors Excel received', {
      sheet: ws.name,
      rows: rows.length,
      headers: headers,
    } as any);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const obj: Record<string, any> = {};
      for (const key of Object.keys(r)) {
        obj[normalizeHeaderKey(key)] = r[key];
      }
      const name = String(obj['name'] || obj['naam'] || '').trim().replace(" B.V.","") || undefined;
      const typeRaw = String(obj['labels'] || obj['type'] || obj['pakket'] || obj['sponsorpackage'] || '').trim().toLowerCase();
      const website = String(obj['website'] || obj['websiteurl'] || obj['site'] || obj['url'] || '').trim();
      const logo = String(obj['logo'] || obj['logourl'] || obj['logofilename'] || '').trim();
      const categories = String(obj['sponsorcategorieen'] || obj['categories'] || '').trim();
      const displayName = String(obj['displayname'] || obj['weergavenaam'] || '').trim();

      const allowed = ['premium', 'goud', 'zilver', 'brons'];
      let type: any = undefined;
      if (!typeRaw) {
        type = 'brons';
      } else if (allowed.includes(typeRaw)) {
        type = typeRaw as any;
      } else {
        type = undefined;
      }

      if (name) receivedNames.push(name);

      if (!name || !type || !website) {
        problems.push({ row: i + 2, reason: 'missing required fields or invalid type' });
        logger.info('Skipping sponsor row', { row: i + 2, name, typeRaw, websitePresent: !!website } as any);
        continue;
      }

      const data: any = {
        name,
        type,
        websiteUrl: website,
        logoUrl: logo ? normalizeLogoFilename(logo) : normalizeLogoFilename(name),
        categories: categories || undefined,
      };

      const hasDisplayNameColumn = 'displayname' in obj || 'weergavenaam' in obj;
      if (hasDisplayNameColumn) {
        data.displayName = displayName || null;
      }

      const existing = await prisma.sponsor.findFirst({ where: { name } });
      const performUpdate = async () => {
        try {
          if (existing) {
            const updateData: any = {
              name: existing.name || data.name,
              logoUrl: existing.logoUrl || data.logoUrl,
              type: data.type,
              websiteUrl: data.websiteUrl,
              categories: data.categories,
            };

            if (hasDisplayNameColumn) {
              updateData.displayName = data.displayName;
            } else { updateData.displayName = existing.displayName; }

            await prisma.sponsor.update({ where: { id: existing.id }, data: updateData });
            updated++;
            logger.info('Updated sponsor from Excel', { name } as any);
          } else {
            await prisma.sponsor.create({ data });
            created++;
            logger.info('Created sponsor from Excel', { name } as any);
          }
        } catch (err: any) {
          const msg = String(err?.message || '');
          if (/Unknown argument `(categories|displayName)`/i.test(msg)) {
            const { categories: _omitCat, displayName: _omitDN, ...dataFallback } = data;
            if (existing) {
              await prisma.sponsor.update({ where: { id: existing.id }, data: dataFallback as any });
              updated++;
              logger.info('Updated sponsor from Excel (fallback without new fields)', { name } as any);
            } else {
              await prisma.sponsor.create({ data: dataFallback as any });
              created++;
              logger.info('Created sponsor from Excel (fallback without new fields)', { name } as any);
            }
          } else {
            throw err;
          }
        }
      };

      await performUpdate();
    }


    logger.info('Sponsors Excel import summary', { created, updated, total: rows.length, problems: problems.length, names: receivedNames } as any);

    return res.json({ ok: true, sheet: ws.name, total: rows.length, created, updated, problems });
  } catch (err) {
    logger.error('POST /sponsors/upload-excel failed', err as any);
    return next(err);
  }
});

export const __test__ = { };
