/**
 * The structure of a draaiboek with hoofdstukken (openspec/changes/chapters D4): every hoofdstuk with its
 * item ids in show order. The editor changes it locally and sends it whole (PUT …/structure).
 */
export type ChapterId = string | number;
export type Structure<C extends ChapterId = ChapterId> = Array<{ id: C; itemIds: string[] }>;

/** The structure from hoofdstukken (in order) and items (in show order) with their hoofdstuk. */
export function buildStructure<C extends ChapterId>(
  chapters: Array<{ id: C }>,
  items: Array<{ id: string; chapterId: C | null | undefined }>,
): Structure<C> {
  const structure = chapters.map((c) => ({id: c.id, itemIds: [] as string[]}));
  for (const item of items) {
    // An item without (a known) hoofdstuk joins the last hoofdstuk, as the API places it
    const chapter = structure.find((c) => c.id === item.chapterId) ?? structure[structure.length - 1];
    chapter?.itemIds.push(item.id);
  }
  return structure;
}

export function chapterOfItem<C extends ChapterId>(structure: Structure<C>, itemId: string): C | undefined {
  return structure.find((c) => c.itemIds.includes(itemId))?.id;
}

/** Moves an item to a place in a hoofdstuk (index in that hoofdstuk's list, after removing it). */
export function moveItem<C extends ChapterId>(structure: Structure<C>, itemId: string, toChapter: C, toIndex: number): Structure<C> {
  const without = structure.map((c) => ({...c, itemIds: c.itemIds.filter((id) => id !== itemId)}));
  return without.map((c) => {
    if (c.id !== toChapter) return c;
    const itemIds = [...c.itemIds];
    itemIds.splice(Math.max(0, Math.min(toIndex, itemIds.length)), 0, itemId);
    return {...c, itemIds};
  });
}

/** Moves a whole hoofdstuk (with its items) to another place. */
export function moveChapter<C extends ChapterId>(structure: Structure<C>, chapterId: C, toIndex: number): Structure<C> {
  const from = structure.findIndex((c) => c.id === chapterId);
  if (from === -1) return structure;
  const result = [...structure];
  const [chapter] = result.splice(from, 1);
  result.splice(Math.max(0, Math.min(toIndex, result.length)), 0, chapter);
  return result;
}

/** Adds an item at the end of a hoofdstuk (a new item). */
export function appendItem<C extends ChapterId>(structure: Structure<C>, chapterId: C, itemId: string): Structure<C> {
  return moveItem(structure, itemId, chapterId, Number.MAX_SAFE_INTEGER);
}

/**
 * A linked item belongs in the hoofdstuk of its parent: one that ended up elsewhere (e.g. its parent was
 * dragged to another hoofdstuk) moves along, right after the parent and the parent's other linked items.
 */
export function keepLinkedTogether<C extends ChapterId>(structure: Structure<C>, items: Array<{ id: string; parentId?: string | null }>): Structure<C> {
  let result = structure;
  for (const item of items) {
    if (!item.parentId) continue;
    const parentChapter = chapterOfItem(result, item.parentId);
    if (parentChapter === undefined || chapterOfItem(result, item.id) === parentChapter) continue;
    const list = result.find((c) => c.id === parentChapter)?.itemIds ?? [];
    let index = list.indexOf(item.parentId) + 1;
    while (index < list.length && items.find((it) => it.id === list[index])?.parentId === item.parentId) index++;
    result = moveItem(result, item.id, parentChapter, index);
  }
  return result;
}

/** The structure without a hoofdstuk, its items moved to the end of another one ("Items verplaatsen naar …"). */
export function removeChapter<C extends ChapterId>(structure: Structure<C>, chapterId: C, moveItemsTo: C | null): Structure<C> {
  const removed = structure.find((c) => c.id === chapterId);
  const rest = structure.filter((c) => c.id !== chapterId);
  if (!removed || removed.itemIds.length === 0 || moveItemsTo == null) return rest;
  return rest.map((c) => (c.id === moveItemsTo ? {...c, itemIds: [...c.itemIds, ...removed.itemIds]} : c));
}

type TimedItem = { id: string; durationSec: number; isTimeAnchor: boolean; anchorType: string | null };

/**
 * Start and end of every hoofdstuk of a template in seconds relative to the match start (the items laid
 * end to end from the Start wedstrijd anchor, else from the first anchor, as the API places them), or
 * null for a hoofdstuk without items.
 */
export function relativeChapterTimes<C extends ChapterId>(structure: Structure<C>, items: TimedItem[]): Map<C, { start: number; end: number } | null> {
  const byId = new Map(items.map((it) => [it.id, it]));
  const ordered = structure.flatMap((c) => c.itemIds).map((id) => byId.get(id)).filter((it): it is TimedItem => !!it);
  let anchor = ordered.findIndex((it) => it.isTimeAnchor && it.anchorType === 'MATCH_START');
  if (anchor === -1) anchor = Math.max(0, ordered.findIndex((it) => it.isTimeAnchor));
  const start = new Map<string, number>();
  let t = 0;
  for (let i = anchor; i < ordered.length; i++) { start.set(ordered[i].id, t); t += ordered[i].durationSec; }
  t = 0;
  for (let i = anchor - 1; i >= 0; i--) { t -= ordered[i].durationSec; start.set(ordered[i].id, t); }
  return new Map(structure.map((c) => {
    const timed = c.itemIds.filter((id) => start.has(id));
    if (timed.length === 0) return [c.id, null];
    const starts = timed.map((id) => start.get(id) ?? 0);
    const ends = timed.map((id) => (start.get(id) ?? 0) + (byId.get(id)?.durationSec ?? 0));
    return [c.id, {start: Math.min(...starts), end: Math.max(...ends)}];
  }));
}

/** "−30:00" / "+35:00" / "0:00": seconds relative to the match start. */
export function formatRelative(seconds: number): string {
  const sign = seconds < 0 ? '−' : seconds > 0 ? '+' : '';
  const abs = Math.abs(Math.round(seconds));
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

/**
 * Why a dragged item doesn't go to another hoofdstuk: a linked item stays in the hoofdstuk of its parent
 * (the API refuses otherwise). Null when the drop is fine.
 */
export function linkedMoveNotice<C extends ChapterId, T extends { id: string; parentId?: string | null }>(
  structure: Structure<C>, items: T[], itemId: string, toChapter: C | undefined, label: (item: T) => string,
): string | null {
  const item = items.find((it) => it.id === itemId);
  const parent = item?.parentId ? items.find((it) => it.id === item.parentId) : undefined;
  if (!item || !parent || toChapter === undefined || toChapter === chapterOfItem(structure, parent.id)) return null;
  return `"${label(item)}" is gekoppeld aan "${label(parent)}" en blijft in hetzelfde hoofdstuk. Sleep "${label(parent)}": de gekoppelde items gaan mee. Of maak de koppeling los.`;
}
