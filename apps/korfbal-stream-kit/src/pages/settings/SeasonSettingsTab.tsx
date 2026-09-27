import React, {useEffect, useState} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {
  SeasonDto,
  useCreateSeason,
  useDeleteSeason,
  useSeasons,
  useSetActiveSeason,
  useSuggestNextSeason,
  validateSeasonName,
} from '../../hooks/useSeasons';
import {useImportLeagueTeams} from '../../hooks/useClubs';
import {importMatchSchedule, MatchScheduleImportSeasonCount} from '../../lib/api';

const cardClass = 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700';
const cardTitleClass = 'text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 border-b border-gray-100 dark:border-gray-700 pb-2';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100';
const primaryButtonClass = 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed';
const secondaryButtonClass = 'px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed';
const errorClass = 'p-3 bg-red-50 border border-red-200 text-red-700 rounded dark:bg-red-900/30 dark:border-red-800 dark:text-red-300';
const successClass = 'p-3 bg-green-50 border border-green-200 text-green-700 rounded dark:bg-green-900/30 dark:border-green-800 dark:text-green-300';

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('nl-NL', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam'});
}

function countsLabel(s: SeasonDto) {
  return `${s.matchCount} wedstrijden, ${s.playerCount} spelers`;
}

function deleteBlockedReason(s: SeasonDto): string | null {
  if (s.isActive) return 'Het actieve seizoen kan niet verwijderd worden';
  if (s.matchCount > 0 || s.playerCount > 0) return 'Seizoen bevat nog wedstrijden of spelers';
  return null;
}

function ActiveSeasonSection({seasons}: { seasons: SeasonDto[] }) {
  const current = seasons.find(s => s.isActive) ?? null;
  const [selectedId, setSelectedId] = useState<number | null>(current?.id ?? null);
  const [success, setSuccess] = useState<string | null>(null);
  const setActive = useSetActiveSeason();

  // Follow the server's active season when it changes (e.g. after creating + activating a season)
  useEffect(() => {
    setSelectedId(current?.id ?? null);
  }, [current?.id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (selectedId == null) return;
    setSuccess(null);
    try {
      const season = await setActive.mutateAsync(selectedId);
      setSuccess(`Seizoen ${season.name} is nu actief`);
    } catch {
      // error shown via mutation state
    }
  }

  return (
    <section className={cardClass}>
      <h2 className={cardTitleClass}>Actief seizoen</h2>
      <form onSubmit={handleSave} className="space-y-4">
        {setActive.isError && <div className={errorClass}>Opslaan mislukt: {(setActive.error as Error).message}</div>}
        {success && <div className={successClass}>{success}</div>}
        <div>
          <label htmlFor="activeSeasonId" className={labelClass}>Seizoen</label>
          <select
            id="activeSeasonId"
            className={inputClass}
            value={selectedId ?? ''}
            onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
          >
            {selectedId == null && <option value="">Kies een seizoen</option>}
            {seasons.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({countsLabel(s)}){s.isActive ? ' – actief' : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Wedstrijden, producties en spelers worden getoond voor het actieve seizoen.
          </p>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={setActive.isPending || selectedId == null || selectedId === current?.id}
            className={primaryButtonClass}
          >
            {setActive.isPending ? 'Opslaan...' : 'Actief seizoen opslaan'}
          </button>
        </div>
      </form>
    </section>
  );
}

function SeasonListSection({seasons}: { seasons: SeasonDto[] }) {
  const del = useDeleteSeason();
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(s: SeasonDto) {
    if (!window.confirm(`Seizoen ${s.name} verwijderen?`)) return;
    setError(null);
    try {
      await del.mutateAsync(s.id);
    } catch (err) {
      setError(`Verwijderen mislukt: ${err instanceof Error ? err.message : 'onbekende fout'}`);
    }
  }

  return (
    <section className={cardClass}>
      <h2 className={cardTitleClass}>Seizoenen</h2>
      {error && <div className={`${errorClass} mb-4`}>{error}</div>}
      {seasons.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Nog geen seizoenen.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="py-2 pr-4 font-medium">Seizoen</th>
                <th className="py-2 pr-4 font-medium">Periode</th>
                <th className="py-2 pr-4 font-medium text-right">Wedstrijden</th>
                <th className="py-2 pr-4 font-medium text-right">Spelers</th>
                <th className="py-2 font-medium sr-only">Acties</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map(s => {
                const blocked = deleteBlockedReason(s);
                return (
                  <tr key={s.id} data-testid={`season-row-${s.id}`} className="border-b border-gray-100 dark:border-gray-700 last:border-0 text-gray-800 dark:text-gray-200">
                    <td className="py-2 pr-4 font-medium">
                      <span className="inline-flex items-center gap-2">
                        {s.name}
                        {s.isActive && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">Actief</span>
                        )}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{formatDate(s.startDate)} – {formatDate(s.endDate)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{s.matchCount}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{s.playerCount}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(s)}
                        disabled={!!blocked || del.isPending}
                        title={blocked ?? `Seizoen ${s.name} verwijderen`}
                        aria-label={`Verwijder seizoen ${s.name}`}
                        className="px-3 py-1 text-sm rounded-md border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        Verwijderen
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function NewSeasonSection({onCreated}: { onCreated: (s: SeasonDto) => void }) {
  const suggest = useSuggestNextSeason();
  const create = useCreateSeason();
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [activate, setActivate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<SeasonDto | null>(null);

  // Prefill with the suggested next season until the user types something
  useEffect(() => {
    if (!touched && suggest.data?.name) setName(suggest.data.name);
  }, [suggest.data?.name, touched]);

  const validationError = touched ? validateSeasonName(name) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const invalid = validateSeasonName(name);
    if (invalid) return;
    setError(null);
    setCreated(null);
    try {
      const season = await create.mutateAsync({name: name.trim(), activate});
      setTouched(false);
      setCreated(season);
      onCreated(season);
    } catch (err) {
      setError(`Aanmaken mislukt: ${err instanceof Error ? err.message : 'onbekende fout'}`);
    }
  }

  return (
    <section className={cardClass}>
      <h2 className={cardTitleClass}>Nieuw seizoen</h2>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && <div className={errorClass}>{error}</div>}
        {created && !created.isActive && (
          <div className={successClass}>
            Seizoen {created.name} aangemaakt. Het is nog niet actief: maak het hierboven actief om het te vullen.
          </div>
        )}
        <div>
          <label htmlFor="newSeasonName" className={labelClass}>Naam</label>
          <input
            id="newSeasonName"
            type="text"
            inputMode="numeric"
            placeholder="2026/2027"
            className={inputClass}
            value={name}
            aria-invalid={!!validationError}
            aria-describedby="newSeasonNameHelp"
            onChange={(e) => {
              setTouched(true);
              setName(e.target.value);
            }}
          />
          {validationError ? (
            <p id="newSeasonNameHelp" role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{validationError}</p>
          ) : (
            <p id="newSeasonNameHelp" className="mt-1 text-xs text-gray-500 dark:text-gray-400">Een seizoen loopt van 1 juli tot en met 30 juni.</p>
          )}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={activate}
            onChange={(e) => setActivate(e.target.checked)}
          />
          <span className="text-gray-700 dark:text-gray-300">Direct activeren</span>
        </label>
        <div className="flex justify-end">
          <button type="submit" disabled={create.isPending} className={primaryButtonClass}>
            {create.isPending ? 'Aanmaken...' : 'Seizoen aanmaken'}
          </button>
        </div>
      </form>
    </section>
  );
}

/** "12 wedstrijden in 2026/2027, 3 in 2025/2026" */
function formatMatchImportBySeason(bySeason: MatchScheduleImportSeasonCount[]): string {
  if (bySeason.length === 0) return 'Geen wedstrijden gevonden';
  return bySeason
    .map((s, i) => (i === 0 ? `${s.count} ${s.count === 1 ? 'wedstrijd' : 'wedstrijden'} in ${s.name}` : `${s.count} in ${s.name}`))
    .join(', ');
}

function hasNotStarted(season: SeasonDto, now = new Date()) {
  const start = new Date(season.startDate);
  return !Number.isNaN(start.getTime()) && now < start;
}

/**
 * Import actions for the active season. Always rendered with live data from useSeasons; remounted
 * (via `key`) when the active season changes so results of a previous season never linger.
 */
function FillSeasonSection({season, justCreated}: { season: SeasonDto; justCreated: boolean }) {
  const qc = useQueryClient();
  const importMatches = useMutation({
    mutationFn: () => importMatchSchedule(),
    onSuccess: () => qc.invalidateQueries(),
  });
  const importTeams = useImportLeagueTeams();
  const sectionClass = justCreated
    ? 'p-6 rounded-lg border-2 border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700'
    : cardClass;

  return (
    <section className={sectionClass} aria-labelledby="fillSeasonTitle" data-testid="fill-season">
      <h2 id="fillSeasonTitle" className={cardTitleClass}>Seizoen vullen</h2>
      {justCreated ? (
        <p className="mb-4 text-sm text-gray-700 dark:text-gray-200">
          <strong>Seizoen {season.name} gestart.</strong> Dit seizoen is nu actief. Vul het met wedstrijden en spelers:
        </p>
      ) : (
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Importeer wedstrijden en spelers voor het actieve seizoen <strong>{season.name}</strong> ({countsLabel(season)}).
        </p>
      )}

      <ol className="space-y-4">
        <li className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              onClick={() => importMatches.mutate()}
              disabled={importMatches.isPending}
              className={secondaryButtonClass}
            >
              {importMatches.isPending ? 'Importeren...' : 'Wedstrijden importeren'}
            </button>
            <div className="text-sm" aria-live="polite">
              {importMatches.isSuccess && (
                <span className="text-green-700 dark:text-green-300">
                  {formatMatchImportBySeason(importMatches.data.bySeason ?? [])} ({importMatches.data.inserted} nieuw, {importMatches.data.updated} bijgewerkt)
                </span>
              )}
              {importMatches.isError && (
                <span className="text-red-700 dark:text-red-300">Import mislukt: {(importMatches.error as Error).message}</span>
              )}
              {!importMatches.isSuccess && !importMatches.isError && (
                <span className="text-gray-500 dark:text-gray-400">Wedstrijden komen in het seizoen van hun speeldatum.</span>
              )}
            </div>
          </div>
          {hasNotStarted(season) && (
            <p className="text-xs text-amber-700 dark:text-amber-300" data-testid="season-not-started-hint">
              Seizoen {season.name} begint pas op {formatDate(season.startDate)}. Het wedstrijdprogramma wordt tot ongeveer
              20 weken vooruit vanaf vandaag geïmporteerd, dus wedstrijden van dit seizoen komen mogelijk pas later binnen.
            </p>
          )}
        </li>
        <li className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={() => importTeams.mutate({seasonId: season.id})}
            disabled={importTeams.isPending}
            className={secondaryButtonClass}
          >
            {importTeams.isPending ? 'Importeren...' : 'Teams/spelers importeren'}
          </button>
          <div className="text-sm" aria-live="polite">
            {importTeams.isSuccess && (
              <span className="text-green-700 dark:text-green-300">
                Clubs: {importTeams.data.clubsCreated} nieuw, {importTeams.data.clubsUpdated} bijgewerkt · Spelers: {importTeams.data.playersCreated} nieuw, {importTeams.data.playersUpdated} bijgewerkt
              </span>
            )}
            {importTeams.isError && (
              <span className="text-red-700 dark:text-red-300">Import mislukt: {(importTeams.error as Error).message}</span>
            )}
            {!importTeams.isSuccess && !importTeams.isError && (
              <span className="text-gray-500 dark:text-gray-400">Spelers worden opgeslagen in seizoen {season.name}.</span>
            )}
          </div>
        </li>
      </ol>
      {importTeams.isSuccess && importTeams.data.problems && importTeams.data.problems.length > 0 && (
        <ul className="mt-3 list-disc list-inside text-xs text-amber-700 dark:text-amber-300">
          {importTeams.data.problems.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      )}
    </section>
  );
}

export default function SeasonSettingsTab() {
  const {data: seasons, isLoading, isError, error} = useSeasons();
  const [createdSeasonId, setCreatedSeasonId] = useState<number | null>(null);

  if (isLoading) return <div className="p-6 text-gray-600 dark:text-gray-300">Laden...</div>;
  if (isError) return <div className={errorClass}>Seizoenen laden mislukt: {(error as Error).message}</div>;

  const list = seasons ?? [];
  const active = list.find(s => s.isActive) ?? null;

  return (
    <div className="space-y-8">
      <ActiveSeasonSection seasons={list} />
      {active && <FillSeasonSection key={active.id} season={active} justCreated={active.id === createdSeasonId} />}
      <NewSeasonSection onCreated={(s) => setCreatedSeasonId(s.id)} />
      <SeasonListSection seasons={list} />
    </div>
  );
}
