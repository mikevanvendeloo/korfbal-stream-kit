import {Router} from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
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

// Multer memory storage for Excel upload
const uploadMem = multer({ storage: multer.memoryStorage() });

// List sponsors with optional filtering and pagination
sponsorsRouter.get('/', async (req, res, next) => {
  try {
    const { type, page, limit } = SponsorQuerySchema.parse(req.query);
    const where: any = {};
    if (type) where.type = type;

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.sponsor.findMany({ where, orderBy: { id: 'asc' }, skip, take: limit }),
      prisma.sponsor.count({ where }),
    ]);

    return res.json({ items, page, limit, total, pages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    logger.error('GET /sponsors failed', err);
    return next(err);
  }
});

// GET /api/sponsors/export-excel
// Exports all sponsors to Excel with the same format as import
// IMPORTANT: This route must be BEFORE /:id to avoid "export-excel" being treated as an ID
sponsorsRouter.get('/export-excel', async (_req, res, next) => {
  try {
    const sponsors = await prisma.sponsor.findMany({ orderBy: { id: 'asc' } });

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Map sponsors to Excel rows
    const rows = sponsors.map((s) => ({
      Name: s.name,
      Labels: s.type,
      'Website URL': s.websiteUrl,
      'Logo file name': s.logoUrl,
      Sponsorcategorieën: s.categories || '',
      DisplayName: (s as any).displayName || '',
    }));

    // Create sheet
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Sponsors');

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Sponsors.xlsx');
    return res.send(buffer);
  } catch (err) {
    logger.error('GET /sponsors/export-excel failed', err as any);
    return next(err);
  }
});

// Get sponsor by id
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

// Create sponsor
sponsorsRouter.post('/', async (req, res, next) => {
  try {
    const { name, type, websiteUrl, logoUrl } = SponsorInputSchema.parse(req.body);
    const created = await prisma.sponsor.create({
      data: {
        name,
        type,
        websiteUrl,
        logoUrl: logoUrl ? normalizeLogoFilename(logoUrl) : makeLogoUrl(name),
      },
    });
    return res.status(201).json(created);
  } catch (err) {
    logger.error('POST /sponsors failed', err as any);
    return next(err);
  }
});

// Update sponsor
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
        displayName: input.displayName !== undefined ? (input.displayName || null) : (existing as any).displayName,
      },
    });
    return res.json(updated);
  } catch (err) {
    logger.error('PUT /sponsors/:id failed', err as any);
    return next(err);
  }
});

// Delete sponsor
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

// POST /api/sponsors/upload-excel
// Accepts multipart/form-data with field name "file" containing an .xlsx file.
// If no file uploaded, attempts to read a default Sponsors.xlsx from the API app root.
sponsorsRouter.post('/upload-excel', uploadMem.single('file'), async (req, res, next) => {
  try {
    let buffer: Buffer | null = null;
    if (req.file && req.file.buffer) {
      buffer = req.file.buffer as Buffer;
    } else {
      // fallback to default file in the API app root
      const fallbackPath = path.join(process.cwd(), 'apps', 'korfbal-stream-api', 'Sponsors.xlsx');
      if (fs.existsSync(fallbackPath)) {
        buffer = fs.readFileSync(fallbackPath);
      }
    }

    if (!buffer) return res.status(400).json({ error: 'No file provided and default Sponsors.xlsx not found' });

    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return res.status(400).json({ error: 'Workbook has no sheets' });
    const ws = wb.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

    let created = 0;
    let updated = 0;
    const problems: { row: number; reason: string }[] = [];

    const receivedNames: string[] = [];

    function normalizeHeaderKey(k: string): string {
      // Lowercase, trim, strip diacritics, and strip all non-alphanumeric characters so that
      // headers like "Sponsor package", "Website URL", and "Sponsorcategorieën" normalize to
      // "sponsorpackage", "websiteurl", and "sponsorcategorieen" respectively.
      const base = String(k || '')
        .normalize('NFD')
        // Remove diacritic marks
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]/g, '');
      return base;
    }

    logger.info('Sponsors Excel received', {
      sheet: sheetName,
      rows: rows.length,
      headers: rows[0] ? Object.keys(rows[0]) : [],
    } as any);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const obj: Record<string, any> = {};
      for (const key of Object.keys(r)) {
        obj[normalizeHeaderKey(key)] = r[key];
      }
      const name = String(obj['name'] || obj['naam'] || '').trim().replace(" B.V.","") || undefined;
      // In the provided Excel, the "Labels" column actually represents the sponsor type
      // Prioritize labels; fall back to Type/Pakket/Sponsor package
      const typeRaw = String(obj['labels'] || obj['type'] || obj['pakket'] || obj['sponsorpackage'] || '').trim().toLowerCase();
      const website = String(obj['website'] || obj['websiteurl'] || obj['site'] || obj['url'] || '').trim();
      const logo = String(obj['logo'] || obj['logourl'] || obj['logofilename'] || '').trim();
      const categories = String(obj['sponsorcategorieen'] || obj['categories'] || '').trim();
      const displayName = String(obj['displayname'] || obj['weergavenaam'] || '').trim();

      // map type to enum or handle missing: default to 'brons' when not provided
      const allowed = ['premium', 'goud', 'zilver', 'brons'];
      let type: any = undefined;
      if (!typeRaw) {
        type = 'brons';
      } else if (allowed.includes(typeRaw)) {
        type = typeRaw as any;
      } else {
        // explicit but invalid type -> skip row to remain strict with provided values
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
        type, // the label
        websiteUrl: website,
        // On Excel import, always normalize to lowercase-safe filename; if no logo provided, derive from name in lowercase
        logoUrl: logo ? normalizeLogoFilename(logo) : normalizeLogoFilename(name),
        categories: categories || undefined,
      };

      // Only update displayName if the column is present in the Excel (even if empty)
      const hasDisplayNameColumn = 'displayname' in obj || 'weergavenaam' in obj;
      if (hasDisplayNameColumn) {
        data.displayName = displayName || null;
      }

      const existing = await prisma.sponsor.findFirst({ where: { name } });
      const performUpdate = async () => {
        try {
          if (existing) {
            if (!existing.name) existing.name = data.name;
            if (!existing.logoUrl) existing.logoUrl = data.logoUrl;
            existing.type = data.type;
            existing.websiteUrl = data.websiteUrl;
            existing.categories = data.categories;
            if (hasDisplayNameColumn) {
              (existing as any).displayName = data.displayName;
            }

            await prisma.sponsor.update({ where: { id: existing.id }, data: existing });
            updated++;
            logger.info('Updated sponsor from Excel', { name } as any);
          } else {
            await prisma.sponsor.create({ data });
            created++;
            logger.info('Created sponsor from Excel', { name } as any);
          }
        } catch (err: any) {
          const msg = String(err?.message || '');
          // Backward compatibility: if Prisma client/schema doesn't have `categories` or `displayName` column yet,
          // retry without that field so uploads continue to work without immediate migration.
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

    try {
      logger.info('Sponsors Excel import summary', { created, updated, total: rows.length, problems: problems.length, names: receivedNames } as any);
    } catch (_) {}

    return res.json({ ok: true, sheet: sheetName, total: rows.length, created, updated, problems });
  } catch (err) {
    logger.error('POST /sponsors/upload-excel failed', err as any);
    return next(err);
  }
});

export const __test__ = { };
