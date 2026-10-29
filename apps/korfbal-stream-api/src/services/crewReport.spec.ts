import {describe, expect, it} from 'vitest';
import {buildCrewCells, groupPositions} from './crewReport';

const camera = {id: 1, name: 'Camera', category: 'TECHNICAL' as const, sortOrder: 20};
const regie = {id: 2, name: 'Regie', category: 'TECHNICAL' as const, sortOrder: 10};
const commentaar = {id: 3, name: 'Commentaar', category: 'ENTERTAINMENT' as const, sortOrder: 130};
const producer = {id: 4, name: 'Producer', category: 'GENERAL' as const, sortOrder: 1};

describe('buildCrewCells', () => {
  it('puts production-wide positions in every segment and adds the ones for a segment only', () => {
    const cells = buildCrewCells(
      [10, 11],
      [{personId: 1, personName: 'Anna', position: regie}],
      [
        {chapterId: 11, personId: 2, personName: 'Bas', position: camera},
        // Also production-wide: listed once, as a segment assignment
        {chapterId: 11, personId: 1, personName: 'Anna', position: regie},
      ],
    );
    expect(cells).toEqual([
      {chapterId: 10, positionId: 2, personName: 'Anna', type: 'production'},
      {chapterId: 11, positionId: 1, personName: 'Bas', type: 'chapter'},
      {chapterId: 11, positionId: 2, personName: 'Anna', type: 'chapter'},
    ]);
  });
});

describe('groupPositions', () => {
  it('groups by category in a fixed order and sorts within a category', () => {
    expect(groupPositions([commentaar, camera, regie, producer])).toEqual([
      {category: 'GENERAL', positions: [producer]},
      {category: 'TECHNICAL', positions: [regie, camera]},
      {category: 'ENTERTAINMENT', positions: [commentaar]},
    ]);
  });
});
