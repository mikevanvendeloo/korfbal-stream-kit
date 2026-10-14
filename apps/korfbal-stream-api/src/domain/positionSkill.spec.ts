import {describe, expect, it} from 'vitest';
import {findPositionByName, getRequiredSkillCodeForPosition, positionKey} from './positionSkill';

const positions = [
  {id: 1, name: 'Camera links'},
  {id: 5, name: 'Regie livestream'},
  {id: 6, name: 'Regie LEDscherm'},
  {id: 1328, name: 'Showcaller'},
];

describe('position names', () => {
  it('ignores case, spaces and punctuation', () => {
    expect(positionKey('Show caller')).toBe(positionKey('showcaller'));
    expect(positionKey('In-ear ondersteuning')).toBe('inearondersteuning');
    expect(findPositionByName(positions, '  camera   LINKS ')?.id).toBe(1);
    expect(findPositionByName(positions, 'Show caller')?.id).toBe(1328);
  });

  it('finds positions under their other names', () => {
    expect(findPositionByName(positions, 'regie')?.id).toBe(5);
    expect(findPositionByName(positions, 'scherm regie')?.id).toBe(6);
    expect(findPositionByName(positions, 'ledscherm regie')?.id).toBe(6);
    // And the other way round, for a database that still has the short name
    expect(findPositionByName([{id: 9, name: 'regie'}], 'Regie livestream')?.id).toBe(9);
  });

  it('finds nothing for a position that does not exist', () => {
    expect(findPositionByName(positions, 'Camera rechts')).toBeUndefined();
    expect(findPositionByName([], 'regie')).toBeUndefined();
  });

  it('knows the required skill whatever the spelling', () => {
    expect(getRequiredSkillCodeForPosition('Regie LEDscherm')).toBe('SCHERM_REGISSEUR');
    expect(getRequiredSkillCodeForPosition('Show caller')).toBe('SHOWCALLER');
    expect(getRequiredSkillCodeForPosition('Camera Links')).toBe('CAMERA_ZOOM');
    expect(getRequiredSkillCodeForPosition('Onbekend')).toBeNull();
  });
});
