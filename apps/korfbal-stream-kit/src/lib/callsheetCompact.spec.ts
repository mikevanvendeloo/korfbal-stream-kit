import {describe, expect, it} from 'vitest';
import {callsheetFullSlots} from './callsheetCompact';
import {CAMERA, REGIE, showItem, showItems} from '../test/showCaller';

const slot = (item: {calculatedTime: Date}, index = 0) => `${item.calculatedTime.toISOString()}#${index}`;
const byId = (id: string) => showItems.find((i) => i.id === id) as (typeof showItems)[number];

describe('callsheetFullSlots', () => {
  it('shows the current item and the next one of the position in full, the rest compact', () => {
    // b runs (regie); the regie's next is d; a is done, e and later are compact
    expect(callsheetFullSlots(showItems, [REGIE.id], new Set(['b']))).toEqual(new Set([slot(byId('b')), slot(byId('d'))]));
  });

  it('takes the next item per shown column, so every column has its own next one in full', () => {
    const full = callsheetFullSlots(showItems, [REGIE.id, CAMERA.id], new Set(['b']));
    // regie: b (current) and d; camera: c (next) — b is not the camera's
    expect(full).toEqual(new Set([slot(byId('b')), slot(byId('d')), slot(byId('c'))]));
  });

  it('shows the first item in full before the show started', () => {
    const waiting = showItems.map((i) => ({...i, status: 'WAITING' as const}));
    expect(callsheetFullSlots(waiting, [REGIE.id], new Set())).toEqual(new Set([slot(byId('a'))]));
  });

  it('counts items at the same time like the columns do (time#index)', () => {
    const at = new Date(2026, 9, 17, 20, 0);
    const same = [showItem('x', 1, 'X', {status: 'ACTIVE'}), showItem('y', 2, 'Y')].map((i) => ({...i, calculatedTime: at}));
    expect(callsheetFullSlots(same, [REGIE.id], new Set(['x']))).toEqual(new Set([`${at.toISOString()}#0`, `${at.toISOString()}#1`]));
  });
});
