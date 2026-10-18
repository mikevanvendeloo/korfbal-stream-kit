/**
 * Minimum staffing of a production: which roles must be filled by the people marked present.
 * One place for the rule (counts and skill codes), used by GET /api/production/:id/attendance and
 * shown on Beheer → Producties → Beschikbaarheid.
 */

export type StaffingRoleDefinition = {
  key: string;
  /** Shown in the checklist */
  label: string;
  /** Used in "nog 1 camera" / "nog 2 camera's" */
  singular: string;
  plural: string;
  required: number;
  /** An optional role never makes the minimum fail */
  optional: boolean;
  /** Skill codes (Skill.code of the organization) that can fill this role */
  skillCodes: string[];
};

export const MINIMUM_STAFFING_ROLES: StaffingRoleDefinition[] = [
  {key: 'regisseur', label: 'Regisseur', singular: 'regisseur', plural: 'regisseurs', required: 1, optional: false, skillCodes: ['REGISSEUR']},
  // Camera links/rechts (zoom) and Camera overzicht; not PTZ, not Herhalingen
  {key: 'camera', label: 'Camera', singular: 'camera', plural: "camera's", required: 3, optional: false, skillCodes: ['CAMERA_ZOOM', 'CAMERA_OVERVIEW']},
  {key: 'commentaar', label: 'Commentaar', singular: 'commentator', plural: 'commentatoren', required: 1, optional: true, skillCodes: ['COMMENTAAR']},
  {key: 'presentatie', label: 'Presentatie', singular: 'presentator', plural: 'presentatoren', required: 1, optional: true, skillCodes: ['PRESENTATIE']},
  {key: 'analist', label: 'Analist', singular: 'analist', plural: 'analisten', required: 1, optional: true, skillCodes: ['ANALIST']},
];

export type StaffingPerson = {id: number; skillCodes: string[]};

export type StaffingRoleResult = {
  key: string;
  label: string;
  singular: string;
  plural: string;
  required: number;
  optional: boolean;
  skillCodes: string[];
  /** People counted for this role (each person counts for one role at most) */
  filled: number;
  personIds: number[];
  /** Skill codes of the role the organization doesn't have (the role can't be filled through them) */
  unknownSkillCodes: string[];
  met: boolean;
};

export type StaffingResult = {
  roles: StaffingRoleResult[];
  /** All required roles are filled */
  met: boolean;
  /** Required roles that are short, with how many people are still needed */
  shortfall: Array<{key: string; missing: number; singular: string; plural: string}>;
};

const normalizeCode = (code: string) => code.trim().toUpperCase();

/**
 * Assigns the present people to the role slots so that each person fills one slot at most
 * (someone who can do Regie and Camera fills only one of them). Maximum bipartite matching with
 * augmenting paths (Kuhn), slots of required roles first: a slot that is filled stays filled while
 * later slots are matched, so required roles get the most people possible before optional ones.
 *
 * Skill codes are compared without case/spacing; a code the organization doesn't have can't fill
 * anything and is reported in `unknownSkillCodes`.
 */
export function computeMinimumStaffing(
  people: StaffingPerson[],
  organizationSkillCodes: Iterable<string>,
  roles: StaffingRoleDefinition[] = MINIMUM_STAFFING_ROLES,
): StaffingResult {
  const known = new Set([...organizationSkillCodes].map(normalizeCode));
  const roleCodes = roles.map((role) => new Set(role.skillCodes.map(normalizeCode).filter((code) => known.has(code))));

  // One slot per required person; required roles first
  const order = roles.map((_, i) => i).sort((a, b) => Number(roles[a].optional) - Number(roles[b].optional));
  const slots: number[] = order.flatMap((roleIndex) => Array.from({length: roles[roleIndex].required}, () => roleIndex));

  const personCodes = people.map((p) => new Set(p.skillCodes.map(normalizeCode)));
  const candidates = slots.map((roleIndex) =>
    people.map((_, i) => i).filter((i) => [...roleCodes[roleIndex]].some((code) => personCodes[i].has(code))));

  const slotOfPerson = new Array<number>(people.length).fill(-1);
  const tryAssign = (slot: number, seen: boolean[]): boolean => {
    for (const person of candidates[slot]) {
      if (seen[person]) continue;
      seen[person] = true;
      if (slotOfPerson[person] === -1 || tryAssign(slotOfPerson[person], seen)) {
        slotOfPerson[person] = slot;
        return true;
      }
    }
    return false;
  };
  for (let slot = 0; slot < slots.length; slot++) tryAssign(slot, new Array<boolean>(people.length).fill(false));

  const results: StaffingRoleResult[] = roles.map((role, roleIndex) => {
    const personIds = people.filter((_, i) => slotOfPerson[i] !== -1 && slots[slotOfPerson[i]] === roleIndex).map((p) => p.id);
    return {
      key: role.key,
      label: role.label,
      singular: role.singular,
      plural: role.plural,
      required: role.required,
      optional: role.optional,
      skillCodes: role.skillCodes,
      filled: personIds.length,
      personIds,
      unknownSkillCodes: role.skillCodes.filter((code) => !known.has(normalizeCode(code))),
      met: personIds.length >= role.required,
    };
  });
  const shortfall = results
    .filter((role) => !role.optional && !role.met)
    .map((role) => ({key: role.key, missing: role.required - role.filled, singular: role.singular, plural: role.plural}));
  return {roles: results, met: shortfall.length === 0, shortfall};
}
