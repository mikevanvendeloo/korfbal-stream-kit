import {describe, expect, it} from 'vitest';
import {callsheetWait} from './callsheetWait';
import {CAMERA, REGIE, showItem, showItems} from '../test/showCaller';

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
