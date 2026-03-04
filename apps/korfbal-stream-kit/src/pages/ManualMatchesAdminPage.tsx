import React, { useState } from 'react';
import { useManualMatches, useCreateManualMatch, useUpdateManualMatch, useDeleteManualMatch, ManualMatch, ManualMatchInput } from '../hooks/useManualMatches';
import { MdAdd, MdDelete, MdEdit } from 'react-icons/md';
import { useForm } from 'react-hook-form';

function MatchFormModal({ match, onSave, onCancel }: { match?: ManualMatch, onSave: (data: ManualMatchInput) => void, onCancel: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<ManualMatchInput>({
    defaultValues: match ? { ...match, date: match.date.substring(0, 16) } : {},
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">{match ? 'Wedstrijd Bewerken' : 'Nieuwe Wedstrijd'}</h2>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Datum & Tijd</label>
            <input type="datetime-local" {...register('date', { required: true })} className="w-full p-2 border rounded bg-white dark:bg-gray-900" />
            {errors.date && <p className="text-red-500 text-xs mt-1">Datum is verplicht.</p>}
          </div>
          <div>
            <label className="block text-sm font-medium">Thuisploeg</label>
            <input {...register('homeTeamName', { required: true })} className="w-full p-2 border rounded bg-white dark:bg-gray-900" />
            {errors.homeTeamName && <p className="text-red-500 text-xs mt-1">Thuisploeg is verplicht.</p>}
          </div>
          <div>
            <label className="block text-sm font-medium">Uitploeg</label>
            <input {...register('awayTeamName', { required: true })} className="w-full p-2 border rounded bg-white dark:bg-gray-900" />
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
    const payload = {
      ...data,
      date: new Date(data.date).toISOString(),
    };

    if (editingMatch) {
      await updateMatch.mutateAsync({ ...editingMatch, ...payload });
    } else {
      await createMatch.mutateAsync(payload);
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
                <td className="p-3">{new Date(match.date).toLocaleString('nl-NL')}</td>
                <td className="p-3">{match.homeTeamName} vs {match.awayTeamName}</td>
                <td className="p-3">{match.refereeName}</td>
                <td className="p-3">{match.description}</td>
                <td className="p-3 text-right">
                  <button onClick={() => setEditingMatch(match)} className="p-2 text-gray-500 hover:text-gray-800"><MdEdit /></button>
                  <button onClick={() => deleteMatch.mutate(match.id)} className="p-2 text-red-500 hover:text-red-700"><MdDelete /></button>
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
