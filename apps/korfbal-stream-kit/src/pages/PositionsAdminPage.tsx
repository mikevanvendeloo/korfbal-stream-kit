import React from 'react';
import {useCreatePosition, useDeletePosition, usePositionsCatalog, useUpdatePosition} from '../hooks/usePositions';
import {useQuery} from '@tanstack/react-query';
import IconButton from '../components/IconButton';
import {MdAdd, MdDelete, MdEdit} from 'react-icons/md';
import {extractError} from "../lib/api";

type Skill = { id: number; code: string; name: string };

function useAllSkills() {
  return useQuery({
    queryKey: ['skills', 'all'],
    queryFn: async (): Promise<Skill[]> => {
      // Backend skills endpoint limits page size to 200 via schema; request max allowed
      const res = await fetch('/api/skills?limit=200&page=1');
      if (!res.ok) throw new Error(await extractError(res));
      const data = await res.json();
      return Array.isArray(data) ? data : data.items;
    },
  });
}

export default function PositionsAdminPage() {
  const { data: positions, isLoading, error } = usePositionsCatalog();
  const { data: skills } = useAllSkills();
  const create = useCreatePosition();
  const update = useUpdatePosition();
  const del = useDeletePosition();

  const [err, setErr] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<null | { id?: number; name: string; skillId: number | null }>(null);

  async function handleSave() {
    if (!editing) return;
    setErr(null);
    try {
      if (editing.id) {
        await update.mutateAsync({ id: editing.id, name: editing.name, skillId: editing.skillId });
      } else {
        await create.mutateAsync({ name: editing.name, skillId: editing.skillId });
      }
      setEditing(null);
    } catch (e: any) {
      setErr(e?.message || 'Opslaan mislukt');
    }
  }

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Posities & taken</h1>
        <button className="px-3 py-1 border rounded inline-flex items-center gap-1" onClick={() => setEditing({ name: '', skillId: null })}>
          <MdAdd /> Nieuwe positie
        </button>
      </div>

      {err && <div role="alert" className="mb-3 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2">{err}</div>}
      {error && <div role="alert" className="mb-3 text-sm text-red-600">{(error as any)?.message}</div>}

      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left border-b border-gray-200 dark:border-gray-800">
            <th className="py-2 pr-3">Naam</th>
            <th className="py-2 pr-3">Skill</th>
            <th className="py-2">Acties</th>
          </tr>
        </thead>
        <tbody>
          {(positions || []).map((p) => (
            <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2 pr-3">{p.name}</td>
              <td className="py-2 pr-3">{p.skill ? `${p.skill.code} — ${p.skill.name}` : <span className="text-gray-400">—</span>}</td>
              <td className="py-2">
                <div className="flex gap-2">
                  <IconButton ariaLabel="Wijzig" title="Wijzig" onClick={() => setEditing({ id: p.id, name: p.name, skillId: p.skill?.id ?? null })}>
                    <MdEdit className="w-5 h-5" />
                  </IconButton>
                  <IconButton ariaLabel="Verwijder" title="Verwijder" onClick={async () => {
                    setErr(null);
                    try {
                      await del.mutateAsync(p.id);
                    } catch (e: any) {
                      setErr(e?.message || 'Verwijderen mislukt');
                    }
                  }}>
                    <MdDelete className="w-5 h-5 text-red-600" />
                  </IconButton>
                </div>
              </td>
            </tr>
          ))}
          {(!positions || positions.length === 0) && !isLoading && (
            <tr>
              <td colSpan={3} className="py-3 text-gray-500">Geen posities</td>
            </tr>
          )}
        </tbody>
      </table>

      {editing && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 p-4 w-full max-w-lg">
            <h2 className="font-semibold mb-3">{editing.id ? 'Positie wijzigen' : 'Nieuwe positie'}</h2>
            <div className="space-y-3">
              <label className="block text-sm">
                <div className="mb-1">Naam</div>
                <input className="w-full border rounded px-2 py-1" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </label>
              <label className="block text-sm">
                <div className="mb-1">Skill</div>
                <select className="w-full border rounded px-2 py-1" value={editing.skillId ?? ''} onChange={(e) => setEditing({ ...editing, skillId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">— geen —</option>
                  {(skills || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="px-3 py-1 border rounded" onClick={() => setEditing(null)}>Annuleer</button>
              <button className="px-3 py-1 border rounded bg-blue-600 text-white" onClick={handleSave}>Opslaan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
