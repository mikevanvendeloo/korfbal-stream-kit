import {Router} from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import {prisma} from '../../services/prisma';

export const callSheetTemplateRouter: Router = Router();
const uploadMem = multer({ storage: multer.memoryStorage() });

interface TemplateItemData {
  templateId: number;
  title: string;
  note?: string;
  durationSec: number;
  orderIndex: number;
  isInVenue: boolean;
  isInLivestream: boolean;
  isTimeAnchor: boolean;
  anchorType?: string;
  autoAdvance: boolean;
  positionIds: number[];
}

// --- Templates ---

// List all templates
callSheetTemplateRouter.get('/', async (req, res, next) => {
  try {
    const templates = await prisma.callSheetTemplate.findMany({
      include: {
        _count: {
          select: { items: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    return res.json(templates);
  } catch (err) {
    return next(err);
  }
});

// Create template
callSheetTemplateRouter.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const created = await prisma.callSheetTemplate.create({
      data: { name }
    });
    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Name must be unique' });
    return next(err);
  }
});

// Get template details
callSheetTemplateRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const template = await prisma.callSheetTemplate.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            positions: { include: { position: true } }
          },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    return res.json(template);
  } catch (err) {
    return next(err);
  }
});

// Update template
callSheetTemplateRouter.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name } = req.body;
    const updated = await prisma.callSheetTemplate.update({
      where: { id },
      data: { name }
    });
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

// Delete template
callSheetTemplateRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.callSheetTemplate.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// --- Template Items ---

// Add item to template
callSheetTemplateRouter.post('/:id/items', async (req, res, next) => {
  try {
    const templateId = Number(req.params.id);
    const {
      title, note, durationSec, orderIndex,
      isInVenue, isInLivestream, isTimeAnchor, anchorType,
      autoAdvance, positionIds
    } = req.body;

    console.log(`[CallSheetTemplates] Adding item to template ${templateId}`, { title, orderIndex });

    // Check if template exists
    const template = await prisma.callSheetTemplate.findUnique({ where: { id: templateId } });
    if (!template) {
      console.error(`[CallSheetTemplates] Template ${templateId} not found`);
      return res.status(404).json({ error: 'Template not found' });
    }

    const item = await prisma.callSheetTemplateItem.create({
      data: {
        template: { connect: { id: templateId } },
        title,
        note,
        durationSec: Number(durationSec) || 0,
        orderIndex: Number(orderIndex) || 0,
        isInVenue: !!isInVenue,
        isInLivestream: isInLivestream !== false,
        isTimeAnchor: !!isTimeAnchor,
        anchorType,
        autoAdvance: !!autoAdvance,
        positions: {
          create: (positionIds || []).map((pid: number) => ({
            position: { connect: { id: pid } }
          }))
        }
      }
    });
    return res.status(201).json(item);
  } catch (err) {
    return next(err);
  }
});

// Update template item
callSheetTemplateRouter.put('/items/:itemId', async (req, res, next) => {
  try {
    const itemId = req.params.itemId;

    const {
      title, note, durationSec, orderIndex,
      isInVenue, isInLivestream, isTimeAnchor, anchorType,
      autoAdvance, positionIds
    } = req.body;

    // Delete old positions and create new ones
    await prisma.callSheetTemplatePosition.deleteMany({
      where: { templateItemId: itemId }
    });

    const updated = await prisma.callSheetTemplateItem.update({
      where: { id: itemId },
      data: {
        title,
        note,
        durationSec: durationSec !== undefined ? Number(durationSec) : undefined,
        orderIndex: orderIndex !== undefined ? Number(orderIndex) : undefined,
        isInVenue: isInVenue !== undefined ? !!isInVenue : undefined,
        isInLivestream: isInLivestream !== undefined ? !!isInLivestream : undefined,
        isTimeAnchor: isTimeAnchor !== undefined ? !!isTimeAnchor : undefined,
        anchorType,
        autoAdvance: autoAdvance !== undefined ? !!autoAdvance : undefined,
        positions: {
          create: (positionIds || []).map((pid: number) => ({
            position: { connect: { id: pid } }
          }))
        }
      }
    });
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

// Delete template item
callSheetTemplateRouter.delete('/items/:itemId', async (req, res, next) => {
  try {
    const itemId = req.params.itemId;

    await prisma.callSheetTemplateItem.delete({
      where: { id: itemId }
    });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// --- Actions ---

// Apply template to production
callSheetTemplateRouter.post('/:id/apply/:productionId', async (req, res, next) => {
  try {
    const templateId = Number(req.params.id);
    const productionId = Number(req.params.productionId);
    const { segmentId: requestedSegmentId, replace = true } = req.body || {};

    const template = await prisma.callSheetTemplate.findUnique({
      where: { id: templateId },
      include: { items: { include: { positions: true } } }
    });

    if (!template) return res.status(404).json({ error: 'Template not found' });

    const production = await prisma.production.findUnique({
      where: { id: productionId },
      include: { segments: { orderBy: { volgorde: 'asc' } } }
    });

    if (!production) return res.status(404).json({ error: 'Production not found' });

    let segmentId: number;

    if (replace) {
      // Clean up old CallSheets, Items, ProductionEvents and Segments for this production
      // Find all items in existing callsheets to delete their positions first (Prisma doesn't cascade all relations automatically sometimes depending on schema)
      const oldCallSheets = await prisma.callSheet.findMany({
        where: { productionId }
      });

      for (const cs of oldCallSheets) {
         const items = await prisma.callSheetItem.findMany({ where: { callSheetId: cs.id }, select: { id: true } });
         const itemIds = items.map(i => i.id);
         if (itemIds.length > 0) {
             await prisma.callSheetItemPosition.deleteMany({ where: { callSheetItemId: { in: itemIds } } });
         }
      }

      // Delete ALL events for this production (even those not linked to a callsheet item)
      // First delete their positions
      await prisma.productionEventPosition.deleteMany({
        where: { event: { productionId } }
      });
      await prisma.productionEvent.deleteMany({
        where: { productionId }
      });

      for (const cs of oldCallSheets) {
        // Delete the items
        await prisma.callSheetItem.deleteMany({
          where: { callSheetId: cs.id }
        });

        // Delete the callsheet itself
        await prisma.callSheet.delete({
          where: { id: cs.id }
        });
      }

      // Delete all segments for this production
      await prisma.productionSegment.deleteMany({
        where: { productionId }
      });

      // Ensure at least one segment exists (create a fresh one after cleanup)
      const newSegment = await prisma.productionSegment.create({
        data: {
          productionId,
          naam: 'Algemeen',
          volgorde: 1,
          duurInMinuten: 60,
          isTimeAnchor: true
        }
      });
      segmentId = newSegment.id;
    } else {
      // Append mode
      if (requestedSegmentId) {
        segmentId = Number(requestedSegmentId);
        // Verify segment exists and belongs to this production
        const seg = await prisma.productionSegment.findFirst({
          where: { id: segmentId, productionId }
        });
        if (!seg) return res.status(400).json({ error: 'Invalid segment for this production' });
      } else {
        // Use first segment or create one if none exists
        if (production.segments.length > 0) {
          segmentId = production.segments[0].id;
        } else {
          const newSegment = await prisma.productionSegment.create({
            data: {
              productionId,
              naam: 'Algemeen',
              volgorde: 1,
              duurInMinuten: 60,
              isTimeAnchor: true
            }
          });
          segmentId = newSegment.id;
        }
      }
    }

    // Create a new CallSheet for this production
    const callSheet = await prisma.callSheet.create({
      data: { productionId, name: template.name }
    });

    const itemsToCreate = [];
    const eventsToCreate = [];

    const idMapping: Record<string, string> = {};
    const eventMapping: Record<string, string> = {};

    // Copieer items
    for (const tItem of template.items) {
      const itemId = `t-${tItem.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      idMapping[tItem.id] = itemId;
      eventMapping[tItem.id] = `ev-${itemId}`;

      itemsToCreate.push({
        id: itemId,
        callSheetId: callSheet.id,
        productionSegmentId: segmentId,
        cue: '',
        title: tItem.title,
        note: tItem.note,
        durationSec: tItem.durationSec,
        orderIndex: tItem.orderIndex,
        isInVenue: tItem.isInVenue,
        isInLivestream: tItem.isInLivestream,
        isTimeAnchor: tItem.isTimeAnchor,
        anchorType: tItem.anchorType,
        autoAdvance: tItem.autoAdvance,
        parentId: null as any, // Placeholder
      });

      eventsToCreate.push({
        id: `ev-${itemId}`,
        productionId: productionId,
        callSheetItemId: itemId,
        title: tItem.title,
        order: tItem.orderIndex,
        status: 'WAITING' as const,
        durationSec: tItem.durationSec,
        autoAdvance: tItem.autoAdvance,
        isTimeAnchor: tItem.isTimeAnchor,
        anchorType: tItem.anchorType,
        isInVenue: tItem.isInVenue,
        isInLivestream: tItem.isInLivestream,
        parentId: null as any, // Placeholder
      });
    }

    // Pass parentIds
    for (let i = 0; i < template.items.length; i++) {
        const tItem = template.items[i];
        if (tItem.parentId && idMapping[tItem.parentId]) {
            itemsToCreate[i].parentId = idMapping[tItem.parentId];
            eventsToCreate[i].parentId = eventMapping[tItem.parentId];
        }
    }

    // Bulk create items and events
    await prisma.callSheetItem.createMany({ data: itemsToCreate });
    await prisma.productionEvent.createMany({ data: eventsToCreate });

    // Handle positions (Prisma createMany doesn't support nested writes, so we do this in a loop or another createMany)
    const itemPositions = [];
    const eventPositions = [];

    for (let i = 0; i < template.items.length; i++) {
        const tItem = template.items[i];
        const itemId = itemsToCreate[i].id;
        const eventId = eventsToCreate[i].id;

        for (const p of tItem.positions) {
            itemPositions.push({
                callSheetItemId: itemId,
                positionId: p.positionId
            });
            eventPositions.push({
                eventId: eventId,
                positionId: p.positionId
            });
        }
    }

    if (itemPositions.length > 0) {
        await prisma.callSheetItemPosition.createMany({ data: itemPositions });
    }
    if (eventPositions.length > 0) {
        await prisma.productionEventPosition.createMany({ data: eventPositions });
    }

    // Update production with template link
    await prisma.production.update({
      where: { id: productionId },
      data: { callSheetTemplateId: templateId }
    });

    return res.json({
      message: `Template applied. Created ${itemsToCreate.length} items.`,
      callSheetId: callSheet.id
    });
  } catch (err) {
    return next(err);
  }
});

// --- Excel Export / Import ---

// Export template to Excel
callSheetTemplateRouter.get('/:id/export', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const template = await prisma.callSheetTemplate.findUnique({
      where: { id },
      include: {
        items: {
          include: { positions: { include: { position: true } } },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    if (!template) return res.status(404).json({ error: 'Template not found' });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Draaiboek');

    const positions = await prisma.position.findMany({ orderBy: { name: 'asc' } });

    // Header row
    const headers = ['Volgorde', 'Titel', 'Notitie', 'Duur (sec)', 'Tijd Anchor', 'Anchor Type', 'Auto Advance', 'Zaal (inVenue)', 'Stream (inStream)'];
    positions.forEach(p => headers.push(p.name));

    worksheet.addRow(headers);

    // Data rows
    template.items.forEach(item => {
      const rowData = [
        item.orderIndex,
        item.title,
        item.note || '',
        item.durationSec,
        item.isTimeAnchor ? 'JA' : 'NEE',
        item.anchorType || '',
        item.autoAdvance ? 'JA' : 'NEE',
        item.isInVenue ? 'JA' : 'NEE',
        item.isInLivestream ? 'JA' : 'NEE'
      ];

      const itemPosIds = new Set(item.positions.map(p => p.positionId));
      positions.forEach(p => {
        rowData.push(itemPosIds.has(p.id) ? 'X' : '');
      });

      worksheet.addRow(rowData);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="draaiboek-${template.name}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return next(err);
  }
});

// Import template from Excel
callSheetTemplateRouter.post('/import', uploadMem.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Template name is required' });

    const workbook = new ExcelJS.Workbook();
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    await workbook.xlsx.load(req.file.buffer as any);
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) return res.status(400).json({ error: 'No worksheet found in Excel' });

    const template = await prisma.callSheetTemplate.create({
      data: { name }
    });

    const positions = await prisma.position.findMany();
    const posMap = new Map<string, number>(positions.map(p => [p.name.toLowerCase(), p.id]));

    const itemsToCreate: TemplateItemData[] = [];
    const positionColumns: { col: number, id: number }[] = [];

    // Skip header row
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        // Find position columns
        row.eachCell((cell, colNumber) => {
          const header = cell.text.toLowerCase();
          const posId = posMap.get(header);
          if (posId !== undefined) {
            positionColumns.push({ col: colNumber, id: posId });
          }
        });
        return;
      }

      const orderIndex = Number(row.getCell(1).value) || rowNumber - 1;
      const title = row.getCell(2).text;
      if (!title) return;

      const note = row.getCell(3).text;
      const durationSec = Number(row.getCell(4).value) || 0;
      const isTimeAnchor = row.getCell(5).text.toUpperCase() === 'JA';
      const anchorType = row.getCell(6).text;
      const autoAdvance = row.getCell(7).text.toUpperCase() === 'JA';
      const isInVenue = row.getCell(8).text.toUpperCase() === 'JA';
      const isInLivestream = row.getCell(9).text.toUpperCase() !== 'NEE'; // Default true

      // Collect positions from columns
      const positionIds: number[] = [];
      positionColumns.forEach(pc => {
        const val = row.getCell(pc.col).text.toUpperCase();
        if (val === 'X' || val === 'JA' || val === 'TRUE' || val === '1') {
          positionIds.push(pc.id);
        }
      });

      itemsToCreate.push({
        templateId: template.id,
        title,
        note,
        durationSec,
        orderIndex,
        isInVenue,
        isInLivestream,
        isTimeAnchor,
        anchorType: anchorType || undefined,
        autoAdvance,
        positionIds
      });
    });

    // Create items in sequence
    for (const itemData of itemsToCreate) {
      const { positionIds, templateId: _, ...data } = itemData;
      await prisma.callSheetTemplateItem.create({
        data: {
          ...data,
          template: { connect: { id: template.id } },
          positions: {
            create: (positionIds || []).map((pid: number) => ({ positionId: pid }))
          }
        }
      });
    }

    return res.status(201).json(template);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Template name already exists' });
    return next(err);
  }
});

// JSON Export / Import

// Export template to JSON
callSheetTemplateRouter.get('/:id/export-json', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const template = await prisma.callSheetTemplate.findUnique({
      where: { id },
      include: {
        items: {
          include: { positions: { include: { position: true } } },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    if (!template) return res.status(404).json({ error: 'Template not found' });

    const exportData = {
      version: 1,
      name: template.name,
      items: template.items.map(item => ({
        id: item.id,
        title: item.title,
        note: item.note,
        durationSec: item.durationSec,
        orderIndex: item.orderIndex,
        isInVenue: item.isInVenue,
        isInLivestream: item.isInLivestream,
        isTimeAnchor: item.isTimeAnchor,
        anchorType: item.anchorType,
        autoAdvance: item.autoAdvance,
        parentId: item.parentId,
        positions: item.positions.map(p => p.position.name)
      }))
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="template-${template.name.replace(/\s+/g, '-')}.json"`);
    return res.json(exportData);
  } catch (err) {
    return next(err);
  }
});

// Import template from JSON
callSheetTemplateRouter.post('/import-json', uploadMem.single('file'), async (req, res, next) => {
  try {
    let data: any;

    if (req.file) {
      const content = req.file.buffer.toString('utf-8');
      data = JSON.parse(content);
    } else if (req.body && req.body.items) {
      data = req.body;
    } else {
      return res.status(400).json({ error: 'No JSON file or data provided' });
    }

    const { name, items, version } = data;
    const finalName = req.body.name || name;

    if (version && version > 1) {
      return res.status(400).json({ error: `Unsupported template version: ${version}. Only version 1 is supported.` });
    }

    if (!finalName) return res.status(400).json({ error: 'Template name is required' });
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Invalid items format' });

    const template = await prisma.callSheetTemplate.create({
      data: { name: finalName }
    });

    const positions = await prisma.position.findMany();
    const positionsByName = Object.fromEntries(positions.map(p => [p.name.toLowerCase(), p.id] as const));

    const idMapping: Record<string, string> = {};

    for (const item of items) {
      const createdItem = await prisma.callSheetTemplateItem.create({
        data: {
          templateId: template.id,
          title: item.title,
          note: item.note ?? null,
          durationSec: Number(item.durationSec) || 0,
          orderIndex: Number(item.orderIndex) || 0,
          isInVenue: !!item.isInVenue,
          isInLivestream: item.isInLivestream !== false,
          isTimeAnchor: !!item.isTimeAnchor,
          anchorType: item.anchorType ?? null,
          autoAdvance: !!item.autoAdvance,
        }
      });

      if (item.id) {
        idMapping[item.id] = createdItem.id;
      }

      if (item.positions && Array.isArray(item.positions)) {
        for (const posName of item.positions) {
          const positionId = positionsByName[posName.toLowerCase()];
          if (positionId) {
            await prisma.callSheetTemplatePosition.create({
              data: {
                templateItemId: createdItem.id,
                positionId: positionId
              }
            });
          }
        }
      }
    }

    // Second pass to link parents
    for (const item of items) {
      if (item.parentId && idMapping[item.parentId]) {
        const currentItemId = idMapping[item.id];
        if (currentItemId) {
          await prisma.callSheetTemplateItem.update({
            where: { id: currentItemId },
            data: { parentId: idMapping[item.parentId] }
          });
        }
      }
    }

    return res.status(201).json(template);
  } catch (err: any) {
    if (err?.code === 'P2002') return res.status(409).json({ error: 'Template name already exists' });
    return next(err);
  }
});
