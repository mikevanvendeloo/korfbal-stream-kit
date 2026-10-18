import type {AttendanceGroup, AttendancePerson, Staffing} from '../hooks/useProductions';

/** Dutch alphabetical order, ignoring case and accents ("émile" sits with "Emma"). */
const nameCollator = new Intl.Collator('nl-NL', {sensitivity: 'base'});

export function compareNames(a: string, b: string): number {
  return nameCollator.compare(a, b);
}

export const ATTENDANCE_GROUPS: Array<{group: AttendanceGroup; label: string}> = [
  {group: 'crew', label: 'Crew'},
  {group: 'entertainment', label: 'Entertainment'},
];

/** The people per group (Crew, Entertainment), each sorted by name. */
export function groupAttendance(persons: AttendancePerson[]): Array<{group: AttendanceGroup; label: string; persons: AttendancePerson[]}> {
  return ATTENDANCE_GROUPS.map(({group, label}) => ({
    group,
    label,
    persons: persons.filter((p) => p.group === group).sort((a, b) => compareNames(a.name, b.name)),
  }));
}

/** "nog 1 camera" / "nog 1 regisseur en 2 camera's" for the roles that are short. */
export function shortfallText(shortfall: Staffing['shortfall']): string {
  const parts = shortfall.map((s) => `${s.missing} ${s.missing === 1 ? s.singular : s.plural}`);
  if (parts.length === 0) return '';
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} en ${parts[parts.length - 1]}`;
  return `nog ${list}`;
}
