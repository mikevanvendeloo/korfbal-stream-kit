import React, { useState } from 'react';
import { useManualMatches, useCreateManualMatch, useUpdateManualMatch, useDeleteManualMatch, ManualMatch, ManualMatchInput } from '../hooks/useManualMatches';
import { MdAdd, MdDelete, MdEdit } from 'react-icons/md';
import { Controller, useForm } from 'react-hook-form';
import { formatDateTime } from '../lib/time';
import DateTimeInputNL, { INVALID_DATE_TIME_MESSAGE } from '../components/DateTimeInputNL';

// date: UTC ISO, '' when empty, null while the fields hold something invalid
type MatchFormValues = Omit<ManualMatchInput, 'date'> & { date: string | null };

function MatchFormModal({ match, onSave, onCancel }: { match?: ManualMatch, onSave: (data: ManualMatchInput) => void, onCancel: () => void }) {
  const { register, control, handleSubmit, formState: { errors } } = useForm<MatchFormValues>({
    // The fields show and mean Amsterdam time, whatever the device's zone
    defaultValues: match ? { ...match } : { date: '' },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">{match ? 'Wedstrijd Bewerken' : 'Nieuwe Wedstrijd'}</h2>
        <form onSubmit={handleSubmit((data) => onSave({ ...data, date: data.date as string }))} className="space-y-4">
          <div>
            <Controller
              name="date"
              control={control}
              rules={{ validate: (v) => (v === null ? INVALID_DATE_TIME_MESSAGE : v ? true : 'Datum is verplicht.') }}
              render={({ field }) => (
                <DateTimeInputNL
                  id="manual-match"
                  value={field.value}
                  onChange={field.onChange}
                  dateLabel="Datum"
                  timeLabel="Tijd"
                  labelClassName="block text-sm font-medium"
                  inputClassName="p-2 border rounded bg-white dark:bg-gray-900"
                  required
                  describedBy={errors.date ? 'manual-match-date-error' : undefined}
                />
              )}
            />
            {errors.date && <p id="manual-match-date-error" role="alert" className="text-red-500 text-xs mt-1">{errors.date.message}</p>}
          </div>
          <div>
            <label htmlFor="manual-match-home" className="block text-sm font-medium">Thuisploeg</label>
            <input id="manual-match-home" {...register('homeTeamName', { required: true })} className="w-full p-2 border rounded bg-white dark:bg-gray-900" />
            {errors.homeTeamName && <p className="text-red-500 text-xs mt-1">Thuisploeg is verplicht.</p>}
          </div>
          <div>
            <label htmlFor="manual-match-away" className="block text-sm font-medium">Uitploeg</label>
            <input id="manual-match-away" {...register('awayTeamName', { required: true })} className="w-full p-2 border rounded bg-white dark:bg-gray-900" />
            {errors.awayTeamName && <p className="text-red-500 text-xs mt-1">Uitploeg is verplicht.</p>}
          </div>
          <div>
            <label className="block text-sm font-medium">Scheidsrechter (optioneel)</label>
            <input {...register('refereeName')} className="w-full p-2 border rounded bg-white dark:bg-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium">Beschrijving (optioneel)</label>
            <input {...register('description')} className="w-full p-2 border rounded bg-white dark:bg-gray-900" />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded border">Annuleren</button>
            <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white">Opslaan</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ManualMatchesAdminPage() {
  const { data: matches, isLoading, error } = useManualMatches();
  const createMatch = useCreateManualMatch();
  const updateMatch = useUpdateManualMatch();
  const deleteMatch = useDeleteManualMatch();
  const [editingMatch, setEditingMatch] = useState<ManualMatch | undefined>();
  const [isCreating, setIsCreating] = useState(false);

  const handleSave = async (data: ManualMatchInput) => {
    // data.date is already UTC ISO (DateTimeInputNL)
    if (editingMatch) {
      await updateMatch.mutateAsync({ ...editingMatch, ...data });
    } else {
      await createMatch.mutateAsync(data);
    }
    setEditingMatch(undefined);
    setIsCreating(false);
  };

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Handmatige Wedstrijden</h1>
        <button onClick={() => setIsCreating(true)} className="px-4 py-2 rounded bg-blue-600 text-white flex items-center gap-2">
          <MdAdd /> Nieuwe Wedstrijd
        </button>
      </div>

      {isLoading && <p>Laden...</p>}
      {error && <p className="text-red-500">Fout: {error.message}</p>}

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="p-3 text-left text-xs font-medium uppercase">Datum</th>
              <th className="p-3 text-left text-xs font-medium uppercase">Wedstrijd</th>
              <th className="p-3 text-left text-xs font-medium uppercase">Scheidsrechter</th>
              <th className="p-3 text-left text-xs font-medium uppercase">Beschrijving</th>
              <th className="p-3 text-right text-xs font-medium uppercase">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {matches?.map(match => (
              <tr key={match.id}>
                <td className="p-3">{formatDateTime(match.date)}</td>
                <td className="p-3">{match.homeTeamName} vs {match.awayTeamName}</td>
                <td className="p-3">{match.refereeName}</td>
                <td className="p-3">{match.description}</td>
                <td className="p-3 text-right">
                  <button onClick={() => setEditingMatch(match)} aria-label={`${match.homeTeamName} vs ${match.awayTeamName} bewerken`} title="Bewerken" className="p-2 text-gray-500 hover:text-gray-800"><MdEdit /></button>
                  <button onClick={() => deleteMatch.mutate(match.id)} aria-label={`${match.homeTeamName} vs ${match.awayTeamName} verwijderen`} title="Verwijderen" className="p-2 text-red-500 hover:text-red-700"><MdDelete /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(isCreating || editingMatch) && (
        <MatchFormModal
          match={editingMatch}
          onSave={handleSave}
          onCancel={() => { setIsCreating(false); setEditingMatch(undefined); }}
        />
      )}
    </div>
  );
}
