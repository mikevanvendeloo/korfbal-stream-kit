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
      autoAdvance, positionIds, parentId
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
        parentId: parentId || undefined,
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
      autoAdvance, positionIds, parentId
    } = req.body;

    // Update positions and fields
    const updated = await prisma.$transaction(async (tx) => {
      // If orderIndex changed, we might want to shift others,
      // but the simplest is to just update this one and let the user reorder.
      // However, the request specifically asked: "waarna alles vanaf dat nummer eentje wordt opgeschoven"
      const currentItem = await tx.callSheetTemplateItem.findUnique({ where: { id: itemId } });
      if (currentItem && orderIndex !== undefined && Number(orderIndex) !== currentItem.orderIndex) {
        const newIdx = Number(orderIndex);
        // Shift items that are at or after the new index
        await tx.callSheetTemplateItem.updateMany({
          where: {
            templateId: currentItem.templateId,
            orderIndex: { gte: newIdx },
            id: { not: itemId }
          },
          data: { orderIndex: { increment: 1 } }
        });
      }

      await tx.callSheetTemplatePosition.deleteMany({
        where: { templateItemId: itemId }
      });

      return tx.callSheetTemplateItem.update({
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
          parentId: parentId !== undefined ? (parentId || null) : undefined,
          positions: {
            create: (positionIds || []).map((pid: number) => ({
              position: { connect: { id: pid } }
            }))
          }
        }
      });
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

// Reorder template items
callSheetTemplateRouter.put('/:id/reorder', async (req, res, next) => {
  try {
    const templateId = Number(req.params.id);
    const { itemIds } = req.body;

    if (!Array.isArray(itemIds)) {
      return res.status(400).json({ error: 'itemIds must be an array' });
    }

    await prisma.$transaction(
      itemIds.map((id, index) =>
        prisma.callSheetTemplateItem.update({
          where: { id: String(id), templateId },
          data: { orderIndex: index + 1 }
        })
      )
    );

    return res.status(200).json({ success: true });
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
    // Forceer replace = true volgens issue description
    const replace = true;

    const result = await prisma.$transaction(async (tx) => {
      const template = await tx.callSheetTemplate.findUnique({
        where: { id: templateId },
        include: { items: { include: { positions: true }, orderBy: { orderIndex: 'asc' } } }
      });

      if (!template) throw new Error('Template not found');

      const production = await tx.production.findUnique({
        where: { id: productionId },
        include: {
          segments: { orderBy: { volgorde: 'asc' } },
          matchSchedule: true
        }
      });

      if (!production) throw new Error('Production not found');

      if (replace) {
        // Clean up old CallSheets, Items, ProductionEvents for this production
        const oldCallSheets = await tx.callSheet.findMany({
          where: { productionId }
        });

        for (const cs of oldCallSheets) {
           const items = await tx.callSheetItem.findMany({ where: { callSheetId: cs.id }, select: { id: true } });
           const itemIds = items.map(i => i.id);
           if (itemIds.length > 0) {
               await tx.callSheetItemPosition.deleteMany({ where: { callSheetItemId: { in: itemIds } } });
           }
        }

        // Delete ALL events for this production
        await tx.productionEventPosition.deleteMany({
          where: { event: { productionId } }
        });
        await tx.productionEvent.deleteMany({
          where: { productionId }
        });

        for (const cs of oldCallSheets) {
          // Delete the items
          await tx.callSheetItem.deleteMany({
            where: { callSheetId: cs.id }
          });

          // Delete the callsheet itself
          await tx.callSheet.delete({
            where: { id: cs.id }
          });
        }

        // Ook eventuele andere callsheets met dezelfde naam verwijderen (veiligheidshalve, mocht de constraint anders geraakt worden)
        await tx.callSheet.deleteMany({
          where: { productionId, name: template.name }
        });
      }

      // Create a new CallSheet for this production
      const callSheet = await tx.callSheet.create({
        data: { productionId, name: template.name }
      });

      const positions = await tx.position.findMany();
      const showcallerId = positions.find(p => p.name.toLowerCase() === 'showcaller')?.id;

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
          productionSegmentId: null,
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
          parentId: null as string | null,
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
          parentId: null as string | null,
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
      await tx.callSheetItem.createMany({ data: itemsToCreate });
      await tx.productionEvent.createMany({ data: eventsToCreate });

      const itemPositions = [];
      const eventPositions = [];

      for (let i = 0; i < template.items.length; i++) {
          const tItem = template.items[i];
          const itemId = itemsToCreate[i].id;
          const eventId = eventsToCreate[i].id;

          if (tItem.positions) {
            const positionIdsToCreate = new Set<number>();
            if (showcallerId) positionIdsToCreate.add(showcallerId);

            for (const p of tItem.positions) {
                positionIdsToCreate.add(p.positionId);
            }

            for (const posId of positionIdsToCreate) {
                itemPositions.push({
                    callSheetItemId: itemId,
                    positionId: posId
                });
                eventPositions.push({
                    eventId: eventId,
                    positionId: posId
                });
            }
          } else if (showcallerId) {
            // Zelfs als er geen posities zijn, Showcaller toevoegen
            itemPositions.push({
                callSheetItemId: itemId,
                positionId: showcallerId
            });
            eventPositions.push({
                eventId: eventId,
                positionId: showcallerId
            });
          }
      }

      if (itemPositions.length > 0) {
          await tx.callSheetItemPosition.createMany({ data: itemPositions });
      }
      if (eventPositions.length > 0) {
          await tx.productionEventPosition.createMany({ data: eventPositions });
      }

      // Update production with template link
      await tx.production.update({
        where: { id: productionId },
        data: { callSheetTemplateId: templateId }
      });

      return { success: true, message: 'Draaiboek succesvol toegepast!', production };
    });

    // Herbereken tijden
    // We moeten eerst relatieve tijden berekenen voor alle items
    // Voordat we recalculate aanroepen, moeten we de anchorEvent een starttijd geven.
    const allEvents = await prisma.productionEvent.findMany({
      where: { productionId },
      orderBy: { order: 'asc' }
    });

    const anchorEvent = allEvents.find(e => e.isTimeAnchor);

    if (anchorEvent && result.production.matchSchedule) {
      const anchorTime = new Date(result.production.matchSchedule.date);

      // Eerst relatieve tijden zetten voor alle events in de juiste volgorde

      // Events VOOR het anker (teruguit rekenen)
      const beforeAnchor = allEvents.filter(e => e.order < anchorEvent.order).reverse();
      let prevStart = new Date(anchorTime);
      for (const ev of beforeAnchor) {
          const start = new Date(prevStart.getTime() - ((ev.durationSec || 0) * 1000));
          await prisma.productionEvent.update({
              where: { id: ev.id },
              data: { plannedStartTime: start, plannedEndTime: prevStart }
          });
          prevStart = start;
      }

      // Anker zelf
      const anchorEnd = new Date(anchorTime.getTime() + ((anchorEvent.durationSec || 0) * 1000));
      await prisma.productionEvent.update({
          where: { id: anchorEvent.id },
          data: { plannedStartTime: anchorTime, plannedEndTime: anchorEnd }
      });

      // Events NA het anker
      const afterAnchor = allEvents.filter(e => e.order > anchorEvent.order);
      let nextStart = anchorEnd;
      for (const ev of afterAnchor) {
          const end = new Date(nextStart.getTime() + ((ev.durationSec || 0) * 1000));
          await prisma.productionEvent.update({
              where: { id: ev.id },
              data: { plannedStartTime: nextStart, plannedEndTime: end }
          });
          nextStart = end;
      }

      // Nu ook de callsheet items bijwerken (gemakshalve even herhalen of syncen)
      const items = await prisma.callSheetItem.findMany({
          where: { callSheetId: (await prisma.callSheet.findFirst({ where: { productionId }}))?.id }
      });

      for (const item of items) {
          const ev = await prisma.productionEvent.findFirst({ where: { callSheetItemId: item.id }});
          if (ev) {
              await prisma.callSheetItem.update({
                  where: { id: item.id },
                  data: { timeStart: ev.plannedStartTime, timeEnd: ev.plannedEndTime }
              });
          }
      }
    }

    return res.json({ success: true, message: result.message });
  } catch (err: any) {
    console.error('Error applying template:', err);
    return res.status(500).json({ error: err.message || 'Fout bij toepassen template' });
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
    const showcallerId = positionsByName['showcaller'];

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

      const itemPositionNames = (item.positions && Array.isArray(item.positions)) ? item.positions : [];
      const positionIdsToCreate = new Set<number>();

      // Altijd Showcaller toevoegen voor elk item
      if (showcallerId) {
        positionIdsToCreate.add(showcallerId);
      }

      for (const posName of itemPositionNames) {
        const positionId = positionsByName[posName.toLowerCase()];
        if (positionId) {
          positionIdsToCreate.add(positionId);
        }
      }

      for (const positionId of positionIdsToCreate) {
        await prisma.callSheetTemplatePosition.create({
          data: {
            templateItemId: createdItem.id,
            positionId: positionId
          }
        });
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
