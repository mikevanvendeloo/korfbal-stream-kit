import type {ReportSponsor} from '../hooks/useProductionReport';

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

/** Same rule as the API (services/reportSponsors.ts): the name, else the display name, ignoring case. */
export function findSponsorByName(name: string, sponsors: ReportSponsor[]): ReportSponsor | undefined {
  if (!name.trim()) return undefined;
  const wanted = normalize(name);
  return sponsors.find((s) => normalize(s.name) === wanted)
    ?? sponsors.find((s) => s.displayName && normalize(s.displayName) === wanted);
}

export const sponsorLogoSrc = (sponsor: ReportSponsor | undefined) =>
  sponsor?.logoUrl ? `/uploads/sponsors/${sponsor.logoUrl}` : null;

/** Pick a sponsor from the list or type a name; a name that matches a sponsor shows its logo. */
export default function SponsorField({id, label, value, onChange, sponsors}: {
  id: string; label: string; value: string; onChange: (value: string) => void; sponsors: ReportSponsor[];
}) {
  const sponsor = findSponsorByName(value, sponsors);
  const logo = sponsorLogoSrc(sponsor);

  return (
    <div className="border rounded p-4 dark:border-gray-700">
      <label htmlFor={id} className="block text-sm font-medium mb-2">{label}:</label>
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">
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
        <div className="w-36 h-20 shrink-0 rounded border border-gray-200 dark:border-gray-700 bg-white flex items-center justify-center p-2">
          {logo ? (
            <img src={logo} alt={`Logo ${sponsor?.name}`} className="max-h-full max-w-full object-contain"
                 onError={(e) => ((e.currentTarget.style.visibility = 'hidden'))}/>
          ) : (
            <span className="text-xs text-gray-400 text-center">{value.trim() ? 'Geen logo' : 'Geen sponsor'}</span>
          )}
        </div>
      </div>
    </div>
  );
}
