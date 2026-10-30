import {randomUUID} from 'node:crypto';
import {Router, type NextFunction, type Request, type Response} from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import {keepOrganizationContext} from '../../middleware/organizationContext';
import {LONG_TRANSACTION, prisma} from '../../services/prisma';
import {positionResolver} from '../../services/positions';
import {broadcastState} from '../../services/productionState';
import {DraaiboekFileSchema} from '../../schemas/draaiboekFile';
import {chapterKey, chapterMinimums, layOutTimes, planDraaiboekImport} from '../../services/draaiboekFile';
import {contentDisposition} from '../../utils/attachment';
import {amsterdamDay, toAmsterdamInputValue} from '../../utils/time';

/**
 * A production's draaiboek (one callsheet) as a file, under /api/production: JSON in the format of the
 * draaiboek template export (version 2), so either can be imported as the other, and Excel in the
 * columns of POST /:id/callsheets/import-excel.
 */
export const productionCallsheetFilesRouter: Router = Router();

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const upload = keepOrganizationContext(multer({storage: multer.memoryStorage(), limits: {fileSize: MAX_FILE_BYTES, files: 1}}).single('file'));
/** The upload, with a too large file answered as 400 instead of an internal error */
function uploadDraaiboek(req: Request, res: Response, next: NextFunction) {
  upload(req, res, (err?: unknown) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({error: err.code === 'LIMIT_FILE_SIZE' ? 'Bestand is te groot (max. 2 MB)' : 'Ongeldige upload'});
    }
    return next(err);
  });
}

/** Without a livestream start: 30 minutes before the kickoff, as "Tijden berekenen" does */
const DEFAULT_LIVE_BEFORE_MATCH_MS = 30 * 60 * 1000;

const callSheetIdOf = (value: string) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

async function loadCallSheet(callSheetId: number) {
  return prisma.callSheet.findUnique({
    where: {id: callSheetId},
    include: {
      items: {orderBy: {orderIndex: 'asc'}, include: {positions: {include: {position: true}}}},
      production: {include: {matchSchedule: true, chapters: {orderBy: {orderIndex: 'asc'}}}},
    },
  });
}

const fileName = (callSheet: NonNullable<Awaited<ReturnType<typeof loadCallSheet>>>, extension: string) => {
  const match = callSheet.production.matchSchedule;
  return `draaiboek-${amsterdamDay(match.date)}-${match.homeTeamName}-${match.awayTeamName}.${extension}`;
};

// GET /api/production/callsheets/:callSheetId/export-json
productionCallsheetFilesRouter.get('/callsheets/:callSheetId/export-json', async (req, res, next) => {
  try {
    const callSheetId = callSheetIdOf(req.params.callSheetId);
    if (!callSheetId) return res.status(400).json({error: 'Ongeldig callsheet-id'});
    const callSheet = await loadCallSheet(callSheetId);
    if (!callSheet) return res.status(404).json({error: 'Draaiboek niet gevonden'});
    const {production} = callSheet;
    const kickoff = production.matchSchedule.date.getTime();
    // The standard positions come from the hoofdstuk with the same name in the production's template
    const templateChapters = production.callSheetTemplateId
      ? await prisma.callSheetTemplateChapter.findMany({
        where: {templateId: production.callSheetTemplateId},
        include: {positions: {orderBy: {orderIndex: 'asc'}, include: {position: true}}},
      })
      : [];
    const chapterName = new Map(production.chapters.map((c) => [c.id, c.name]));

    res.setHeader('Content-Disposition', contentDisposition(fileName(callSheet, 'json')));
    return res.json({
      version: 2,
      kind: 'productie-draaiboek',
      name: callSheet.name,
      match: {date: production.matchSchedule.date, homeTeam: production.matchSchedule.homeTeamName, awayTeam: production.matchSchedule.awayTeamName},
      chapters: production.chapters.map((c) => ({
        name: c.name,
        minDurationSec: c.minDurationSec,
        positions: templateChapters.find((t) => chapterKey(t.name) === chapterKey(c.name))?.positions.map((p) => p.position.name) ?? [],
      })),
      items: callSheet.items.map((item) => ({
        id: item.id,
        cue: item.cue,
        title: item.title,
        note: item.note,
        color: item.color,
        durationSec: item.durationSec,
        orderIndex: item.orderIndex,
        isInVenue: item.isInVenue,
        isInLivestream: item.isInLivestream,
        isTimeAnchor: item.isTimeAnchor,
        anchorType: item.anchorType,
        autoAdvance: item.autoAdvance,
        parentId: item.parentId,
        chapter: item.chapterId != null ? chapterName.get(item.chapterId) ?? null : null,
        positions: item.positions.map((p) => p.position.name),
        startOffsetSec: item.timeStart ? Math.round((item.timeStart.getTime() - kickoff) / 1000) : null,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/production/callsheets/:callSheetId/export-excel: the columns POST /:id/callsheets/import-excel reads
productionCallsheetFilesRouter.get('/callsheets/:callSheetId/export-excel', async (req, res, next) => {
  try {
    const callSheetId = callSheetIdOf(req.params.callSheetId);
    if (!callSheetId) return res.status(400).json({error: 'Ongeldig callsheet-id'});
    const callSheet = await loadCallSheet(callSheetId);
    if (!callSheet) return res.status(404).json({error: 'Draaiboek niet gevonden'});
    const chapterName = new Map(callSheet.production.chapters.map((c) => [c.id, c.name]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Draaiboek');
    sheet.columns = [
      {header: 'Hoofdstuk', key: 'chapter', width: 20},
      {header: 'Cue', key: 'cue', width: 10},
      {header: 'Titel', key: 'title', width: 40},
      {header: 'Opmerking', key: 'note', width: 40},
      {header: 'Kleur', key: 'color', width: 10},
      {header: 'Start', key: 'start', width: 18},
      {header: 'Einde', key: 'end', width: 18},
      {header: 'Duur', key: 'duration', width: 8},
      {header: 'Volgorde', key: 'order', width: 8},
      {header: 'Posities', key: 'positions', width: 40},
    ];
    for (const item of callSheet.items) {
      sheet.addRow({
        chapter: item.chapterId != null ? chapterName.get(item.chapterId) ?? '' : '',
        cue: item.cue,
        title: item.title,
        note: item.note ?? '',
        color: item.color ?? '',
        // Amsterdam time as text: the import reads a time without zone as Amsterdam time
        start: item.timeStart ? toAmsterdamInputValue(item.timeStart) : '',
        end: item.timeEnd ? toAmsterdamInputValue(item.timeEnd) : '',
        duration: item.durationSec,
        order: item.orderIndex,
        positions: item.positions.map((p) => p.position.name).join(', '),
      });
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', contentDisposition(fileName(callSheet, 'xlsx')));
    return res.send(Buffer.from(await workbook.xlsx.writeBuffer()));
  } catch (err) {
    return next(err);
  }
});

/** The uploaded JSON (field `file`), or a JSON body with `items`; null when it can't be read. */
function readFile(req: Request): unknown {
  if (req.file) {
    try {
      return JSON.parse(req.file.buffer.toString('utf-8'));
    } catch {
      return null;
    }
  }
  return req.body && Array.isArray(req.body.items) ? req.body : null;
}

// POST /api/production/callsheets/:callSheetId/import-json: replaces the draaiboek's items by those of
// the file (a production draaiboek export or a draaiboek template export, version 1 or 2)
productionCallsheetFilesRouter.post('/callsheets/:callSheetId/import-json', uploadDraaiboek, async (req, res, next) => {
  try {
    const callSheetId = callSheetIdOf(req.params.callSheetId);
    if (!callSheetId) return res.status(400).json({error: 'Ongeldig callsheet-id'});
    const callSheet = await loadCallSheet(callSheetId);
    if (!callSheet) return res.status(404).json({error: 'Draaiboek niet gevonden'});

    const raw = readFile(req);
    if (raw == null) return res.status(400).json({error: 'Geen geldig draaiboekbestand (JSON) ontvangen'});
    const parsed = DraaiboekFileSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return res.status(400).json({error: `Ongeldig draaiboekbestand: ${issue.message}${issue.path.length ? ` (${issue.path.join('.')})` : ''}`});
    }
    const file = parsed.data;
    const {production} = callSheet;
    const plan = planDraaiboekImport(file, production.chapters.map((c) => c.name));
    // One time anchor per kind (livestream start, match start): the first one the file flags
    const anchorIndexes = new Set<number>();
    const anchorKinds = new Set<string>();
    file.items.forEach((item, index) => {
      const kind = item.anchorType ?? 'MATCH_START';
      if (item.isTimeAnchor && !anchorKinds.has(kind)) { anchorKinds.add(kind); anchorIndexes.add(index); }
    });
    const isAnchor = (index: number) => anchorIndexes.has(index);
    const kickoff = production.matchSchedule.date;
    const liveStart = production.liveTime ?? new Date(kickoff.getTime() - DEFAULT_LIVE_BEFORE_MATCH_MS);
    // A hoofdstuk's minimum: the file's when it names one, else the production's own
    const fileMinimum = new Map((file.chapters ?? []).filter((c) => c.minDurationSec !== undefined).map((c) => [chapterKey(c.name), c.minDurationSec ?? null]));
    const minimumOf = (name: string) => (fileMinimum.has(chapterKey(name))
      ? fileMinimum.get(chapterKey(name)) ?? null
      : production.chapters.find((c) => chapterKey(c.name) === chapterKey(name))?.minDurationSec ?? null);
    const chapterNames = [...production.chapters.map((c) => c.name), ...plan.newChapters];
    const times = layOutTimes(plan.items.map(({index, chapterName}) => {
      const item = file.items[index];
      return {
        durationSec: item.durationSec, isTimeAnchor: isAnchor(index), anchorType: item.anchorType ?? null, startOffsetSec: item.startOffsetSec ?? null,
        isInVenue: !!item.isInVenue, isInLivestream: item.isInLivestream !== false, chapterId: chapterKey(chapterName),
      };
    }), {kickoff, liveStart, chapterMinimums: chapterMinimums(chapterNames.map((name) => ({id: chapterKey(name), minDurationSec: minimumOf(name)})))});

    await prisma.$transaction(async (tx) => {
      // Hoofdstukken: the production's own stay (also when they end up empty), missing ones are added
      const chapterIds = new Map(production.chapters.map((c) => [chapterKey(c.name), c.id]));
      for (const c of production.chapters) {
        if (fileMinimum.has(chapterKey(c.name)) && minimumOf(c.name) !== c.minDurationSec) {
          await tx.productionChapter.update({where: {id: c.id}, data: {minDurationSec: minimumOf(c.name)}});
        }
      }
      let orderIndex = Math.max(0, ...production.chapters.map((c) => c.orderIndex));
      for (const name of plan.newChapters) {
        const chapter = await tx.productionChapter.create({data: {productionId: production.id, name, orderIndex: ++orderIndex, minDurationSec: minimumOf(name)}});
        chapterIds.set(chapterKey(name), chapter.id);
      }

      await tx.callSheetItem.deleteMany({where: {callSheetId}});
      const positionOf = positionResolver(tx);
      const newIds = new Map<number, string>();
      for (const [i, planned] of plan.items.entries()) {
        const item = file.items[planned.index];
        const positionIds = new Set<number>();
        for (const name of item.positions ?? []) if (name.trim()) positionIds.add((await positionOf(name.trim())).id);
        const created = await tx.callSheetItem.create({
          data: {
            id: randomUUID(),
            callSheetId,
            chapterId: chapterIds.get(chapterKey(planned.chapterName)) as number,
            cue: item.cue,
            title: item.title,
            note: item.note ?? null,
            color: item.color ?? null,
            durationSec: item.durationSec,
            orderIndex: planned.orderIndex,
            isInVenue: !!item.isInVenue,
            isInLivestream: item.isInLivestream !== false,
            isTimeAnchor: isAnchor(planned.index),
            anchorType: item.anchorType ?? null,
            autoAdvance: !!item.autoAdvance,
            timeStart: times[i].timeStart,
            timeEnd: times[i].timeEnd,
            positions: {create: [...positionIds].map((positionId) => ({positionId}))},
          },
        });
        newIds.set(planned.index, created.id);
      }
      for (const planned of plan.items) {
        if (planned.parentIndex == null) continue;
        const parentId = newIds.get(planned.parentIndex);
        if (parentId) await tx.callSheetItem.update({where: {id: newIds.get(planned.index)}, data: {parentId}});
      }
    }, LONG_TRANSACTION);

    // LIVE follows the production that is on air; "naar LIVE" makes the events from the new items
    if (production.isActive) broadcastState();
    return res.json({ok: true, items: plan.items.length, newChapters: plan.newChapters});
  } catch (err) {
    return next(err);
  }
});
