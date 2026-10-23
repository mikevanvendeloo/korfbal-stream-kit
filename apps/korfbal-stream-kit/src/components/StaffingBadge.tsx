import type {StaffingSummary} from '../hooks/useProductions';
import {shortfallText} from '../lib/attendance';
import {adminPaths} from '../lib/adminPaths';

/** "Regisseur: 1/1 ✓" per role, for the tooltip. */
export function staffingChecklist(staffing: StaffingSummary): string {
  return staffing.roles
    .map((role) => `${role.label}${role.optional ? ' (optioneel)' : ''}: ${role.filled}/${role.required} ${role.met ? '✓' : '✗'}`)
    .join('\n');
}

/**
 * The Bezetting column of Beheer → Producties: whether the people marked present fill the minimum
 * staffing, linking to the production's Beschikbaarheid tab. Truncates, so it never widens the page.
 */
export default function StaffingBadge({productionId, staffing}: { productionId: number; staffing?: StaffingSummary }) {
  if (!staffing) return null;
  const nobody = staffing.presentCount === 0;
  const text = nobody ? 'Nog niemand aanwezig' : staffing.met ? '✓ Gehaald' : `✗ ${shortfallText(staffing.shortfall)}`;
  const tone = nobody
    ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
    : staffing.met
      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
      : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200';
  const title = `${staffing.presentCount} aanwezig — minimale bezetting ${staffing.met ? 'gehaald' : 'nog niet gehaald'}\n${staffingChecklist(staffing)}`;

  return (
    <a href={adminPaths.production(productionId, 'beschikbaarheid')}
       data-testid={`staffing-${productionId}`}
       title={title}
       aria-label={`Bezetting: ${text}. Naar Beschikbaarheid`}
       className={`inline-block max-w-[9rem] sm:max-w-[16rem] truncate align-middle text-xs px-2 py-0.5 rounded hover:underline ${tone}`}>
      {text}
    </a>
  );
}
