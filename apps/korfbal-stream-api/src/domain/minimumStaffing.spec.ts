import {describe, expect, it} from 'vitest';
import {computeMinimumStaffing, MINIMUM_STAFFING_ROLES, StaffingPerson} from './minimumStaffing';
import {crewGroupOf, positionCategoriesBySkill} from './crewGroup';

const ALL_CODES = ['REGISSEUR', 'CAMERA_ZOOM', 'CAMERA_OVERVIEW', 'CAMERA_PTZ', 'HERHALINGEN', 'COMMENTAAR', 'PRESENTATIE', 'ANALIST', 'RUNNER'];
let nextId = 1;
const person = (...skillCodes: string[]): StaffingPerson => ({id: nextId++, skillCodes});
function role(result: ReturnType<typeof computeMinimumStaffing>, key: string) {
  const found = result.roles.find((r) => r.key === key);
  if (!found) throw new Error(`no role ${key}`);
  return found;
}

describe('computeMinimumStaffing', () => {
  it('is met with a regisseur and three cameras; the optional roles may stay empty', () => {
    const result = computeMinimumStaffing(
      [person('REGISSEUR'), person('CAMERA_ZOOM'), person('CAMERA_ZOOM'), person('CAMERA_OVERVIEW')], ALL_CODES);
    expect(result.met).toBe(true);
    expect(result.shortfall).toEqual([]);
    expect(role(result, 'camera').filled).toBe(3);
    for (const key of ['commentaar', 'presentatie', 'analist']) {
      expect(role(result, key)).toMatchObject({optional: true, filled: 0, met: false});
    }
  });

  it('counts a person with several skills only once', () => {
    // Someone who can do Regie and Camera fills one of them, not both
    const result = computeMinimumStaffing(
      [person('REGISSEUR', 'CAMERA_ZOOM'), person('CAMERA_ZOOM'), person('CAMERA_OVERVIEW')], ALL_CODES);
    expect(role(result, 'regisseur').filled + role(result, 'camera').filled).toBe(3);
    expect(result.met).toBe(false);
    const ids = result.roles.flatMap((r) => r.personIds);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('finds the assignment that works: the all-rounder moves to where nobody else can go', () => {
    const allRounder = person('CAMERA_ZOOM', 'REGISSEUR');
    const result = computeMinimumStaffing(
      // The all-rounder is listed first, so a greedy pass would make them a camera and leave Regie empty
      [allRounder, person('CAMERA_ZOOM'), person('CAMERA_OVERVIEW'), person('CAMERA_ZOOM')], ALL_CODES);
    expect(result.met).toBe(true);
    expect(role(result, 'regisseur').personIds).toEqual([allRounder.id]);
  });

  it('gives required roles priority over optional ones', () => {
    // The commentator can also do camera: the camera needs them more
    const result = computeMinimumStaffing(
      [person('COMMENTAAR', 'CAMERA_ZOOM'), person('REGISSEUR'), person('CAMERA_ZOOM'), person('CAMERA_OVERVIEW')], ALL_CODES);
    expect(result.met).toBe(true);
    expect(role(result, 'commentaar').filled).toBe(0);
  });

  it('still fills an optional role when that costs no required role', () => {
    const result = computeMinimumStaffing([person('COMMENTAAR', 'CAMERA_ZOOM'), person('CAMERA_ZOOM'), person('PRESENTATIE')], ALL_CODES);
    expect(role(result, 'camera').filled).toBe(2);
    expect(role(result, 'presentatie').filled).toBe(1);
    expect(role(result, 'commentaar').filled).toBe(0);
  });

  it('does not count PTZ or Herhalingen as camera, and says how many are still missing', () => {
    const result = computeMinimumStaffing([person('REGISSEUR'), person('CAMERA_PTZ'), person('HERHALINGEN'), person('CAMERA_ZOOM')], ALL_CODES);
    expect(result.met).toBe(false);
    expect(result.shortfall).toEqual([{key: 'camera', missing: 2, singular: 'camera', plural: "camera's"}]);
  });

  it('never fails on optional roles', () => {
    const result = computeMinimumStaffing([person('REGISSEUR'), person('CAMERA_ZOOM'), person('CAMERA_ZOOM'), person('CAMERA_ZOOM')], ['REGISSEUR', 'CAMERA_ZOOM', 'CAMERA_OVERVIEW']);
    expect(result.met).toBe(true);
    expect(role(result, 'commentaar').unknownSkillCodes).toEqual(['COMMENTAAR']);
  });

  it('treats a role whose skill codes the organization lacks as unmet, with the missing codes', () => {
    const result = computeMinimumStaffing([person('REGISSEUR'), person('CAMERA_ZOOM')], ['CAMERA_ZOOM', 'CAMERA_OVERVIEW']);
    expect(role(result, 'regisseur')).toMatchObject({filled: 0, met: false, unknownSkillCodes: ['REGISSEUR']});
    expect(result.shortfall.map((s) => s.key)).toEqual(['regisseur', 'camera']);
  });

  it('counts the known codes of a role when only some are missing, and compares codes without case', () => {
    const result = computeMinimumStaffing([person('camera_zoom'), person(' CAMERA_ZOOM ')], ['CAMERA_ZOOM']);
    expect(role(result, 'camera')).toMatchObject({filled: 2, unknownSkillCodes: ['CAMERA_OVERVIEW']});
  });

  it('has the counts in one place', () => {
    expect(MINIMUM_STAFFING_ROLES.map((r) => [r.key, r.required, r.optional])).toEqual([
      ['regisseur', 1, false], ['camera', 3, false], ['commentaar', 1, true], ['presentatie', 1, true], ['analist', 1, true],
    ]);
  });
});

describe('crewGroupOf', () => {
  const categories = positionCategoriesBySkill([
    {skillId: 1, category: 'ENTERTAINMENT'}, // Commentaar
    {skillId: 2, category: 'TECHNICAL'}, // Camera
    {skillId: 3, category: 'GENERAL'}, // Runner
    {skillId: 4, category: 'ENTERTAINMENT'}, // Presentatie
    {skillId: 5, category: 'ENTERTAINMENT'}, {skillId: 5, category: 'TECHNICAL'}, // used by both
    {skillId: null, category: 'ENTERTAINMENT'},
  ]);

  it('is Entertainment only when every skill belongs to Entertainment positions', () => {
    expect(crewGroupOf([1], categories)).toBe('entertainment');
    expect(crewGroupOf([1, 4], categories)).toBe('entertainment');
    expect(crewGroupOf([1, 2], categories)).toBe('crew');
    expect(crewGroupOf([1, 3], categories)).toBe('crew');
    expect(crewGroupOf([5], categories)).toBe('crew');
  });

  it('puts people without skills, or with a skill no position uses, in Crew', () => {
    expect(crewGroupOf([], categories)).toBe('crew');
    expect(crewGroupOf([99], categories)).toBe('crew');
  });
});
