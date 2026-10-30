import {describe, expect, it} from 'vitest';
import {callsheetWait} from './callsheetWait';
import {CAMERA, LED, REGIE, rustHallDone, rustItems, showItem, showItems} from '../test/showCaller';

const active = showItems[1]; // 'b', for the regie
const at = (item: { calculatedTime: Date }, secondsBefore: number) => item.calculatedTime.getTime() - secondsBefore * 1000;

describe('callsheetWait', () => {
  it('is nothing while nothing runs or the position has the active item', () => {
    expect(callsheetWait(showItems, null, CAMERA.id)).toBeNull();
    expect(callsheetWait(showItems, active, REGIE.id)).toBeNull();
  });

  it('waits for the position\'s next item, with the seconds until its start', () => {
    const wait = callsheetWait(showItems, active, CAMERA.id, at(showItems[2], 90));
    expect(wait).toEqual({kind: 'waiting', next: showItems[2], secondsLeft: 90});
  });

  it('is not a gap when a linked item for the position runs with the active one', () => {
    const items = [...showItems, showItem('b2', 2, 'Camera op presentator', {positionList: [CAMERA], parentId: 'b'})];
    expect(callsheetWait(items, active, CAMERA.id)).toBeNull();
    expect(callsheetWait(items, items[6], REGIE.id)).toBeNull();
  });

  it('is done when the position has nothing after the active item', () => {
    const last = showItem('g', 7, 'Afkondiging');
    expect(callsheetWait([...showItems, last], last, CAMERA.id)).toEqual({kind: 'done'});
  });

  it('is nothing for a position without items', () => {
    const withoutEveryone = showItems.filter((item) => item.positions.length > 0);
    expect(callsheetWait(withoutEveryone, active, 99)).toBeNull();
  });
});

describe('callsheetWait with the hall lane', () => {
  const commentators = rustItems[2];

  it('is no gap for the LED while its hall item runs next to the stream', () => {
    expect(callsheetWait(rustItems, commentators, LED.id, Date.now(), rustItems[1])).toBeNull();
  });

  it('waits for the next item when the hall lane is done, skipping hall items that are over', () => {
    const analysis = rustHallDone[4];
    const wait = callsheetWait(rustHallDone, analysis, LED.id, rustHallDone[5].calculatedTime.getTime() - 60_000, null);
    expect(wait).toEqual({kind: 'waiting', next: rustHallDone[5], secondsLeft: 60});
    // Before: the statistics (order after the commentators) are over, so not "next"
    const atCommentators = rustHallDone.map((e) => (e.id === 'r3' ? {...e, status: 'ACTIVE'} : e));
    expect(callsheetWait(atCommentators, atCommentators[2], LED.id, Date.now(), null)).toMatchObject({kind: 'waiting', next: {id: 'r6'}});
  });
});
