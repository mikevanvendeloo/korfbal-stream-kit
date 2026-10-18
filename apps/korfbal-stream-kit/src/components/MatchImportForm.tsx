import React from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {importMatchSchedule, MatchImportError, MatchScheduleImportSeasonCount} from '../lib/api';
import {formatDateNL} from './DateInputNL';

/** The default range: counted by the source from the current week (keep in sync with the API's DEFAULT_IMPORT_RANGE). */
export const DEFAULT_IMPORT_RANGE = '30-weeks';

const inputClass = 'w-full sm:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50';
const buttonClass = 'px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed';

/** "12 wedstrijden in 2026/2027, 3 in 2025/2026" */
export function formatMatchImportBySeason(bySeason: MatchScheduleImportSeasonCount[]): string {
  if (bySeason.length === 0) return 'Geen wedstrijden gevonden';
  return bySeason
    .map((s, i) => (i === 0 ? `${s.count} ${s.count === 1 ? 'wedstrijd' : 'wedstrijden'} in ${s.name}` : `${s.count} in ${s.name}`))
    .join(', ');
}

/** A failed match import or connection test: what went wrong, and what to do (the API's hint). */
export function MatchImportErrorMessage({error, prefix}: { error: unknown; prefix?: string }) {
  const message = error instanceof Error ? error.message : 'Onbekende fout';
  const hint = error instanceof MatchImportError ? error.hint : undefined;
  return (
    <div role="alert" className="text-sm text-red-700 dark:text-red-300 min-w-0" data-testid="match-import-error">
      <p className="font-medium break-words">{prefix ? `${prefix}: ` : ''}{message}</p>
      {hint && <p className="mt-1 text-red-600 dark:text-red-400 break-words" data-testid="match-import-hint">{hint}</p>}
    </div>
  );
}

function formatDayLong(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? formatDateNL(iso) : d.toLocaleDateString('nl-NL', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam'});
}

type Props = {
  /** Start of the indoor competition of the active season (YYYY-MM-DD), or null when not set */
  indoorStartDate: string | null;
  /** Called after a successful import */
  onImported?: () => void;
};

/**
 * "Wedstrijden importeren": from the start of the indoor competition (date=indoor, resolved by the API
 * from the active season) or from a date or range the user types (DD-MM-JJJJ or 30-weeks).
 */
export default function MatchImportForm({indoorStartDate, onImported}: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = React.useState<'indoor' | 'custom'>(indoorStartDate ? 'indoor' : 'custom');
  const [date, setDate] = React.useState(DEFAULT_IMPORT_RANGE);
  const id = React.useId();

  // The start date can be set or cleared while the form is open
  React.useEffect(() => {
    if (!indoorStartDate) setMode('custom');
  }, [indoorStartDate]);

  const importMatches = useMutation({
    mutationFn: () => importMatchSchedule({date: mode === 'indoor' ? 'indoor' : date.trim() || DEFAULT_IMPORT_RANGE}),
    onSuccess: async () => {
      await qc.invalidateQueries();
      onImported?.();
    },
  });

  return (
    <div className="space-y-3 min-w-0" data-testid="match-import">
      <fieldset className="space-y-2 min-w-0">
        <legend className="sr-only">Wat importeren</legend>
        <label className={`flex items-start gap-2 text-sm ${indoorStartDate ? 'cursor-pointer' : 'opacity-60'}`}>
          <input type="radio" name={`${id}-mode`} className="mt-1" checked={mode === 'indoor'} disabled={!indoorStartDate}
                 onChange={() => setMode('indoor')}/>
          <span className="min-w-0">
            <span className="text-gray-800 dark:text-gray-100">
              Zaalcompetitie{indoorStartDate ? ` (vanaf ${formatDayLong(indoorStartDate)})` : ''}
            </span>
            {!indoorStartDate && (
              <span className="block text-xs text-amber-700 dark:text-amber-300" data-testid="indoor-start-missing">
                Stel de startdatum van de zaalcompetitie in bij Seizoenen
              </span>
            )}
          </span>
        </label>
        <div className="flex items-start gap-2 text-sm">
          <input id={`${id}-custom`} type="radio" name={`${id}-mode`} className="mt-1" checked={mode === 'custom'} onChange={() => setMode('custom')}/>
          <div className="min-w-0 flex-1">
            <label htmlFor={`${id}-date`} className="text-gray-800 dark:text-gray-100">Vanaf datum of periode</label>
            <input id={`${id}-date`} type="text" autoComplete="off" className={`${inputClass} mt-1 block`} value={date}
                   placeholder="DD-MM-JJJJ of 30-weeks" aria-describedby={`${id}-date-help`}
                   onFocus={() => setMode('custom')} onChange={(e) => setDate(e.target.value)}/>
            <p id={`${id}-date-help`} className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Een dag als <strong>DD-MM-JJJJ</strong> (bijvoorbeeld 07-11-2026) haalt alles op vanaf die dag tot het einde van het
              gepubliceerde programma. Een periode als <strong>30-weeks</strong> telt vanaf deze week (alleen weken).
            </p>
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
        <button type="button" onClick={() => importMatches.mutate()} disabled={importMatches.isPending} className={buttonClass}>
          {importMatches.isPending ? 'Importeren...' : 'Wedstrijden importeren'}
        </button>
        <div className="text-sm min-w-0" aria-live="polite">
          {importMatches.isSuccess && (
            <span className="text-green-700 dark:text-green-300" data-testid="match-import-result">
              {formatMatchImportBySeason(importMatches.data.bySeason ?? [])} ({importMatches.data.inserted} nieuw, {importMatches.data.updated} bijgewerkt)
            </span>
          )}
          {importMatches.isError && <MatchImportErrorMessage error={importMatches.error} prefix="Import mislukt"/>}
          {!importMatches.isSuccess && !importMatches.isError && (
            <span className="text-gray-500 dark:text-gray-400">Wedstrijden komen in het seizoen van hun speeldatum.</span>
          )}
        </div>
      </div>
    </div>
  );
}
