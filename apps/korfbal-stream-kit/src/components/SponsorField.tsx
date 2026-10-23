import type {ReportSponsor} from '../hooks/useProductionReport';
import FallbackImage from './FallbackImage';

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

/** Same rule as the API (services/reportSponsors.ts): the name, else the display name, ignoring case. */
export function findSponsorByName(name: string, sponsors: ReportSponsor[]): ReportSponsor | undefined {
  if (!name.trim()) return undefined;
  const wanted = normalize(name);
  return sponsors.find((s) => normalize(s.name) === wanted)
    ?? sponsors.find((s) => s.displayName && normalize(s.displayName) === wanted);
}

/** The URL of a sponsor logo: `logoSrc` from the API (the directory follows from the organization's slug). */
export const sponsorLogoSrc = (sponsor: Pick<ReportSponsor, 'logoSrc'> | undefined) => sponsor?.logoSrc || null;

const placeholder = (text: string) => <span className="text-xs text-gray-400 print:text-gray-600 text-center">{text}</span>;

/**
 * Pick a sponsor from the list or type a name; a name that matches a sponsor shows its logo.
 * Printed (Ctrl/Cmd+P) it shows the name as text and the logo, without the form fields.
 */
export default function SponsorField({id, label, value, onChange, sponsors}: {
  id: string; label: string; value: string; onChange: (value: string) => void; sponsors: ReportSponsor[];
}) {
  const sponsor = findSponsorByName(value, sponsors);
  const logo = sponsorLogoSrc(sponsor);

  return (
    <div className="border rounded p-4 dark:border-gray-700 print:border-gray-300 break-inside-avoid">
      <label htmlFor={id} className="block text-sm font-medium mb-2">{label}:</label>
      <div className="flex gap-4 items-start">
        <div data-testid={`${id}-print-name`} className="hidden print:block flex-1 min-w-0 break-words">{value.trim() || '—'}</div>
        <div className="flex-1 min-w-0 print:hidden">
          <select
            id={id}
            value={sponsor?.name ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-700"
          >
            <option value="">-- Selecteer een sponsor of typ hieronder --</option>
            {sponsors.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          <input
            type="text"
            aria-label={`${label} (vrije tekst)`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full mt-2 px-3 py-2 border rounded dark:bg-gray-900 dark:border-gray-700"
            placeholder="Of typ hier een vrije tekst sponsor naam"
          />
        </div>
        <div data-testid={`${id}-logo`}
             className="w-36 h-20 shrink-0 rounded border border-gray-200 dark:border-gray-700 print:border-gray-300 bg-white flex items-center justify-center p-2">
          {logo ? (
            <FallbackImage src={logo} alt={`Logo ${sponsor?.name}`} className="max-h-full max-w-full object-contain"
                           fallback={placeholder('Logo niet gevonden')}/>
          ) : (
            placeholder(value.trim() ? 'Geen logo' : 'Geen sponsor')
          )}
        </div>
      </div>
    </div>
  );
}
