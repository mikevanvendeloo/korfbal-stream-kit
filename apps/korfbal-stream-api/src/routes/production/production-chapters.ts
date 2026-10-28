import {Router} from 'express';
import {prisma} from '../../services/prisma';
import {NotFoundError} from '../../middleware/error';
import {ChapterCreateSchema, ProductionChapterUpdateSchema, ProductionStructureSchema} from '../../schemas/chapters';
import {flattenChapters, structureProblem} from '../../services/chapters';

/**
 * Hoofdstukken of a production's draaiboek (openspec/changes/chapters D4), under /api/production. The
 * hoofdstukken belong to the production; a callsheet's items each sit in one of them. The table is
 * still ProductionSegment (naam, volgorde) until the field renames.
 */
export const productionChaptersRouter: Router = Router();

const positiveId = (value: string) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// POST /api/production/:id/chapters {name}: a new hoofdstuk at the end
productionChaptersRouter.post('/:id/chapters', async (req, res, next) => {
  try {
    const productionId = positiveId(req.params.id);
    if (!productionId) return res.status(400).json({error: 'Ongeldig productie-id'});
    const {name} = ChapterCreateSchema.parse(req.body);
    const production = await prisma.production.findUnique({where: {id: productionId}, include: {segments: {select: {volgorde: true}}}});
    if (!production) return res.status(404).json({error: 'Productie niet gevonden'});
    const volgorde = Math.max(0, ...production.segments.map((s) => s.volgorde)) + 1;
    const chapter = await prisma.productionChapter.create({data: {productionId, naam: name, volgorde, duurInMinuten: 0}});
    return res.status(201).json(chapter);
  } catch (err) {
    return next(err);
  }
});

// PUT /api/production/chapters/:chapterId {name}: rename
productionChaptersRouter.put('/chapters/:chapterId', async (req, res, next) => {
  try {
    const chapterId = positiveId(req.params.chapterId);
    if (!chapterId) return res.status(400).json({error: 'Ongeldig hoofdstuk-id'});
    const {name} = ProductionChapterUpdateSchema.parse(req.body);
    const chapter = await prisma.productionChapter.findUnique({where: {id: chapterId}});
    if (!chapter) return res.status(404).json({error: 'Hoofdstuk niet gevonden'});
    return res.json(await prisma.productionChapter.update({where: {id: chapterId}, data: {naam: name}}));
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/production/chapters/:chapterId: only a hoofdstuk without callsheet items (move them first)
productionChaptersRouter.delete('/chapters/:chapterId', async (req, res, next) => {
  try {
    const chapterId = positiveId(req.params.chapterId);
    if (!chapterId) return res.status(400).json({error: 'Ongeldig hoofdstuk-id'});
    const chapter = await prisma.productionChapter.findUnique({where: {id: chapterId}, include: {_count: {select: {callSheetItems: true}}}});
    if (!chapter) return res.status(404).json({error: 'Hoofdstuk niet gevonden'});
    if (chapter._count.callSheetItems > 0) return res.status(409).json({error: 'Hoofdstuk is niet leeg'});
    await prisma.productionChapter.delete({where: {id: chapterId}});
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// PUT /api/production/callsheets/:callSheetId/structure {chapters: [{id, itemIds}]}: the production's
// hoofdstuk order and this callsheet's items in them, in one go. LIVE follows after "naar LIVE" (sync).
productionChaptersRouter.put('/callsheets/:callSheetId/structure', async (req, res, next) => {
  try {
    const callSheetId = positiveId(req.params.callSheetId);
    if (!callSheetId) return res.status(400).json({error: 'Ongeldig callsheet-id'});
    const {chapters: structure} = ProductionStructureSchema.parse(req.body);
    const callSheet = await prisma.callSheet.findUnique({
      where: {id: callSheetId},
      include: {items: {select: {id: true, parentId: true}}, production: {include: {segments: {select: {id: true}}}}},
    });
    if (!callSheet) return res.status(404).json({error: 'Callsheet niet gevonden'});
    const problem = structureProblem(structure, callSheet.production.segments.map((s) => s.id), callSheet.items);
    if (problem) return res.status(400).json({error: problem});

    await prisma.$transaction(async (tx) => {
      // volgorde is unique per production: park the hoofdstukken first
      await tx.productionChapter.updateMany({where: {productionId: callSheet.productionId}, data: {volgorde: {increment: 1000}}});
      for (const [i, chapter] of structure.entries()) {
        await tx.productionChapter.update({where: {id: chapter.id}, data: {volgorde: i + 1}});
      }
      for (const {itemId, chapterId, orderIndex} of flattenChapters(structure)) {
        await tx.callSheetItem.update({where: {id: itemId}, data: {productionSegmentId: chapterId, orderIndex}});
      }
      // Saved in the editor: the automatic placement has been looked at
      await tx.production.update({where: {id: callSheet.productionId}, data: {chaptersAutoPlaced: false}});
    });
    return res.json({ok: true});
  } catch (err) {
    return next(err);
  }
});

/**
 * The hoofdstuk for a new or moved callsheet item: the given one (of the callsheet's production), else
 * the hoofdstuk of the callsheet's last item, else the production's last hoofdstuk, else a new one
 * "Draaiboek". Every item is in a hoofdstuk (D1).
 */
export async function productionItemChapter(callSheetId: number, chapterId: unknown): Promise<number> {
  const callSheet = await prisma.callSheet.findUnique({where: {id: callSheetId}, select: {productionId: true}});
  if (!callSheet) throw new NotFoundError('Callsheet niet gevonden');
  const {productionId} = callSheet;
  if (chapterId != null && chapterId !== '') {
    const chapter = await prisma.productionChapter.findFirst({where: {id: Number(chapterId) || -1, productionId}});
    if (!chapter) throw new NotFoundError('Hoofdstuk niet gevonden');
    return chapter.id;
  }
  const last = await prisma.callSheetItem.findFirst({where: {callSheetId, productionSegmentId: {not: null}}, orderBy: {orderIndex: 'desc'}});
  if (last?.productionSegmentId) return last.productionSegmentId;
  const lastChapter = await prisma.productionChapter.findFirst({where: {productionId}, orderBy: {volgorde: 'desc'}});
  if (lastChapter) return lastChapter.id;
  return (await prisma.productionChapter.create({data: {productionId, naam: 'Draaiboek', volgorde: 1, duurInMinuten: 0}})).id;
}
