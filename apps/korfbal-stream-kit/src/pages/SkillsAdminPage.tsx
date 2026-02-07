import React from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ColumnDef, flexRender, getCoreRowModel, useReactTable} from '@tanstack/react-table';
import IconButton from '../components/IconButton';
import {MdAdd, MdDelete, MdEdit, MdDownload, MdUploadFile} from 'react-icons/md';
import {createUrl, extractError} from "../lib/api";

export type Skill = { id: number; code: string; name: string; nameMale: string; nameFemale: string; createdAt?: string };

function useSkills(q?: string) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  const qk = ['skills', q] as const;
  return useQuery({
    queryKey: qk,
    queryFn: async (): Promise<{ items: Skill[]; total: number }> => {
      const skillsUrl = createUrl(`/api/skills?${params.toString()}`);
      const res = await fetch(skillsUrl);
      if (!res.ok) throw new Error(await extractError(res));
      const data = await res.json();
      return Array.isArray(data) ? { items: data, total: data.length } : data;
    },
  });
}

function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { code: string; name: string; nameMale: string; nameFemale: string }) => {
      const res = await fetch(createUrl('/api/skills'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['skills'] }),
  });
}

function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; code?: string; name?: string; nameMale?: string; nameFemale?: string }) => {
      const res = await fetch(createUrl(`/api/skills/${input.id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: input.code, name: input.name, nameMale: input.nameMale, nameFemale: input.nameFemale }) });
      if (!res.ok) throw new Error(await extractError(res));
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['skills'] }),
  });
}

function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(createUrl(`/api/skills/${id}`), { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await extractError(res));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['skills'] }),
  });
}

export default function SkillsAdminPage() {
  const [q, setQ] = React.useState('');
  const { data, isLoading, error, refetch } = useSkills(q);
  const create = useCreateSkill();
  const update = useUpdateSkill();
  const del = useDeleteSkill();
  const qc = useQueryClient();

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<{ id?: number; code: string; name: string; nameMale: string; nameFemale: string } | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const columns = React.useMemo<ColumnDef<Skill>[]>(() => [
    { header: 'Code', accessorKey: 'code' },
    { header: 'Naam', accessorKey: 'name' },
    { header: 'Male', accessorKey: 'nameMale' },
    { header: 'Female', accessorKey: 'nameFemale' },
    {
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <IconButton ariaLabel="Edit skill" title="Wijzig" onClick={() => setEditing({ id: row.original.id, code: row.original.code, name: row.original.name, nameMale: row.original.nameMale, nameFemale: row.original.nameFemale })}>
            <MdEdit className="w-5 h-5" />
          </IconButton>
          <IconButton ariaLabel="Delete skill" title="Verwijder" onClick={async () => {
            setErrorMsg(null);
            try {
              await del.mutateAsync(row.original.id);
            } catch (e: any) {
              setErrorMsg(e?.message || 'Verwijderen mislukt');
            }
          }}>
            <MdDelete className="w-5 h-5 text-red-600" />
          </IconButton>
        </div>
      ),
    },
  ], [del]);

  const table = useReactTable({ data: data?.items || [], columns, getCoreRowModel: getCoreRowModel() });

  async function onSave() {
    if (!editing) return;
    const payload = { code: editing.code.toUpperCase(), name: editing.name, nameMale: editing.nameMale, nameFemale: editing.nameFemale };
    setErrorMsg(null);
    try {
      if (editing.id) {
        await update.mutateAsync({ id: editing.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      setEditing(null);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Opslaan mislukt');
    }
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch(createUrl('/api/skills/import-json'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await extractError(res));
      const result = await res.json();
      setSuccessMsg(`Geïmporteerd: ${result.created} nieuw, ${result.updated} bijgewerkt`);
      await qc.invalidateQueries({ queryKey: ['skills'] });
    } catch (e: any) {
      setErrorMsg(e?.message || 'Import mislukt');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div className="container py-6 text-gray-800 dark:text-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Skills</h1>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImport} />
          <button className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center justify-center" title="Import JSON" onClick={() => fileRef.current?.click()}>
            <MdUploadFile className="w-5 h-5" />
            <span className="sr-only">Import</span>
          </button>
          <a href="/api/skills/export-json" download className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center justify-center" title="Export JSON">
            <MdDownload className="w-5 h-5" />
            <span className="sr-only">Export</span>
          </a>
          <button className="px-3 py-1 border rounded inline-flex items-center gap-1" onClick={() => setEditing({ code: '', name: '', nameMale: '', nameFemale: '' })}>
            <MdAdd /> Nieuw
          </button>
        </div>
      </div>

      <div className="mb-3">
        <input aria-label="Search skills" value={q} onChange={(e) => setQ(e.target.value)} className="px-2 py-1 border rounded w-64 bg-white dark:bg-gray-950" placeholder="Zoek code of naam" />
      </div>

      {isLoading && <div>Laden…</div>}
      {error && <div className="text-red-600">Fout bij laden</div>}
      {successMsg && (
        <div role="status" className="mt-2 rounded-md border border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 px-3 py-2">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div role="alert" className="mt-2 rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 px-3 py-2">
          {errorMsg}
        </div>
      )}

      <table className="min-w-full border border-gray-200 dark:border-gray-800 text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th key={header.id} className="text-left p-2 border-b border-gray-200 dark:border-gray-800">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="p-2 border-b border-gray-200 dark:border-gray-800">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 p-4 rounded shadow w-[460px]">
            <h2 className="font-semibold mb-2">{editing.id ? 'Skill wijzigen' : 'Nieuwe skill'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1">Code</label>
                <input autoFocus aria-label="Skill code" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} className="px-2 py-1 border rounded w-full bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="block text-xs mb-1">Naam</label>
                <input aria-label="Skill name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="px-2 py-1 border rounded w-full bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="block text-xs mb-1">Naam (man)</label>
                <input aria-label="Skill name male" value={editing.nameMale} onChange={(e) => setEditing({ ...editing, nameMale: e.target.value })} className="px-2 py-1 border rounded w-full bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="block text-xs mb-1">Naam (vrouw)</label>
                <input aria-label="Skill name female" value={editing.nameFemale} onChange={(e) => setEditing({ ...editing, nameFemale: e.target.value })} className="px-2 py-1 border rounded w-full bg-white dark:bg-gray-950" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-1 border rounded" onClick={() => setEditing(null)}>Annuleren</button>
              <button className="px-3 py-1 border rounded bg-blue-600 text-white" onClick={onSave}>Opslaan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
