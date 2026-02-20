import {Router} from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import {prisma} from '../../services/prisma';

export const productionCallsheetsRouter: Router = Router();

// Multer memory storage for Excel upload (used by callsheet import)
const uploadMem = multer({ storage: multer.memoryStorage() });

// -------- Callsheets --------
// List callsheets for a production
productionCallsheetsRouter.get('/:id/callsheets', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    const prod = await prisma.production.findUnique({ where: { id } });
    if (!prod) return res.status(404).json({ error: 'Not found' });

    const items = await prisma.callSheet.findMany({ where: { productionId: id }, orderBy: { id: 'asc' } });
    return res.json(items);
  } catch (err) {
    return next(err);
  }
});

// Create a callsheet for a production
productionCallsheetsRouter.post('/:id/callsheets', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

    const name = String(req.body?.name || '').trim();
    const color = req.body?.color != null ? String(req.body.color) : null;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const created = await prisma.callSheet.create({ data: { productionId: id, name, color: color || undefined } });
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'P2003') return res.status(404).json({ error: 'Production not found' });
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Callsheet name must be unique within production' });
    return next(err);
  }
});

// Get a callsheet by id
productionCallsheetsRouter.get('/callsheets/:callSheetId', async (req, res, next) => {
  try {
    const callSheetId = Number(req.params.callSheetId);
    if (!Number.isInteger(callSheetId) || callSheetId <= 0) return res.status(400).json({ error: 'Invalid callsheet id' });

    const cs = await prisma.callSheet.findUnique({
      where: { id: callSheetId },
      include: {
        items: {
          include: {
            productionSegment: true,
            positions: { include: { position: true } },
          },
          orderBy: [{ productionSegmentId: 'asc' }, { orderIndex: 'asc' }],
        },
      },
    });
    if (!cs) return res.status(404).json({ error: 'Not found' });

    // Normalize positions to array of position ids
    const norm = {
      ...cs,
      items: cs.items.map((it) => ({
        ...it,
        positionIds: it.positions.map((p) => p.positionId),
      })),
    } as any;

    return res.json(norm);
  } catch (err) {
    return next(err);
  }
});

// Update a callsheet (name/color)
productionCallsheetsRouter.put('/callsheets/:callSheetId', async (req, res, next) => {
  try {
    const callSheetId = Number(req.params.callSheetId);
    if (!Number.isInteger(callSheetId) || callSheetId <= 0) return res.status(400).json({ error: 'Invalid callsheet id' });
    const name = req.body?.name != null ? String(req.body.name).trim() : undefined;
    const color = req.body?.color != null ? String(req.body.color) : undefined;

    const updated = await prisma.callSheet.update({ where: { id: callSheetId }, data: { name, color } });
    return res.json(updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Callsheet name must be unique within production' });
    return next(err);
  }
});

// Delete a callsheet
productionCallsheetsRouter.delete('/callsheets/:callSheetId', async (req, res, next) => {
  try {
    const callSheetId = Number(req.params.callSheetId);
    if (!Number.isInteger(callSheetId) || callSheetId <= 0) return res.status(400).json({ error: 'Invalid callsheet id' });
    await prisma.$transaction(async (tx) => {
      await tx.callSheetItemPosition.deleteMany({ where: { item: { callSheetId } } });
      await tx.callSheetItem.deleteMany({ where: { callSheetId } });
      await tx.callSheet.delete({ where: { id: callSheetId } });
    });
    return res.status(204).send();
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    return next(err);
  }
});

// Create an item within a callsheet
productionCallsheetsRouter.post('/callsheets/:callSheetId/items', async (req, res, next) => {
  try {
    const callSheetId = Number(req.params.callSheetId);
    if (!Number.isInteger(callSheetId) || callSheetId <= 0) return res.status(400).json({ error: 'Invalid callsheet id' });

    const id = String(req.body?.id || '').trim();
    const productionSegmentId = Number(req.body?.productionSegmentId);
    const cue = String(req.body?.cue || '').trim();
    const title = String(req.body?.title || '').trim();
    const note = req.body?.note != null ? String(req.body.note) : null;
    const color = req.body?.color != null ? String(req.body.color) : null;
    const durationSec = Number(req.body?.durationSec);
    const timeStart = req.body?.timeStart ? new Date(req.body.timeStart) : null;
    const timeEnd = req.body?.timeEnd ? new Date(req.body.timeEnd) : null;
    const orderIndex = req.body?.orderIndex != null ? Number(req.body.orderIndex) : 0;
    const positionIds: number[] = Array.isArray(req.body?.positionIds) ? req.body.positionIds.map((x: any) => Number(x)).filter((x: number) => Number.isInteger(x) && x > 0) : [];

    if (!id || !productionSegmentId || !cue || !title || !Number.isInteger(durationSec) || durationSec < 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Basic validation of segment and positions
    const seg = await prisma.productionSegment.findUnique({ where: { id: productionSegmentId } });
    if (!seg) return res.status(404).json({ error: 'Segment not found' });

    const created = await prisma.$transaction(async (tx) => {
      const it = await tx.callSheetItem.create({
        data: {
          id,
          callSheetId,
          productionSegmentId,
          cue,
          title,
          note: note || undefined,
          color: color || undefined,
          timeStart: timeStart || undefined,
          timeEnd: timeEnd || undefined,
          durationSec,
          orderIndex,
        },
      });

      if (positionIds.length > 0) {
        await tx.callSheetItemPosition.createMany({
          data: positionIds.map((pid) => ({ callSheetItemId: it.id, positionId: pid })),
          skipDuplicates: true,
        });
      }

      return it;
    });

    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Item id already exists' });
    if (err?.code === 'P2003') return res.status(404).json({ error: 'Callsheet not found' });
    return next(err);
  }
});

// Update an item
productionCallsheetsRouter.put('/callsheet-items/:itemId', async (req, res, next) => {
  try {
    const itemId = String(req.params.itemId);
    if (!itemId) return res.status(400).json({ error: 'Invalid item id' });

    const data: any = {};
    if (req.body?.productionSegmentId != null) data.productionSegmentId = Number(req.body.productionSegmentId);
    if (req.body?.cue != null) data.cue = String(req.body.cue).trim();
    if (req.body?.title != null) data.title = String(req.body.title).trim();
    if (req.body?.note != null) data.note = String(req.body.note);
    if (req.body?.color != null) data.color = String(req.body.color);
    if (req.body?.timeStart != null) data.timeStart = req.body.timeStart ? new Date(req.body.timeStart) : null;
    if (req.body?.timeEnd != null) data.timeEnd = req.body.timeEnd ? new Date(req.body.timeEnd) : null;
    if (req.body?.durationSec != null) data.durationSec = Number(req.body.durationSec);
    if (req.body?.orderIndex != null) data.orderIndex = Number(req.body.orderIndex);

    const positionIds: number[] | undefined = Array.isArray(req.body?.positionIds)
      ? req.body.positionIds.map((x: any) => Number(x)).filter((x: number) => Number.isInteger(x) && x > 0)
      : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      const it = await tx.callSheetItem.update({ where: { id: itemId }, data });
      if (positionIds) {
        await tx.callSheetItemPosition.deleteMany({ where: { callSheetItemId: itemId } });
        if (positionIds.length > 0) {
          await tx.callSheetItemPosition.createMany({ data: positionIds.map((pid) => ({ callSheetItemId: itemId, positionId: pid })) });
        }
      }
      return it;
    });

    return res.json(updated);
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    return next(err);
  }
});

// Delete an item
productionCallsheetsRouter.delete('/callsheet-items/:itemId', async (req, res, next) => {
  try {
    const itemId = String(req.params.itemId);
    if (!itemId) return res.status(400).json({ error: 'Invalid item id' });
    await prisma.$transaction(async (tx) => {
      await tx.callSheetItemPosition.deleteMany({ where: { callSheetItemId: itemId } });
      await tx.callSheetItem.delete({ where: { id: itemId } });
    });
    return res.status(204).send();
  } catch (err: any) {
    if (err?.code === 'P2025') return res.status(404).json({ error: 'Not found' });
    return next(err);
  }
});

// Import a callsheet from an Excel template
// POST /api/production/:id/callsheets/import-excel
// Accepts multipart/form-data with field name "file" containing an .xlsx file.
// If no file uploaded, attempts to read a default template.xlsx from the API app root.
productionCallsheetsRouter.post('/:id/callsheets/import-excel', uploadMem.single('file'), async (req, res, next) => {
  try {
    const productionId = Number(req.params.id);
    if (!Number.isInteger(productionId) || productionId <= 0) return res.status(400).json({ error: 'Invalid id' });

    const prod = await prisma.production.findUnique({ where: { id: productionId } });
    if (!prod) return res.status(404).json({ error: 'Production not found' });

    let buffer: Buffer | null = null;
    if (req.file?.buffer) {
      buffer = req.file.buffer;
    } else {
      const fallbackPath = path.join(process.cwd(), 'apps', 'korfbal-stream-api', 'template.xlsx');
      if (fs.existsSync(fallbackPath)) buffer = fs.readFileSync(fallbackPath);
    }
    if (!buffer) return res.status(400).json({ error: 'No file provided and default template.xlsx not found' });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const ws = workbook.worksheets[0];
    if (!ws) return res.status(400).json({ error: 'Workbook has no sheets' });

    // Convert sheet to JSON-like array of objects
    const rows: any[] = [];
    let headers: string[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        // Header row
        headers = (row.values as any[]).slice(1).map(v => String(v));
      } else {
        const rowData: any = {};
        // exceljs values array is 1-based, but slice(1) makes it 0-based relative to headers
        // However, row.values might be sparse.
        headers.forEach((header, index) => {
          // values[index + 1] because values[0] is undefined in exceljs
          const cellValue = row.getCell(index + 1).value;
          // Handle rich text or other complex cell types if necessary, but usually .value is enough
          // For hyperlinks, .value might be an object { text, hyperlink }
          if (cellValue && typeof cellValue === 'object' && 'text' in cellValue) {
             rowData[header] = (cellValue as any).text;
          } else {
             rowData[header] = cellValue;
          }
        });
        rows.push(rowData);
      }
    });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No data rows found in sheet' });
    }

    // Fetch segments and positions upfront for fast lookup
    const [segments, allPositions] = await Promise.all([
      prisma.productionSegment.findMany({ where: { productionId }, orderBy: { volgorde: 'asc' } }),
      prisma.position.findMany({}),
    ]);
    const segByName = new Map<string, { id: number; naam: string; volgorde: number }>();
    for (const s of segments as any[]) segByName.set((s.naam || '').toString().trim().toLowerCase(), s);
    const posByName = new Map<string, { id: number; name: string }>();
    for (const p of allPositions as any[]) posByName.set((p.name || '').toString().trim().toLowerCase(), p);

    const normKey = (k: string) => k.toString().trim().toLowerCase().replace(/\s+|[_-]+/g, '');

    type Parsed = {
      productionSegmentId: number;
      id: string;
      cue: string;
      title: string;
      note?: string | null;
      color?: string | null;
      timeStart?: Date | null;
      timeEnd?: Date | null;
      durationSec: number;
      orderIndex: number;
      positionNames: string[];
    };

    const problems: string[] = [];
    const parsed: Parsed[] = [];

    const parseDuration = (v: any): number | null => {
      if (v == null) return null;
      if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
      const s = String(v).trim();
      if (!s) return null;
      // Allow mm:ss
      const m = s.match(/^(\d+):(\d{1,2})$/);
      if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
      const n = Number(s.replace(/[,]/g, '.'));
      if (Number.isFinite(n)) return Math.round(n);
      return null;
    };

    const toDateMaybe = (v: any): Date | null => {
      if (v == null || v === '') return null;
      if (v instanceof Date) return v;
      const s = String(v);
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    };

    const genId = () => Math.random().toString(16).slice(2, 10);

    rows.forEach((row, idx) => {
      const rowHeaders = Object.keys(row);
      const map: Record<string, any> = {};
      for (const hk of rowHeaders) map[normKey(hk)] = row[hk];

      const segName = (map[normKey('segment')] ?? map[normKey('segmentnaam')] ?? map[normKey('segmentname')] ?? '').toString().trim();
      const cue = (map[normKey('cue')] ?? '').toString().trim();
      const title = (map[normKey('title')] ?? map[normKey('titel')] ?? '').toString().trim();
      const note = map[normKey('note')] ?? map[normKey('opmerking')] ?? '';
      const color = map[normKey('color')] ?? map[normKey('kleur')] ?? '';
      const timeStart = toDateMaybe(map[normKey('timestart')] ?? map[normKey('start')] ?? map[normKey('starttijd')]);
      const timeEnd = toDateMaybe(map[normKey('timeend')] ?? map[normKey('end')] ?? map[normKey('eindtijd')]);
      const durationSec = parseDuration(map[normKey('duration')] ?? map[normKey('duur')] ?? map[normKey('durationsec')] ?? map[normKey('duursec')]);
      const orderIndex = Number(map[normKey('order')] ?? map[normKey('volgorde')] ?? map[normKey('index')] ?? 0) || 0;
      const idCell = (map[normKey('id')] ?? '').toString().trim();
      const positionsRaw = (map[normKey('positions')] ?? map[normKey('posities')] ?? map[normKey('position')] ?? map[normKey('positie')] ?? '').toString();
      const positionNames = positionsRaw
        .split(/[,;]+/)
        .map((s: string) => s.trim())
        .filter((s: string) => !!s);

      const rowNo = idx + 2; // +2 for header baseline in Excel
      if (!segName || !cue || !title || durationSec == null) {
        problems.push(`Row ${rowNo}: missing required fields (segment/cue/title/duration)`);
        return;
      }

      const seg = segByName.get(segName.toLowerCase());
      if (!seg) {
        problems.push(`Row ${rowNo}: unknown segment '${segName}'`);
        return;
      }

      parsed.push({
        productionSegmentId: (seg as any).id,
        id: idCell || genId(),
        cue,
        title,
        note: note ? String(note) : null,
        color: color ? String(color) : null,
        timeStart,
        timeEnd,
        durationSec: durationSec!,
        orderIndex,
        positionNames,
      });
    });

    if (parsed.length === 0) {
      return res.status(400).json({ error: 'No valid rows to import', problems });
    }

    const callSheetName = (req.body?.name ? String(req.body.name) : 'Callsheet import').trim() || 'Callsheet import';
    const callSheetColor = req.body?.color != null ? String(req.body.color) : undefined;

    const result = await prisma.$transaction(async (tx) => {
      const cs = await tx.callSheet.create({ data: { productionId, name: callSheetName, color: callSheetColor } });

      for (const it of parsed) {
        const created = await tx.callSheetItem.create({
          data: {
            id: it.id,
            callSheetId: cs.id,
            productionSegmentId: it.productionSegmentId,
            cue: it.cue,
            title: it.title,
            note: it.note || undefined,
            color: it.color || undefined,
            timeStart: it.timeStart || undefined,
            timeEnd: it.timeEnd || undefined,
            durationSec: it.durationSec,
            orderIndex: it.orderIndex,
          },
        });

        if (it.positionNames.length > 0) {
          // Ensure positions exist
          const ids: number[] = [];
          for (const name of it.positionNames) {
            const key = name.trim().toLowerCase();
            let p = posByName.get(key);
            if (!p) {
              p = await tx.position.create({ data: { name } });
              posByName.set(key, p as any);
            }
            ids.push((p as any).id);
          }
          if (ids.length > 0) {
            await tx.callSheetItemPosition.createMany({
              data: ids.map((pid) => ({ callSheetItemId: created.id, positionId: pid })),
              skipDuplicates: true,
            });
          }
        }
      }

      return cs;
    });

    return res.status(201).json({ ok: true, callSheet: result, items: parsed.length, problems });
  } catch (err) {
    return next(err);
  }
});
