import {describe, expect, it} from 'vitest';
import {blockIndexes, hallLaneState, laneOf, parallelLanes} from './lanes';
import {rustHallDone, rustItems, showItems} from '../test/showCaller';

describe('lanes', () => {
  it('puts Zaal-only and Stream-only items in their lane; both, neither and anchors are samenkomstpunten', () => {
    expect(laneOf({isInVenue: true, isInLivestream: false})).toBe('ZAAL');
    expect(laneOf({isInVenue: false, isInLivestream: true})).toBe('STREAM');
    expect(laneOf({isInVenue: true, isInLivestream: true})).toBe('JOIN');
    expect(laneOf({isInVenue: false, isInLivestream: false})).toBe('JOIN');
    expect(laneOf({isInVenue: false, isInLivestream: true, isTimeAnchor: true})).toBe('JOIN');
  });

  it('cuts the show into blocks; lanes never cross a hoofdstuk', () => {
    expect(blockIndexes(rustItems)).toEqual([0, 1, 1, 1, 1, 2]);
    expect(blockIndexes([{isInLivestream: true, chapterId: 1}, {isInLivestream: true, chapterId: 2}])).toEqual([0, 1]);
  });

  it('marks the lane only where Zaal and Stream run side by side', () => {
    expect([...parallelLanes(rustItems)]).toEqual([['r2', 'ZAAL'], ['r3', 'STREAM'], ['r4', 'ZAAL'], ['r5', 'STREAM']]);
    // An all-Stream draaiboek has no lanes to show
    expect(parallelLanes(showItems).size).toBe(0);
  });

  it('follows the stream with Volgend while the hall item runs next to it', () => {
    const lane = hallLaneState(rustItems, 'r3', 'r2');
    expect(lane.running?.id).toBe('r2');
    expect(lane.streamNext?.id).toBe('r5');
    expect(lane.canAdvance).toBe(true);
    expect(lane.endsHallItem).toBe(false);
    expect(lane.done).toBe(false);
  });

  it('warns when Volgend goes to the samenkomstpunt while the hall still runs', () => {
    const items = rustItems.map((e) => (e.id === 'r2' || e.id === 'r3' ? {...e, status: 'COMPLETED'} : e));
    const lane = hallLaneState(items, 'r5', 'r4');
    expect(lane.streamNext?.id).toBe('r6');
    expect(lane.endsHallItem).toBe(true);
  });

  it('knows when the hall lane of the block is done and what comes next', () => {
    const lane = hallLaneState(rustHallDone, 'r5', null);
    expect(lane.done).toBe(true);
    expect(lane.canAdvance).toBe(false);
    expect(lane.afterBlock?.title).toBe('Start tweede helft');
  });
});
