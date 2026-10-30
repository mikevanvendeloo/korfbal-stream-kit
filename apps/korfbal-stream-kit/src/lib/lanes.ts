/**
 * Zaal and Stream as parallel lanes (openspec/changes/parallel-lanes D1, D4). The API lays out the times
 * (services/laneTimes.ts); the kit only needs to know which lane an item is in, which items form a block and
 * what the hall lane does during the show. Keep `laneOf`, `blockIndexes` and `hallLaneItems` in step with
 * the API's laneTimes.ts.
 *
 * An item with only Zaal runs in the hall lane, an item with only Stream in the stream lane; an item with
 * both or neither, and every time anchor, is a samenkomstpunt (JOIN). Lanes never cross a hoofdstuk.
 */

export type Lane = 'ZAAL' | 'STREAM' | 'JOIN';

type LaneFlags = {
  isTimeAnchor?: boolean | null;
  isInVenue?: boolean | null;
  isInLivestream?: boolean | null;
  chapterId?: string | number | null;
};

export function laneOf(item: LaneFlags): Lane {
  if (item.isTimeAnchor) return 'JOIN';
  if (item.isInVenue && !item.isInLivestream) return 'ZAAL';
  if (item.isInLivestream && !item.isInVenue) return 'STREAM';
  return 'JOIN';
}

/** The block of every item in show order: a JOIN item is a block of its own, a run of Zaal/Stream items within one hoofdstuk is one block. */
export function blockIndexes(items: LaneFlags[]): number[] {
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

/** Zaal items in a block that also has Stream items: during the show they run by themselves, next to the stream. */
export function hallLaneItems(items: LaneFlags[]): boolean[] {
  const blocks = blockIndexes(items);
  const withStream = new Set(items.flatMap((item, i) => (laneOf(item) === 'STREAM' ? [blocks[i]] : [])));
  return items.map((item, i) => laneOf(item) === 'ZAAL' && withStream.has(blocks[i]));
}

/**
 * The lane edge of every item (in show order) that runs next to the other lane: a block with both Zaal and
 * Stream items. Items elsewhere get none (an all-Stream draaiboek doesn't turn blue).
 */
export function parallelLanes<T extends LaneFlags & { id: string }>(items: T[]): Map<string, 'ZAAL' | 'STREAM'> {
  const blocks = blockIndexes(items);
  const lanesPerBlock = new Map<number, Set<Lane>>();
  items.forEach((item, i) => {
    const set = lanesPerBlock.get(blocks[i]) ?? new Set<Lane>();
    set.add(laneOf(item));
    lanesPerBlock.set(blocks[i], set);
  });
  const result = new Map<string, 'ZAAL' | 'STREAM'>();
  items.forEach((item, i) => {
    const lane = laneOf(item);
    const lanes = lanesPerBlock.get(blocks[i]);
    if (lane !== 'JOIN' && lanes?.has('ZAAL') && lanes.has('STREAM')) result.set(item.id, lane);
  });
  return result;
}

type ShowEvent = LaneFlags & { id: string; order: number; status: string; durationSec?: number | null };

export type HallLaneState<E extends ShowEvent> = {
  /** Which items run in the hall lane by themselves */
  hall: Set<string>;
  /** The block of every item */
  blockOf: Map<string, number>;
  /** What Volgend (or Start show) makes active: the next item that isn't in the hall lane */
  streamNext: E | null;
  /** The hall item running now */
  running: E | null;
  /** The hall lane of the current block is done: "Zaal klaar · volgende: …" */
  done: boolean;
  /** What comes after the current block (the next samenkomstpunt) */
  afterBlock: E | null;
  /** Zaal › has something to do: a hall item runs or one of the current block still waits */
  canAdvance: boolean;
  /** Volgend goes to another block while a hall item runs: Volgend ends it ("Zaal nog m:ss bezig") */
  endsHallItem: boolean;
};

/**
 * The hall lane during the show (D4): what runs in the hall next to the active (stream) item, whether the
 * hall lane of the current block is done, and what Volgend activates (it follows the stream).
 */
export function hallLaneState<E extends ShowEvent>(events: E[], activeEventId: string | null, activeVenueEventId: string | null): HallLaneState<E> {
  const ordered = [...events].sort((a, b) => a.order - b.order);
  const inHall = hallLaneItems(ordered);
  const blocks = blockIndexes(ordered);
  const hall = new Set(ordered.filter((_, i) => inHall[i]).map((e) => e.id));
  const blockOf = new Map(ordered.map((e, i) => [e.id, blocks[i]]));
  const active = ordered.find((e) => e.id === activeEventId) ?? null;
  const running = activeVenueEventId ? ordered.find((e) => e.id === activeVenueEventId) ?? null : null;
  const streamNext = active
    ? ordered.find((e) => e.order > active.order && !hall.has(e.id)) ?? null
    : ordered.find((e) => !hall.has(e.id)) ?? null;
  const block = active ? blockOf.get(active.id) : undefined;
  const hallInBlock = block === undefined ? [] : ordered.filter((e) => hall.has(e.id) && blockOf.get(e.id) === block);
  const lastOfBlock = block === undefined ? undefined : [...ordered].reverse().find((e) => blockOf.get(e.id) === block);
  const afterBlock = lastOfBlock ? ordered.find((e) => e.order > lastOfBlock.order) ?? null : null;
  return {
    hall,
    blockOf,
    streamNext,
    running,
    done: !running && hallInBlock.length > 0 && hallInBlock.every((e) => e.status !== 'WAITING'),
    afterBlock,
    canAdvance: !!running || hallInBlock.some((e) => e.status === 'WAITING'),
    endsHallItem: !!running && !!streamNext && blockOf.get(streamNext.id) !== blockOf.get(running.id),
  };
}
