import {Router} from 'express';
import {prisma} from '../../services/prisma';
import {NotFoundError} from '../../middleware/error';
import {ChapterCreateSchema, TemplateChapterUpdateSchema, TemplateStructureSchema} from '../../schemas/chapters';
import {flattenChapters, structureProblem} from '../../services/chapters';

/**
 * Hoofdstukken of a draaiboek template (openspec/changes/chapters D4), under /api/callsheets/templates.
 * Every item is in exactly one hoofdstuk; the whole order is written at once (PUT /:id/structure).
 */
export const callSheetTemplateChaptersRouter: Router = Router();

const positiveId = (value: string) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

async function assertPositionsExist(positionIds: number[]) {
  const found = await prisma.position.count({where: {id: {in: positionIds}}});
  if (found !== new Set(positionIds).size) throw new NotFoundError('Positie niet gevonden');
}

// POST /api/callsheets/templates/:id/chapters {name}: a new hoofdstuk at the end
callSheetTemplateChaptersRouter.post('/:id/chapters', async (req, res, next) => {
  try {
    const templateId = positiveId(req.params.id);
    if (!templateId) return res.status(400).json({error: 'Ongeldig template-id'});
    const {name} = ChapterCreateSchema.parse(req.body);
    const template = await prisma.callSheetTemplate.findUnique({where: {id: templateId}, include: {chapters: {select: {orderIndex: true}}}});
    if (!template) return res.status(404).json({error: 'Template niet gevonden'});
    const orderIndex = Math.max(-1, ...template.chapters.map((c) => c.orderIndex)) + 1;
    const chapter = await prisma.callSheetTemplateChapter.create({data: {templateId, name, orderIndex}, include: {positions: true}});
    return res.status(201).json(chapter);
  } catch (err) {
    return next(err);
  }
});

// PUT /api/callsheets/templates/chapters/:chapterId {name?, positionIds?}: rename, and/or the standard positions in order
callSheetTemplateChaptersRouter.put('/chapters/:chapterId', async (req, res, next) => {
  try {
    const {name, positionIds} = TemplateChapterUpdateSchema.parse(req.body);
    const chapterId = req.params.chapterId;
    const chapter = await prisma.callSheetTemplateChapter.findUnique({where: {id: chapterId}});
    if (!chapter) return res.status(404).json({error: 'Hoofdstuk niet gevonden'});
    if (positionIds) await assertPositionsExist(positionIds);
    const updated = await prisma.$transaction(async (tx) => {
      if (positionIds) {
        await tx.callSheetTemplateChapterPosition.deleteMany({where: {chapterId}});
        await tx.callSheetTemplateChapterPosition.createMany({data: positionIds.map((positionId, orderIndex) => ({chapterId, positionId, orderIndex}))});
      }
      return tx.callSheetTemplateChapter.update({
        where: {id: chapterId},
        data: name === undefined ? {} : {name},
        include: {positions: {orderBy: {orderIndex: 'asc'}, include: {position: true}}},
      });
    });
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/callsheets/templates/chapters/:chapterId: only an empty hoofdstuk (move its items first)
callSheetTemplateChaptersRouter.delete('/chapters/:chapterId', async (req, res, next) => {
  try {
    const chapter = await prisma.callSheetTemplateChapter.findUnique({where: {id: req.params.chapterId}, include: {_count: {select: {items: true}}}});
    if (!chapter) return res.status(404).json({error: 'Hoofdstuk niet gevonden'});
    if (chapter._count.items > 0) return res.status(409).json({error: 'Hoofdstuk is niet leeg'});
    await prisma.callSheetTemplateChapter.delete({where: {id: chapter.id}});
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// PUT /api/callsheets/templates/:id/structure {chapters: [{id, itemIds}]}: the whole order in one go
callSheetTemplateChaptersRouter.put('/:id/structure', async (req, res, next) => {
  try {
    const templateId = positiveId(req.params.id);
    if (!templateId) return res.status(400).json({error: 'Ongeldig template-id'});
    const {chapters: structure} = TemplateStructureSchema.parse(req.body);
    const template = await prisma.callSheetTemplate.findUnique({
      where: {id: templateId},
      include: {chapters: {select: {id: true}}, items: {select: {id: true, parentId: true}}},
    });
    if (!template) return res.status(404).json({error: 'Template niet gevonden'});
    const problem = structureProblem(structure, template.chapters.map((c) => c.id), template.items);
    if (problem) return res.status(400).json({error: problem});

    await prisma.$transaction(async (tx) => {
      // (templateId, orderIndex) is unique: park the hoofdstukken on negative numbers first
      for (const [i, chapter] of structure.entries()) {
        await tx.callSheetTemplateChapter.update({where: {id: chapter.id}, data: {orderIndex: -(i + 1)}});
      }
      for (const [i, chapter] of structure.entries()) {
        await tx.callSheetTemplateChapter.update({where: {id: chapter.id}, data: {orderIndex: i}});
      }
      for (const {itemId, chapterId, orderIndex} of flattenChapters(structure)) {
        await tx.callSheetTemplateItem.update({where: {id: itemId}, data: {chapterId, orderIndex}});
      }
      // Saved in the editor: the automatic placement has been looked at
      await tx.callSheetTemplate.update({where: {id: templateId}, data: {chaptersAutoPlaced: false}});
    });
    return res.json({ok: true});
  } catch (err) {
    return next(err);
  }
});

/**
 * The hoofdstuk for a new or changed template item: the given one (of the same template), else the
 * hoofdstuk of the template's last item, else its last hoofdstuk, else a new hoofdstuk "Draaiboek".
 */
export async function templateItemChapter(templateId: number, chapterId: unknown): Promise<string> {
  if (chapterId != null && chapterId !== '') {
    const chapter = await prisma.callSheetTemplateChapter.findFirst({where: {id: String(chapterId), templateId}});
    if (!chapter) throw new NotFoundError('Hoofdstuk niet gevonden');
    return chapter.id;
  }
  const last = await prisma.callSheetTemplateItem.findFirst({where: {templateId, chapterId: {not: null}}, orderBy: {orderIndex: 'desc'}});
  if (last?.chapterId) return last.chapterId;
  const lastChapter = await prisma.callSheetTemplateChapter.findFirst({where: {templateId}, orderBy: {orderIndex: 'desc'}});
  if (lastChapter) return lastChapter.id;
  return (await prisma.callSheetTemplateChapter.create({data: {templateId, name: 'Draaiboek', orderIndex: 0}})).id;
}

// POST /api/callsheets/templates/from-callsheet/:callSheetId {name}: a production's callsheet as a new
// draaiboek template, with its hoofdstukken, items (positions, anchors, links) and the standard positions
// of the hoofdstukken of the production's own template (by name)
callSheetTemplateChaptersRouter.post('/from-callsheet/:callSheetId', async (req, res, next) => {
  try {
    const callSheetId = positiveId(req.params.callSheetId);
    if (!callSheetId) return res.status(400).json({error: 'Ongeldig callsheet-id'});
    const {name} = ChapterCreateSchema.parse(req.body);
    const callSheet = await prisma.callSheet.findUnique({
      where: {id: callSheetId},
      include: {
        items: {orderBy: {orderIndex: 'asc'}, include: {positions: true}},
        production: {include: {segments: {orderBy: {volgorde: 'asc'}}}},
      },
    });
    if (!callSheet) return res.status(404).json({error: 'Callsheet niet gevonden'});
    const sourceTemplateId = callSheet.production.callSheetTemplateId;
    const sourceChapters = sourceTemplateId
      ? await prisma.callSheetTemplateChapter.findMany({where: {templateId: sourceTemplateId}, include: {positions: {orderBy: {orderIndex: 'asc'}}}})
      : [];

    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.callSheetTemplate.create({data: {name}});
      const chapterOf = new Map<number, string>();
      for (const [orderIndex, segment] of callSheet.production.segments.entries()) {
        const positions = sourceChapters.find((c) => c.name === segment.naam)?.positions ?? [];
        const chapter = await tx.callSheetTemplateChapter.create({
          data: {templateId: created.id, name: segment.naam, orderIndex, positions: {create: positions.map((p) => ({positionId: p.positionId, orderIndex: p.orderIndex}))}},
        });
        chapterOf.set(segment.id, chapter.id);
      }
      const itemOf = new Map<string, string>();
      for (const [i, item] of callSheet.items.entries()) {
        const copy = await tx.callSheetTemplateItem.create({
          data: {
            templateId: created.id,
            chapterId: (item.productionSegmentId != null && chapterOf.get(item.productionSegmentId)) || null,
            cue: item.cue,
            title: item.title, note: item.note, durationSec: item.durationSec, orderIndex: i + 1,
            isInVenue: item.isInVenue, isInLivestream: item.isInLivestream, isTimeAnchor: item.isTimeAnchor,
            anchorType: item.anchorType, autoAdvance: item.autoAdvance,
          },
        });
        itemOf.set(item.id, copy.id);
        if (item.positions.length > 0) {
          await tx.callSheetTemplatePosition.createMany({data: item.positions.map((p) => ({templateItemId: copy.id, positionId: p.positionId}))});
        }
      }
      for (const item of callSheet.items) {
        const parentId = item.parentId && itemOf.get(item.parentId);
        if (parentId) await tx.callSheetTemplateItem.update({where: {id: itemOf.get(item.id)}, data: {parentId}});
      }
      return created;
    });
    return res.status(201).json(template);
  } catch (err) {
    return next(err);
  }
});

/** A hoofdstuk name from an import file, as stored (trimmed, at most 100 characters like ChapterCreateSchema). */
export const importedChapterName = (value: unknown) => String(value ?? '').trim().slice(0, 100);
/** At most this many hoofdstukken per template (as the structure schema allows) */
const MAX_CHAPTERS = 200;

/** The hoofdstukken of a template by (imported) name, created in the given order when missing (imports). */
export async function templateChaptersByName(templateId: number, names: string[]): Promise<Map<string, string>> {
  if (new Set(names).size > MAX_CHAPTERS) throw Object.assign(new Error(`Te veel hoofdstukken (maximaal ${MAX_CHAPTERS})`), {status: 400});
  const byName = new Map<string, string>();
  const existing = await prisma.callSheetTemplateChapter.findMany({where: {templateId}, orderBy: {orderIndex: 'asc'}});
  for (const chapter of existing) byName.set(chapter.name, chapter.id);
  let orderIndex = existing.length;
  for (const name of names) {
    if (byName.has(name)) continue;
    byName.set(name, (await prisma.callSheetTemplateChapter.create({data: {templateId, name, orderIndex: orderIndex++}})).id);
  }
  return byName;
}
