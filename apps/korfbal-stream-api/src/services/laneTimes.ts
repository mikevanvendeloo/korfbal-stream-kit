/**
 * Zaal and Stream as parallel lanes (openspec/changes/parallel-lanes D1, D2): the one timing rule for
 * "Tijden herberekenen", applying a template, the draaiboek import, the template editor and the reports.
 *
 * An item with only Zaal runs in the hall lane, an item with only Stream in the stream lane; an item with
 * both or neither, and every time anchor, is a samenkomstpunt (JOIN). Between two samenkomstpunten both
 * lanes start together; the next samenkomstpunt starts when the longest lane ends. Lanes never cross a
 * hoofdstuk boundary. A hoofdstuk with a minimum lasts at least that long: the next one starts no earlier
 * than its start + minimum.
 */

export type Lane = 'ZAAL' | 'STREAM' | 'JOIN';

export type LaneItem = {
  durationSec: number;
  isTimeAnchor: boolean;
  anchorType: string | null;
  startOffsetSec?: number | null;
  isInVenue?: boolean | null;
  isInLivestream?: boolean | null;
  chapterId?: string | number | null;
};

export type ItemTimes = { timeStart: Date | null; timeEnd: Date | null };

export type LaneOptions = {
  kickoff: Date;
  liveStart: Date;
  /** Minimum duration in seconds per hoofdstuk id; a missing or null entry means no minimum */
  chapterMinimums?: Map<string | number, number | null | undefined>;
};

export function laneOf(item: Pick<LaneItem, 'isTimeAnchor' | 'isInVenue' | 'isInLivestream'>): Lane {
  if (item.isTimeAnchor) return 'JOIN';
  if (item.isInVenue && !item.isInLivestream) return 'ZAAL';
  if (item.isInLivestream && !item.isInVenue) return 'STREAM';
  return 'JOIN';
}

type Block = {
  chapter: string | number | null;
  join: boolean;
  anchor: boolean;
  /** Item indexes per lane, in show order (a JOIN block has one lane with one item) */
  lanes: number[][];
  lengthMs: number;
};

function blocksOf(items: LaneItem[]): Block[] {
  const blocks: Block[] = [];
  let open: { block: Block; zaal: number[]; stream: number[] } | null = null;
  const close = () => {
    if (!open) return;
    open.block.lanes = [open.zaal, open.stream].filter((lane) => lane.length > 0);
    open.block.lengthMs = Math.max(...open.block.lanes.map((lane) => lane.reduce((sum, i) => sum + items[i].durationSec * 1000, 0)));
    blocks.push(open.block);
    open = null;
  };
  items.forEach((item, i) => {
    const chapter = item.chapterId ?? null;
    const lane = laneOf(item);
    if (lane === 'JOIN') {
      close();
      blocks.push({chapter, join: true, anchor: item.isTimeAnchor, lanes: [[i]], lengthMs: item.durationSec * 1000});
      return;
    }
    if (open && open.block.chapter !== chapter) close();
    if (!open) open = {block: {chapter, join: false, anchor: false, lanes: [], lengthMs: 0}, zaal: [], stream: []};
    (lane === 'ZAAL' ? open.zaal : open.stream).push(i);
  });
  close();
  return blocks;
}

/**
 * Planned start and end of items in show order. Every anchor starts at its own time (the match start at
 * the kickoff, the livestream start at the live time); the blocks after an anchor follow it until the
 * next anchor; the blocks before the first anchor are laid out backwards from it. Without an anchor an
 * item keeps its offset from the kickoff when it has one. Without lanes or minimums every item follows
 * the previous one end to end.
 */
export function layOutLaneTimes(items: LaneItem[], {kickoff, liveStart, chapterMinimums}: LaneOptions): ItemTimes[] {
  const at = (start: number, durationSec: number): ItemTimes => ({timeStart: new Date(start), timeEnd: new Date(start + durationSec * 1000)});
  if (!items.some((it) => it.isTimeAnchor)) {
    return items.map((it) => (it.startOffsetSec == null ? {timeStart: null, timeEnd: null} : at(kickoff.getTime() + it.startOffsetSec * 1000, it.durationSec)));
  }
  const anchorTime = (it: LaneItem) => (it.anchorType === 'LIVESTREAM_START' ? liveStart : kickoff).getTime();
  const minimumMs = (chapter: string | number | null) => {
    const min = chapter == null ? null : chapterMinimums?.get(chapter);
    return min != null && min > 0 ? min * 1000 : 0;
  };
  const times: ItemTimes[] = items.map(() => ({timeStart: null, timeEnd: null}));
  const place = (block: Block, start: number) => {
    for (const lane of block.lanes) {
      let t = start;
      for (const i of lane) {
        times[i] = at(t, items[i].durationSec);
        t += items[i].durationSec * 1000;
      }
    }
  };

  const blocks = blocksOf(items);
  const first = blocks.findIndex((b) => b.anchor);
  const firstStart = anchorTime(items[blocks[first].lanes[0][0]]);

  // Backwards: the anchor's own hoofdstuk end to end, each earlier hoofdstuk lasting at least its minimum
  let end = firstStart;
  let b = first - 1;
  for (; b >= 0 && blocks[b].chapter === blocks[first].chapter; b--) {
    end -= blocks[b].lengthMs;
    place(blocks[b], end);
  }
  const anchorChapterStart = end;
  while (b >= 0) {
    const chapter = blocks[b].chapter;
    const run: Block[] = [];
    for (; b >= 0 && blocks[b].chapter === chapter; b--) run.unshift(blocks[b]);
    const length = run.reduce((sum, block) => sum + block.lengthMs, 0);
    end -= Math.max(length, minimumMs(chapter));
    let start = end;
    for (const block of run) {
      place(block, start);
      start += block.lengthMs;
    }
  }

  // Forwards from the first anchor; a later anchor still starts at its own time
  let t = firstStart;
  let chapter = blocks[first].chapter;
  let chapterStart = anchorChapterStart;
  for (let i = first; i < blocks.length; i++) {
    const block = blocks[i];
    let start = block.anchor ? anchorTime(items[block.lanes[0][0]]) : t;
    if (block.chapter !== chapter) {
      if (!block.anchor) start = Math.max(start, chapterStart + minimumMs(chapter));
      chapter = block.chapter;
      chapterStart = start;
    }
    place(block, start);
    t = start + block.lengthMs;
  }
  return times;
}

export type ChapterSpan<K> = {
  id: K;
  /** Null without timed items */
  start: number | null;
  /** The end of its items */
  itemsEnd: number | null;
  /** max(items end, start + minimum) */
  end: number | null;
  minDurationSec: number | null;
  /** How much longer the items run than the minimum (0 without minimum or when they fit) */
  overrunSec: number;
};

/** A hoofdstuk's start and end from its items' times and its minimum (D2), in milliseconds. */
export function chapterSpan<K>(
  chapter: { id: K; minDurationSec?: number | null },
  items: Array<{ start: number | null; end: number | null }>,
): ChapterSpan<K> {
  const minDurationSec = chapter.minDurationSec ?? null;
  const starts = items.map((i) => i.start).filter((t): t is number => t != null);
  if (starts.length === 0) return {id: chapter.id, start: null, itemsEnd: null, end: null, minDurationSec, overrunSec: 0};
  const start = Math.min(...starts);
  const itemsEnd = Math.max(start, ...items.map((i) => i.end ?? i.start).filter((t): t is number => t != null));
  const minimumEnd = minDurationSec != null ? start + minDurationSec * 1000 : start;
  const overrunSec = minDurationSec != null ? Math.max(0, Math.round((itemsEnd - minimumEnd) / 1000)) : 0;
  return {id: chapter.id, start, itemsEnd, end: Math.max(itemsEnd, minimumEnd), minDurationSec, overrunSec};
}

/**
 * The parallel block of every item in show order (D1): a JOIN item is a block on its own, a run of
 * ZAAL/STREAM items within one hoofdstuk is one block.
 */
export function blockIndexes(items: Array<Pick<LaneItem, 'isTimeAnchor' | 'isInVenue' | 'isInLivestream' | 'chapterId'>>): number[] {
  let block = -1;
  let previous: { lane: Lane; chapter: string | number | null } | null = null;
  return items.map((item) => {
    const lane = laneOf(item);
    const chapter = item.chapterId ?? null;
    if (lane === 'JOIN' || !previous || previous.lane === 'JOIN' || previous.chapter !== chapter) block++;
    previous = {lane, chapter};
    return block;
  });
}

/**
 * Which items run in the hall lane by themselves during the show (D4): ZAAL items in a block that also has
 * STREAM items. A block with only Zaal items has nothing to follow, so Volgend steps through it as before.
 */
export function hallLaneItems(items: Array<Pick<LaneItem, 'isTimeAnchor' | 'isInVenue' | 'isInLivestream' | 'chapterId'>>): boolean[] {
  const blocks = blockIndexes(items);
  const withStream = new Set(items.filter((it) => laneOf(it) === 'STREAM').map((it) => blocks[items.indexOf(it)]));
  return items.map((item, i) => laneOf(item) === 'ZAAL' && withStream.has(blocks[i]));
}

/**
 * The planned times again during the show, from one item that starts at `start` (the item that just
 * became active): every item follows the one before in its lane, nothing else is pinned (also not the
 * draaiboek's own anchors, which stay samenkomstpunten), each hoofdstuk lasts at least its minimum.
 */
export function relayOutFrom(items: LaneItem[], index: number, start: Date, chapterMinimums?: LaneOptions['chapterMinimums']): ItemTimes[] {
  const free = items.map((item) => ({...item, isTimeAnchor: false, ...(item.isTimeAnchor ? {isInVenue: true, isInLivestream: true} : {})}));
  const origin = {durationSec: 0, isTimeAnchor: true, anchorType: 'MATCH_START', chapterId: items[0]?.chapterId ?? null};
  const base = layOutLaneTimes([origin, ...free], {kickoff: new Date(0), liveStart: new Date(0), chapterMinimums}).slice(1);
  const shift = start.getTime() - (base[index]?.timeStart?.getTime() ?? 0);
  const moved = (d: Date | null) => (d == null ? null : new Date(d.getTime() + shift));
  return base.map((t) => ({timeStart: moved(t.timeStart), timeEnd: moved(t.timeEnd)}));
}

/** The minimum duration per hoofdstuk id, for the layout */
export const chapterMinimums = <K extends string | number>(chapters: Array<{ id: K; minDurationSec: number | null }>) =>
  new Map<string | number, number | null>(chapters.map((c) => [c.id, c.minDurationSec]));
