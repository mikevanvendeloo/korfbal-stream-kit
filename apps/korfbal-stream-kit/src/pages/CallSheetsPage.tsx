import React from 'react';
import {Link, useParams} from 'react-router-dom';
import {useCallSheets, useCreateCallSheet, useDeleteCallSheet} from '../hooks/useCallsheet';

export default function CallSheetsPage() {
  const params = useParams<{ id: string }>();
  const productionId = Number(params.id);
  const { data, isLoading, error } = useCallSheets(productionId);
  const createCS = useCreateCallSheet(productionId);
  const delCS = useDeleteCallSheet(productionId);

  const [name, setName] = React.useState('Callsheet');
  const [color, setColor] = React.useState<string>('');
  const [err, setErr] = React.useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await createCS.mutateAsync({ name, color: color || null });
      setName('Callsheet');
      setColor('');
    } catch (e: any) {
      setErr(e?.message || 'Aanmaken mislukt');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Callsheet verwijderen?')) return;
    setErr(null);
    try {
      await delCS.mutateAsync(id);
    } catch (e: any) {
      setErr(e?.message || 'Verwijderen mislukt');
    }
  }

  if (!productionId) return <div className="container py-6">Invalid production id</div>;
  if (isLoading) return <div className="container py-6">Laden…</div>;
  if (error) return <div className="container py-6 text-red-700">{String((error as any)?.message || error)}</div>;

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Callsheets</h1>
        <Link className="underline" to={`/admin/productions/${productionId}`}>Terug naar productie</Link>
      </div>

      <form onSubmit={handleCreate} className="mb-4 flex gap-2 items-end">
        <label className="text-sm">
          <div className="mb-1">Naam</div>
          <input value={name} onChange={(e) => setName(e.target.value)} className="border rounded px-2 py-1" required />
        </label>
        <label className="text-sm">
          <div className="mb-1">Kleur</div>
          <input value={color} onChange={(e) => setColor(e.target.value)} className="border rounded px-2 py-1" placeholder="#ff9900" />
        </label>
        <button className="px-3 py-2 rounded bg-blue-600 text-white" type="submit" disabled={createCS.isPending}>Nieuw</button>
      </form>
      {err && <div className="mb-3 text-red-700">{err}</div>}

      <div className="border rounded divide-y">
        {data?.map((cs) => (
          <div key={cs.id} className="p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{cs.name}</div>
              {cs.color && <div className="text-sm text-gray-500">{cs.color}</div>}
            </div>
            <div className="flex gap-3 items-center">
              <Link className="underline" to={`/admin/productions/${productionId}/callsheets/${cs.id}`}>Open</Link>
              <button className="text-red-700 underline" onClick={() => handleDelete(cs.id)}>Verwijder</button>
            </div>
          </div>
        ))}
        {!data?.length && <div className="p-3 text-gray-600">Geen callsheets</div>}
      </div>
    </div>
  );
}
